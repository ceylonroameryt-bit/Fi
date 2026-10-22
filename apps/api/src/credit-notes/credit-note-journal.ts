import { Prisma, TaxDirection, TaxTreatment } from '@prisma/client';
import { DomainException } from '../common/errors/domain.exception';
import type { MoneyService } from '../accounting-engine/money.service';
import { SELF_ACCOUNTED_TREATMENTS } from '../tax/vat-calculation';
import { BillJournalLine, buildBillJournalLines } from '../bills/bill-journal';

export interface CreditNoteJournalLineInput {
  accountId: string;
  description: string;
  net: Prisma.Decimal;
  /** VAT on the credit note (0 for reverse charge / PIVA, which is self-accounted). */
  vat: Prisma.Decimal;
  taxCodeId: string;
  treatment: TaxTreatment;
  rate: Prisma.Decimal;
}

export type CreditNoteJournalLine = BillJournalLine;

/** Swaps debits and credits and negates the VAT analysis, so a credit note undoes what the document did. */
function mirror(lines: CreditNoteJournalLine[]): CreditNoteJournalLine[] {
  return lines.map((l) => ({
    ...l,
    debit: l.credit,
    credit: l.debit,
    ...(l.taxNetAmount !== undefined ? { taxNetAmount: l.taxNetAmount.neg() } : {}),
    ...(l.taxAmount !== undefined ? { taxAmount: l.taxAmount.neg() } : {}),
  }));
}

/**
 * Sales credit note: the exact reverse of a sales invoice –
 *   Dr revenue (net, OUTPUT analysis negative), Dr VAT control (VAT), Cr debtors control (gross).
 * Supplier credit note: the exact reverse of a supplier bill (including reverse-charge self-accounting) –
 *   Dr creditors control (gross), Cr expense (net, INPUT analysis negative), Cr VAT control.
 * Negative net/VAT analysis reduces the same VAT return boxes the original document increased.
 */
export function buildCreditNoteJournalLines(
  money: MoneyService,
  input: {
    sales: boolean;
    lines: CreditNoteJournalLineInput[];
    vatAccountId: string | null;
    controlAccountId: string;
    contactId: string;
    label: string;
  },
): CreditNoteJournalLine[] {
  if (!input.sales) {
    return mirror(
      buildBillJournalLines(money, {
        lines: input.lines.map((l) => ({ ...l, vatCharged: l.vat })),
        vatAccountId: input.vatAccountId,
        creditorsAccountId: input.controlAccountId,
        contactId: input.contactId,
        label: input.label,
      }),
    );
  }

  const invoiceLike: CreditNoteJournalLine[] = [];
  let vat = money.ZERO;
  let gross = money.ZERO;
  for (const l of input.lines) {
    // Domestic reverse-charge sales carry no VAT; the customer's notional VAT is recorded for analysis.
    const analysedVat = SELF_ACCOUNTED_TREATMENTS.has(l.treatment) ? money.round(l.net.mul(l.rate), 2) : l.vat;
    invoiceLike.push({
      accountId: l.accountId,
      description: l.description,
      debit: money.ZERO,
      credit: l.net,
      taxCodeId: l.taxCodeId,
      taxDirection: TaxDirection.OUTPUT,
      taxNetAmount: l.net,
      taxAmount: analysedVat,
    });
    vat = vat.plus(l.vat);
    gross = gross.plus(l.net).plus(l.vat);
  }
  if (!vat.isZero()) {
    if (!input.vatAccountId) throw new DomainException('ACCOUNT_NOT_FOUND', 'No VAT control account (subtype TAX_PAYABLE) in the chart of accounts');
    invoiceLike.push({ accountId: input.vatAccountId, description: `Output VAT – ${input.label}`, debit: money.ZERO, credit: vat });
  }
  invoiceLike.unshift({ accountId: input.controlAccountId, description: input.label, debit: gross, credit: money.ZERO, contactId: input.contactId });
  return mirror(invoiceLike);
}
