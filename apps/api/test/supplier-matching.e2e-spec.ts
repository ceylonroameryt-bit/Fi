import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { createValidationPipe } from '../src/common/validation/validation.pipe';
import { RolesService } from '../src/roles/roles.service';
import { JobWorkerService } from '../src/jobs/job-worker.service';

/** A random UK VAT number with valid mod-97 check digits (unique per run). */
function randomUkVat(): string {
  const weights = [8, 7, 6, 5, 4, 3, 2];
  const digits = Array.from({ length: 7 }, (_, i) => (i === 0 ? 1 + Math.floor(Math.random() * 9) : Math.floor(Math.random() * 10)));
  const total = digits.reduce((s, d, i) => s + d * weights[i], 0);
  const check = (97 - (total % 97)) % 97;
  return `GB${digits.join('')}${String(check).padStart(2, '0')}`;
}

/** Stage 9 (Phase 46): supplier matching and proposed contacts (rules extractor, no AI). */
describe('Direction & supplier matching (Stage 9 E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let orgId: string;
  let orgName: string;
  const run = Date.now();
  const supplierName = `Hilltop Garage Services ${run}`;
  const supplierVat = randomUkVat();

  const http = () => request(app.getHttpServer());
  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`).set('x-organization-id', orgId);
  const ai = (path: string) => `/api/v1/organizations/${orgId}/ai${path}`;
  const drain = () => app.get(JobWorkerService).drain();
  const suggestionOf = async (docId: string) => {
    const s = await prisma.aiSuggestion.findFirstOrThrow({ where: { documentId: docId, status: 'PENDING_REVIEW' } });
    return s.payload as any;
  };
  const ingest = async (lines: string[]) => {
    const accepted = (await auth(http().post(ai('/documents/upload'))).send({ fileName: 'bill.txt', mimeType: 'text/plain', text: lines.join('\n') }).expect(202)).body;
    await drain();
    return accepted.id as string;
  };
  const billLines = (supplierLine: string, invoiceNo: string, vat?: string) => [
    `Supplier: ${supplierLine}`,
    ...(vat ? [`VAT Reg No: ${vat}`] : []),
    `Invoice No: ${invoiceNo}`,
    'Invoice Date: 2026-04-23',
    `Bill To: ${orgName}`,
    'Tyres 180.00',
    'Subtotal: 180.00',
    'VAT 20%: 36.00',
    'Total: 216.00',
  ];

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
    const org = await prisma.organization.update({ where: { id: orgId }, data: { aiEnabled: true } });
    orgName = org.name;
  });

  afterAll(async () => {
    await prisma.organization.update({ where: { id: orgId }, data: { aiEnabled: false } });
    await app.close();
  });

  let firstDocId: string;

  it('proposes a new supplier for an unknown counterparty and never creates it automatically', async () => {
    const contactsBefore = await prisma.contact.count({ where: { organizationId: orgId } });
    firstDocId = await ingest(billLines(supplierName, `HG-${run}-1`, supplierVat));

    const doc = await prisma.aiDocument.findUniqueOrThrow({ where: { id: firstDocId } });
    expect(doc).toMatchObject({ status: 'AWAITING_REVIEW', direction: 'PURCHASE' });
    const payload = await suggestionOf(firstDocId);
    expect(payload.entity).toBeNull();
    expect(payload.counterpartyMatch.matchType).toBe('NONE');
    expect(payload.proposedContact).toEqual({ type: 'SUPPLIER', name: supplierName, vatNumber: supplierVat });
    expect(await prisma.contact.count({ where: { organizationId: orgId } })).toBe(contactsBefore);
  });

  it('creates the contact only when a reviewer accepts it, then re-matches the document by VAT number', async () => {
    const res = (await auth(http().post(ai(`/documents/${firstDocId}/proposed-contact`))).send({}).expect(202)).body;
    expect(res.contact).toMatchObject({ name: supplierName, type: 'SUPPLIER', vatNumber: supplierVat });
    await drain();

    const payload = await suggestionOf(firstDocId);
    expect(payload.entity).toEqual({ id: res.contact.id, name: supplierName });
    expect(payload.counterpartyMatch.matchType).toBe('EXACT_VAT');
    expect(payload.proposedContact).toBeNull();
    expect(payload.accountingIntent.missing).not.toContain('Supplier');
  });

  it('matches the next bill from the same supplier by VAT number even when the name is printed differently', async () => {
    const docId = await ingest(billLines(`${supplierName.toUpperCase()} LIMITED`, `HG-${run}-2`, supplierVat.replace(/^GB(\d{3})(\d{4})(\d{2})$/, 'GB $1 $2 $3')));
    const payload = await suggestionOf(docId);
    expect(payload.counterpartyMatch.matchType).toBe('EXACT_VAT');
    expect(payload.entity.name).toBe(supplierName);
  });

  it('matches an exact name variant (Ltd/Limited) without a VAT number', async () => {
    const docId = await ingest(billLines(`${supplierName} Ltd`, `HG-${run}-3`));
    expect((await suggestionOf(docId)).counterpartyMatch.matchType).toBe('EXACT_NAME');
  });

  it('only offers a similar-but-different name as a candidate, never as the match', async () => {
    // "Hilltop Motor Services" scores about 0.7 against "Hilltop Garage Services": a candidate, not a match.
    const similar = supplierName.replace('Garage', 'Motor');
    const docId = await ingest(billLines(similar, `HG-${run}-4`));
    const payload = await suggestionOf(docId);
    expect(payload.entity).toBeNull();
    expect(payload.counterpartyMatch.candidates.map((c: any) => c.name)).toContain(supplierName);
    expect(payload.proposedContact.name).toBe(similar);
  });

  it('treats a near-identical long name (above the 0.9 threshold) as a fuzzy match', async () => {
    const docId = await ingest(billLines(supplierName.replace('Services', 'Service'), `HG-${run}-5`));
    const payload = await suggestionOf(docId);
    expect(payload.counterpartyMatch.matchType).toBe('FUZZY_NAME');
    expect(payload.entity.name).toBe(supplierName);
  });

  it('refuses to accept a proposal twice or for a document not awaiting review', async () => {
    await auth(http().post(ai(`/documents/${firstDocId}/proposed-contact`))).send({}).expect(409);
  });
});
