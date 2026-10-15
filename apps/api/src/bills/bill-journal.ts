import { Prisma, TaxDirection, TaxTreatment } from '@prisma/client';
import { DomainException } from '../common/errors/domain.exception';
import type { MoneyService } from '../accounting-engine/money.service';
import { SELF_ACCOUNTED_TREATMENTS } from '../tax/vat-calculation';

export interface BillJournalLineInput {
  accountId: string;
  description: string;
  net: Prisma.Decimal;
  /** VAT charged by the supplier (0 for reverse charge / PIVA). */
  vatCharged: Prisma.Decimal;
  taxCodeId: string;
  treatment: TaxTreatment;
  rate: Prisma.Decimal;
}

export interface BillJournalLine {
  accountId: string;
  description: string;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  contactId?: string;
  taxCodeId?: string;
  taxDirection?: TaxDirection;
  taxNetAmount?: Prisma.Decimal;
  taxAmount?: Prisma.Decimal;
}

/**
 * Double entry for a supplier bill:
 *   Dr expense/asset (net, tax-analysed per line)
 *   Dr VAT control (VAT charged)
 *   Dr VAT control / Cr VAT control (self-accounted VAT for reverse charge and PIVA)
 *   Cr creditors control (net + VAT charged), tagged with the supplier.
 */
export function buildBillJournalLines(
  money: MoneyService,
  input: {
    lines: BillJournalLineInput[];
    vatAccountId: string | null;
    creditorsAccountId: string;
    contactId: string;
    label: string;
  },
): BillJournalLine[] {
  const out: BillJournalLine[] = [];
  let charged = money.ZERO;
  let selfAccounted = money.ZERO;
  let gross = money.ZERO;

  for (const l of input.lines) {
    const notional = SELF_ACCOUNTED_TREATMENTS.has(l.treatment) ? money.round(l.net.mul(l.rate), 2) : money.ZERO;
    out.push({
      accountId: l.accountId,
      description: l.description,
      debit: l.net,
      credit: money.ZERO,
      taxCodeId: l.taxCodeId,
      taxDirection: TaxDirection.INPUT,
      taxNetAmount: l.net,
      taxAmount: notional.isZero() ? l.vatCharged : notional,
    });
    charged = charged.plus(l.vatCharged);
    selfAccounted = selfAccounted.plus(notional);
    gross = gross.plus(l.net).plus(l.vatCharged);
  }

  if ((!charged.isZero() || !selfAccounted.isZero()) && !input.vatAccountId) {
    throw new DomainException('ACCOUNT_NOT_FOUND', 'No VAT control account (subtype TAX_PAYABLE) in the chart of accounts');
  }
  if (!charged.isZero()) {
    out.push({ accountId: input.vatAccountId!, description: `Input VAT – ${input.label}`, debit: charged, credit: money.ZERO });
  }
  if (!selfAccounted.isZero()) {
    out.push({ accountId: input.vatAccountId!, description: `Input VAT (reverse charge) – ${input.label}`, debit: selfAccounted, credit: money.ZERO });
    out.push({ accountId: input.vatAccountId!, description: `Output VAT (reverse charge) – ${input.label}`, debit: money.ZERO, credit: selfAccounted });
  }
  out.push({ accountId: input.creditorsAccountId, description: input.label, debit: money.ZERO, credit: gross, contactId: input.contactId });
  return out;
}
