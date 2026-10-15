import { Prisma } from '@prisma/client';
import { MoneyService } from '../../accounting-engine/money.service';
import { AiGatewayService } from '../gateway/ai-gateway.service';
import { FakeAiProvider } from '../gateway/providers/fake.provider';
import type { ClassifiedLineResult } from '../document-intelligence/line-classification.service';
import { CodingSuggestionService } from './coding-suggestion.service';

const D = (v: string) => new Prisma.Decimal(v);
const rate = (r: string) => [{ rate: D(r), effectiveFrom: new Date('2011-01-04'), effectiveTo: null }];

const ACCOUNTS = [
  { id: 'a-fuel', code: '5100', name: 'Fuel', accountType: 'EXPENSE', accountSubtype: 'OPERATING_EXPENSE', isActive: true, isControlAccount: false },
  { id: 'a-repairs', code: '7300', name: 'Vehicle repairs', accountType: 'EXPENSE', accountSubtype: 'OPERATING_EXPENSE', isActive: true, isControlAccount: false },
  { id: 'a-old', code: '7999', name: 'Old account', accountType: 'EXPENSE', accountSubtype: 'OPERATING_EXPENSE', isActive: false, isControlAccount: false },
  { id: 'a-sales', code: '4000', name: 'Sales', accountType: 'REVENUE', accountSubtype: 'SALES', isActive: true, isControlAccount: false },
  { id: 'a-ap', code: '2000', name: 'Creditors', accountType: 'LIABILITY', accountSubtype: 'ACCOUNTS_PAYABLE', isActive: true, isControlAccount: true },
];
const TAX = [
  { id: 't-sr', code: 'UK_SR', name: 'Standard rate', treatment: 'STANDARD', isActive: true, rates: rate('0.20') },
  { id: 't-zr', code: 'UK_ZR', name: 'Zero rate', treatment: 'ZERO', isActive: true, rates: rate('0') },
  { id: 't-rc', code: 'UK_RC_SERV', name: 'Reverse charge services', treatment: 'REVERSE_CHARGE_SERVICES', isActive: true, rates: rate('0.20') },
];

const history = (description: string, accountId: string, taxCodeId: string, journalNumber: string, date = '2026-03-01') => ({
  description,
  accountId,
  taxCodeId,
  journalEntry: { journalNumber, postingDate: new Date(date) },
});

function line(n: number, description: string, over: Partial<ClassifiedLineResult> = {}): ClassifiedLineResult {
  return {
    lineNumber: n,
    description,
    quantity: null,
    unitPrice: null,
    netAmount: '100.00',
    taxAmount: null,
    totalAmount: null,
    productType: 'UNKNOWN',
    productClassification: 'GENERAL_EXPENSE',
    taxClassification: null,
    accountingCategory: 'GENERAL_EXPENSE',
    confidence: 0.5,
    ...over,
  };
}

describe('CodingSuggestionService', () => {
  let prisma: any;
  let provider: FakeAiProvider;
  let service: CodingSuggestionService;
  const suggest = (lines: ClassifiedLineResult[], over: Record<string, unknown> = {}) =>
    service.suggest({
      organizationId: 'org-1',
      documentId: 'doc-1',
      direction: 'PURCHASE',
      contactId: 'sup-1',
      contactName: 'Hilltop Garage',
      lines,
      postingDate: new Date('2026-04-23'),
      ...over,
    });

  beforeEach(() => {
    prisma = {
      account: { findMany: jest.fn().mockResolvedValue(ACCOUNTS) },
      taxCode: { findMany: jest.fn().mockResolvedValue(TAX) },
      journalLine: { findMany: jest.fn().mockResolvedValue([]) },
      organization: { findUnique: jest.fn().mockResolvedValue({ aiEnabled: true, aiMonthlyCostLimitUsd: null }) },
      aiUsageLog: { create: jest.fn(), aggregate: jest.fn().mockResolvedValue({ _sum: { costUsd: null } }) },
    };
    provider = new FakeAiProvider();
    const gateway = new AiGatewayService(prisma, provider, { AI_MODEL: 'claude-opus-5-5', AI_MONTHLY_COST_LIMIT_USD: 50 } as any);
    service = new CodingSuggestionService(prisma, new MoneyService(), gateway, provider);
  });

  it("uses this supplier's history first: same item on an earlier posted bill", async () => {
    prisma.journalLine.findMany.mockResolvedValue([history('Front tyres fitted', 'a-repairs', 't-sr', 'JNL-2026-000042')]);
    const [c] = await suggest([line(1, 'Front tyres fitted x2')]);
    expect(c).toMatchObject({ accountId: 'a-repairs', taxCode: 'UK_SR', taxCodeId: 't-sr', accountSource: 'HISTORY', taxSource: 'HISTORY' });
    expect(c.reason).toContain('JNL-2026-000042');
    expect(provider.requests).toHaveLength(0);

    const where = prisma.journalLine.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ organizationId: 'org-1', taxDirection: 'INPUT' });
    expect(where.journalEntry).toMatchObject({ organizationId: 'org-1', status: 'POSTED', lines: { some: { contactId: 'sup-1' } } });
  });

  it("uses the supplier's dominant coding when no earlier line resembles this one", async () => {
    prisma.journalLine.findMany.mockResolvedValue([
      history('Service', 'a-repairs', 't-sr', 'J1'),
      history('MOT', 'a-repairs', 't-sr', 'J2'),
      history('Brakes', 'a-repairs', 't-sr', 'J3'),
      history('Wipers', 'a-repairs', 't-sr', 'J4'),
      history('Coffee', 'a-fuel', 't-zr', 'J5'),
    ]);
    const [c] = await suggest([line(1, 'Exhaust replacement')]);
    expect(c).toMatchObject({ accountId: 'a-repairs', taxCode: 'UK_SR', accountSource: 'HISTORY' });
    expect(c.reason).toContain('4 of 5');
  });

  it('lets the VAT printed on the document decide the tax code over history', async () => {
    prisma.journalLine.findMany.mockResolvedValue([history('Diesel', 'a-fuel', 't-zr', 'J9')]);
    const [c] = await suggest([line(1, 'Diesel', { taxAmount: '20.00', taxClassification: 'UK_SR' })]);
    expect(c).toMatchObject({ accountId: 'a-fuel', accountSource: 'HISTORY', taxCode: 'UK_SR', taxSource: 'DOCUMENT' });
  });

  it('ignores history pointing at archived accounts', async () => {
    prisma.journalLine.findMany.mockResolvedValue([history('Diesel', 'a-old', 't-sr', 'J9')]);
    provider.enqueue({ output: { lines: [{ lineNumber: 1, accountCode: null, taxCode: null, reason: 'Not sure' }] } });
    const [c] = await suggest([line(1, 'Diesel')]);
    expect(c).toMatchObject({ accountId: null, accountSource: 'NONE' });
    expect(provider.requests[0].userContent).not.toContain('7999');
  });

  it('asks the model only for lines history could not code, offering only this organisation\'s accounts and valid tax codes', async () => {
    prisma.journalLine.findMany.mockResolvedValue([history('Diesel', 'a-fuel', 't-sr', 'J9')]);
    provider.enqueue({ output: { lines: [{ lineNumber: 2, accountCode: '7300', taxCode: 'UK_SR', reason: 'Vehicle repair work' }] } });
    const result = await suggest([line(1, 'Diesel'), line(2, 'Clutch repair')]);

    expect(result[0].accountSource).toBe('HISTORY');
    expect(result[1]).toMatchObject({ accountId: 'a-repairs', accountSource: 'MODEL', taxCode: 'UK_SR', taxSource: 'MODEL' });
    expect(result[1].reason).toContain('Vehicle repair work');

    const req = provider.requests[0];
    expect(req.userContent).toContain('7300 | Vehicle repairs');
    expect(req.userContent).not.toContain('7999'); // archived
    expect(req.userContent).not.toContain('2000 | Creditors'); // control account
    expect(req.userContent).not.toContain('4000 | Sales'); // wrong side for a purchase
    expect(req.userContent).not.toMatch(/1\. Diesel/); // already coded from history
    // The structured-output schema itself only allows this organisation's codes.
    const bad = { lines: [{ lineNumber: 2, accountCode: '9999', taxCode: null, reason: 'x' }] };
    const good = { lines: [{ lineNumber: 2, accountCode: '7300', taxCode: 'UK_ZR', reason: 'x' }] };
    expect(req.schema.safeParse(bad).success).toBe(false);
    expect(req.schema.safeParse(good).success).toBe(true);
  });

  it('drops a model tax code that contradicts the VAT printed on the line', async () => {
    provider.enqueue({ output: { lines: [{ lineNumber: 1, accountCode: '7300', taxCode: 'UK_SR', reason: 'repair' }] } });
    const [c] = await suggest([line(1, 'Repair', { taxAmount: '0.00' })]);
    expect(c.accountId).toBe('a-repairs');
    expect(c.taxCode).toBeNull();
    expect(c.reason).toContain('contradicts');
  });

  it('accepts a zero-rate or reverse-charge code when the line shows no VAT', async () => {
    provider.enqueue({ output: { lines: [{ lineNumber: 1, accountCode: '7300', taxCode: 'UK_RC_SERV', reason: 'overseas service' }] } });
    const [c] = await suggest([line(1, 'Cloud hosting (Ireland)', { taxAmount: '0.00' })]);
    expect(c.taxCode).toBe('UK_RC_SERV');
  });

  it('never offers purchase-only tax codes for a sale', async () => {
    provider.enqueue({ output: { lines: [{ lineNumber: 1, accountCode: '4000', taxCode: 'UK_SR', reason: 'sale' }] } });
    await suggest([line(1, 'Consulting')], { direction: 'SALE', contactId: null });
    expect(provider.requests[0].userContent).not.toContain('UK_RC_SERV');
    expect(provider.requests[0].userContent).toContain('4000 | Sales');
  });

  it('leaves lines uncoded (with a reason) when there is no history and no AI provider', async () => {
    const noAi = new CodingSuggestionService(prisma, new MoneyService(), {} as any, null);
    const [c] = await noAi.suggest({
      organizationId: 'org-1',
      documentId: 'doc-1',
      direction: 'PURCHASE',
      contactId: null,
      contactName: null,
      lines: [line(1, 'Mystery item')],
      postingDate: null,
    });
    expect(c).toMatchObject({ accountId: null, taxCode: null, accountSource: 'NONE', taxSource: 'NONE' });
  });
});
