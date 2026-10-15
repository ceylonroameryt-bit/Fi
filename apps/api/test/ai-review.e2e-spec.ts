import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { PasswordService } from '../src/auth/password.service';
import { createValidationPipe } from '../src/common/validation/validation.pipe';
import { RolesService } from '../src/roles/roles.service';
import { JobWorkerService } from '../src/jobs/job-worker.service';
import { makeTextPdf } from '../src/documents/__fixtures__/pdf-builder';
import { loadTaxCodeIds } from './tax-codes.helper';

function randomUkVat(): string {
  const w = [8, 7, 6, 5, 4, 3, 2];
  const d = Array.from({ length: 7 }, (_, i) => (i === 0 ? 1 + Math.floor(Math.random() * 9) : Math.floor(Math.random() * 10)));
  const check = (97 - (d.reduce((s, x, i) => s + x * w[i], 0) % 97)) % 97;
  return `GB${d.join('')}${String(check).padStart(2, '0')}`;
}

/** Stage 12 (Phase 48): human review, permissions and the AI-vs-final decision log. */
describe('Human review & permissions (Stage 12 E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let bookkeeperToken: string;
  let orgId: string;
  let orgName: string;
  let expenseAccountId: string;
  let tax: Record<string, string>;
  let supplierId: string;
  const run = Date.now();
  const supplierVat = randomUkVat();
  const supplierName = `Review Supplies ${run}`;

  const http = () => request(app.getHttpServer());
  const as = (t: string) => (r: request.Test) => r.set('Authorization', `Bearer ${t}`).set('x-organization-id', orgId);
  const auth = (r: request.Test) => as(token)(r);
  const ai = (p: string) => `/api/v1/organizations/${orgId}/ai${p}`;

  const billPdf = (invoiceNo: string, opts: { total?: string; vat?: string } = {}) =>
    makeTextPdf([
      `Supplier: ${supplierName}`,
      `VAT Reg No: ${opts.vat ?? supplierVat}`,
      `Invoice No: ${invoiceNo}`,
      'Invoice Date: 2026-04-25',
      `Bill To: ${orgName}`,
      'Printer toner 80.00',
      'Subtotal: £80.00',
      'VAT 20%: £16.00',
      `Total: £${opts.total ?? '96.00'}`,
    ]);
  const ingest = async (pdf: Buffer) => {
    const doc = (await auth(http().post(ai('/documents'))).attach('file', pdf, { filename: 'bill.pdf', contentType: 'application/pdf' }).expect(202)).body;
    await app.get(JobWorkerService).drain();
    return doc.id as string;
  };
  const reviewOf = async (id: string) => (await auth(http().get(ai(`/documents/${id}/review`))).expect(200)).body;
  /** The reviewer's final values: start from the review screen's values and apply edits. */
  const finalValues = (review: any, edits: Record<string, unknown> = {}) => {
    const f = Object.fromEntries(review.fields.map((x: any) => [x.path, x.value]));
    return {
      direction: 'PURCHASE',
      contactId: supplierId,
      invoiceNumber: f.invoiceNumber,
      invoiceDate: f.invoiceDate,
      currency: f.currency,
      issuerVatNumber: f['issuer.vatNumber'] ?? undefined,
      subtotal: f.subtotal,
      vatTotal: f.vatTotal,
      total: f.total,
      lines: review.lines.map((l: any) => ({
        lineNumber: l.lineNumber,
        description: l.description,
        netAmount: l.netAmount,
        vatAmount: l.vatAmount ?? undefined,
        accountId: l.accountId ?? expenseAccountId,
        taxCodeId: l.taxCodeId ?? tax.UK_SR,
      })),
      ...edits,
    };
  };

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
    orgId = (await http().get('/api/v1/organizations').set('Authorization', `Bearer ${token}`).expect(200)).body[0].organization.id;
    orgName = (await prisma.organization.update({ where: { id: orgId }, data: { aiEnabled: true } })).name;
    expenseAccountId = (await prisma.account.findFirstOrThrow({ where: { organizationId: orgId, accountType: 'EXPENSE', isActive: true, isControlAccount: false }, orderBy: { code: 'asc' } })).id;
    supplierId = (await auth(http().post(`/api/v1/organizations/${orgId}/contacts`)).send({ name: supplierName, type: 'SUPPLIER', country: 'GB', vatNumber: supplierVat }).expect(201)).body.id;

    // A bookkeeper: may view and create drafts, may not approve AI drafts.
    const bookkeeperRole = await prisma.role.findFirstOrThrow({ where: { organizationId: orgId, systemKey: 'BOOKKEEPER' } });
    const email = `bookkeeper-${run}@example.com`;
    const user = await prisma.user.create({
      data: { email, passwordHash: await app.get(PasswordService).hash('Bookkeeper-Pass-2026!'), emailVerified: true, firstName: 'Book', lastName: 'Keeper' },
    });
    await prisma.organizationMember.create({ data: { organizationId: orgId, userId: user.id, roleId: bookkeeperRole.id, status: 'ACTIVE' } });
    bookkeeperToken = (await http().post('/api/v1/auth/login').send({ email, password: 'Bookkeeper-Pass-2026!' }).expect(200)).body.accessToken;
  });

  afterAll(async () => {
    await prisma.organization.update({ where: { id: orgId }, data: { aiEnabled: false } });
    await app.close();
  });

  let cleanDocId: string;
  let wrongTotalDocId: string;
  let badVatDocId: string;

  it('lists AI drafts awaiting review, sorted by confidence only, none auto-approved', async () => {
    cleanDocId = await ingest(billPdf(`RV-${run}-1`));
    wrongTotalDocId = await ingest(billPdf(`RV-${run}-2`, { total: '99.00' }));
    badVatDocId = await ingest(billPdf(`RV-${run}-3`, { vat: 'GB123456789' }));

    const queue = (await auth(http().get(ai('/review-queue'))).expect(200)).body;
    const ours = queue.filter((q: any) => [cleanDocId, wrongTotalDocId, badVatDocId].includes(q.id));
    expect(ours).toHaveLength(3);
    const scores = queue.map((q: any) => q.confidenceScore);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    const asc = (await auth(http().get(ai('/review-queue?sort=confidence_asc'))).expect(200)).body.map((q: any) => q.confidenceScore);
    expect([...asc].sort((a, b) => a - b)).toEqual(asc);
    expect(await prisma.bill.count({ where: { sourceDocumentId: { in: [cleanDocId, wrongTotalDocId, badVatDocId] } } })).toBe(0);
  });

  it('shows each extracted value with its status and where it is on the document', async () => {
    const review = await reviewOf(cleanDocId);
    expect(review.document).toMatchObject({ id: cleanDocId, status: 'AWAITING_REVIEW', textSource: 'PDF_TEXT', fileUrl: `/ai/documents/${cleanDocId}/file` });
    const invoiceNumber = review.fields.find((f: any) => f.path === 'invoiceNumber');
    expect(invoiceNumber).toMatchObject({ value: `RV-${run}-1`, status: 'verified' });
    expect(invoiceNumber.boxes[0]).toEqual(expect.objectContaining({ page: 1, x0: expect.any(Number), y1: expect.any(Number) }));
    const total = review.fields.find((f: any) => f.path === 'total');
    expect(total.boxes).toHaveLength(1);
    expect(review.lines[0]).toMatchObject({ description: 'Printer toner', netAmount: '80.00' });
    expect(review.lines[0].boxes.length).toBe(1);
    expect(review.pages[0].words.length).toBeGreaterThan(10);

    const file = await auth(http().get(ai(`/documents/${cleanDocId}/file`))).expect(200);
    expect(file.headers['content-type']).toBe('application/pdf');
  });

  it('only users with ai_draft.approve can approve or reject', async () => {
    const review = await reviewOf(cleanDocId);
    const res = await as(bookkeeperToken)(http().post(ai(`/documents/${cleanDocId}/review/approve`))).send(finalValues(review)).expect(403);
    expect(JSON.stringify(res.body)).toContain('ai_draft.approve');
    await as(bookkeeperToken)(http().post(ai(`/documents/${cleanDocId}/reject`))).send({ reason: 'nope' }).expect(403);
    await as(bookkeeperToken)(http().get(ai(`/documents/${cleanDocId}/review`))).expect(200); // may still look
  });

  it('approves a clean draft (reviewer supplies the account) and logs AI vs final values side by side', async () => {
    const review = await reviewOf(cleanDocId);
    const res = (await auth(http().post(ai(`/documents/${cleanDocId}/review/approve`))).send(finalValues(review)).expect(200)).body;
    expect(res).toMatchObject({ outcome: 'EDITED' }); // account/tax chosen by the reviewer where AI had none
    const bill = await prisma.bill.findUniqueOrThrow({ where: { id: res.billId } });
    expect(bill).toMatchObject({ status: 'DRAFT', sourceDocumentId: cleanDocId });

    const decision = await prisma.aiReviewDecision.findFirstOrThrow({ where: { documentId: cleanDocId } });
    expect(decision).toMatchObject({ outcome: 'EDITED', resultingBillId: res.billId });
    expect((decision.aiValues as any).invoiceNumber).toBe(`RV-${run}-1`);
    expect((decision.finalValues as any).lines[0].accountId).toBe(expenseAccountId);
    expect(decision.changedFields).toEqual(expect.arrayContaining(['lines[1].accountId']));

    // The log is append-only.
    await expect(prisma.aiReviewDecision.update({ where: { id: decision.id }, data: { reason: 'tamper' } })).rejects.toThrow(/append-only/);
  });

  it('refuses approval while a field is inconsistent; correcting the value lets it through', async () => {
    const review = await reviewOf(wrongTotalDocId);
    expect(review.fields.find((f: any) => f.path === 'total').status).toBe('inconsistent');

    const refused = await auth(http().post(ai(`/documents/${wrongTotalDocId}/review/approve`))).send(finalValues(review)).expect(422);
    expect(JSON.stringify(refused.body)).toContain('AI_REVIEW_INCONSISTENT');
    expect(JSON.stringify(refused.body)).toContain('"field":"total"');

    const res = (await auth(http().post(ai(`/documents/${wrongTotalDocId}/review/approve`))).send(finalValues(review, { total: '96.00' })).expect(200)).body;
    expect(res.changedFields).toContain('total');
    const decision = await prisma.aiReviewDecision.findFirstOrThrow({ where: { documentId: wrongTotalDocId } });
    expect((decision.aiValues as any).total).toBe('99.00');
    expect((decision.finalValues as any).total).toBe('96.00');
    expect(decision.overrides).toEqual([]);
  });

  it('accepts an inconsistent field left as printed only with a stated reason, which is logged', async () => {
    const review = await reviewOf(badVatDocId);
    expect(review.fields.find((f: any) => f.path === 'issuer.vatNumber').status).toBe('inconsistent');
    const body = finalValues(review);
    await auth(http().post(ai(`/documents/${badVatDocId}/review/approve`)))
      .send({ ...body, overrides: [{ field: 'issuer.vatNumber', reason: 'x' }] })
      .expect(400); // reason too short
    await auth(http().post(ai(`/documents/${badVatDocId}/review/approve`)))
      .send({ ...body, overrides: [{ field: 'issuer.vatNumber', reason: 'Printed wrongly by supplier; confirmed by phone' }] })
      .expect(200);
    const decision = await prisma.aiReviewDecision.findFirstOrThrow({ where: { documentId: badVatDocId } });
    expect(decision.overrides).toEqual([
      expect.objectContaining({ field: 'issuer.vatNumber', reason: 'Printed wrongly by supplier; confirmed by phone' }),
    ]);
  });

  it('rejection is logged and leaves nothing behind', async () => {
    const docId = await ingest(billPdf(`RV-${run}-4`));
    await auth(http().post(ai(`/documents/${docId}/reject`))).send({ reason: 'Personal expense, not company' }).expect(200);
    expect((await prisma.aiDocument.findUniqueOrThrow({ where: { id: docId } })).status).toBe('REJECTED');
    expect(await prisma.aiReviewDecision.findFirstOrThrow({ where: { documentId: docId } })).toMatchObject({ outcome: 'REJECTED', reason: 'Personal expense, not company' });
    expect(await prisma.bill.count({ where: { sourceDocumentId: docId } })).toBe(0);
  });
});
