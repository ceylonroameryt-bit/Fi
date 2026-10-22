import { Injectable } from '@nestjs/common';
import {
  BankTransactionStatus,
  JournalSourceType,
  JournalStatus,
  JournalType,
  Prisma,
  TaxDirection,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { JournalsService } from '../journals/journals.service';
import { JournalValidationService } from '../accounting-engine/journal-validation.service';
import { JournalPostingService } from '../accounting-engine/journal-posting.service';
import { AuditService } from '../audit/audit.service';
import { AuditEvents } from '../audit/audit-events';
import { DomainException } from '../common/errors/domain.exception';
import type { Actor, OrgContext } from '../common/types/request-context.types';
import { MatchTransactionDto, QuickCreateTransactionDto } from './dto/reconcile-transaction.dto';
import { lockRows } from '../payments/allocation-rules';
import { MoneyService } from '../accounting-engine/money.service';
import { TaxCodesService } from '../tax/tax-codes.service';
import { calculateVat, SELF_ACCOUNTED_TREATMENTS } from '../tax/vat-calculation';
import { INPUT_ONLY_TREATMENTS } from '../tax/vat-boxes';

/** Statement lines that are still open for reconciliation. */
const OPEN_STATUSES: BankTransactionStatus[] = [BankTransactionStatus.UNMATCHED, BankTransactionStatus.CATEGORISED];

@Injectable()
export class BankReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journals: JournalsService,
    private readonly validator: JournalValidationService,
    private readonly posting: JournalPostingService,
    private readonly audit: AuditService,
    private readonly money: MoneyService,
    private readonly taxCodes: TaxCodesService,
  ) {}

  async getSuggestions(organizationId: string, statementLineId: string) {
    const line = await this.prisma.bankStatementLine.findFirst({
      where: { id: statementLineId, organizationId },
      include: {
        bankAccount: true,
      },
    });

    if (!line) {
      throw new DomainException('BANK_TRANSACTION_NOT_FOUND', 'Statement transaction line not found');
    }

    const absAmount = new Prisma.Decimal(line.amount).abs();
    const targetDate = line.transactionDate;
    const windowStart = new Date(targetDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    const windowEnd = new Date(targetDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    // 1. Search for matching payments with exact amount within +/- 7 days
    const candidatePayments = await this.prisma.payment.findMany({
      where: {
        organizationId,
        amount: absAmount,
        paymentDate: { gte: windowStart, lte: windowEnd },
        status: 'POSTED',
      },
      include: {
        contact: { select: { id: true, name: true } },
      },
      take: 5,
    });

    // 2. Search for matching journal lines on the bank account's nominal account
    const candidateJournalLines = await this.prisma.journalLine.findMany({
      where: {
        organizationId,
        accountId: line.bankAccount.nominalAccountId,
        journalEntry: {
          status: JournalStatus.POSTED,
          postingDate: { gte: windowStart, lte: windowEnd },
        },
        OR: [
          { debit: absAmount },
          { credit: absAmount },
        ],
      },
      include: {
        journalEntry: {
          select: { id: true, journalNumber: true, postingDate: true, description: true },
        },
      },
      take: 5,
    });

    return {
      line,
      candidatePayments,
      candidateJournalLines,
    };
  }

  async matchTransaction(
    organizationId: string,
    statementLineId: string,
    dto: MatchTransactionDto,
    actor: Actor,
  ) {
    if (!dto.matchedPaymentId && !dto.matchedJournalLineId) {
      throw new DomainException('BANK_MATCH_INVALID', 'Choose a payment or a ledger line to match');
    }
    return this.prisma.$transaction(async (tx) => {
      await lockRows(tx, 'bank_statement_lines', organizationId, [statementLineId]);
      const line = await tx.bankStatementLine.findFirst({
        where: { id: statementLineId, organizationId },
        include: { bankAccount: true },
      });
      if (!line) {
        throw new DomainException('BANK_TRANSACTION_NOT_FOUND', 'Statement transaction line not found');
      }
      if (!OPEN_STATUSES.includes(line.status)) {
        throw new DomainException('BANK_TRANSACTION_ALREADY_RECONCILED', `This statement line is already ${line.status.toLowerCase()}`);
      }
      const amount = new Prisma.Decimal(line.amount);
      const absAmount = amount.abs();

      // The match must be this organisation's posted entry for the same amount and direction.
      if (dto.matchedPaymentId) {
        const payment = await tx.payment.findFirst({ where: { id: dto.matchedPaymentId, organizationId, status: 'POSTED' } });
        if (!payment) throw new DomainException('BANK_MATCH_INVALID', 'Payment not found, or not posted, in this organisation');
        const moneyIn = payment.kind === 'CUSTOMER_RECEIPT' || payment.kind === 'SUPPLIER_REFUND';
        if (!payment.amount.equals(absAmount) || moneyIn !== amount.greaterThan(0)) {
          throw new DomainException('BANK_MATCH_INVALID', `The payment (${payment.amount.toFixed(2)}) does not match this statement line (${amount.toFixed(2)})`);
        }
        if (payment.bankAccountNominalId !== line.bankAccount.nominalAccountId) {
          throw new DomainException('BANK_MATCH_INVALID', 'The payment was recorded against a different bank account');
        }
      }
      if (dto.matchedJournalLineId) {
        const jl = await tx.journalLine.findFirst({
          where: { id: dto.matchedJournalLineId, organizationId, accountId: line.bankAccount.nominalAccountId, journalEntry: { status: JournalStatus.POSTED } },
        });
        if (!jl) throw new DomainException('BANK_MATCH_INVALID', "Ledger line not found on this bank account's posted entries");
        const ledgerAmount = jl.debit.minus(jl.credit);
        if (!ledgerAmount.equals(amount)) {
          throw new DomainException('BANK_MATCH_INVALID', `The ledger line (${ledgerAmount.toFixed(2)}) does not match this statement line (${amount.toFixed(2)})`);
        }
      }
      const taken = await tx.bankStatementLine.findFirst({
        where: {
          organizationId,
          id: { not: line.id },
          status: BankTransactionStatus.MATCHED,
          OR: [
            ...(dto.matchedPaymentId ? [{ matchedPaymentId: dto.matchedPaymentId }] : []),
            ...(dto.matchedJournalLineId ? [{ matchedJournalLineId: dto.matchedJournalLineId }] : []),
          ],
        },
        select: { id: true },
      });
      if (taken) throw new DomainException('BANK_TRANSACTION_ALREADY_RECONCILED', 'That entry is already matched to another statement line');

      const updated = await tx.bankStatementLine.update({
        where: { id: line.id },
        data: {
          matchedPaymentId: dto.matchedPaymentId ?? null,
          matchedJournalLineId: dto.matchedJournalLineId ?? null,
          status: BankTransactionStatus.MATCHED,
          matchExplanation: dto.notes ?? 'Reconciled to ledger entry',
        },
      });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.BANK_TRANSACTION_RECONCILED,
        entityType: 'bank_statement_line',
        entityId: line.id,
        newValues: {
          matchedPaymentId: updated.matchedPaymentId,
          matchedJournalLineId: updated.matchedJournalLineId,
        },
      });

      return updated;
    });
  }

  async unmatchTransaction(organizationId: string, statementLineId: string, actor: Actor) {
    const line = await this.prisma.bankStatementLine.findFirst({
      where: { id: statementLineId, organizationId },
    });

    if (!line) {
      throw new DomainException('BANK_TRANSACTION_NOT_FOUND', 'Statement transaction line not found');
    }
    // A journal created from this line stays posted; unmatching would let it be posted again.
    const ownJournal = await this.prisma.journalEntry.findFirst({
      where: { organizationId, sourceType: JournalSourceType.BANK_TRANSACTION, sourceId: line.id, status: JournalStatus.POSTED },
      select: { journalNumber: true },
    });
    if (ownJournal) {
      throw new DomainException('BANK_TRANSACTION_ALREADY_RECONCILED', `This line was posted as journal ${ownJournal.journalNumber}; reverse that journal before unmatching`);
    }

    const updated = await this.prisma.bankStatementLine.update({
      where: { id: line.id },
      data: {
        matchedPaymentId: null,
        matchedJournalLineId: null,
        status: BankTransactionStatus.UNMATCHED,
        matchExplanation: null,
      },
    });

    await this.audit.record(null, actor, {
      organizationId,
      eventType: AuditEvents.BANK_TRANSACTION_UNRECONCILED,
      entityType: 'bank_statement_line',
      entityId: line.id,
      newValues: { status: 'UNMATCHED' },
    });

    return updated;
  }

  async quickCreateAndReconcile(
    organizationId: string,
    statementLineId: string,
    dto: QuickCreateTransactionDto,
    orgContext: OrgContext,
    actor: Actor,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await lockRows(tx, 'bank_statement_lines', organizationId, [statementLineId]);
      const line = await tx.bankStatementLine.findFirst({
        where: { id: statementLineId, organizationId },
        include: { bankAccount: true },
      });

      if (!line) {
        throw new DomainException('BANK_TRANSACTION_NOT_FOUND', 'Statement transaction line not found');
      }
      if (!OPEN_STATUSES.includes(line.status)) {
        throw new DomainException('BANK_TRANSACTION_ALREADY_RECONCILED', `This statement line is already ${line.status.toLowerCase()}`);
      }
      const reposted = await tx.journalEntry.findFirst({
        where: { organizationId, sourceType: JournalSourceType.BANK_TRANSACTION, sourceId: line.id, status: JournalStatus.POSTED },
        select: { journalNumber: true },
      });
      if (reposted) {
        throw new DomainException('BANK_TRANSACTION_ALREADY_RECONCILED', `This line was already posted as journal ${reposted.journalNumber}`);
      }

      const nominalTarget = await tx.account.findFirst({
        where: { id: dto.accountId, organizationId, isActive: true },
      });
      if (!nominalTarget) {
        throw new DomainException('ACCOUNT_NOT_FOUND', 'Selected nominal account not found');
      }

      const absAmount = new Prisma.Decimal(line.amount).abs();
      const isMoneyIn = new Prisma.Decimal(line.amount).greaterThan(0);
      const zeroDec = new Prisma.Decimal('0');
      const currency = line.currency;

      // With a tax code the bank amount is VAT-inclusive: split it with the shared calculateVat so
      // the VAT is reclaimed (money out) or accounted for (money in) and reaches the VAT return.
      let net = absAmount;
      let vat = zeroDec;
      let tax: { taxCodeId: string; taxDirection: TaxDirection; taxNetAmount: Prisma.Decimal; taxAmount: Prisma.Decimal } | null = null;
      let vatAccountId: string | null = null;
      if (dto.taxCodeId) {
        const code = await this.taxCodes.resolve(dto.taxCodeId, line.transactionDate);
        if (SELF_ACCOUNTED_TREATMENTS.has(code.treatment)) {
          throw new DomainException('VALIDATION_FAILED', `Tax code ${code.code} needs a supplier bill or invoice, not a bank entry`);
        }
        if (isMoneyIn && INPUT_ONLY_TREATMENTS.has(code.treatment)) {
          throw new DomainException('VALIDATION_FAILED', `Tax code ${code.code} can only be used on purchases`);
        }
        const split = calculateVat(this.money, { lines: [{ amount: absAmount, rate: code.rate, treatment: code.treatment }], amountMode: 'GROSS', rounding: 'LINE' });
        net = split.lines[0].net;
        vat = split.lines[0].vat;
        tax = { taxCodeId: code.id, taxDirection: isMoneyIn ? TaxDirection.OUTPUT : TaxDirection.INPUT, taxNetAmount: net, taxAmount: vat };
        if (!vat.isZero()) {
          const vatAccount = await tx.account.findFirst({ where: { organizationId, isActive: true, accountSubtype: 'TAX_PAYABLE' }, orderBy: { code: 'asc' } });
          if (!vatAccount) throw new DomainException('ACCOUNT_NOT_FOUND', 'No VAT control account (subtype TAX_PAYABLE) in the chart of accounts');
          vatAccountId = vatAccount.id;
        }
      }
      const description = dto.description || line.description;
      const bankLine = { accountId: line.bankAccount.nominalAccountId, description, currency };
      const targetLine = { accountId: nominalTarget.id, description, currency, contactId: dto.contactId ?? null, ...(tax ?? {}) };
      const vatLine = vatAccountId ? { accountId: vatAccountId, description: `VAT – ${description}`.slice(0, 255), currency } : null;
      const ordered = isMoneyIn
        ? [
            // Money in: Dr Bank (gross), Cr target (net), Cr VAT control
            { ...bankLine, debit: absAmount, credit: zeroDec },
            { ...targetLine, debit: zeroDec, credit: net },
            ...(vatLine ? [{ ...vatLine, debit: zeroDec, credit: vat }] : []),
          ]
        : [
            // Money out: Dr target (net), Dr VAT control, Cr Bank (gross)
            { ...targetLine, debit: net, credit: zeroDec },
            ...(vatLine ? [{ ...vatLine, debit: vat, credit: zeroDec }] : []),
            { ...bankLine, debit: zeroDec, credit: absAmount },
          ];
      const journalLines = ordered.map((l, i) => ({ lineNumber: i + 1, ...l }));

      const year = line.transactionDate.getUTCFullYear();
      const journalNumber = await this.journals.allocateJournalNumber(tx, organizationId, year);

      const draftJournal = await tx.journalEntry.create({
        data: {
          organizationId,
          journalNumber,
          journalType: JournalType.GENERAL,
          journalDate: line.transactionDate,
          postingDate: line.transactionDate,
          description: dto.description || `Bank transaction: ${line.description}`,
          sourceType: JournalSourceType.BANK_TRANSACTION,
          sourceId: line.id,
          currency,
          status: JournalStatus.DRAFT,
          createdById: actor.userId!,
          lines: {
            create: journalLines,
          },
        },
      });

      const validation = await this.validator.validateJournal(draftJournal.id, orgContext, tx);
      if (!validation.isValid) {
        throw new DomainException('POSTING_VALIDATION_FAILED', `Bank transaction journal validation failed: ${validation.errors.join('; ')}`);
      }

      await tx.journalEntry.update({
        where: { id: draftJournal.id },
        data: {
          status: JournalStatus.VALIDATED,
          periodId: validation.periodId,
          validatedById: actor.userId,
          validatedAt: new Date(),
          updatedById: actor.userId,
        },
      });

      await this.posting.postJournal(organizationId, draftJournal.id, orgContext, actor, tx);

      // Link to statement line (the bank side of the new journal)
      const bankSide = await tx.journalLine.findFirstOrThrow({
        where: { journalEntryId: draftJournal.id, accountId: line.bankAccount.nominalAccountId },
        select: { id: true },
      });
      const updatedLine = await tx.bankStatementLine.update({
        where: { id: line.id },
        data: {
          matchedJournalLineId: bankSide.id,
          status: BankTransactionStatus.MATCHED,
          matchExplanation: `Created and reconciled journal ${journalNumber}`,
        },
      });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.BANK_TRANSACTION_RECONCILED,
        entityType: 'bank_statement_line',
        entityId: line.id,
        newValues: {
          journalNumber,
          accountId: dto.accountId,
        },
      });

      return {
        line: updatedLine,
        journalId: draftJournal.id,
        journalNumber,
      };
    });
  }
}
