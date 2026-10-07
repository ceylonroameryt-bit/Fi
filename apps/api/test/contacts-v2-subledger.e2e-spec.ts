import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/validation/validation.pipe';
import { RolesService } from '../src/roles/roles.service';
import { PrismaService } from '../src/database/prisma.service';
import cookieParser from 'cookie-parser';

describe('Contacts V2 & Subledger Foundation (E2E Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let orgId: string;
  let salesAccountId: string;
  let arAccountId: string;
  let customerContactId: string;
  let supplierContactId: string;
  let bothContactId: string;
  let invoiceId: string;
  const testRun = Date.now();
  const testCompanyNumber = `GB${testRun.toString().slice(-8)}`;
  const testEmail = `finance-${testRun}@vanguard-aero.test`;

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

    prisma = app.get(PrismaService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Signs in as demo owner and retrieves organization accounts', async () => {
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

    orgId = orgsRes.body[0].organization.id;

    const accountsRes = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgId}/accounts`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-organization-id', orgId)
      .expect(200);

    const salesAcc = accountsRes.body.find((a: any) => a.code === '4000');
    const arAcc = accountsRes.body.find((a: any) => a.code === '1100');
    expect(salesAcc).toBeDefined();
    expect(arAcc).toBeDefined();
    salesAccountId = salesAcc.id;
    arAccountId = arAcc.id;
  });

  describe('P3.1 & P3.2: Account Validation & Business Contact Fields', () => {
    it('2. Rejects Revenue account as AR control account', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${orgId}/contacts`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .send({
          name: 'Invalid AR Contact',
          type: 'CUSTOMER',
          receivableAccountId: salesAccountId, // 4000 Revenue
        })
        .expect(422);

      expect(res.body.error?.code).toBe('INVALID_RECEIVABLE_ACCOUNT');
    });

    it('3. Creates CUSTOMER with complete business fields, shipping address, and valid AR account', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${orgId}/contacts`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .send({
          name: 'Vanguard Aerospace Ltd',
          companyName: 'Vanguard Aerospace UK',
          companyNumber: testCompanyNumber,
          vatNumber: 'GB987654321',
          type: 'CUSTOMER',
          email: testEmail,
          phone: '+44 20 7946 0999',
          creditLimit: 50000,
          paymentTermsDays: 45,
          addressLine1: '1 Aerospace Way',
          city: 'Farnborough',
          postcode: 'GU14 6TD',
          country: 'GB',
          shippingAddressLine1: 'Hangar 4B, Logistics Gate',
          shippingCity: 'Farnborough',
          shippingPostcode: 'GU14 6TD',
          shippingCountry: 'GB',
          receivableAccountId: arAccountId,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.companyNumber).toBe(testCompanyNumber);
      expect(res.body.vatNumber).toBe('GB987654321');
      expect(res.body.shippingAddressLine1).toBe('Hangar 4B, Logistics Gate');
      customerContactId = res.body.id;
    });

    it('4. Creates SUPPLIER and BOTH contacts', async () => {
      const suppRes = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${orgId}/contacts`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .send({
          name: 'Precision Metal Supplies',
          type: 'SUPPLIER',
          email: 'invoices@precisionmetal.test',
        })
        .expect(201);
      supplierContactId = suppRes.body.id;

      const bothRes = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${orgId}/contacts`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .send({
          name: 'Global Partner Logistics',
          type: 'BOTH',
          email: 'ops@globalpartner.test',
        })
        .expect(201);
      bothContactId = bothRes.body.id;
    });
  });

  describe('P3.3: Contact Person Management', () => {
    let person1Id: string;
    let person2Id: string;

    it('5. Adds contact person to customer', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${orgId}/contacts/${customerContactId}/people`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .send({
          firstName: 'Sarah',
          lastName: 'Connor',
          jobTitle: 'Head of Procurement',
          email: 'sarah.connor@vanguard-aero.test',
          phone: '+44 20 7946 0111',
          isPrimary: true,
          isBillingContact: true,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.isPrimary).toBe(true);
      person1Id = res.body.id;
    });

    it('6. Adds second contact person as primary and verifies first is demoted', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${orgId}/contacts/${customerContactId}/people`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .send({
          firstName: 'John',
          lastName: 'Reese',
          jobTitle: 'Finance Director',
          email: 'john.reese@vanguard-aero.test',
          isPrimary: true,
        })
        .expect(201);

      expect(res.body.isPrimary).toBe(true);
      person2Id = res.body.id;

      // Verify contact detail returns John Reese as primaryPerson
      const contactRes = await request(app.getHttpServer())
        .get(`/api/v1/organizations/${orgId}/contacts/${customerContactId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .expect(200);

      expect(contactRes.body.primaryPerson?.id).toBe(person2Id);
      const oldPerson = contactRes.body.people.find((p: any) => p.id === person1Id);
      expect(oldPerson.isPrimary).toBe(false);
    });

    it('7. Deactivates a contact person', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${orgId}/contacts/${customerContactId}/people/${person1Id}/deactivate`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .expect(200);

      expect(res.body.isActive).toBe(false);
    });
  });

  describe('P3.4 & P3.5: Server-Side Pagination, Sorting, Search, and Summary', () => {
    it('8. Retrieves paginated contacts with total and pages', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/organizations/${orgId}/contacts?page=1&pageSize=2&sortBy=name&sortDirection=asc`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .expect(200);

      expect(res.body.items).toBeDefined();
      expect(res.body.items.length).toBeLessThanOrEqual(2);
      expect(res.body.total).toBeGreaterThanOrEqual(3);
      expect(res.body.page).toBe(1);
      expect(res.body.pageSize).toBe(2);
      expect(res.body.totalPages).toBeGreaterThanOrEqual(2);
    });

    it('9. Searches contacts by company registration number', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/organizations/${orgId}/contacts?search=${testCompanyNumber}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].id).toBe(customerContactId);
    });

    it('10. Retrieves organisation contact summary metrics', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/organizations/${orgId}/contacts/summary`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .expect(200);

      expect(res.body.total).toBeGreaterThanOrEqual(3);
      expect(res.body.active).toBeGreaterThanOrEqual(3);
      expect(res.body.customers).toBeGreaterThanOrEqual(1);
      expect(res.body.suppliers).toBeGreaterThanOrEqual(1);
      expect(res.body.both).toBeGreaterThanOrEqual(1);
      expect(typeof res.body.customersWithOutstandingBalance).toBe('number');
    });

    it('11. Detects duplicate signals on duplicate check endpoint', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/organizations/${orgId}/contacts/duplicate-check?email=${testEmail}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .expect(200);

      expect(res.body.hasPotentialDuplicates).toBe(true);
      expect(res.body.matches[0].id).toBe(customerContactId);
      expect(res.body.matches[0].matchReason).toBe('MATCHING_EMAIL');
    });
  });

  describe('P3.6 & P3.7 & P3.8: Subledger Tagging, Invoices, Balances, and Statements', () => {
    it('12. Rejects sales invoice creation for SUPPLIER-only contact', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${orgId}/invoices`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .send({
          contactId: supplierContactId,
          issueDate: '2026-04-20',
          dueDate: '2026-05-20',
          lines: [
            {
              accountId: salesAccountId,
              description: 'Services',
              quantity: 1,
              unitPrice: 1000,
              taxRate: 0.2,
            },
          ],
        })
        .expect(400);

      expect(res.body.error?.code).toBe('CONTACT_NOT_CUSTOMER');
    });

    it('12b. Permits sales invoice creation for BOTH (Customer & Supplier) contact', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${orgId}/invoices`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .send({
          contactId: bothContactId,
          issueDate: '2026-04-20',
          dueDate: '2026-05-20',
          lines: [
            {
              accountId: salesAccountId,
              description: 'Logistics Joint Venture',
              quantity: 1,
              unitPrice: 500,
              taxRate: 0,
            },
          ],
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
    });

    it('13. Creates and posts sales invoice for CUSTOMER contact (£1,200 total)', async () => {
      const createRes = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${orgId}/invoices`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .send({
          contactId: customerContactId,
          issueDate: '2026-04-20',
          dueDate: '2026-05-20',
          lines: [
            {
              accountId: salesAccountId,
              description: 'Aeronautics Consulting',
              quantity: 1,
              unitPrice: 1000, // 1000.00 Net
              taxRate: 0.20,   // 200.00 VAT
            },
          ],
        })
        .expect(201);

      invoiceId = createRes.body.id;
      expect(Number(createRes.body.totalAmount)).toBe(1200);

      const postRes = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${orgId}/invoices/${invoiceId}/post`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .expect(200);

      expect(postRes.body.invoice.status).toBe('POSTED');

      // Verify the AR journal line is tagged with contactId
      const journalId = postRes.body.invoice.journalEntryId;
      const journalLines = await prisma.journalLine.findMany({
        where: { journalEntryId: journalId },
      });

      const arLine = journalLines.find((l) => Number(l.debit) === 1200);
      expect(arLine).toBeDefined();
      expect(arLine?.contactId).toBe(customerContactId);

      // Verify Revenue and VAT lines do NOT have customer contactId
      const revLine = journalLines.find((l) => Number(l.credit) === 1000);
      expect(revLine?.contactId).toBeNull();
    });

    it('14. Derives customer balance of £1,200.00 from posted subledger journal line', async () => {
      const contactRes = await request(app.getHttpServer())
        .get(`/api/v1/organizations/${orgId}/contacts/${customerContactId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .expect(200);

      expect(contactRes.body.outstandingReceivableBalance).toBe('1200.00');
    });

    it('15. Retrieves Customer Statement showing £1,200.00 running and closing balance', async () => {
      const stmtRes = await request(app.getHttpServer())
        .get(`/api/v1/organizations/${orgId}/contacts/${customerContactId}/statement`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .expect(200);

      expect(stmtRes.body.contactId).toBe(customerContactId);
      expect(stmtRes.body.openingBalance).toBe('0.00');
      expect(stmtRes.body.closingBalance).toBe('1200.00');
      expect(stmtRes.body.items).toHaveLength(1);
      expect(stmtRes.body.items[0].debit).toBe('1200.00');
      expect(stmtRes.body.items[0].runningBalance).toBe('1200.00');
    });

    it('16. Voids invoice and verifies customer balance returns to £0.00', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/organizations/${orgId}/invoices/${invoiceId}/void`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .send({ reason: 'Contract adjusted' })
        .expect(200);

      const contactRes = await request(app.getHttpServer())
        .get(`/api/v1/organizations/${orgId}/contacts/${customerContactId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .expect(200);

      expect(contactRes.body.outstandingReceivableBalance).toBe('0.00');

      // Statement now contains 2 transactions and closes at £0.00
      const stmtRes = await request(app.getHttpServer())
        .get(`/api/v1/organizations/${orgId}/contacts/${customerContactId}/statement`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .expect(200);

      expect(stmtRes.body.closingBalance).toBe('0.00');
      expect(stmtRes.body.items).toHaveLength(2);
    });
  });

  describe('Tenant Database Integrity & Archiving Rules', () => {
    it('17. Enforces database composite foreign key against cross-tenant journal lines', async () => {
      // Create a second test organization
      const otherOrg = await prisma.organization.create({
        data: {
          name: 'Rival Tenant Corp',
          country: 'GB',
          baseCurrency: 'GBP',
          timezone: 'Europe/London',
          createdById: (await prisma.user.findFirstOrThrow()).id,
        },
      });

      const journal = await prisma.journalEntry.findFirstOrThrow({
        where: { organizationId: orgId },
      });

      // Attempt direct DB insert with mismatched organizationId
      await expect(
        prisma.journalLine.create({
          data: {
            journalEntryId: journal.id,
            organizationId: otherOrg.id, // Mismatched tenant
            lineNumber: 999,
            accountId: arAccountId,
            currency: 'GBP',
            debit: 50,
            contactId: customerContactId, // Belongs to orgId, not otherOrg.id!
          },
        }),
      ).rejects.toThrow();

      await prisma.organization.delete({ where: { id: otherOrg.id } });
    });

    it('18. Archives contact, blocks new invoices, but preserves statements and history', async () => {
      // Archive contact
      await request(app.getHttpServer())
        .post(`/api/v1/organizations/${orgId}/contacts/${customerContactId}/archive`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .expect(200);

      // Attempting to create new invoice for archived contact is rejected
      const failRes = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${orgId}/invoices`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .send({
          contactId: customerContactId,
          issueDate: '2026-04-25',
          dueDate: '2026-05-25',
          lines: [
            { accountId: salesAccountId, description: 'Test', quantity: 1, unitPrice: 100, taxRate: 0 },
          ],
        })
        .expect(422);

      expect(failRes.body.error?.code).toBe('CONTACT_ARCHIVED');

      // Historical statements still accessible
      const stmtRes = await request(app.getHttpServer())
        .get(`/api/v1/organizations/${orgId}/contacts/${customerContactId}/statement`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .expect(200);

      expect(stmtRes.body.contactId).toBe(customerContactId);

      // Restore contact
      await request(app.getHttpServer())
        .post(`/api/v1/organizations/${orgId}/contacts/${customerContactId}/restore`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .expect(200);

      // New invoice creation succeeds again
      const okRes = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${orgId}/invoices`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .send({
          contactId: customerContactId,
          issueDate: '2026-04-25',
          dueDate: '2026-05-25',
          lines: [
            { accountId: salesAccountId, description: 'Test', quantity: 1, unitPrice: 100, taxRate: 0 },
          ],
        })
        .expect(201);

      expect(okRes.body.id).toBeDefined();
    });
  });
});
