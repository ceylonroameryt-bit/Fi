import { Prisma, TaxTreatment } from '@prisma/client';
import type { DecimalValue, MoneyService } from '../accounting-engine/money.service';

/** Whether entered amounts exclude VAT (NET) or include it (GROSS). */
export type VatAmountMode = 'NET' | 'GROSS';
/** Round VAT per line, or once per rate on the invoice total (both permitted by HMRC). */
export type VatRoundingMode = 'LINE' | 'INVOICE';

export interface VatLineInput {
  amount: DecimalValue;
  rate: DecimalValue;
  treatment: TaxTreatment;
}

export interface VatLineResult {
  net: Prisma.Decimal;
  /** VAT charged on the document (payable to / reclaimable from the counterparty). */
  vat: Prisma.Decimal;
  /** VAT the organisation self-accounts for under reverse charge / PIVA; 0 otherwise. */
  notionalVat: Prisma.Decimal;
  gross: Prisma.Decimal;
}

export interface VatCalculationResult {
  lines: VatLineResult[];
  totalNet: Prisma.Decimal;
  totalVat: Prisma.Decimal;
  totalNotionalVat: Prisma.Decimal;
  totalGross: Prisma.Decimal;
}

/** Treatments where the buyer, not the supplier, accounts for the VAT. */
export const SELF_ACCOUNTED_TREATMENTS: ReadonlySet<TaxTreatment> = new Set([
  TaxTreatment.DOMESTIC_REVERSE_CHARGE,
  TaxTreatment.REVERSE_CHARGE_SERVICES,
  TaxTreatment.POSTPONED_IMPORT_VAT,
]);

const NIL_RATE_TREATMENTS: ReadonlySet<TaxTreatment> = new Set([
  TaxTreatment.ZERO,
  TaxTreatment.EXEMPT,
  TaxTreatment.OUTSIDE_SCOPE,
]);

const PENNY = new Prisma.Decimal('0.01');

/**
 * The single VAT calculation used everywhere (invoices, bills, AI drafts, validation).
 * All rounding goes through MoneyService.round (half-up to the penny).
 */
export function calculateVat(
  money: MoneyService,
  input: { lines: VatLineInput[]; amountMode: VatAmountMode; rounding: VatRoundingMode },
): VatCalculationResult {
  const prepared = input.lines.map((l) => {
    const rate = money.toDecimal(l.rate);
    if (rate.isNegative() || rate.greaterThan(1)) throw new Error(`Invalid VAT rate ${rate.toString()}`);
    if (NIL_RATE_TREATMENTS.has(l.treatment) && !rate.isZero()) {
      throw new Error(`Treatment ${l.treatment} must have a 0% rate`);
    }
    const selfAccounted = SELF_ACCOUNTED_TREATMENTS.has(l.treatment);
    const amount = money.round(l.amount, 2);
    // Reverse-charge documents carry no VAT, so an entered amount is always net.
    const isGross = input.amountMode === 'GROSS' && !selfAccounted;
    // Exact (unrounded) VAT for this line.
    const exactVat = isGross ? amount.mul(rate).div(rate.plus(1)) : amount.mul(rate);
    return { amount, rate, selfAccounted, isGross, exactVat };
  });

  const vats =
    input.rounding === 'LINE'
      ? prepared.map((p) => money.round(p.exactVat, 2))
      : allocateInvoiceRounding(money, prepared);

  const lines = prepared.map((p, i): VatLineResult => {
    const vat = vats[i];
    const net = p.isGross ? p.amount.minus(vat) : p.amount;
    return p.selfAccounted
      ? { net, vat: money.ZERO, notionalVat: vat, gross: net }
      : { net, vat, notionalVat: money.ZERO, gross: net.plus(vat) };
  });

  const sum = (pick: (l: VatLineResult) => Prisma.Decimal) => lines.reduce((a, l) => a.plus(pick(l)), money.ZERO);
  return {
    lines,
    totalNet: sum((l) => l.net),
    totalVat: sum((l) => l.vat),
    totalNotionalVat: sum((l) => l.notionalVat),
    totalGross: sum((l) => l.gross),
  };
}

/**
 * Rounds VAT once per (rate, entry mode, self-accounted) group, then spreads the pennies over
 * the lines by largest remainder so every line stays within 1p of its exact VAT.
 */
function allocateInvoiceRounding(
  money: MoneyService,
  prepared: Array<{ rate: Prisma.Decimal; selfAccounted: boolean; isGross: boolean; exactVat: Prisma.Decimal }>,
): Prisma.Decimal[] {
  const result: Prisma.Decimal[] = new Array(prepared.length);
  const groups = new Map<string, number[]>();
  prepared.forEach((p, i) => {
    const key = `${p.rate.toString()}|${p.isGross}|${p.selfAccounted}`;
    groups.set(key, [...(groups.get(key) ?? []), i]);
  });

  for (const indexes of groups.values()) {
    const groupTotal = money.round(
      indexes.reduce((a, i) => a.plus(prepared[i].exactVat), money.ZERO),
      2,
    );
    // Truncate each line toward zero, then hand out the remaining pennies.
    const truncated = indexes.map((i) => prepared[i].exactVat.toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN));
    let remaining = groupTotal.minus(truncated.reduce((a, v) => a.plus(v), money.ZERO));
    const step = remaining.isNegative() ? PENNY.negated() : PENNY;
    const order = indexes
      .map((i, k) => ({ k, remainder: prepared[i].exactVat.minus(truncated[k]).abs() }))
      .sort((a, b) => b.remainder.comparedTo(a.remainder) || a.k - b.k);
    for (const { k } of order) {
      if (remaining.isZero()) break;
      truncated[k] = truncated[k].plus(step);
      remaining = remaining.minus(step);
    }
    indexes.forEach((i, k) => (result[i] = truncated[k]));
  }
  return result;
}
