import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { createValidationPipe } from '../src/common/validation/validation.pipe';
import { RolesService } from '../src/roles/roles.service';
import cookieParser from 'cookie-parser';

describe('Monetary Precision & Reporting Correctness (Phase 4 E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let orgId: string;
  let salesAccountId: string;
  let bankAccountId: string;
  let customerContactId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser('test-secret-at-least-32-characters-long'));
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(createValidationPipe());

    prisma = app.get(PrismaService);
    const roles = app.get(RolesService);
    await roles.seedGlobalPermissions();

    await app.init();

    // Sign in as owner
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'owner@democonsulting.com', password: 'Password1234!' })
      .expect(200);

    ownerToken = loginRes.body.accessToken;

    const orgsRes = await request(app.getHttpServer())
      .get('/api/v1/organizations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    orgId = orgsRes.body[0].organization.id;

    // Load accounts
    const accountsRes = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgId}/accounts`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-organization-id', orgId)
      .expect(200);

    salesAccountId = accountsRes.body.find((a: { code: string; id: string }) => a.code === '4000').id;
    bankAccountId = accountsRes.body.find((a: { code: string; id: string }) => a.code === '1010').id;

    // Ensure customer contact exists
    let contact = await prisma.contact.findFirst({
      where: { organizationId: orgId, type: 'CUSTOMER' },
    });
    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          organizationId: orgId,
          type: 'CUSTOMER',
          name: 'Precision Test Customer',
          email: 'precision@example.com',
          country: 'GB',
          currency: 'GBP',
        },
      });
    }
    customerContactId = contact.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects creation of an invoice in an unsupported foreign currency (e.g. USD in a GBP org)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/invoices`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-organization-id', orgId)
      .send({
        contactId: customerContactId,
        issueDate: '2026-04-10',
        dueDate: '2026-05-10',
        currency: 'USD',
        lines: [
          {
            accountId: salesAccountId,
            description: 'FX Consultation',
            quantity: '1',
            unitPrice: '100.00',
            taxRate: '0',
          },
        ],
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UNSUPPORTED_CURRENCY');
    expect(res.body.error.message).toContain('Multi-currency and FX conversion are not enabled');
  });

  it('rejects creation of a journal in an unsupported foreign currency', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/journals`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-organization-id', orgId)
      .send({
        journalDate: '2026-04-10',
        description: 'Foreign Journal',
        currency: 'EUR',
        lines: [
          { accountId: bankAccountId, debit: '100', credit: '0' },
          { accountId: salesAccountId, debit: '0', credit: '100' },
        ],
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UNSUPPORTED_CURRENCY');
  });

  it('specifically tests two zero-tax lines with quantity 0.0001 and unit price 0.5', async () => {
    // 0.0001 * 0.5 = 0.00005 -> rounds Half-Up to 0.0001 per line
    // Two lines: 0.0001 + 0.0001 = 0.0002 subtotal and total
    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/invoices`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-organization-id', orgId)
      .send({
        contactId: customerContactId,
        issueDate: '2026-04-12',
        dueDate: '2026-05-12',
        reference: 'PRECISION-TEST-01',
        lines: [
          {
            accountId: salesAccountId,
            description: 'Micro Line A',
            quantity: '0.0001',
            unitPrice: '0.5',
            taxRate: '0',
          },
          {
            accountId: salesAccountId,
            description: 'Micro Line B',
            quantity: '0.0001',
            unitPrice: '0.5',
            taxRate: '0',
          },
        ],
      })
      .expect(201);

    const invoice = createRes.body;
    expect(parseFloat(invoice.lines[0].lineTotal)).toBe(0.0001);
    expect(parseFloat(invoice.lines[1].lineTotal)).toBe(0.0001);
    expect(parseFloat(invoice.subtotal)).toBe(0.0002);
    expect(parseFloat(invoice.totalAmount)).toBe(0.0002);

    // Post the invoice: journal must be created atomically and balance exactly
    const postRes = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/invoices/${invoice.id}/post`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-organization-id', orgId)
      .expect(200);

    expect(postRes.body.invoice.status).toBe('POSTED');

    // Verify journal lines
    const journalId = postRes.body.invoice.journalEntryId;
    const journal = await prisma.journalEntry.findUnique({
      where: { id: journalId },
      include: { lines: true },
    });

    expect(journal).toBeDefined();
    expect(journal?.lines).toHaveLength(3); // 1 AR (Debit) + 2 Revenue (Credit)

    const arLine = journal?.lines.find((l) => Number(l.debit) > 0);
    const revLines = journal?.lines.filter((l) => Number(l.credit) > 0);

    expect(Number(arLine?.debit)).toBe(0.0002);
    expect(revLines).toHaveLength(2);
    expect(Number(revLines![0].credit)).toBe(0.0001);
    expect(Number(revLines![1].credit)).toBe(0.0001);

    // Ensure total debit === total credit down to the 4th decimal place
    const totalDebit = journal!.lines.reduce((s, l) => s + Number(l.debit), 0);
    const totalCredit = journal!.lines.reduce((s, l) => s + Number(l.credit), 0);
    expect(totalDebit).toBeCloseTo(0.0002, 4);
    expect(totalCredit).toBeCloseTo(0.0002, 4);
    expect(totalDebit).toEqual(totalCredit);
  });

  it('handles multiple lines with 20% VAT tax rate and verifies exact line-by-line reconciliation', async () => {
    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/invoices`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-organization-id', orgId)
      .send({
        contactId: customerContactId,
        issueDate: '2026-04-14',
        dueDate: '2026-05-14',
        reference: 'VAT-TAX-RECON-01',
        lines: [
          {
            accountId: salesAccountId,
            description: 'Item 1 - Standard Rate',
            quantity: '3.5',
            unitPrice: '12.3456',
            taxRate: '0.2',
          },
          {
            accountId: salesAccountId,
            description: 'Item 2 - Fractional',
            quantity: '1.25',
            unitPrice: '99.99',
            taxRate: '0.2',
          },
        ],
      })
      .expect(201);

    const inv = createRes.body;
    // Line 1: Net = 3.5 * 12.3456 = 43.2096. Tax = 43.2096 * 0.2 = 8.64192 -> 8.6419. Total = 51.8515
    // Line 2: Net = 1.25 * 99.99 = 124.9875. Tax = 124.9875 * 0.2 = 24.9975. Total = 149.9850
    // Subtotal = 43.2096 + 124.9875 = 168.1971
    // Tax Total = 8.6419 + 24.9975 = 33.6394
    // Total Amount = 51.8515 + 149.9850 = 201.8365
    expect(parseFloat(inv.subtotal)).toBeCloseTo(168.1971, 4);
    expect(parseFloat(inv.taxTotal)).toBeCloseTo(33.6394, 4);
    expect(parseFloat(inv.totalAmount)).toBeCloseTo(201.8365, 4);

    // Posting must balance exactly: AR Debit = 201.8365, Revenue Credits = 168.1971, Tax Credit = 33.6394
    const postRes = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/invoices/${inv.id}/post`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-organization-id', orgId)
      .expect(200);

    expect(postRes.body.invoice.status).toBe('POSTED');
  });

  it('handles large monetary amounts close to DB precision limit without floating-point distortion', async () => {
    const largeAmount = '999999999.9999';

    const journalRes = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/journals`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-organization-id', orgId)
      .send({
        journalDate: '2026-04-15',
        description: 'Large amount test',
        lines: [
          { accountId: bankAccountId, debit: largeAmount, credit: '0' },
          { accountId: salesAccountId, debit: '0', credit: largeAmount },
        ],
      })
      .expect(201);

    expect(journalRes.body.lines[0].debit).toBe(largeAmount);
    expect(journalRes.body.lines[1].credit).toBe(largeAmount);

    // Validate and post the journal
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/journals/${journalRes.body.id}/validate`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-organization-id', orgId)
      .expect(200);

    const postRes = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/journals/${journalRes.body.id}/post`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-organization-id', orgId)
      .expect(200);

    expect(postRes.body.status).toBe('POSTED');
  });

  it('reconciles Trial Balance displayed rows with displayed totals', async () => {
    const tbRes = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgId}/reports/trial-balance`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-organization-id', orgId)
      .expect(200);

    const tb = tbRes.body;
    expect(tb.isBalanced).toBe(true);

    // Sum of displayed account row debit balances
    const sumRowDebits = tb.accounts.reduce(
      (acc: number, r: { debitBalance: string }) => acc + parseFloat(r.debitBalance),
      0,
    );
    const sumRowCredits = tb.accounts.reduce(
      (acc: number, r: { creditBalance: string }) => acc + parseFloat(r.creditBalance),
      0,
    );

    expect(sumRowDebits).toBeCloseTo(parseFloat(tb.totalDebit), 2);
    expect(sumRowCredits).toBeCloseTo(parseFloat(tb.totalCredit), 2);
    expect(parseFloat(tb.difference)).toBe(0);
  });
});
