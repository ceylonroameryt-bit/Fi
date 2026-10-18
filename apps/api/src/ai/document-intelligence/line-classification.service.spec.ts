import { AiDirection } from '@prisma/client';
import { LineClassificationService, suggestTaxCodeFromAmounts } from './line-classification.service';
import { MoneyService } from '../../accounting-engine/money.service';
import { NEUTRAL_BUSINESS_PROFILE } from '../business-context/business-context.types';

describe('LineClassificationService (Stage 4: no defaults)', () => {
  const prisma: any = { aiFeedback: { findMany: jest.fn().mockResolvedValue([]) } };
  const service = new LineClassificationService(prisma, new MoneyService());
  const classify = (lines: any[]) => service.classifyLines('org-1', lines, AiDirection.PURCHASE, NEUTRAL_BUSINESS_PROFILE, null);

  it('BUG-08: leaves VAT, total and tax classification null when the line shows no VAT', async () => {
    const [line] = await classify([{ description: 'Widgets', net: '120.00' }]);
    expect(line).toMatchObject({
      netAmount: '120.00',
      taxAmount: null,
      totalAmount: null,
      quantity: null,
      unitPrice: null,
      taxClassification: null,
    });
  });

  it('BUG-10: never defaults quantity to 1 or price to 0', async () => {
    const [line] = await classify([{ description: 'Mystery' }]);
    expect(line).toMatchObject({ quantity: null, unitPrice: null, netAmount: null, taxAmount: null, totalAmount: null });
  });

  it('computes missing net from quantity x unit price in exact decimals (code, not model)', async () => {
    const [line] = await classify([{ description: 'Diesel', quantity: '3', unitPrice: '0.10' }]);
    expect(line.netAmount).toBe('0.30');
  });

  it('computes total only from net + VAT when both are known', async () => {
    const [line] = await classify([{ description: 'Diesel', net: '100.00', vat: '20.00' }]);
    expect(line).toMatchObject({ totalAmount: '120.00', taxClassification: 'UK_SR' });
  });

  it('derives unit price only when net / quantity is exact', async () => {
    const [a, b] = await classify([
      { description: 'Consulting', quantity: '2', net: '200.00' },
      { description: 'Thirds', quantity: '3', net: '100.00' },
    ]);
    expect(a.unitPrice).toBe('100.0000');
    expect(b.unitPrice).toBeNull();
  });

  it('gives a single line the document VAT only when its net equals the document subtotal', async () => {
    const one = (subtotal: string) =>
      service.classifyLines('org-1', [{ description: 'Consulting', net: '200.00' }], AiDirection.SALE, NEUTRAL_BUSINESS_PROFILE, null, {
        subtotal,
        vatTotal: '40.00',
      });
    expect((await one('200.00'))[0]).toMatchObject({ taxAmount: '40.00', taxClassification: 'UK_SR', totalAmount: '240.00' });
    expect((await one('250.00'))[0].taxAmount).toBeNull();
    const two = await service.classifyLines(
      'org-1',
      [{ description: 'A', net: '100.00' }, { description: 'B', net: '100.00' }],
      AiDirection.SALE,
      NEUTRAL_BUSINESS_PROFILE,
      null,
      { subtotal: '200.00', vatTotal: '40.00' },
    );
    expect(two.map((l) => l.taxAmount)).toEqual([null, null]);
  });

  it('does not assume an industry: fuel for an unknown business is a travel expense, not stock', async () => {
    const [line] = await classify([{ description: 'Unleaded petrol', net: '50.00' }]);
    expect(line.productType).toBe('EXPENSE');
  });
});

describe('suggestTaxCodeFromAmounts', () => {
  it.each([
    ['100.00', '20.00', 'UK_SR'],
    ['30.09', '1.50', 'UK_RR'],
    ['10.03', '2.01', 'UK_SR'],
    ['100.00', '0.00', null], // zero-rated, exempt and outside scope all look the same
    ['100.00', '17.50', null], // not a current UK rate
    ['0.00', '0.00', null],
    [null, '20.00', null],
    ['100.00', null, null],
  ])('net %p VAT %p -> %p', (net, vat, expected) => {
    expect(suggestTaxCodeFromAmounts(new MoneyService(), net, vat)).toBe(expected);
  });
});
