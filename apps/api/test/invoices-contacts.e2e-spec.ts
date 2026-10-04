import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/validation/validation.pipe';
import { RolesService } from '../src/roles/roles.service';
import cookieParser from 'cookie-parser';

describe('Contacts & Invoicing Module (E2E Integration)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let orgId: string;
  let salesAccountId: string;
  let customerContactId: string;
  let invoiceId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser('test-secret-at-least-32-characters-long'));
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(createValidationPipe());

    const roles = app.get(RolesService);
    await roles.seedGlobalPermissions();

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Signs in as demo owner and retrieves organization', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'owner@democonsulting.com', password: 'Password1234!' })
      .expect(200);

    expect(loginRes.body.accessToken).toBeDefined();
    ownerToken = loginRes.body.accessToken;

    const orgsRes = await request(app.getHttpServer())
      .get('/api/v1/organizations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(orgsRes.body.length).toBeGreaterThan(0);
    orgId = orgsRes.body[0].organization.id;
  });

  it('2. Loads chart of accounts and locates Sales Revenue (4000)', async () => {
    const accountsRes = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgId}/accounts`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-organization-id', orgId)
      .expect(200);

    const salesAcc = accountsRes.body.find((a: any) => a.code === '4000');
    expect(salesAcc).toBeDefined();
    salesAccountId = salesAcc.id;
  });

  it('3. Creates a new customer contact', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/contacts`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-organization-id', orgId)
      .send({
        name: 'Nexus Dynamics Ltd',
        companyName: 'Nexus Dynamics Global UK',
        type: 'CUSTOMER',
        email: 'billing@nexusdynamics.test',
        phone: '+44 20 7123 4567',
        taxNumber: 'GB999888777',
        paymentTermsDays: 30,
        addressLine1: '10 Tech Square',
        city: 'London',
        postcode: 'EC1A 1BB',
        country: 'GB',
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('Nexus Dynamics Ltd');
    expect(res.body.type).toBe('CUSTOMER');
    customerContactId = res.body.id;
  });

  it('4. Creates a draft sales invoice with line items', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/invoices`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-organization-id', orgId)
      .send({
        contactId: customerContactId,
        issueDate: '2026-04-15',
        dueDate: '2026-05-15',
        reference: 'PO-2026-0099',
        currency: 'GBP',
        notes: 'Thank you for your business.',
        lines: [
          {
            accountId: salesAccountId,
            description: 'Enterprise Cloud Consulting',
            quantity: 10,
            unitPrice: 250, // 2500.00
            taxRate: 0.20,  // 20% VAT = 500.00
          },
          {
            accountId: salesAccountId,
            description: 'Architecture Audit Report',
            quantity: 1,
            unitPrice: 1500, // 1500.00
            taxRate: 0.20,   // 20% VAT = 300.00
          },
        ],
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('DRAFT');
    expect(res.body.invoiceNumber).toMatch(/^INV-2026-\d{6}$/);
    expect(Number(res.body.subtotal)).toBe(4000);
    expect(Number(res.body.taxTotal)).toBe(800);
    expect(Number(res.body.totalAmount)).toBe(4800);
    invoiceId = res.body.id;
  });

  it('5. Posts the sales invoice to General Ledger', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/invoices/${invoiceId}/post`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-organization-id', orgId)
      .expect(200);

    expect(res.body.invoice.status).toBe('POSTED');
    expect(res.body.invoice.journalEntryId).toBeDefined();
    expect(res.body.postingResult.status).toBe('POSTED');
    expect(res.body.postingResult.journalNumber).toMatch(/^JE-2026-\d{6}$/);
    expect(Number(res.body.postingResult.totalDebit)).toBe(4800);
    expect(Number(res.body.postingResult.totalCredit)).toBe(4800);
    expect(Number(res.body.postingResult.difference)).toBe(0);
  });

  it('6. Rejects editing a POSTED invoice (immutability)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${orgId}/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-organization-id', orgId)
      .send({ reference: 'MODIFIED-PO' })
      .expect(409);
  });

  it('7. Rejects deleting a POSTED invoice (audit protection)', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/organizations/${orgId}/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-organization-id', orgId)
      .expect(409);
  });

  it('8. Voids the invoice and verifies symmetrical journal reversal in General Ledger', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/invoices/${invoiceId}/void`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-organization-id', orgId)
      .send({ reason: 'Client requested order cancellation' })
      .expect(200);

    expect(res.body.invoice.status).toBe('VOIDED');
    expect(res.body.reversal.reversalJournal).toBeDefined();
    expect(res.body.reversal.reversalJournal.journalNumber).toMatch(/^JE-2026-\d{6}$/);
    expect(res.body.reversal.reversalJournal.reversalOfJournalId).toBe(res.body.invoice.journalEntryId);
  });

  it('9. Rejects re-voiding an already VOIDED invoice', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/invoices/${invoiceId}/void`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-organization-id', orgId)
      .send({ reason: 'Duplicate void attempt' })
      .expect(409);
  });
});
