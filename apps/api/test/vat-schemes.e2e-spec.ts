import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { Prisma } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { createValidationPipe } from '../src/common/validation/validation.pipe';
import { RolesService } from '../src/roles/roles.service';
import { loadTaxCodeIds } from './tax-codes.helper';

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

/** Stage 0 (sales & purchases): dated VAT schemes – standard, Flat Rate, not registered, cash accounting. */
describe('VAT schemes (Stage 0 E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let orgId: string;
  let tax: Record<string, string>;
  const acc: Record<string, string> = {};
  let customerId: string;
  let supplierId: string;
  const run = Date.now();

  const http = () => request(app.getHttpServer());
  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`).set('x-organization-id', orgId);
  const api = (p: string) => `/api/v1/organizations/${orgId}${p}`;
  const vatReturn = (from: string, to: string) => auth(http().get(api(`/vat-return?from=${from}&to=${to}`)));
  const trialBalance = async () => (await auth(http().get(api('/reports/trial-balance'))).expect(200)).body;
  const setScheme = (body: Record<string, unknown>) => auth(http().put(api('/vat-scheme'))).send(body);

  async function sell(date: string, lines: Array<[string, string, string]>, status: number) {
    const inv = (
      await auth(http().post(api('/invoices')))
        .send({ contactId: customerId, issueDate: date, dueDate: date, lines: lines.map(([account, net, code]) => ({ accountId: acc[account], description: 'Goods', quantity: 1, unitPrice: net, taxCodeId: tax[code] })) })
        .expect(201)
    ).body;
    return auth(http().post(api(`/invoices/${inv.id}/post`))).send({}).expect(status);
  }
  async function buy(date: string, lines: Array<[string, string, string]>, status: number) {
    const bill = (
      await auth(http().post(api('/bills')))
        .send({ contactId: supplierId, supplierInvoiceNumber: `S-${date}-${Math.random()}`, issueDate: date, lines: lines.map(([account, net, code]) => ({ accountId: acc[account], description: 'Purchase', netAmount: net, taxCodeId: tax[code] })) })
        .expect(201)
    ).body;
    return auth(http().post(api(`/bills/${bill.id}/approve`))).send({}).expect(status);
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser('test-secret-at-least-32-characters-long'));
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(createValidationPipe());
    await app.get(RolesService).seedGlobalPermissions();
    await app.init();
    prisma = app.get(PrismaService);
    tax = await loadTaxCodeIds(app);

    token = (await http().post('/api/v1/auth/login').send({ email: 'owner@democonsulting.com', password: 'Password1234!' }).expect(200)).body.accessToken;
    orgId = (
      await http().post('/api/v1/organizations').set('Authorization', `Bearer ${token}`).send({ name: `Scheme Test ${run} Ltd`, country: 'GB', baseCurrency: 'GBP', timezone: 'Europe/London' }).expect(201)
    ).body.id;
    await auth(http().post(api('/financial-years'))).send({ name: 'FY 2026/27', startDate: '2026-04-01', endDate: '2027-03-31', generatePeriods: true }).expect(201);
    for (const a of await prisma.account.findMany({ where: { organizationId: orgId } })) acc[a.code] = a.id;
    customerId = (await auth(http().post(api('/contacts'))).send({ name: `Customer ${run}`, type: 'CUSTOMER', country: 'GB' }).expect(201)).body.id;
    supplierId = (await auth(http().post(api('/contacts'))).send({ name: `Supplier ${run}`, type: 'SUPPLIER', country: 'GB' }).expect(201)).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('an organisation with no scheme set is treated as standard (and the AI profile says "not stated")', async () => {
    const s = (await auth(http().get(api('/vat-scheme'))).expect(200)).body;
    expect(s).toMatchObject({ current: { scheme: 'STANDARD', startDate: null }, history: [], defaulted: true });
    expect((await auth(http().get(api('/ai/business-profile'))).expect(200)).body.vatScheme).toBeNull();
  });

  it('standard scheme (Apr–Jun): boxes on the invoice basis', async () => {
    await sell('2026-05-10', [['4000', '1000.00', 'UK_SR']], 200);
    await buy('2026-05-12', [['6700', '500.00', 'UK_SR']], 200);
    const r = (await vatReturn('2026-04-01', '2026-06-30').expect(200)).body;
    expect(r).toMatchObject({ scheme: 'STANDARD', flatRatePercent: null });
    expect(r.boxes).toMatchObject({ box1: '200.00', box4: '100.00', box5: '100.00', box6: '1000', box7: '500' });
    expect(r.reconciliation.reconciled).toBe(true);
  });

  it('validates scheme changes: forward only, flat-rate percentage rules', async () => {
    const back = await setScheme({ scheme: 'FLAT_RATE', startDate: '2026-05-01', flatRatePercent: 12.5 }).expect(409);
    expect(JSON.stringify(back.body)).toContain('VAT_SCHEME_BACKDATED');
    await setScheme({ scheme: 'FLAT_RATE', startDate: '2026-07-01' }).expect(400); // percentage required
    await setScheme({ scheme: 'FLAT_RATE', startDate: '2026-07-01', flatRatePercent: 20 }).expect(400); // above 16.5
    await setScheme({ scheme: 'FLAT_RATE', startDate: '2026-07-01', flatRatePercent: 12.5, limitedCostTrader: true }).expect(400);
    await setScheme({ scheme: 'STANDARD', startDate: '2026-07-01', flatRatePercent: 12.5 }).expect(400);
  });

  it('Flat Rate from 1 July: box 1 = 12.5% of VAT-inclusive turnover; only a ≥ £2,000 capital asset is reclaimed', async () => {
    const set = (await setScheme({ scheme: 'FLAT_RATE', startDate: '2026-07-01', flatRatePercent: 12.5 }).expect(200)).body;
    expect(set).toEqual({ scheme: 'FLAT_RATE', startDate: '2026-07-01', flatRatePercent: '12.50', limitedCostTrader: false });
    const audit = await prisma.auditLog.findFirst({ where: { organizationId: orgId, eventType: 'VAT_SCHEME_CHANGED' } });
    expect(audit).toBeTruthy();

    await sell('2026-07-10', [['4000', '1000.00', 'UK_SR'], ['4000', '100.00', 'UK_ZR']], 200);
    await buy('2026-07-12', [['6700', '500.00', 'UK_SR']], 200); // ordinary purchase: no reclaim
    await buy('2026-07-15', [['1510', '2000.00', 'UK_SR']], 200); // capital asset, 2,400 incl. VAT
    await buy('2026-07-16', [['1510', '1000.00', 'UK_SR']], 200); // capital asset under £2,000: no reclaim

    const r = (await vatReturn('2026-07-01', '2026-09-30').expect(200)).body;
    expect(r).toMatchObject({ scheme: 'FLAT_RATE', flatRatePercent: '12.50' });
    // Turnover 1,200 + 100 = 1,300 → 12.5% = 162.50. Reclaim 400 on the £2,400 asset only.
    expect(r.boxes).toMatchObject({ box1: '162.50', box4: '400.00', box5: '-237.50', box6: '1300', box7: '2000' });
    // Ledger VAT control: 200 charged − 100 − 400 − 200 reclaimed in the ledger = −500; HMRC owes 237.50 → not reconciled yet.
    expect(r.reconciliation).toMatchObject({ vatControlMovement: '-500.00', difference: '-262.50', reconciled: false });

    expect(JSON.stringify((await auth(http().get(api('/vat-return/boxes/box1/lines?from=2026-07-01&to=2026-09-30'))).expect(422)).body)).toContain('VAT_SCHEME_NOT_SUPPORTED');
    expect((await auth(http().get(api('/ai/business-profile'))).expect(200)).body.vatScheme).toBe('FLAT_RATE');
  });

  it('a return may not straddle a scheme change', async () => {
    const res = await vatReturn('2026-06-01', '2026-07-31').expect(422);
    expect(JSON.stringify(res.body)).toContain('VAT_SCHEME_CHANGED_IN_PERIOD');
  });

  it('the flat-rate adjustment posts the shortfall through the posting engine, once; then the return reconciles', async () => {
    const res = (await auth(http().post(api('/vat-return/flat-rate-adjustment'))).send({ from: '2026-07-01', to: '2026-09-30' }).expect(200)).body;
    expect(res).toMatchObject({ posted: true, amount: '-262.50' });
    const journal = await prisma.journalEntry.findFirstOrThrow({ where: { organizationId: orgId, journalNumber: res.journalNumber }, include: { lines: { include: { account: true } } } });
    expect(journal).toMatchObject({ status: 'POSTED', sourceType: 'SYSTEM', journalType: 'TAX' });
    const dr = journal.lines.reduce((s, l) => s.plus(l.debit), D(0));
    const cr = journal.lines.reduce((s, l) => s.plus(l.credit), D(0));
    expect(dr.equals(cr)).toBe(true);
    expect(journal.lines.find((l) => l.account.accountSubtype === 'TAX_PAYABLE')!.credit.toFixed(2)).toBe('262.50');
    expect(journal.lines.find((l) => l.account.accountSubtype === 'OTHER_INCOME')!.debit.toFixed(2)).toBe('262.50');
    expect((await trialBalance()).isBalanced).toBe(true);

    const after = (await vatReturn('2026-07-01', '2026-09-30').expect(200)).body;
    expect(after.boxes.box5).toBe('-237.50'); // unchanged: the adjustment has no tax code
    expect(after.reconciliation).toMatchObject({ vatControlMovement: '-237.50', reconciled: true });

    const again = await auth(http().post(api('/vat-return/flat-rate-adjustment'))).send({ from: '2026-07-01', to: '2026-09-30' }).expect(409);
    expect(JSON.stringify(again.body)).toContain('VAT_FLAT_RATE_ADJUSTMENT_EXISTS');
    const standardPeriod = await auth(http().post(api('/vat-return/flat-rate-adjustment'))).send({ from: '2026-04-01', to: '2026-06-30' }).expect(422);
    expect(JSON.stringify(standardPeriod.body)).toContain('VAT_SCHEME_NOT_SUPPORTED');
  });

  it('not registered from 1 October: VAT codes are refused at posting; outside the scope posts; no VAT return', async () => {
    await setScheme({ scheme: 'NOT_REGISTERED', startDate: '2026-10-01' }).expect(200);
    const refused = await sell('2026-10-05', [['4000', '300.00', 'UK_SR']], 422);
    expect(JSON.stringify(refused.body)).toContain('not VAT-registered');
    const refusedBill = await buy('2026-10-06', [['6700', '120.00', 'UK_SR']], 422);
    expect(JSON.stringify(refusedBill.body)).toContain('not VAT-registered');
    await sell('2026-10-07', [['4000', '300.00', 'UK_OS']], 200);
    await buy('2026-10-08', [['6700', '120.00', 'UK_OS']], 200);
    expect((await trialBalance()).isBalanced).toBe(true);
    expect(JSON.stringify((await vatReturn('2026-10-01', '2026-12-31').expect(422)).body)).toContain('VAT_NOT_REGISTERED');
  });

  it('cash accounting is recorded but its return is refused until payments exist (Stage 3)', async () => {
    await setScheme({ scheme: 'CASH_ACCOUNTING', startDate: '2027-01-01' }).expect(200);
    expect(JSON.stringify((await vatReturn('2027-01-01', '2027-03-31').expect(422)).body)).toContain('VAT_SCHEME_NOT_SUPPORTED');
    const s = (await auth(http().get(api('/vat-scheme'))).expect(200)).body;
    expect(s.history.map((h: any) => `${h.scheme}@${h.startDate}`)).toEqual(['FLAT_RATE@2026-07-01', 'NOT_REGISTERED@2026-10-01', 'CASH_ACCOUNTING@2027-01-01']);
  });

  it('the AI business profile no longer sets the VAT scheme', async () => {
    await auth(http().put(api('/ai/business-profile'))).send({ vatScheme: 'STANDARD' }).expect(400);
  });
});
