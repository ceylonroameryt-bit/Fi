import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { createValidationPipe } from '../src/common/validation/validation.pipe';
import { RolesService } from '../src/roles/roles.service';
import { JobWorkerService } from '../src/jobs/job-worker.service';
import { loadTaxCodeIds } from './tax-codes.helper';

/**
 * Stage 10 (Phase 47): account & tax suggestions from the counterparty's posted history.
 * Uses a customer (sales invoices are the posted history available before supplier bills exist).
 */
describe('Account & tax suggestion (Stage 10 E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let orgId: string;
  let orgName: string;
  let salesAccountId: string;
  let journalNumber: string;
  const run = Date.now();
  const customerName = `Retainer Client ${run}`;

  const http = () => request(app.getHttpServer());
  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`).set('x-organization-id', orgId);
  const api = (p: string) => `/api/v1/organizations/${orgId}${p}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser('test-secret-at-least-32-characters-long'));
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(createValidationPipe());
    await app.get(RolesService).seedGlobalPermissions();
    await app.init();
    prisma = app.get(PrismaService);
    const tax = await loadTaxCodeIds(app);

    const login = await http().post('/api/v1/auth/login').send({ email: 'owner@democonsulting.com', password: 'Password1234!' }).expect(200);
    token = login.body.accessToken;
    orgId = (await http().get('/api/v1/organizations').set('Authorization', `Bearer ${token}`).expect(200)).body[0].organization.id;
    orgName = (await prisma.organization.update({ where: { id: orgId }, data: { aiEnabled: true } })).name;
    salesAccountId = (await auth(http().get(api('/accounts'))).expect(200)).body.find((a: any) => a.code === '4000').id;

    // Posted history: one invoice to this customer for the retainer.
    const customer = (await auth(http().post(api('/contacts'))).send({ name: customerName, type: 'CUSTOMER', country: 'GB' }).expect(201)).body;
    const invoice = (
      await auth(http().post(api('/invoices')))
        .send({
          contactId: customer.id,
          issueDate: '2026-04-01',
          dueDate: '2026-04-30',
          lines: [{ accountId: salesAccountId, description: 'Monthly bookkeeping retainer', quantity: 1, unitPrice: 500, taxCodeId: tax.UK_SR }],
        })
        .expect(201)
    ).body;
    const posted = (await auth(http().post(api(`/invoices/${invoice.id}/post`))).expect(200)).body;
    journalNumber = (await prisma.journalEntry.findUniqueOrThrow({ where: { id: posted.invoice.journalEntryId } })).journalNumber;
  });

  afterAll(async () => {
    await prisma.organization.update({ where: { id: orgId }, data: { aiEnabled: false } });
    await app.close();
  });

  it("codes a line from the customer's posted history and records why; unknown lines stay uncoded", async () => {
    const text = [
      `Supplier: ${orgName}`,
      `Invoice No: RET-${run}`,
      'Invoice Date: 2026-05-01',
      `Bill To: ${customerName}`,
      'Monthly bookkeeping retainer May 500.00',
      'Courier recharge 40.00',
      'Subtotal: 540.00',
      'VAT 20%: 108.00',
      'Total: 648.00',
    ].join('\n');
    const accepted = (await auth(http().post(api('/ai/documents/upload'))).send({ fileName: 'ret.txt', mimeType: 'text/plain', text }).expect(202)).body;
    await app.get(JobWorkerService).drain();

    const doc = await prisma.aiDocument.findUniqueOrThrow({ where: { id: accepted.id } });
    expect(doc).toMatchObject({ direction: 'SALE', status: 'AWAITING_REVIEW' });

    const rows = await prisma.aiLineClassification.findMany({ where: { documentId: accepted.id }, orderBy: { lineNumber: 'asc' }, include: { suggestedTaxCode: true } });
    expect(rows[0]).toMatchObject({ resolvedAccountId: salesAccountId, accountSource: 'HISTORY', taxSource: 'HISTORY' });
    expect(rows[0].suggestedTaxCode?.code).toBe('UK_SR');
    expect(rows[0].codingReason).toContain(journalNumber);
    expect(rows[1]).toMatchObject({ accountSource: 'NONE', taxSource: 'NONE', resolvedAccountId: null });
    expect(rows[1].codingReason).toContain('a reviewer must choose');

    // The proposal and the suggestion carry the same coding, with reasons for the reviewer.
    const suggestion = await prisma.aiSuggestion.findFirstOrThrow({ where: { documentId: accepted.id } });
    const payload = suggestion.payload as any;
    expect(payload.coding[0]).toMatchObject({ accountId: salesAccountId, accountSource: 'HISTORY', taxCode: 'UK_SR' });
    expect(payload.accountingIntent.missing).toEqual(expect.arrayContaining(['Line 2: account']));
  });
});
