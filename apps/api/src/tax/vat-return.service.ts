import { Injectable } from '@nestjs/common';
import { AccountSubtype, JournalStatus, Prisma, VatScheme } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { MoneyService } from '../accounting-engine/money.service';
import { DomainException } from '../common/errors/domain.exception';
import { parseIsoDate, toIsoDate } from '../common/utils/dates';
import { SOURCE_BOXES, VAT_BOXES, VatBox, vatBoxContributions } from './vat-boxes';
import { flatRateBoxes, SchemePeriod, vatSchemesBetween } from './vat-schemes';

export interface VatReturnRange {
  from: string;
  to: string;
}

export interface VatReturnReport {
  organizationId: string;
  from: string;
  to: string;
  /** The VAT scheme the return was prepared under. */
  scheme: VatScheme;
  /** Flat Rate Scheme percentage used for box 1 (FLAT_RATE only). */
  flatRatePercent: string | null;
  /** Boxes 1–5 in pounds and pence; boxes 6–9 in whole pounds (pence dropped), per HMRC. */
  boxes: Record<VatBox, string>;
  lineCount: number;
  /** Boxes always zero because NI/EU goods movements are not supported yet. */
  unsupportedBoxes: VatBox[];
  /** Box 5 cross-checked against the movement on the VAT control account(s) for the same dates. */
  reconciliation: { vatControlMovement: string; box5: string; difference: string; reconciled: boolean };
}

export interface VatBoxLine {
  journalLineId: string;
  journalId: string;
  journalNumber: string;
  postingDate: string;
  description: string | null;
  accountCode: string;
  accountName: string;
  contactId: string | null;
  taxCode: string;
  taxDirection: string;
  net: string;
  vat: string;
  /** What this line contributes to the requested box. */
  amount: string;
}

const POSTED_STATUSES = [JournalStatus.POSTED, JournalStatus.REVERSED];

/** VAT return (boxes 1–9) computed purely from posted, tax-analysed ledger lines. */
@Injectable()
export class VatReturnService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly money: MoneyService,
  ) {}

  async getReturn(organizationId: string, range: VatReturnRange): Promise<VatReturnReport> {
    const { from, to } = this.parseRange(range);
    const scheme = await this.schemeFor(organizationId, from, to);
    const lines = await this.loadLines(organizationId, from, to);

    const totals = Object.fromEntries(VAT_BOXES.map((b) => [b, this.money.ZERO])) as Record<VatBox, Prisma.Decimal>;
    if (scheme.scheme === VatScheme.FLAT_RATE) {
      const frs = flatRateBoxes(
        this.money,
        scheme.flatRatePercent!,
        lines.map((l) => ({
          journalId: l.journalEntry.id,
          direction: l.taxDirection!,
          treatment: l.taxCode!.treatment,
          accountSubtype: l.account.accountSubtype,
          net: this.money.toDecimal(l.taxNetAmount!),
          vat: this.money.toDecimal(l.taxAmount!),
        })),
      );
      for (const [box, amount] of Object.entries(frs) as [VatBox, Prisma.Decimal][]) totals[box] = amount;
    } else {
      for (const line of lines) {
        for (const [box, amount] of this.contributions(line)) totals[box] = totals[box].plus(amount);
      }
    }
    totals.box3 = totals.box1.plus(totals.box2);
    totals.box5 = totals.box3.minus(totals.box4);

    const boxes = Object.fromEntries(
      VAT_BOXES.map((b) => [
        b,
        ['box6', 'box7', 'box8', 'box9'].includes(b)
          ? this.money.wholePounds(totals[b]).toFixed(0)
          : this.money.round(totals[b], 2).toFixed(2),
      ]),
    ) as Record<VatBox, string>;

    const movement = await this.vatControlMovement(organizationId, from, to);
    const box5 = this.money.round(totals.box5, 2);
    const difference = this.money.round(movement, 2).minus(box5);

    return {
      organizationId,
      from: toIsoDate(from),
      to: toIsoDate(to),
      scheme: scheme.scheme,
      flatRatePercent: scheme.flatRatePercent ? this.money.toDecimal(scheme.flatRatePercent).toFixed(2) : null,
      boxes,
      lineCount: lines.length,
      unsupportedBoxes: ['box2', 'box8', 'box9'],
      reconciliation: {
        vatControlMovement: this.money.round(movement, 2).toFixed(2),
        box5: box5.toFixed(2),
        difference: difference.toFixed(2),
        reconciled: difference.isZero(),
      },
    };
  }

  /** Drill-down: the ledger lines behind one box. */
  async getBoxLines(organizationId: string, range: VatReturnRange, box: string): Promise<VatBoxLine[]> {
    if (!SOURCE_BOXES.has(box as VatBox)) {
      throw new DomainException('VALIDATION_FAILED', `Box must be one of ${[...SOURCE_BOXES].join(', ')}`);
    }
    const { from, to } = this.parseRange(range);
    const scheme = await this.schemeFor(organizationId, from, to);
    if (scheme.scheme === VatScheme.FLAT_RATE) {
      throw new DomainException('VAT_SCHEME_NOT_SUPPORTED', 'Box drill-down is for the standard basis; Flat Rate boxes are computed from turnover');
    }
    const lines = await this.loadLines(organizationId, from, to);
    const result: VatBoxLine[] = [];
    for (const line of lines) {
      const hit = this.contributions(line).find(([b]) => b === box);
      if (!hit) continue;
      result.push({
        journalLineId: line.id,
        journalId: line.journalEntry.id,
        journalNumber: line.journalEntry.journalNumber,
        postingDate: toIsoDate(line.journalEntry.postingDate),
        description: line.description,
        accountCode: line.account.code,
        accountName: line.account.name,
        contactId: line.contactId,
        taxCode: line.taxCode!.code,
        taxDirection: line.taxDirection!,
        net: this.money.round(line.taxNetAmount!, 2).toFixed(2),
        vat: this.money.round(line.taxAmount!, 2).toFixed(2),
        amount: this.money.round(hit[1], 2).toFixed(2),
      });
    }
    return result;
  }

  private contributions(line: Awaited<ReturnType<VatReturnService['loadLines']>>[number]) {
    return vatBoxContributions(
      line.taxDirection!,
      line.taxCode!.treatment,
      this.money.toDecimal(line.taxNetAmount!),
      this.money.toDecimal(line.taxAmount!),
    );
  }

  private loadLines(organizationId: string, from: Date, to: Date) {
    return this.prisma.journalLine.findMany({
      where: {
        organizationId,
        taxCodeId: { not: null },
        journalEntry: { organizationId, status: { in: POSTED_STATUSES }, postingDate: { gte: from, lte: to } },
      },
      select: {
        id: true,
        description: true,
        contactId: true,
        taxDirection: true,
        taxNetAmount: true,
        taxAmount: true,
        taxCode: { select: { code: true, treatment: true } },
        account: { select: { code: true, name: true, accountSubtype: true } },
        journalEntry: { select: { id: true, journalNumber: true, postingDate: true } },
      },
      orderBy: [{ journalEntry: { postingDate: 'asc' } }, { lineNumber: 'asc' }],
    });
  }

  /**
   * The one scheme in force for the whole return. A return may not straddle a scheme change, and
   * schemes this engine cannot compute yet are refused rather than approximated.
   */
  private async schemeFor(organizationId: string, from: Date, to: Date): Promise<SchemePeriod> {
    const periods = await vatSchemesBetween(this.prisma, organizationId, from, to);
    if (periods.length > 1) {
      throw new DomainException('VAT_SCHEME_CHANGED_IN_PERIOD', `The VAT scheme changes on ${toIsoDate(periods[1].startDate!)}; prepare separate returns before and after that date`, {
        changes: periods.slice(1).map((p) => ({ scheme: p.scheme, startDate: toIsoDate(p.startDate!) })),
      });
    }
    const scheme = periods[0];
    if (scheme.scheme === VatScheme.NOT_REGISTERED) {
      throw new DomainException('VAT_NOT_REGISTERED', 'The organisation is not VAT-registered for this period; there is no VAT return');
    }
    if (scheme.scheme === VatScheme.CASH_ACCOUNTING) {
      throw new DomainException('VAT_SCHEME_NOT_SUPPORTED', 'Cash accounting returns need customer and supplier payments, which are not recorded yet');
    }
    return scheme;
  }

  /** Net credit movement (credits − debits) on VAT control accounts in the range. */
  private async vatControlMovement(organizationId: string, from: Date, to: Date): Promise<Prisma.Decimal> {
    const agg = await this.prisma.journalLine.aggregate({
      where: {
        organizationId,
        account: { organizationId, accountSubtype: AccountSubtype.TAX_PAYABLE },
        journalEntry: { organizationId, status: { in: POSTED_STATUSES }, postingDate: { gte: from, lte: to } },
      },
      _sum: { debit: true, credit: true },
    });
    return this.money.toDecimal(agg._sum.credit ?? 0).minus(this.money.toDecimal(agg._sum.debit ?? 0));
  }

  private parseRange(range: VatReturnRange): { from: Date; to: Date } {
    if (!range.from || !range.to) {
      throw new DomainException('VALIDATION_FAILED', 'from and to dates (YYYY-MM-DD) are required');
    }
    const from = parseIsoDate(range.from, 'from');
    const to = parseIsoDate(range.to, 'to');
    if (from > to) throw new DomainException('VALIDATION_FAILED', 'from must be on or before to');
    return { from, to };
  }
}
