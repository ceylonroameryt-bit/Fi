import { AccountSubtype, Prisma, TaxDirection, TaxTreatment, VatScheme } from '@prisma/client';
import type { PrismaService, Tx } from '../database/prisma.service';
import type { MoneyService } from '../accounting-engine/money.service';
import type { VatBox } from './vat-boxes';

export interface SchemePeriod {
  scheme: VatScheme;
  startDate: Date | null;
  flatRatePercent: Prisma.Decimal | null;
  limitedCostTrader: boolean;
}

/** No row means the organisation is VAT-registered on the standard (invoice) basis. */
export const DEFAULT_SCHEME: SchemePeriod = { scheme: VatScheme.STANDARD, startDate: null, flatRatePercent: null, limitedCostTrader: false };

/** HMRC Flat Rate Scheme: a single purchase of capital assets of at least this much (incl. VAT) is reclaimable. */
export const FRS_CAPITAL_ASSET_THRESHOLD = new Prisma.Decimal('2000');

/** Self-accounted treatments: the buyer accounts for the output VAT itself. */
const SELF_ACCOUNTED: ReadonlySet<TaxTreatment> = new Set([
  TaxTreatment.REVERSE_CHARGE_SERVICES,
  TaxTreatment.DOMESTIC_REVERSE_CHARGE,
  TaxTreatment.POSTPONED_IMPORT_VAT,
]);

/** The scheme in force on a date. */
export async function vatSchemeOn(client: PrismaService | Tx, organizationId: string, date: Date): Promise<SchemePeriod> {
  const row = await client.organizationVatScheme.findFirst({
    where: { organizationId, startDate: { lte: date } },
    orderBy: { startDate: 'desc' },
  });
  return row ?? DEFAULT_SCHEME;
}

/** Every scheme period that overlaps [from, to], oldest first. */
export async function vatSchemesBetween(client: PrismaService | Tx, organizationId: string, from: Date, to: Date): Promise<SchemePeriod[]> {
  const first = await vatSchemeOn(client, organizationId, from);
  const later = await client.organizationVatScheme.findMany({
    where: { organizationId, startDate: { gt: from, lte: to } },
    orderBy: { startDate: 'asc' },
  });
  return [first, ...later];
}

export interface FlatRateLine {
  journalId: string;
  direction: TaxDirection;
  treatment: TaxTreatment;
  accountSubtype: AccountSubtype;
  net: Prisma.Decimal;
  vat: Prisma.Decimal;
}

/**
 * Flat Rate Scheme boxes (HMRC VAT Notice 733) from tax-analysed ledger lines:
 * - box 6: VAT-inclusive turnover (all sales lines, including zero-rated and exempt);
 * - box 1: flat-rate % × that turnover, plus VAT the business self-accounts (reverse charge, PIVA);
 * - box 4 / box 7: only capital assets bought on one invoice (journal) totalling at least £2,000 incl. VAT.
 * Unrounded; the caller rounds per HMRC rules. Outside-the-scope lines never reach here.
 */
export function flatRateBoxes(money: MoneyService, percent: Prisma.Decimal, lines: FlatRateLine[]): Partial<Record<VatBox, Prisma.Decimal>> {
  let turnover = money.ZERO;
  let selfAccounted = money.ZERO;
  const assetsByJournal = new Map<string, FlatRateLine[]>();

  for (const l of lines) {
    if (l.treatment === TaxTreatment.OUTSIDE_SCOPE) continue;
    if (l.direction === TaxDirection.OUTPUT) {
      turnover = turnover.plus(l.net).plus(l.vat);
      continue;
    }
    if (SELF_ACCOUNTED.has(l.treatment)) selfAccounted = selfAccounted.plus(l.vat);
    if (l.accountSubtype === AccountSubtype.FIXED_ASSET) {
      assetsByJournal.set(l.journalId, [...(assetsByJournal.get(l.journalId) ?? []), l]);
    }
  }

  let box4 = money.ZERO;
  let box7 = money.ZERO;
  for (const assetLines of assetsByJournal.values()) {
    const gross = assetLines.reduce((s, l) => s.plus(l.net).plus(l.vat), money.ZERO);
    if (gross.abs().lessThan(FRS_CAPITAL_ASSET_THRESHOLD)) continue;
    for (const l of assetLines) {
      box4 = box4.plus(l.vat);
      box7 = box7.plus(l.net);
    }
  }

  return {
    box1: turnover.mul(percent).div(100).plus(selfAccounted),
    box4,
    box6: turnover,
    box7,
  };
}
