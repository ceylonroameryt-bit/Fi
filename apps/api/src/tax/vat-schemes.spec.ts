import { AccountSubtype, Prisma, TaxDirection, TaxTreatment } from '@prisma/client';
import { MoneyService } from '../accounting-engine/money.service';
import { flatRateBoxes, FlatRateLine } from './vat-schemes';

describe('flatRateBoxes (Flat Rate Scheme)', () => {
  const money = new MoneyService();
  const D = (v: string) => new Prisma.Decimal(v);
  const sale = (net: string, vat: string, treatment: TaxTreatment = TaxTreatment.STANDARD): FlatRateLine => ({
    journalId: 's',
    direction: TaxDirection.OUTPUT,
    treatment,
    accountSubtype: AccountSubtype.SALES,
    net: D(net),
    vat: D(vat),
  });
  const buy = (journalId: string, net: string, vat: string, subtype: AccountSubtype = AccountSubtype.OPERATING_EXPENSE, treatment: TaxTreatment = TaxTreatment.STANDARD): FlatRateLine => ({
    journalId,
    direction: TaxDirection.INPUT,
    treatment,
    accountSubtype: subtype,
    net: D(net),
    vat: D(vat),
  });

  it('box 1 is the flat-rate percentage of VAT-inclusive turnover, including zero-rated and exempt sales', () => {
    const b = flatRateBoxes(money, D('12.5'), [sale('1000', '200'), sale('100', '0', TaxTreatment.ZERO), sale('50', '0', TaxTreatment.EXEMPT)]);
    expect(b.box6!.toFixed(2)).toBe('1350.00');
    expect(b.box1!.toFixed(4)).toBe('168.7500'); // 12.5% × 1350
  });

  it('ordinary purchases reclaim nothing', () => {
    const b = flatRateBoxes(money, D('10'), [sale('100', '20'), buy('b1', '500', '100')]);
    expect(b.box4!.toFixed(2)).toBe('0.00');
    expect(b.box7!.toFixed(2)).toBe('0.00');
  });

  it('capital assets on one invoice of £2,000 or more incl. VAT are reclaimable; below that they are not', () => {
    const b = flatRateBoxes(money, D('10'), [
      buy('laptop', '1600', '320', AccountSubtype.FIXED_ASSET), // 1,920 gross: not reclaimable
      buy('van', '1500', '300', AccountSubtype.FIXED_ASSET), // same invoice as the next line:
      buy('van', '200', '40', AccountSubtype.FIXED_ASSET), //   2,040 gross in total → reclaimable
    ]);
    expect(b.box4!.toFixed(2)).toBe('340.00');
    expect(b.box7!.toFixed(2)).toBe('1700.00');
  });

  it('exactly £2,000 incl. VAT qualifies', () => {
    const b = flatRateBoxes(money, D('10'), [buy('x', '1666.67', '333.33', AccountSubtype.FIXED_ASSET)]);
    expect(b.box4!.toFixed(2)).toBe('333.33');
  });

  it('self-accounted VAT (reverse charge) is added to box 1 and not reclaimed', () => {
    const b = flatRateBoxes(money, D('10'), [sale('1000', '200'), buy('rc', '500', '100', AccountSubtype.OPERATING_EXPENSE, TaxTreatment.REVERSE_CHARGE_SERVICES)]);
    expect(b.box1!.toFixed(2)).toBe('220.00'); // 10% × 1,200 + 100
    expect(b.box4!.toFixed(2)).toBe('0.00');
  });

  it('credit notes (negative lines) reduce turnover; outside-the-scope lines are ignored', () => {
    const b = flatRateBoxes(money, D('10'), [sale('1000', '200'), sale('-100', '-20'), sale('999', '0', TaxTreatment.OUTSIDE_SCOPE)]);
    expect(b.box6!.toFixed(2)).toBe('1080.00');
    expect(b.box1!.toFixed(2)).toBe('108.00');
  });
});
