import { Injectable } from '@nestjs/common';
import { AccountSubtype, JournalSourceType, JournalStatus, JournalType, Prisma, VatScheme } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { DomainException } from '../common/errors/domain.exception';
import type { Actor, OrgContext } from '../common/types/request-context.types';
import { parseIsoDate, toIsoDate } from '../common/utils/dates';
import { AuditService } from '../audit/audit.service';
import { AuditEvents } from '../audit/audit-events';
import { MoneyService } from '../accounting-engine/money.service';
import { JournalPostingService } from '../accounting-engine/journal-posting.service';
import { JournalValidationService } from '../accounting-engine/journal-validation.service';
import { JournalsService } from '../journals/journals.service';
import { VatReturnService } from './vat-return.service';
import { DEFAULT_SCHEME, vatSchemeOn } from './vat-schemes';
import type { FlatRateAdjustmentDto, SetVatSchemeDto } from './dto/vat-scheme.dto';

const LIMITED_COST_TRADER_PERCENT = new Prisma.Decimal('16.5');

/** The organisation's dated VAT scheme, and the Flat Rate period-end adjustment. */
@Injectable()
export class VatSchemesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly money: MoneyService,
    private readonly audit: AuditService,
    private readonly vatReturn: VatReturnService,
    private readonly journals: JournalsService,
    private readonly validator: JournalValidationService,
    private readonly postingService: JournalPostingService,
  ) {}

  async get(organizationId: string, on = new Date()) {
    const history = await this.prisma.organizationVatScheme.findMany({ where: { organizationId }, orderBy: { startDate: 'asc' } });
    const current = await vatSchemeOn(this.prisma, organizationId, on);
    return { current: this.view(current), history: history.map((h) => this.view(h)), defaulted: current === DEFAULT_SCHEME };
  }

  /**
   * Records a scheme from a date. Only forward changes: the date must be after the last change and
   * after every posted VAT-analysed journal, so returns already prepared never change.
   */
  async set(organizationId: string, dto: SetVatSchemeDto, actor: Actor) {
    const startDate = parseIsoDate(dto.startDate, 'startDate');
    const flat = dto.scheme === VatScheme.FLAT_RATE;
    if (!flat && (dto.flatRatePercent !== undefined || dto.limitedCostTrader)) {
      throw new DomainException('VALIDATION_FAILED', 'A flat-rate percentage and limited cost trader apply only to the Flat Rate Scheme');
    }
    const percent = flat ? new Prisma.Decimal(dto.flatRatePercent!) : null;
    if (flat && dto.limitedCostTrader && !percent!.equals(LIMITED_COST_TRADER_PERCENT)) {
      throw new DomainException('VALIDATION_FAILED', 'A limited cost trader uses the 16.5% flat rate');
    }

    return this.prisma.transaction(async (tx) => {
      const latest = await tx.organizationVatScheme.findFirst({ where: { organizationId }, orderBy: { startDate: 'desc' } });
      if (latest && startDate <= latest.startDate) {
        throw new DomainException('VAT_SCHEME_BACKDATED', `The last scheme change is on ${toIsoDate(latest.startDate)}; a new change must start after it`);
      }
      const posted = await tx.journalEntry.findFirst({
        where: { organizationId, status: { in: [JournalStatus.POSTED, JournalStatus.REVERSED] }, postingDate: { gte: startDate }, lines: { some: { taxCodeId: { not: null } } } },
        orderBy: { postingDate: 'desc' },
        select: { journalNumber: true, postingDate: true },
      });
      if (posted) {
        throw new DomainException('VAT_SCHEME_BACKDATED', `VAT-analysed journals are already posted on or after ${dto.startDate} (latest ${posted.journalNumber} on ${toIsoDate(posted.postingDate)}); choose a later start date`);
      }
      const before = await vatSchemeOn(tx, organizationId, startDate);
      if (before.scheme === dto.scheme && (before.flatRatePercent?.toString() ?? null) === (percent?.toString() ?? null) && before.limitedCostTrader === !!dto.limitedCostTrader) {
        throw new DomainException('VALIDATION_FAILED', 'That scheme is already in force');
      }
      const row = await tx.organizationVatScheme.create({
        data: { organizationId, scheme: dto.scheme, startDate, flatRatePercent: percent, limitedCostTrader: flat ? !!dto.limitedCostTrader : false, createdById: actor.userId },
      });
      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.VAT_SCHEME_CHANGED,
        entityType: 'ORGANIZATION',
        entityId: organizationId,
        oldValues: this.view(before),
        newValues: this.view(row),
      });
      return this.view(row);
    });
  }

  /**
   * Flat Rate Scheme: the ledger's VAT control holds the VAT actually charged (and any reclaimed),
   * but HMRC is owed box 5. The difference is the business's flat-rate surplus (or shortfall); it is
   * moved between the VAT control account and other income by a journal through the posting engine,
   * once per return period.
   */
  async postFlatRateAdjustment(organizationId: string, dto: FlatRateAdjustmentDto, orgContext: OrgContext, actor: Actor) {
    this.postingService.checkPostingPermission(orgContext);
    const report = await this.vatReturn.getReturn(organizationId, dto);
    if (report.scheme !== VatScheme.FLAT_RATE) {
      throw new DomainException('VAT_SCHEME_NOT_SUPPORTED', 'The flat-rate adjustment applies only to Flat Rate Scheme returns');
    }
    const reference = `FRS-ADJ ${report.from}..${report.to}`;
    const difference = this.money.toDecimal(report.reconciliation.difference);

    return this.prisma.transaction(async (tx) => {
      const existing = await tx.journalEntry.findFirst({
        where: { organizationId, reference, sourceType: JournalSourceType.SYSTEM, status: JournalStatus.POSTED },
        select: { journalNumber: true },
      });
      if (existing) {
        throw new DomainException('VAT_FLAT_RATE_ADJUSTMENT_EXISTS', `The adjustment for ${report.from} to ${report.to} is already posted as ${existing.journalNumber}; reverse it first to redo it`);
      }
      if (difference.isZero()) return { posted: false, amount: '0.00', journalNumber: null, report };

      const vatAccount = await tx.account.findFirst({ where: { organizationId, isActive: true, accountSubtype: AccountSubtype.TAX_PAYABLE }, orderBy: { code: 'asc' } });
      const income = await tx.account.findFirst({ where: { organizationId, isActive: true, accountSubtype: AccountSubtype.OTHER_INCOME }, orderBy: { code: 'asc' } });
      if (!vatAccount || !income) {
        throw new DomainException('VALIDATION_FAILED', 'A VAT control account and an other-income account are needed for the flat-rate adjustment');
      }
      const amount = difference.abs();
      const surplus = difference.greaterThan(0); // more VAT in the ledger than is owed: release it to income
      const postingDate = parseIsoDate(report.to, 'to');
      const label = `Flat Rate Scheme adjustment ${report.from} to ${report.to} (${report.flatRatePercent}%)`;
      const journal = await tx.journalEntry.create({
        data: {
          organizationId,
          journalNumber: await this.journals.allocateJournalNumber(tx, organizationId, postingDate.getUTCFullYear()),
          journalType: JournalType.TAX,
          journalDate: postingDate,
          postingDate,
          description: label,
          reference,
          sourceType: JournalSourceType.SYSTEM,
          currency: 'GBP',
          status: JournalStatus.DRAFT,
          createdById: actor.userId!,
          lines: {
            create: [
              { lineNumber: 1, accountId: vatAccount.id, description: label, debit: surplus ? amount : 0, credit: surplus ? 0 : amount, currency: 'GBP' },
              { lineNumber: 2, accountId: income.id, description: label, debit: surplus ? 0 : amount, credit: surplus ? amount : 0, currency: 'GBP' },
            ],
          },
        },
      });
      const validation = await this.validator.validateJournal(journal.id, orgContext, tx);
      if (!validation.isValid) {
        throw new DomainException('POSTING_VALIDATION_FAILED', `Flat-rate adjustment validation failed: ${validation.errors.join('; ')}`, { errors: validation.errors });
      }
      await tx.journalEntry.update({
        where: { id: journal.id },
        data: { status: JournalStatus.VALIDATED, periodId: validation.periodId, validatedById: actor.userId, validatedAt: new Date() },
      });
      const result = await this.postingService.postJournal(organizationId, journal.id, orgContext, actor, tx);
      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.VAT_FLAT_RATE_ADJUSTMENT_POSTED,
        entityType: 'JOURNAL',
        entityId: journal.id,
        newValues: { from: report.from, to: report.to, amount: amount.toFixed(2), surplus, journalNumber: result.journalNumber },
      });
      return { posted: true, amount: (surplus ? amount : amount.neg()).toFixed(2), journalNumber: result.journalNumber, report };
    });
  }

  private view(s: { scheme: VatScheme; startDate: Date | null; flatRatePercent: Prisma.Decimal | null; limitedCostTrader: boolean }) {
    return {
      scheme: s.scheme,
      startDate: s.startDate ? toIsoDate(s.startDate) : null,
      flatRatePercent: s.flatRatePercent ? this.money.toDecimal(s.flatRatePercent).toFixed(2) : null,
      limitedCostTrader: s.limitedCostTrader,
    };
  }
}
