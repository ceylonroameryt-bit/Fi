import { Prisma, TaxDirection, TaxTreatment } from '@prisma/client';
import { vatBoxContributions, VatBox } from './vat-boxes';

const D = (v: string) => new Prisma.Decimal(v);

function boxes(direction: TaxDirection, treatment: TaxTreatment, net = '1000', vat = '200') {
  const out: Partial<Record<VatBox, string>> = {};
  for (const [box, amount] of vatBoxContributions(direction, treatment, D(net), D(vat))) out[box] = amount.toFixed(2);
  return out;
}

describe('vatBoxContributions (UK VAT return)', () => {
  it('standard-rated sale: box 1 VAT, box 6 net', () => {
    expect(boxes('OUTPUT', 'STANDARD')).toEqual({ box1: '200.00', box6: '1000.00' });
  });

  it('standard-rated purchase: box 4 VAT, box 7 net', () => {
    expect(boxes('INPUT', 'STANDARD')).toEqual({ box4: '200.00', box7: '1000.00' });
  });

  it.each(['ZERO', 'EXEMPT'] as const)('%s sale/purchase counts in boxes 6/7 only', (t) => {
    expect(boxes('OUTPUT', t, '500', '0')).toEqual({ box1: '0.00', box6: '500.00' });
    expect(boxes('INPUT', t, '500', '0')).toEqual({ box4: '0.00', box7: '500.00' });
  });

  it('outside the scope is excluded entirely', () => {
    expect(boxes('OUTPUT', 'OUTSIDE_SCOPE', '500', '0')).toEqual({});
    expect(boxes('INPUT', 'OUTSIDE_SCOPE', '500', '0')).toEqual({});
  });

  it('domestic reverse charge – supplier: net in box 6, no VAT', () => {
    expect(boxes('OUTPUT', 'DOMESTIC_REVERSE_CHARGE')).toEqual({ box6: '1000.00' });
  });

  it('domestic reverse charge – customer: VAT in boxes 1 and 4, net in box 7 only', () => {
    expect(boxes('INPUT', 'DOMESTIC_REVERSE_CHARGE')).toEqual({ box1: '200.00', box4: '200.00', box7: '1000.00' });
  });

  it('imported services reverse charge: VAT in 1 and 4, net in 6 and 7', () => {
    expect(boxes('INPUT', 'REVERSE_CHARGE_SERVICES')).toEqual({
      box1: '200.00',
      box4: '200.00',
      box6: '1000.00',
      box7: '1000.00',
    });
  });

  it('postponed import VAT: VAT in 1 and 4, net in 7', () => {
    expect(boxes('INPUT', 'POSTPONED_IMPORT_VAT')).toEqual({ box1: '200.00', box4: '200.00', box7: '1000.00' });
  });

  it.each(['REVERSE_CHARGE_SERVICES', 'POSTPONED_IMPORT_VAT'] as const)('%s cannot be a sale', (t) => {
    expect(() => boxes('OUTPUT', t)).toThrow();
  });

  it('credit notes reduce the boxes', () => {
    expect(boxes('OUTPUT', 'STANDARD', '-100', '-20')).toEqual({ box1: '-20.00', box6: '-100.00' });
  });
});
