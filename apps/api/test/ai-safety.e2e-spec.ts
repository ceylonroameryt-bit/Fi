import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { createValidationPipe } from '../src/common/validation/validation.pipe';
import { RolesService } from '../src/roles/roles.service';
import { CUSTOMER_VAT_ON_SUPPLIER_BILL_TEXT, SPARSE_DOCUMENT_TEXT } from '../src/ai/__fixtures__/safety-fixtures';

/** Stage 4 (Phase 41): the AI document pipeline end to end, one test per prototype defect. */
describe('AI safety fixes (Stage 4 E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let orgId: string;
  let orgName: string;
  let previousTaxNumber: string | null;
  let salesAccountId: string;
  let customerId: string;
  const customerName = `Safety Customer ${Date.now()}`;
  const ourInvoiceNumber = `S-${Date.now()}`;

  const http = () => request(app.getHttpServer());
  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`).set('x-organization-id', orgId);
  const upload = (text: string) =>
    auth(http().post(`/api/v1/organizations/${orgId}/ai/documents/upload`)).send({ fileName: 'doc.txt', mimeType: 'text/plain', text });
  const invoiceCount = () => prisma.invoice.count({ where: { organizationId: orgId } });

  const ownSalesInvoiceText = () =>
    [
      `Supplier: ${orgName}`,
      'VAT Reg No: GB987654321',
      `Invoice No: ${ourInvoiceNumber}`,
      'Invoice Date: 2026-04-20',
      'Due Date: 2026-05-20',
      `Bill To: ${customerName}`,
      '2 hours Consulting £200.00',
      'Subtotal: £200.00',
      'VAT 20%: £40.00',
      'Total: £240.00',
    ].join('\n');

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser('test-secret-at-least-32-characters-long'));
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(createValidationPipe());
    await app.get(RolesService).seedGlobalPermissions();
    await app.init();
    prisma = app.get(PrismaService);

    const login = await http().post('/api/v1/auth/login').send({ email: 'owner@democonsulting.com', password: 'Password1234!' }).expect(200);
    token = login.body.accessToken;
    orgId = (await http().get('/api/v1/organizations').set('Authorization', `Bearer ${token}`).expect(200)).body[0].organization.id;
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    orgName = org.name;
    previousTaxNumber = org.taxNumber;
    await prisma.organization.update({ where: { id: orgId }, data: { taxNumber: 'GB987654321', aiEnabled: true } });

    salesAccountId = (await auth(http().get(`/api/v1/organizations/${orgId}/accounts`)).expect(200)).body.find((a: any) => a.code === '4000').id;
    customerId = (
      await auth(http().post(`/api/v1/organizations/${orgId}/contacts`)).send({ name: customerName, type: 'CUSTOMER', country: 'GB' }).expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await prisma.organization.update({ where: { id: orgId }, data: { taxNumber: previousTaxNumber, aiEnabled: false } });
    await app.close();
  });

  it('BUG-17: document processing respects the organisation AI switch', async () => {
    await prisma.organization.update({ where: { id: orgId }, data: { aiEnabled: false } });
    const res = await upload(SPARSE_DOCUMENT_TEXT).expect(403);
    expect(JSON.stringify(res.body)).toContain('AI_DISABLED');
    await prisma.organization.update({ where: { id: orgId }, data: { aiEnabled: true } });
  });

  it('BUG-12/15: a supplier bill naming our VAT as customer is a PURCHASE and approving it never creates a sales invoice', async () => {
    const doc = (await upload(CUSTOMER_VAT_ON_SUPPLIER_BILL_TEXT).expect(201)).body;
    expect(doc.direction).toBe('PURCHASE');
    expect(doc.status).toBe('REQUIRES_REVIEW');

    const before = await invoiceCount();
    const res = await auth(http().post(`/api/v1/organizations/${orgId}/ai/documents/${doc.id}/approve`)).send({}).expect(422);
    expect(JSON.stringify(res.body)).toContain('AI_BILLS_NOT_AVAILABLE');
    expect(await invoiceCount()).toBe(before);
  });

  it('BUG-04/07: a document with no identifiable parties stays UNKNOWN with nothing invented, and cannot be approved', async () => {
    const doc = (await upload(SPARSE_DOCUMENT_TEXT).expect(201)).body;
    expect(doc.direction).toBe('UNKNOWN');
    const [extraction] = doc.extractions;
    expect(extraction).toMatchObject({ invoiceNumber: null, invoiceDate: null, currency: null });
    const res = await auth(http().post(`/api/v1/organizations/${orgId}/ai/documents/${doc.id}/approve`)).send({}).expect(422);
    expect(JSON.stringify(res.body)).toContain('AI_DIRECTION_UNRESOLVED');
  });

  it('BUG-14: a high-confidence sale is never auto-drafted; a reviewer approves it into a DRAFT invoice calculated by code', async () => {
    const before = await invoiceCount();
    const doc = (await upload(ownSalesInvoiceText()).expect(201)).body;
    expect(doc.direction).toBe('SALE');
    expect(doc.status).toBe('REQUIRES_REVIEW');
    expect(doc.suggestions[0].status).toBe('PENDING_REVIEW');
    expect(await invoiceCount()).toBe(before);

    const tbBefore = (await auth(http().get(`/api/v1/organizations/${orgId}/reports/trial-balance`)).expect(200)).body;
    const approved = (
      await auth(http().post(`/api/v1/organizations/${orgId}/ai/documents/${doc.id}/edit`))
        .send({ contactId: customerId, lines: [{ lineNumber: 1, description: 'Consulting', accountId: salesAccountId }] })
        .expect(200)
    ).body;

    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: approved.invoiceId }, include: { lines: true } });
    expect(invoice.status).toBe('DRAFT');
    expect(invoice.reference).toBe(ourInvoiceNumber);
    expect(invoice.subtotal.toFixed(2)).toBe('200.00');
    expect(invoice.taxTotal.toFixed(2)).toBe('40.00');
    expect(invoice.totalAmount.toFixed(2)).toBe('240.00');
    expect(invoice.lines[0].taxCodeId).toBeTruthy();
    expect(invoice.journalEntryId).toBeNull();

    // Drafts do not touch the ledger.
    const tbAfter = (await auth(http().get(`/api/v1/organizations/${orgId}/reports/trial-balance`)).expect(200)).body;
    expect(tbAfter.totalDebit).toBe(tbBefore.totalDebit);
    expect(tbAfter.isBalanced).toBe(true);
  });

  it('BUG-16: the same document again is refused as a duplicate, not renamed', async () => {
    const doc = (await upload(ownSalesInvoiceText()).expect(201)).body;
    const res = await auth(http().post(`/api/v1/organizations/${orgId}/ai/documents/${doc.id}/edit`))
      .send({ contactId: customerId, lines: [{ lineNumber: 1, description: 'Consulting', accountId: salesAccountId }] })
      .expect(409);
    expect(JSON.stringify(res.body)).toContain('AI_DUPLICATE_DOCUMENT');
  });

  it('refuses an incomplete sales draft and lists what is missing', async () => {
    const text = ownSalesInvoiceText()
      .replace(/Invoice No: .*/, `Invoice No: ${ourInvoiceNumber}-B`)
      .replace(/Due Date: .*\n/, '');
    const doc = (await upload(text).expect(201)).body;
    const res = await auth(http().post(`/api/v1/organizations/${orgId}/ai/documents/${doc.id}/edit`))
      .send({ contactId: customerId, lines: [{ lineNumber: 1, description: 'Consulting', accountId: salesAccountId }] })
      .expect(422);
    expect(JSON.stringify(res.body)).toContain('AI_DRAFT_INCOMPLETE');
    expect(JSON.stringify(res.body)).toContain('due date');
  });
});
