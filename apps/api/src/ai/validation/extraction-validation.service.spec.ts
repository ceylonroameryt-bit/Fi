import { MoneyService } from '../../accounting-engine/money.service';
import type { RawExtractionResult } from '../providers/llm-provider.interface';
import { ExtractionValidationService } from './extraction-validation.service';

const TODAY = new Date('2026-10-16T00:00:00Z');

function bill(over: Partial<RawExtractionResult> = {}): RawExtractionResult {
  return {
    invoiceNumber: 'ABC-1001',
    invoiceDate: '2026-09-30',
    dueDate: '2026-10-30',
    currency: 'GBP',
    issuer: { name: 'ABC Fuel Ltd', vatNumber: 'GB999999973' },
    recipient: { name: 'Blynt Petrol Station Ltd' },
    lines: [
      { description: 'Diesel', quantity: '1000', unitPrice: '1.20', net: '1200.00', vat: '240.00', total: '1440.00' },
      { description: 'Delivery', quantity: '1', unitPrice: '50.00', net: '50.00', vat: '10.00', total: '60.00' },
    ],
    subtotal: '1250.00',
    vatTotal: '250.00',
    total: '1500.00',
    ...over,
  };
}

function deepFreeze<T>(o: T): T {
  Object.values(o as object).forEach((v) => v && typeof v === 'object' && deepFreeze(v));
  return Object.freeze(o);
}

describe('ExtractionValidationService', () => {
  let prisma: any;
  let service: ExtractionValidationService;
  const run = (extraction: RawExtractionResult, extra: Record<string, unknown> = {}) =>
    service.validate({
      organizationId: 'org-1',
      documentId: 'doc-1',
      extraction: deepFreeze(extraction),
      baseCurrency: 'GBP',
      today: TODAY,
      ...extra,
    });
  const statusOf = async (extraction: RawExtractionResult, field: string, extra?: Record<string, unknown>) =>
    (await run(extraction, extra)).fields[field]?.status;

  beforeEach(() => {
    prisma = { aiExtraction: { findMany: jest.fn().mockResolvedValue([]) } };
    service = new ExtractionValidationService(prisma, new MoneyService());
  });

  it('marks every field of a consistent bill as verified', async () => {
    const v = await run(bill());
    expect(v.consistent).toBe(true);
    expect(v.findings).toEqual([]);
    for (const f of ['invoiceNumber', 'invoiceDate', 'dueDate', 'currency', 'issuer.vatNumber', 'subtotal', 'vatTotal', 'total', 'lines[1].net', 'lines[2].vat']) {
      expect(v.fields[f]).toEqual({ status: 'verified', findings: [] });
    }
  });

  it('never changes the extracted values (input is frozen; no corrections)', async () => {
    const input = bill({ total: '9999.99' });
    await expect(run(input)).resolves.toBeDefined();
    expect(input.total).toBe('9999.99');
  });

  it('flags line nets that do not add up to the subtotal', async () => {
    const v = await run(bill({ subtotal: '1300.00', total: '1550.00' }));
    expect(v.consistent).toBe(false);
    expect(v.fields.subtotal.status).toBe('inconsistent');
    expect(v.fields['lines[1].net'].status).toBe('inconsistent');
    expect(v.findings.map((f) => f.rule)).toContain('LINES_SUM_TO_SUBTOTAL');
  });

  it('flags net + VAT not equal to the total', async () => {
    const v = await run(bill({ total: '1490.00' }));
    expect(v.fields.total.status).toBe('inconsistent');
    expect(v.findings.find((f) => f.rule === 'NET_PLUS_VAT_EQUALS_TOTAL')?.message).toContain('1250.00 + 250.00 = 1500.00');
  });

  it('flags a line whose VAT is not 0%, 5% or 20% of its net (within a penny)', async () => {
    const lines = bill().lines.map((l, i) => (i === 0 ? { ...l, vat: '230.00', total: '1430.00' } : l));
    const v = await run(bill({ lines, vatTotal: '240.00', total: '1490.00' }));
    expect(v.fields['lines[1].vat'].status).toBe('inconsistent');
    expect(v.fields['lines[2].vat'].status).toBe('verified');
  });

  it('accepts line-level rounding of VAT within a penny', async () => {
    const lines = [{ description: 'Widgets', net: '10.03', vat: '2.01' }];
    expect(await statusOf(bill({ lines, subtotal: '10.03', vatTotal: '2.01', total: '12.04' }), 'lines[1].vat')).toBe('verified');
  });

  it('flags line VATs that do not add up to the VAT total', async () => {
    expect(await statusOf(bill({ vatTotal: '260.00', total: '1510.00' }), 'vatTotal')).toBe('inconsistent');
  });

  it('flags a UK VAT number with bad check digits, but not a foreign one', async () => {
    expect(await statusOf(bill({ issuer: { name: 'ABC Fuel Ltd', vatNumber: 'GB123456789' } }), 'issuer.vatNumber')).toBe('inconsistent');
    expect(await statusOf(bill({ issuer: { name: 'ABC GmbH', vatNumber: 'DE123456789' } }), 'issuer.vatNumber')).toBe('verified');
  });

  it.each([
    ['an invoice dated more than 31 days ahead', { invoiceDate: '2026-12-01', dueDate: '2026-12-31' }, 'invoiceDate'],
    ['an invoice older than 6 years', { invoiceDate: '2020-01-01', dueDate: '2020-01-31' }, 'invoiceDate'],
    ['a due date before the invoice date', { dueDate: '2026-09-01' }, 'dueDate'],
  ])('flags %s', async (_, over, field) => {
    expect(await statusOf(bill(over), field)).toBe('inconsistent');
  });

  it('reports a missing currency as missing and a foreign currency as inconsistent', async () => {
    expect(await statusOf(bill({ currency: undefined }), 'currency')).toBe('missing');
    expect(await statusOf(bill({ currency: 'EUR' }), 'currency')).toBe('inconsistent');
  });

  it('marks absent fields missing, including values dropped by extraction verification', async () => {
    const v = await run(bill({ dueDate: undefined, total: undefined }), {
      verificationIssues: [{ field: 'total', issue: 'VALUE_NOT_IN_SOURCE' }],
    });
    expect(v.fields.dueDate).toEqual({ status: 'missing', findings: [] });
    expect(v.fields.total.status).toBe('missing');
    expect(v.fields.total.findings[0]).toContain('VALUE_NOT_IN_SOURCE');
    // Cannot check net + VAT = total without a total, so that rule is not reported as passing or failing.
    expect(v.findings.map((f) => f.rule)).not.toContain('NET_PLUS_VAT_EQUALS_TOTAL');
  });

  it('flags a duplicate: same supplier (by VAT number) and invoice number on another active document', async () => {
    prisma.aiExtraction.findMany.mockResolvedValue([
      { documentId: 'doc-0', issuerTaxId: 'GB 999 9999 73', issuerName: 'Other name', document: { status: 'AWAITING_REVIEW', classifications: [] } },
    ]);
    const v = await run(bill());
    expect(v.fields.invoiceNumber.status).toBe('inconsistent');
    expect(v.findings.find((f) => f.rule === 'DUPLICATE_DOCUMENT')).toMatchObject({ fields: ['invoiceNumber'], message: expect.stringContaining('doc-0') });
    const where = prisma.aiExtraction.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ organizationId: 'org-1', documentId: { not: 'doc-1' } });
  });

  it('does not treat the same invoice number from a different supplier, or a rejected document, as a duplicate', async () => {
    prisma.aiExtraction.findMany.mockResolvedValue([
      { documentId: 'doc-2', issuerTaxId: 'GB999999918', issuerName: 'Someone Else Ltd', document: { status: 'AWAITING_REVIEW', classifications: [] } },
      { documentId: 'doc-3', issuerTaxId: 'GB999999973', issuerName: 'ABC Fuel Ltd', document: { status: 'REJECTED', classifications: [] } },
    ]);
    expect(await statusOf(bill(), 'invoiceNumber')).toBe('verified');
  });

  it('matches a duplicate by supplier contact when VAT numbers are absent', async () => {
    prisma.aiExtraction.findMany.mockResolvedValue([
      { documentId: 'doc-4', issuerTaxId: null, issuerName: 'A.B.C. Fuel', document: { status: 'DRAFT_CREATED', classifications: [{ entityId: 'sup-1' }] } },
    ]);
    const v = await run(bill({ issuer: { name: 'ABC Fuel Ltd' } }), { issuerContactId: 'sup-1' });
    expect(v.fields.invoiceNumber.status).toBe('inconsistent');
  });
});
