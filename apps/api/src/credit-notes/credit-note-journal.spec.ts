import { Prisma, TaxTreatment } from '@prisma/client';
import { MoneyService } from '../accounting-engine/money.service';
import { buildCreditNoteJournalLines } from './credit-note-journal';

describe('buildCreditNoteJournalLines', () => {
  const money = new MoneyService();
  const D = (v: string) => new Prisma.Decimal(v);
  const sum = (lines: Array<{ debit: Prisma.Decimal; credit: Prisma.Decimal }>, k: 'debit' | 'credit') => lines.reduce((s, l) => s.plus(l[k]), D('0')).toFixed(2);
  const line = (net: string, vat: string, treatment: TaxTreatment = TaxTreatment.STANDARD, rate = '0.2') => ({
    accountId: 'acc-line',
    description: 'Returned goods',
    net: D(net),
    vat: D(vat),
    taxCodeId: 'tc',
    treatment,
    rate: D(rate),
  });
  const common = { vatAccountId: 'acc-vat', controlAccountId: 'acc-control', contactId: 'c1', label: 'CN-1' };

  it('sales credit note reverses an invoice: Dr revenue, Dr VAT, Cr debtors; VAT analysis negative', () => {
    const out = buildCreditNoteJournalLines(money, { ...common, sales: true, lines: [line('100.00', '20.00')] });
    expect(sum(out, 'debit')).toBe(sum(out, 'credit'));
    const revenue = out.find((l) => l.accountId === 'acc-line')!;
    expect(revenue.debit.toFixed(2)).toBe('100.00');
    expect(revenue).toMatchObject({ taxDirection: 'OUTPUT' });
    expect(revenue.taxNetAmount!.toFixed(2)).toBe('-100.00');
    expect(revenue.taxAmount!.toFixed(2)).toBe('-20.00');
    expect(out.find((l) => l.accountId === 'acc-vat')!.debit.toFixed(2)).toBe('20.00');
    const control = out.find((l) => l.accountId === 'acc-control')!;
    expect(control.credit.toFixed(2)).toBe('120.00');
    expect(control.contactId).toBe('c1');
  });

  it('supplier credit note reverses a bill: Dr creditors, Cr expense, Cr VAT; VAT analysis negative', () => {
    const out = buildCreditNoteJournalLines(money, { ...common, sales: false, lines: [line('200.00', '40.00')] });
    expect(sum(out, 'debit')).toBe(sum(out, 'credit'));
    expect(out.find((l) => l.accountId === 'acc-control')!.debit.toFixed(2)).toBe('240.00');
    const expense = out.find((l) => l.accountId === 'acc-line')!;
    expect(expense.credit.toFixed(2)).toBe('200.00');
    expect(expense).toMatchObject({ taxDirection: 'INPUT' });
    expect(expense.taxNetAmount!.toFixed(2)).toBe('-200.00');
    expect(expense.taxAmount!.toFixed(2)).toBe('-40.00');
  });

  it('supplier credit note for reverse-charge services reverses the self-accounted VAT too', () => {
    const out = buildCreditNoteJournalLines(money, { ...common, sales: false, lines: [line('500.00', '0.00', TaxTreatment.REVERSE_CHARGE_SERVICES)] });
    expect(sum(out, 'debit')).toBe(sum(out, 'credit'));
    expect(out.find((l) => l.accountId === 'acc-control')!.debit.toFixed(2)).toBe('500.00');
    expect(out.find((l) => l.accountId === 'acc-line')!.taxAmount!.toFixed(2)).toBe('-100.00');
    const vatLines = out.filter((l) => l.accountId === 'acc-vat');
    expect(vatLines.map((l) => `${l.debit.toFixed(2)}/${l.credit.toFixed(2)}`).sort()).toEqual(['0.00/100.00', '100.00/0.00']);
  });

  it('zero-rated lines need no VAT account', () => {
    const out = buildCreditNoteJournalLines(money, { ...common, vatAccountId: null, sales: true, lines: [line('50.00', '0.00', TaxTreatment.ZERO, '0')] });
    expect(out).toHaveLength(2);
    expect(sum(out, 'debit')).toBe('50.00');
  });
});
