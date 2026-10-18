import { Prisma, TaxTreatment } from '@prisma/client';
import { MoneyService } from '../accounting-engine/money.service';
import { buildBillJournalLines, BillJournalLineInput } from './bill-journal';

const D = (v: string) => new Prisma.Decimal(v);
const money = new MoneyService();

const line = (over: Partial<BillJournalLineInput> = {}): BillJournalLineInput => ({
  accountId: 'exp',
  description: 'Diesel',
  net: D('1000.00'),
  vatCharged: D('200.00'),
  taxCodeId: 'tc-sr',
  treatment: TaxTreatment.STANDARD,
  rate: D('0.20'),
  ...over,
});

const build = (lines: BillJournalLineInput[]) =>
  buildBillJournalLines(money, { lines, vatAccountId: 'vat', creditorsAccountId: 'ap', contactId: 'sup-1', label: 'Bill BILL-2026-000001' });

const sum = (ls: ReturnType<typeof build>, side: 'debit' | 'credit') => ls.reduce((a, l) => a.plus(l[side]), D('0')).toFixed(2);

describe('buildBillJournalLines', () => {
  it('standard-rated bill: Dr expense (net), Dr input VAT, Cr creditors (gross) with the supplier tagged', () => {
    const lines = build([line()]);
    expect(lines.map((l) => [l.accountId, l.debit.toFixed(2), l.credit.toFixed(2)])).toEqual([
      ['exp', '1000.00', '0.00'],
      ['vat', '200.00', '0.00'],
      ['ap', '0.00', '1200.00'],
    ]);
    expect(lines[0]).toMatchObject({ taxCodeId: 'tc-sr', taxDirection: 'INPUT' });
    expect(lines[0].taxNetAmount!.toFixed(2)).toBe('1000.00');
    expect(lines[0].taxAmount!.toFixed(2)).toBe('200.00');
    expect(lines[2].contactId).toBe('sup-1');
    expect(sum(lines, 'debit')).toBe(sum(lines, 'credit'));
  });

  it('zero-rated line: no VAT line', () => {
    const lines = build([line({ vatCharged: D('0'), taxCodeId: 'tc-zr', treatment: TaxTreatment.ZERO, rate: D('0') })]);
    expect(lines.map((l) => l.accountId)).toEqual(['exp', 'ap']);
    expect(lines[0].taxAmount!.toFixed(2)).toBe('0.00');
  });

  it('reverse charge (imported services): self-accounts input and output VAT; creditor owed the net only', () => {
    const lines = build([line({ vatCharged: D('0'), taxCodeId: 'tc-rc', treatment: TaxTreatment.REVERSE_CHARGE_SERVICES })]);
    expect(lines.map((l) => [l.accountId, l.debit.toFixed(2), l.credit.toFixed(2)])).toEqual([
      ['exp', '1000.00', '0.00'],
      ['vat', '200.00', '0.00'],
      ['vat', '0.00', '200.00'],
      ['ap', '0.00', '1000.00'],
    ]);
    // Notional VAT is recorded on the expense line for VAT return boxes 1 and 4.
    expect(lines[0].taxAmount!.toFixed(2)).toBe('200.00');
    expect(sum(lines, 'debit')).toBe(sum(lines, 'credit'));
  });

  it('mixed bill sums VAT per kind and stays balanced', () => {
    const lines = build([
      line(),
      line({ accountId: 'exp2', net: D('50.00'), vatCharged: D('0'), taxCodeId: 'tc-zr', treatment: TaxTreatment.ZERO, rate: D('0') }),
      line({ accountId: 'exp3', net: D('300.00'), vatCharged: D('0'), taxCodeId: 'tc-pi', treatment: TaxTreatment.POSTPONED_IMPORT_VAT }),
    ]);
    expect(sum(lines, 'debit')).toBe(sum(lines, 'credit'));
    expect(lines.find((l) => l.accountId === 'ap')!.credit.toFixed(2)).toBe('1550.00'); // 1000 + 200 VAT + 50 + 300 (PIVA: no VAT charged)
  });

  it('refuses to build without a VAT control account when VAT is involved', () => {
    expect(() =>
      buildBillJournalLines(money, { lines: [line()], vatAccountId: null, creditorsAccountId: 'ap', contactId: 'sup-1', label: 'x' }),
    ).toThrow(/VAT control account/);
  });
});
