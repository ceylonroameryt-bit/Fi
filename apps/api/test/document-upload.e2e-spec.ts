import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { StorageService } from '../src/common/storage/storage.service';
import { createValidationPipe } from '../src/common/validation/validation.pipe';
import { RolesService } from '../src/roles/roles.service';
import { OCR_PROVIDER } from '../src/documents/ocr/ocr-provider.interface';
import { FakeOcrProvider } from '../src/documents/ocr/fake-ocr.provider';
import { makeTextPdf, PNG_BYTES } from '../src/documents/__fixtures__/pdf-builder';

/** Stage 5 (Phase 42): upload validation, private storage, de-duplication, text + word positions. */
describe('Document upload & text extraction (Stage 5 E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ocr: FakeOcrProvider;
  let token: string;
  let orgId: string;
  let previousTaxNumber: string | null;
  const previousOcr = process.env.OCR_PROVIDER;
  const run = Date.now();

  const http = () => request(app.getHttpServer());
  const uploadFile = (bytes: Buffer, filename: string, contentType: string) =>
    http()
      .post(`/api/v1/organizations/${orgId}/ai/documents`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgId)
      .attach('file', bytes, { filename, contentType });

  const supplierBillPdf = makeTextPdf([
    'Supplier: ABC Fuel Ltd',
    'VAT Reg No: GB123456789',
    `Invoice No: ABC-${run}`,
    'Invoice Date: 2026-04-21',
    'Bill To: Demo Consulting Ltd',
    'Customer VAT: GB987654321',
    'Diesel 1000.00',
    'Subtotal: 1000.00',
    'VAT 20%: 200.00',
    'Total: 1200.00',
  ]);

  beforeAll(async () => {
    process.env.OCR_PROVIDER = 'fake';
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser('test-secret-at-least-32-characters-long'));
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(createValidationPipe());
    await app.get(RolesService).seedGlobalPermissions();
    await app.init();
    prisma = app.get(PrismaService);
    ocr = app.get(OCR_PROVIDER);

    const login = await http().post('/api/v1/auth/login').send({ email: 'owner@democonsulting.com', password: 'Password1234!' }).expect(200);
    token = login.body.accessToken;
    orgId = (await http().get('/api/v1/organizations').set('Authorization', `Bearer ${token}`).expect(200)).body[0].organization.id;
    previousTaxNumber = (await prisma.organization.findUniqueOrThrow({ where: { id: orgId } })).taxNumber;
    await prisma.organization.update({ where: { id: orgId }, data: { aiEnabled: true, taxNumber: 'GB987654321' } });
  });

  afterAll(async () => {
    await prisma.organization.update({ where: { id: orgId }, data: { aiEnabled: false, taxNumber: previousTaxNumber } });
    process.env.OCR_PROVIDER = previousOcr;
    await app.close();
  });

  it('accepts a digital PDF, stores it privately, reads its text layer with word positions and proposes from it', async () => {
    const doc = (await uploadFile(supplierBillPdf, 'abc-bill.pdf', 'application/pdf').expect(201)).body;

    expect(doc.duplicate).toBe(false);
    expect(ocr.calls).toHaveLength(0);
    expect(doc.direction).toBe('PURCHASE');
    expect(doc.extractions[0]).toMatchObject({ invoiceNumber: `ABC-${run}`, issuerTaxId: 'GB123456789' });

    const stored = await prisma.aiDocument.findUniqueOrThrow({ where: { id: doc.id }, include: { pages: true } });
    expect(stored.fileKey).toMatch(new RegExp(`^orgs/${orgId}/documents/[0-9a-f-]{36}\\.pdf$`));
    expect(stored).toMatchObject({ textSource: 'PDF_TEXT', pageCount: 1, mimeType: 'application/pdf' });
    expect(stored.contentSha256).toHaveLength(64);
    const words = stored.pages[0].words as Array<{ text: string; x0: number; y0: number }>;
    expect(words.find((w) => w.text === `ABC-${run}`)).toEqual(expect.objectContaining({ x0: expect.any(Number), y0: expect.any(Number) }));

    const bytes = (await app.get(StorageService).getObject(stored.fileKey)).body;
    expect(bytes.equals(supplierBillPdf)).toBe(true);
  });

  it('returns the existing document for the same file instead of processing it twice', async () => {
    const before = await prisma.aiDocument.count({ where: { organizationId: orgId } });
    const again = (await uploadFile(supplierBillPdf, 'renamed.pdf', 'application/pdf').expect(201)).body;
    expect(again.duplicate).toBe(true);
    expect(await prisma.aiDocument.count({ where: { organizationId: orgId } })).toBe(before);
  });

  it('sends a phone photo to OCR and keeps the OCR word boxes', async () => {
    const photo = Buffer.concat([PNG_BYTES, Buffer.from(String(run))]);
    ocr.enqueue([
      {
        pageNumber: 1,
        width: null,
        height: null,
        text: `Invoice No: PHOTO-${run}\nTotal: 9.99`,
        words: [{ text: `PHOTO-${run}`, x0: 0.4, y0: 0.1, x1: 0.6, y1: 0.12, confidence: 0.97 }],
      },
    ]);
    const doc = (await uploadFile(photo, 'receipt.png', 'image/png').expect(201)).body;
    expect(ocr.calls.at(-1)).toMatchObject({ mimeType: 'image/png' });
    const stored = await prisma.aiDocument.findUniqueOrThrow({ where: { id: doc.id }, include: { pages: true } });
    expect(stored.textSource).toBe('OCR');
    expect(stored.pages[0].words).toEqual([expect.objectContaining({ text: `PHOTO-${run}`, confidence: 0.97 })]);
    expect(doc.extractions[0].invoiceNumber).toBe(`PHOTO-${run}`);
  });

  it('rejects files whose content does not match the declared type, and unsupported files', async () => {
    const mismatch = await uploadFile(PNG_BYTES, 'fake.pdf', 'application/pdf').expect(415);
    expect(JSON.stringify(mismatch.body)).toContain('DOCUMENT_TYPE_MISMATCH');
    const zip = await uploadFile(Buffer.from('504b0304140006000800', 'hex'), 'x.docx', 'application/octet-stream').expect(415);
    expect(JSON.stringify(zip.body)).toContain('DOCUMENT_TYPE_UNSUPPORTED');
  });

  it('requires a file', async () => {
    await http()
      .post(`/api/v1/organizations/${orgId}/ai/documents`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgId)
      .expect(400);
  });
});
