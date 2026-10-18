import { Injectable } from '@nestjs/common';
import {
  BankTransactionStatus,
  JournalSourceType,
  JournalStatus,
  JournalType,
  Prisma,
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

@Injectable()
export class BankReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journals: JournalsService,
    private readonly validator: JournalValidationService,
    private readonly posting: JournalPostingService,
    private readonly audit: AuditService,
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

    const absAmount = new Prisma.Decimal(Math.abs(Number(line.amount)).toFixed(4));
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
    const line = await this.prisma.bankStatementLine.findFirst({
      where: { id: statementLineId, organizationId },
    });

    if (!line) {
      throw new DomainException('BANK_TRANSACTION_NOT_FOUND', 'Statement transaction line not found');
    }

    const updated = await this.prisma.bankStatementLine.update({
      where: { id: line.id },
      data: {
        matchedPaymentId: dto.matchedPaymentId ?? line.matchedPaymentId,
        matchedJournalLineId: dto.matchedJournalLineId ?? line.matchedJournalLineId,
        status: BankTransactionStatus.MATCHED,
        matchExplanation: dto.notes ?? 'Reconciled to ledger entry',
      },
    });

    await this.audit.record(null, actor, {
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
  }

  async unmatchTransaction(organizationId: string, statementLineId: string, actor: Actor) {
    const line = await this.prisma.bankStatementLine.findFirst({
      where: { id: statementLineId, organizationId },
    });

    if (!line) {
      throw new DomainException('BANK_TRANSACTION_NOT_FOUND', 'Statement transaction line not found');
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
      const line = await tx.bankStatementLine.findFirst({
        where: { id: statementLineId, organizationId },
        include: { bankAccount: true },
      });

      if (!line) {
        throw new DomainException('BANK_TRANSACTION_NOT_FOUND', 'Statement transaction line not found');
      }

      const nominalTarget = await tx.account.findFirst({
        where: { id: dto.accountId, organizationId, isActive: true },
      });
      if (!nominalTarget) {
        throw new DomainException('ACCOUNT_NOT_FOUND', 'Selected nominal account not found');
      }

      const absAmount = new Prisma.Decimal(Math.abs(Number(line.amount)).toFixed(4));
      const isMoneyIn = Number(line.amount) > 0;
      const zeroDec = new Prisma.Decimal('0');
      const currency = line.currency;

      const journalLines = isMoneyIn
        ? [
            // Money in: Dr Bank, Cr Target Nominal
            {
              lineNumber: 1,
              accountId: line.bankAccount.nominalAccountId,
              description: dto.description || line.description,
              debit: absAmount,
              credit: zeroDec,
              currency,
            },
            {
              lineNumber: 2,
              accountId: nominalTarget.id,
              description: dto.description || line.description,
              debit: zeroDec,
              credit: absAmount,
              currency,
              contactId: dto.contactId ?? null,
            },
          ]
        : [
            // Money out: Dr Target Nominal (expense/fee), Cr Bank
            {
              lineNumber: 1,
              accountId: nominalTarget.id,
              description: dto.description || line.description,
              debit: absAmount,
              credit: zeroDec,
              currency,
              contactId: dto.contactId ?? null,
            },
            {
              lineNumber: 2,
              accountId: line.bankAccount.nominalAccountId,
              description: dto.description || line.description,
              debit: zeroDec,
              credit: absAmount,
              currency,
            },
          ];

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

      // Link to statement line
      const updatedLine = await tx.bankStatementLine.update({
        where: { id: line.id },
        data: {
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
