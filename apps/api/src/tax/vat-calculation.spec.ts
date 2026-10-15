import { TaxTreatment } from '@prisma/client';
import { MoneyService } from '../accounting-engine/money.service';
import { calculateVat, VatLineInput } from './vat-calculation';

describe('calculateVat', () => {
  const money = new MoneyService();
  const std = (amount: string): VatLineInput => ({ amount, rate: '0.20', treatment: TaxTreatment.STANDARD });

  it('net entry, line rounding: rounds VAT per line half-up', () => {
    const r = calculateVat(money, { lines: [std('10.03'), std('10.03')], amountMode: 'NET', rounding: 'LINE' });
    // 10.03 * 20% = 2.006 -> 2.01 per line
    expect(r.lines.map((l) => l.vat.toFixed(2))).toEqual(['2.01', '2.01']);
    expect(r.totalNet.toFixed(2)).toBe('20.06');
    expect(r.totalVat.toFixed(2)).toBe('4.02');
    expect(r.totalGross.toFixed(2)).toBe('24.08');
  });

  it('net entry, invoice rounding: rounds the total once and allocates pennies to lines', () => {
    const r = calculateVat(money, { lines: [std('10.03'), std('10.03')], amountMode: 'NET', rounding: 'INVOICE' });
    // total 20.06 * 20% = 4.012 -> 4.01
    expect(r.totalVat.toFixed(2)).toBe('4.01');
    expect(r.lines.reduce((a, l) => a.plus(l.vat), money.ZERO).toFixed(2)).toBe('4.01');
    for (const l of r.lines) expect(l.vat.minus(l.net.mul('0.20')).abs().lessThan('0.01')).toBe(true);
  });

  it('gross entry: extracts VAT with the VAT fraction', () => {
    const r = calculateVat(money, { lines: [std('120.00'), std('9.99')], amountMode: 'GROSS', rounding: 'LINE' });
    expect(r.lines[0].vat.toFixed(2)).toBe('20.00');
    expect(r.lines[0].net.toFixed(2)).toBe('100.00');
    // 9.99 / 6 = 1.665 -> 1.67 ; net 8.32
    expect(r.lines[1].vat.toFixed(2)).toBe('1.67');
    expect(r.lines[1].net.toFixed(2)).toBe('8.32');
    expect(r.totalGross.toFixed(2)).toBe('129.99');
  });

  it('gross entry, invoice rounding keeps gross exact', () => {
    const r = calculateVat(money, { lines: [std('9.99'), std('9.99')], amountMode: 'GROSS', rounding: 'INVOICE' });
    expect(r.totalGross.toFixed(2)).toBe('19.98');
    expect(r.totalVat.toFixed(2)).toBe('3.33');
    expect(r.totalNet.plus(r.totalVat).toFixed(2)).toBe('19.98');
  });

  it('handles reduced, zero, exempt and outside-scope rates', () => {
    const r = calculateVat(money, {
      lines: [
        { amount: '100', rate: '0.05', treatment: TaxTreatment.REDUCED },
        { amount: '100', rate: '0', treatment: TaxTreatment.ZERO },
        { amount: '100', rate: '0', treatment: TaxTreatment.EXEMPT },
        { amount: '100', rate: '0', treatment: TaxTreatment.OUTSIDE_SCOPE },
      ],
      amountMode: 'NET',
      rounding: 'LINE',
    });
    expect(r.lines.map((l) => l.vat.toFixed(2))).toEqual(['5.00', '0.00', '0.00', '0.00']);
    expect(r.totalVat.toFixed(2)).toBe('5.00');
  });

  it.each([TaxTreatment.DOMESTIC_REVERSE_CHARGE, TaxTreatment.REVERSE_CHARGE_SERVICES, TaxTreatment.POSTPONED_IMPORT_VAT])(
    '%s: no VAT is charged, notional VAT is self-accounted',
    (treatment) => {
      const r = calculateVat(money, {
        lines: [{ amount: '1000', rate: '0.20', treatment }],
        amountMode: 'NET',
        rounding: 'LINE',
      });
      expect(r.lines[0].vat.toFixed(2)).toBe('0.00');
      expect(r.lines[0].notionalVat.toFixed(2)).toBe('200.00');
      expect(r.totalGross.toFixed(2)).toBe('1000.00');
      expect(r.totalNotionalVat.toFixed(2)).toBe('200.00');
    },
  );

  it('keeps credit notes (negative amounts) symmetric', () => {
    const r = calculateVat(money, { lines: [std('-10.03')], amountMode: 'NET', rounding: 'LINE' });
    expect(r.lines[0].vat.toFixed(2)).toBe('-2.01');
  });

  it('rejects a rate that does not match a zero-rated treatment', () => {
    expect(() =>
      calculateVat(money, {
        lines: [{ amount: '10', rate: '0.20', treatment: TaxTreatment.EXEMPT }],
        amountMode: 'NET',
        rounding: 'LINE',
      }),
    ).toThrow(/EXEMPT/);
  });
});
