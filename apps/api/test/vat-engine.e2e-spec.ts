import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { Prisma } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/validation/validation.pipe';
import { RolesService } from '../src/roles/roles.service';
import { loadTaxCodeIds } from './tax-codes.helper';

/** Stage 2 (Phase 26): tax-coded sales invoices feed a ledger-derived VAT return. */
describe('VAT engine (Stage 2 E2E)', () => {
  let app: INestApplication;
  let tax: Record<string, string>;
  let token: string;
  let orgId: string;
  let salesAccountId: string;
  let customerId: string;
  // A date no other suite posts on, so box deltas are attributable to this test.
  const day = '2026-04-27';

  const http = () => request(app.getHttpServer());
  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`).set('x-organization-id', orgId);
  const vatReturn = async () => (await auth(http().get(`/api/v1/organizations/${orgId}/vat-return?from=${day}&to=${day}`)).expect(200)).body;
  const trialBalance = async () =>
    (await auth(http().get(`/api/v1/organizations/${orgId}/reports/trial-balance`)).expect(200)).body;
  const delta = (after: any, before: any, box: string) => new Prisma.Decimal(after.boxes[box]).minus(before.boxes[box]).toFixed(2);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser('test-secret-at-least-32-characters-long'));
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(createValidationPipe());
    await app.get(RolesService).seedGlobalPermissions();
    await app.init();
    tax = await loadTaxCodeIds(app);

    const login = await http().post('/api/v1/auth/login').send({ email: 'owner@democonsulting.com', password: 'Password1234!' }).expect(200);
    token = login.body.accessToken;
    orgId = (await http().get('/api/v1/organizations').set('Authorization', `Bearer ${token}`).expect(200)).body[0].organization.id;
    salesAccountId = (await auth(http().get(`/api/v1/organizations/${orgId}/accounts`)).expect(200)).body.find((a: any) => a.code === '4000').id;
    customerId = (
      await auth(http().post(`/api/v1/organizations/${orgId}/contacts`))
        .send({ name: `VAT Customer ${Date.now()}`, type: 'CUSTOMER', country: 'GB' })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  const createInvoice = (lines: Array<Record<string, unknown>>) =>
    auth(http().post(`/api/v1/organizations/${orgId}/invoices`))
      .send({ contactId: customerId, issueDate: day, dueDate: '2026-05-27', lines })
      .expect(201)
      .then((r) => r.body);

  it('lists the dated UK tax codes', async () => {
    const codes = (await http().get('/api/v1/tax-codes?date=2026-04-27').set('Authorization', `Bearer ${token}`).expect(200)).body;
    const byCode = Object.fromEntries(codes.map((c: any) => [c.code, c.rate]));
    expect(byCode).toMatchObject({ UK_SR: '0.2000', UK_RR: '0.0500', UK_ZR: '0.0000', UK_EX: '0.0000', UK_OS: '0.0000' });
    const historic = (await http().get('/api/v1/tax-codes?date=2010-06-01').set('Authorization', `Bearer ${token}`).expect(200)).body;
    expect(historic.find((c: any) => c.code === 'UK_SR').rate).toBe('0.1750');
  });

  it('blocks posting an invoice line without a tax code', async () => {
    const inv = await createInvoice([{ accountId: salesAccountId, description: 'No code', quantity: 1, unitPrice: 50, taxRate: 0.2 }]);
    const res = await auth(http().post(`/api/v1/organizations/${orgId}/invoices/${inv.id}/post`)).expect(422);
    expect(JSON.stringify(res.body)).toContain('TAX_CODE_REQUIRED');
  });

  it('posts a mixed-rate invoice, stores tax analysis, and feeds VAT boxes 1 and 6', async () => {
    const before = await vatReturn();

    const inv = await createInvoice([
      { accountId: salesAccountId, description: 'Consulting', quantity: 1, unitPrice: '1000.00', taxCodeId: tax.UK_SR },
      { accountId: salesAccountId, description: 'Fuel', quantity: 3, unitPrice: '10.03', taxCodeId: tax.UK_RR },
      { accountId: salesAccountId, description: 'Books', quantity: 1, unitPrice: '40.00', taxCodeId: tax.UK_ZR },
      { accountId: salesAccountId, description: 'Disbursement', quantity: 1, unitPrice: '15.00', taxCodeId: tax.UK_OS },
    ]);
    // VAT: 200.00 + 1.50 (30.09 * 5% = 1.5045) + 0 + 0
    expect(new Prisma.Decimal(inv.taxTotal).toFixed(2)).toBe('201.50');
    expect(new Prisma.Decimal(inv.totalAmount).toFixed(2)).toBe('1286.59');

    const tbBefore = await trialBalance();
    await auth(http().post(`/api/v1/organizations/${orgId}/invoices/${inv.id}/post`)).expect(200);
    const tbAfter = await trialBalance();
    expect(tbAfter.isBalanced).toBe(true);
    expect(tbAfter.difference).toBe('0.00');
    expect(tbBefore.isBalanced).toBe(true);

    const after = await vatReturn();
    expect(delta(after, before, 'box1')).toBe('201.50');
    expect(delta(after, before, 'box4')).toBe('0.00');
    // Box 6 is whole pounds: 1000 + 30.09 + 40 (outside scope excluded) = 1070.09 -> delta 1070 (+/-1 from truncation)
    expect(Math.abs(Number(delta(after, before, 'box6')) - 1070)).toBeLessThanOrEqual(1);
    expect(after.reconciliation.reconciled).toBe(true);

    const box1Lines = (await auth(http().get(`/api/v1/organizations/${orgId}/vat-return/boxes/box1/lines?from=${day}&to=${day}`)).expect(200)).body;
    const ours = box1Lines.filter((l: any) => ['UK_SR', 'UK_RR', 'UK_ZR'].includes(l.taxCode) && l.journalId);
    expect(ours.length).toBeGreaterThanOrEqual(3);
    expect(box1Lines.some((l: any) => l.taxCode === 'UK_OS')).toBe(false);

    // Voiding reverses the journal on the void date, taking the VAT back out in that period.
    const wide = async () =>
      (await auth(http().get(`/api/v1/organizations/${orgId}/vat-return?from=${day}&to=2099-12-31`)).expect(200)).body;
    const beforeVoid = await wide();
    await auth(http().post(`/api/v1/organizations/${orgId}/invoices/${inv.id}/void`)).send({ reason: 'VAT test void' }).expect(200);
    const afterVoid = await wide();
    expect(delta(afterVoid, beforeVoid, 'box1')).toBe('-201.50');
    expect((await trialBalance()).isBalanced).toBe(true);
  });

  it('rejects purchase-only tax codes on sales invoices', async () => {
    const res = await auth(http().post(`/api/v1/organizations/${orgId}/invoices`))
      .send({
        contactId: customerId,
        issueDate: day,
        dueDate: '2026-05-27',
        lines: [{ accountId: salesAccountId, description: 'x', quantity: 1, unitPrice: 10, taxCodeId: tax.UK_RC_SERV }],
      })
      .expect(400);
    expect(JSON.stringify(res.body)).toContain('VALIDATION_FAILED');
  });
});
