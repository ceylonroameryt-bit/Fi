import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { Prisma } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { createValidationPipe } from '../src/common/validation/validation.pipe';
import { RolesService } from '../src/roles/roles.service';
import { JobWorkerService } from '../src/jobs/job-worker.service';
import { loadTaxCodeIds } from './tax-codes.helper';

/** A random UK VAT number with valid mod-97 check digits. */
function randomUkVat(): string {
  const w = [8, 7, 6, 5, 4, 3, 2];
  const d = Array.from({ length: 7 }, (_, i) => (i === 0 ? 1 + Math.floor(Math.random() * 9) : Math.floor(Math.random() * 10)));
  const check = (97 - (d.reduce((s, x, i) => s + x * w[i], 0) % 97)) % 97;
  return `GB${d.join('')}${String(check).padStart(2, '0')}`;
}

/** Stage 11 (Phase 22): supplier bills, posted through the posting engine. */
describe('Supplier bills (Stage 11 E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tax: Record<string, string>;
  let token: string;
  let orgId: string;
  let orgName: string;
  let expenseAccountId: string;
  let supplierId: string;
  const run = Date.now();
  const supplierVat = randomUkVat();
  const supplierName = `Fleet Parts Direct ${run}`;
  const day = '2026-04-24';

  const http = () => request(app.getHttpServer());
  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`).set('x-organization-id', orgId);
  const api = (p: string) => `/api/v1/organizations/${orgId}${p}`;
  const D = (v: string | Prisma.Decimal) => new Prisma.Decimal(v);
  const trialBalance = async () => (await auth(http().get(api('/reports/trial-balance'))).expect(200)).body;
  const vatReturn = async (to = day) => (await auth(http().get(api(`/vat-return?from=${day}&to=${to}`))).expect(200)).body;
  const delta = (a: any, b: any, box: string) => D(a.boxes[box]).minus(b.boxes[box]).toFixed(2);
  const createBill = (body: Record<string, unknown>) => auth(http().post(api('/bills'))).send({ contactId: supplierId, issueDate: day, ...body });

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

    const login = await http().post('/api/v1/auth/login').send({ email: 'owner@democonsulting.com', password: 'Password1234!' }).expect(200);
    token = login.body.accessToken;
    orgId = (await http().get('/api/v1/organizations').set('Authorization', `Bearer ${token}`).expect(200)).body[0].organization.id;
    orgName = (await prisma.organization.update({ where: { id: orgId }, data: { aiEnabled: true } })).name;
    const expense = await prisma.account.findFirstOrThrow({
      where: { organizationId: orgId, accountType: 'EXPENSE', isActive: true, isControlAccount: false },
      orderBy: { code: 'asc' },
    });
    expenseAccountId = expense.id;
    supplierId = (
      await auth(http().post(api('/contacts')))
        .send({ name: supplierName, type: 'SUPPLIER', country: 'GB', vatNumber: supplierVat, paymentTermsDays: 14 })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await prisma.organization.update({ where: { id: orgId }, data: { aiEnabled: false } });
    await app.close();
  });

  let billId: string;

  it('creates a draft with code-calculated totals and a due date from the supplier terms', async () => {
    const bill = (
      await createBill({
        supplierInvoiceNumber: `FP-${run}-1`,
        lines: [
          { accountId: expenseAccountId, description: 'Brake pads', quantity: 4, unitPrice: '25.00', taxCodeId: tax.UK_SR },
          { accountId: expenseAccountId, description: 'Workshop consumables', netAmount: '19.99', taxCodeId: tax.UK_SR },
        ],
      }).expect(201)
    ).body;
    billId = bill.id;
    expect(bill).toMatchObject({ status: 'DRAFT', supplierInvoiceNumber: `FP-${run}-1`, warnings: [] });
    expect(bill.billNumber).toMatch(/^BILL-2026-\d{6}$/);
    expect(bill.dueDate.slice(0, 10)).toBe('2026-05-08'); // 24 April + 14 days
    expect(D(bill.subtotal).toFixed(2)).toBe('119.99');
    expect(D(bill.taxTotal).toFixed(2)).toBe('24.00'); // 20.00 + 4.00 (19.99 x 20% = 3.998)
    expect(D(bill.totalAmount).toFixed(2)).toBe('143.99');
    expect(bill.lines[0].quantity).toBe('4');
    expect(bill.lines[1].quantity).toBeNull();
  });

  it('rejects a line that has neither quantity x price nor a net amount, or where they disagree', async () => {
    await createBill({ supplierInvoiceNumber: 'X', lines: [{ accountId: expenseAccountId, description: 'x', taxCodeId: tax.UK_SR }] }).expect(400);
    await createBill({
      supplierInvoiceNumber: 'X',
      lines: [{ accountId: expenseAccountId, description: 'x', quantity: 2, unitPrice: 10, netAmount: '25.00', taxCodeId: tax.UK_SR }],
    }).expect(400);
  });

  it('blocks approval while a line has no tax code', async () => {
    const draft = (await createBill({ supplierInvoiceNumber: `FP-${run}-NOTAX`, lines: [{ accountId: expenseAccountId, description: 'x', netAmount: '10.00' }] }).expect(201)).body;
    const res = await auth(http().post(api(`/bills/${draft.id}/approve`))).send({}).expect(422);
    expect(JSON.stringify(res.body)).toContain('TAX_CODE_REQUIRED');
    await auth(http().delete(api(`/bills/${draft.id}`))).expect(200);
  });

  it('approval posts Dr expense, Dr input VAT, Cr creditors through the posting engine; TB balances; VAT boxes 4 and 7 move', async () => {
    const vatBefore = await vatReturn();
    const res = (await auth(http().post(api(`/bills/${billId}/approve`))).send({}).expect(200)).body;
    expect(res.bill).toMatchObject({ status: 'POSTED' });
    expect(res.bill.approvedAt).toBeTruthy();

    const journal = await prisma.journalEntry.findUniqueOrThrow({ where: { id: res.bill.journalEntryId }, include: { lines: { include: { account: true } } } });
    expect(journal).toMatchObject({ status: 'POSTED', sourceType: 'BILL', sourceId: billId, journalType: 'PURCHASE' });
    const debits = journal.lines.reduce((a, l) => a.plus(l.debit), D('0'));
    const credits = journal.lines.reduce((a, l) => a.plus(l.credit), D('0'));
    expect(debits.equals(credits)).toBe(true);
    const ap = journal.lines.find((l) => l.account.accountSubtype === 'ACCOUNTS_PAYABLE')!;
    expect(ap).toMatchObject({ contactId: supplierId });
    expect(ap.credit.toFixed(2)).toBe('143.99');
    const vatLine = journal.lines.find((l) => l.account.accountSubtype === 'TAX_PAYABLE')!;
    expect(vatLine.debit.toFixed(2)).toBe('24.00');

    expect((await trialBalance()).isBalanced).toBe(true);
    const vatAfter = await vatReturn();
    expect(delta(vatAfter, vatBefore, 'box4')).toBe('24.00');
    expect(delta(vatAfter, vatBefore, 'box1')).toBe('0.00');
    expect(vatAfter.reconciliation.reconciled).toBe(vatBefore.reconciliation.reconciled);

    // Posted bills are immutable.
    await auth(http().patch(api(`/bills/${billId}`))).send({ notes: 'change' }).expect(409);
  });

  it('warns about a duplicate supplier invoice number and only posts it with a logged override', async () => {
    const dup = (
      await createBill({ supplierInvoiceNumber: `fp-${run}-1`, lines: [{ accountId: expenseAccountId, description: 'Brake pads', netAmount: '100.00', taxCodeId: tax.UK_SR }] }).expect(201)
    ).body;
    expect(dup.warnings[0]).toContain('Possible duplicate');

    const refused = await auth(http().post(api(`/bills/${dup.id}/approve`))).send({}).expect(409);
    expect(JSON.stringify(refused.body)).toContain('BILL_DUPLICATE');

    await auth(http().post(api(`/bills/${dup.id}/approve`))).send({ duplicateOverrideReason: 'Supplier re-issued with a new delivery' }).expect(200);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityId: dup.id, eventType: 'BILL_POSTED' } });
    expect((audit.newValues as any).duplicateOverrideReason).toBe('Supplier re-issued with a new delivery');
    expect((await trialBalance()).isBalanced).toBe(true);
  });

  it('reverse charge on imported services: self-accounts VAT (boxes 1 and 4), supplier owed the net only', async () => {
    const vatBefore = await vatReturn();
    const bill = (
      await createBill({
        supplierInvoiceNumber: `RC-${run}`,
        lines: [{ accountId: expenseAccountId, description: 'Cloud hosting (Ireland)', netAmount: '500.00', taxCodeId: tax.UK_RC_SERV }],
      }).expect(201)
    ).body;
    expect(D(bill.taxTotal).toFixed(2)).toBe('0.00');
    expect(D(bill.totalAmount).toFixed(2)).toBe('500.00');
    await auth(http().post(api(`/bills/${bill.id}/approve`))).send({}).expect(200);

    const vatAfter = await vatReturn();
    expect(delta(vatAfter, vatBefore, 'box1')).toBe('100.00');
    expect(delta(vatAfter, vatBefore, 'box4')).toBe('100.00');
    expect(delta(vatAfter, vatBefore, 'box5')).toBe('0.00');
    expect(Number(delta(vatAfter, vatBefore, 'box7'))).toBe(500);
    expect((await trialBalance()).isBalanced).toBe(true);
  });

  it('voids a posted bill by reversal; trial balance still balances', async () => {
    const before = await vatReturn('2099-12-31');
    const res = (await auth(http().post(api(`/bills/${billId}/void`))).send({ reason: 'Entered twice' }).expect(200)).body;
    expect(res.bill.status).toBe('VOIDED');
    expect(res.reversal.reversalJournal.journalNumber).toBeTruthy();
    const after = await vatReturn('2099-12-31');
    expect(delta(after, before, 'box4')).toBe('-24.00');
    expect((await trialBalance()).isBalanced).toBe(true);
  });

  it('an approved AI purchase becomes a DRAFT bill with the source document attached; nothing posts until a person approves the bill', async () => {
    const text = [
      `Supplier: ${supplierName}`,
      `VAT Reg No: ${supplierVat}`,
      `Invoice No: FP-${run}-AI`,
      `Invoice Date: ${day}`,
      `Bill To: ${orgName}`,
      'Clutch kit 120.00',
      'Subtotal: 120.00',
      'VAT 20%: 24.00',
      'Total: £144.00',
    ].join('\n');
    const accepted = (await auth(http().post(api('/ai/documents/upload'))).send({ fileName: 'fp-ai.txt', mimeType: 'text/plain', text }).expect(202)).body;
    await app.get(JobWorkerService).drain();
    const journalsBefore = await prisma.journalEntry.count({ where: { organizationId: orgId } });

    const approved = (
      await auth(http().post(api(`/ai/documents/${accepted.id}/edit`)))
        .send({ contactId: supplierId, lines: [{ lineNumber: 1, description: 'Clutch kit', accountId: expenseAccountId }] })
        .expect((r) => {
          if (r.status !== 200) throw new Error(`approve failed: ${JSON.stringify(r.body)}`);
        })
    ).body;
    const bill = await prisma.bill.findUniqueOrThrow({ where: { id: approved.billId }, include: { lines: { include: { taxCode: true } } } });
    expect(bill).toMatchObject({ status: 'DRAFT', sourceDocumentId: accepted.id, supplierInvoiceNumber: `FP-${run}-AI`, journalEntryId: null });
    expect(bill.lines[0].taxCode?.code).toBe('UK_SR');
    expect(bill.totalAmount.toFixed(2)).toBe('144.00');
    expect(await prisma.journalEntry.count({ where: { organizationId: orgId } })).toBe(journalsBefore);
    expect((await prisma.aiDocument.findUniqueOrThrow({ where: { id: accepted.id } })).status).toBe('DRAFT_CREATED');

    const file = await auth(http().get(api(`/bills/${bill.id}/attachment`))).expect(200);
    expect(file.headers['content-type']).toContain('text/plain');
    expect(file.text).toBe(text);
  });
});
