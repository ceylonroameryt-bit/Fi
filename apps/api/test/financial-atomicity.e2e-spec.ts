import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { createValidationPipe } from '../src/common/validation/validation.pipe';
import { RolesService } from '../src/roles/roles.service';
import cookieParser from 'cookie-parser';

describe('Financial Atomicity & Concurrency Controls (Phase 3 E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let orgId: string;
  let salesAccountId: string;
  let bankAccountId: string;
  let customerContactId: string;
  let postedInvoiceId: string;
  let postedJournalId: string;

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

    salesAccountId = accountsRes.body.find((a: any) => a.code === '4000').id;
    bankAccountId = accountsRes.body.find((a: any) => a.code === '1010').id;

    // Create customer contact
    const contactRes = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/contacts`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-organization-id', orgId)
      .send({
        name: 'Atomicity Test Corp',
        type: 'CUSTOMER',
        paymentTermsDays: 30,
      })
      .expect(201);

    customerContactId = contactRes.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Invoice Posting Atomicity & Double-Posting Prevention', () => {
    it('creates a draft invoice and posts it atomically', async () => {
      const invRes = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${orgId}/invoices`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .send({
          contactId: customerContactId,
          issueDate: '2026-04-20',
          dueDate: '2026-05-20',
          reference: 'ATOMIC-01',
          currency: 'GBP',
          lines: [
            {
              accountId: salesAccountId,
              description: 'Atomicity Consulting Service',
              quantity: 2,
              unitPrice: 500,
              taxRate: 0.20,
            },
          ],
        })
        .expect(201);

      postedInvoiceId = invRes.body.id;

      // Post the invoice
      const postRes = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${orgId}/invoices/${postedInvoiceId}/post`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .expect(200);

      expect(postRes.body.invoice.status).toBe('POSTED');
      expect(postRes.body.invoice.journalEntryId).toBeDefined();
      postedJournalId = postRes.body.invoice.journalEntryId;

      // Verify DB constraint: Exactly one journal entry exists for this invoice
      const journals = await prisma.journalEntry.findMany({
        where: {
          organizationId: orgId,
          sourceType: 'INVOICE',
          sourceId: postedInvoiceId,
        },
      });
      expect(journals.length).toBe(1);
    });

    it('rejects retrying or concurrent post on an already POSTED invoice (409 Conflict)', async () => {
      const retryRes = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${orgId}/invoices/${postedInvoiceId}/post`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .expect(409);

      expect(retryRes.body.error.code).toBe('INVOICE_ALREADY_POSTED');

      // Still only one journal entry exists
      const count = await prisma.journalEntry.count({
        where: {
          organizationId: orgId,
          sourceType: 'INVOICE',
          sourceId: postedInvoiceId,
        },
      });
      expect(count).toBe(1);
    });

    it('blocks independent modification or deletion of invoice-generated journals', async () => {
      // Attempt to modify invoice-generated journal via Journals API
      const patchRes = await request(app.getHttpServer())
        .patch(`/api/v1/organizations/${orgId}/journals/${postedJournalId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .send({ description: 'Tampered description' })
        .expect(409);

      expect(patchRes.body.error.code).toBe('JOURNAL_SYSTEM_MANAGED');

      // Attempt to delete invoice-generated journal via Journals API
      const deleteRes = await request(app.getHttpServer())
        .delete(`/api/v1/organizations/${orgId}/journals/${postedJournalId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .expect(409);

      expect(deleteRes.body.error.code).toBe('JOURNAL_SYSTEM_MANAGED');
    });
  });

  describe('2. Journal Concurrency & Genuine Optimistic Version Checks', () => {
    let draftJournalId: string;
    let initialVersion: number;

    it('creates a manual draft journal with version tracking', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${orgId}/journals`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .send({
          journalDate: '2026-05-10',
          description: 'Optimistic locking test journal',
          currency: 'GBP',
          lines: [
            { accountId: bankAccountId, debit: 100, credit: 0 },
            { accountId: salesAccountId, debit: 0, credit: 100 },
          ],
        })
        .expect(201);

      draftJournalId = res.body.id;
      initialVersion = res.body.version;
      expect(initialVersion).toBeDefined();
    });

    it('updates draft journal successfully when version matches', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/organizations/${orgId}/journals/${draftJournalId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .send({
          description: 'Updated with matching version',
          version: initialVersion,
        })
        .expect(200);

      expect(res.body.version).toBe(initialVersion + 1);
    });

    it('rejects stale draft update when version does not match (409 CONCURRENT_MODIFICATION)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/organizations/${orgId}/journals/${draftJournalId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .send({
          description: 'Stale modification attempt',
          version: initialVersion, // Stale version!
        })
        .expect(409);

      expect(res.body.error.code).toBe('CONCURRENT_MODIFICATION');
    });
  });

  describe('3. Database Triggers & Posted Accounting Protections (Direct SQL)', () => {
    it('PostgreSQL trigger blocks direct SQL INSERT of lines into a POSTED journal', async () => {
      await expect(
        prisma.$queryRawUnsafe(`
          INSERT INTO "journal_lines" ("id", "organization_id", "journal_entry_id", "account_id", "line_number", "debit", "credit", "currency", "created_at", "updated_at")
          VALUES (gen_random_uuid(), '${orgId}'::uuid, '${postedJournalId}'::uuid, '${bankAccountId}'::uuid, 99, 50.00, 0, 'GBP', NOW(), NOW())
        `),
      ).rejects.toThrow(/Lines of a posted or reversed journal are immutable/);
    });

    it('PostgreSQL trigger blocks direct SQL UPDATE of lines belonging to a POSTED journal', async () => {
      await expect(
        prisma.$queryRawUnsafe(`
          UPDATE "journal_lines"
          SET "debit" = 99999.00
          WHERE "journal_entry_id" = '${postedJournalId}'::uuid
        `),
      ).rejects.toThrow(/Lines of a posted or reversed journal are immutable/);
    });

    it('PostgreSQL trigger blocks direct SQL DELETE of lines belonging to a POSTED journal', async () => {
      await expect(
        prisma.$queryRawUnsafe(`
          DELETE FROM "journal_lines"
          WHERE "journal_entry_id" = '${postedJournalId}'::uuid
        `),
      ).rejects.toThrow(/Lines of a posted or reversed journal are immutable/);
    });

    it('PostgreSQL trigger blocks direct SQL UPDATE reverting POSTED journal back to DRAFT', async () => {
      await expect(
        prisma.$queryRawUnsafe(`
          UPDATE "journal_entries"
          SET "status" = 'DRAFT'
          WHERE "id" = '${postedJournalId}'::uuid
        `),
      ).rejects.toThrow(/cannot be transitioned back to/);
    });

    it('PostgreSQL trigger blocks altering critical financial attributes of a POSTED journal', async () => {
      await expect(
        prisma.$queryRawUnsafe(`
          UPDATE "journal_entries"
          SET "currency" = 'EUR'
          WHERE "id" = '${postedJournalId}'::uuid
        `),
      ).rejects.toThrow(/Header attributes of posted\/reversed journal .* are immutable/);
    });
  });

  describe('4. Period Lock Coordination & Fail-Closed Behavior', () => {
    let periodToLock: any;

    it('retrieves an open period and hard-locks it', async () => {
      const periodsRes = await request(app.getHttpServer())
        .get(`/api/v1/organizations/${orgId}/periods`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      // Period for November 2026
      periodToLock = periodsRes.body.find((p: any) => p.name.includes('November 2026'));
      expect(periodToLock).toBeDefined();

      const lockRes = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${orgId}/periods/${periodToLock.id}/hard-lock`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(lockRes.body.status).toBe('HARD_LOCKED');
    });

    it('rejects posting an invoice into a hard-locked period (PERIOD_HARD_LOCKED)', async () => {
      // Create invoice dated in November 2026
      const invRes = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${orgId}/invoices`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .send({
          contactId: customerContactId,
          issueDate: '2026-11-15',
          dueDate: '2026-12-15',
          reference: 'LOCKED-PERIOD-01',
          currency: 'GBP',
          lines: [
            {
              accountId: salesAccountId,
              description: 'Locked period service',
              quantity: 1,
              unitPrice: 200,
              taxRate: 0,
            },
          ],
        })
        .expect(201);

      const lockedInvId = invRes.body.id;

      // Attempt to post
      const postRes = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${orgId}/invoices/${lockedInvId}/post`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .expect(422);

      expect(postRes.body.error.code).toBe('POSTING_VALIDATION_FAILED');

      // Verify atomic rollback: Invoice is STILL in DRAFT status and NO journal was created
      const checkInvoice = await prisma.invoice.findUnique({
        where: { id: lockedInvId },
      });
      expect(checkInvoice?.status).toBe('DRAFT');
      expect(checkInvoice?.journalEntryId).toBeNull();

      const orphanedJournals = await prisma.journalEntry.findMany({
        where: {
          organizationId: orgId,
          sourceType: 'INVOICE',
          sourceId: lockedInvId,
        },
      });
      expect(orphanedJournals.length).toBe(0);
    });

    it('unlocks the period and successfully posts the invoice', async () => {
      // Unlock period
      await request(app.getHttpServer())
        .post(`/api/v1/organizations/${orgId}/periods/${periodToLock.id}/unlock`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      // Locate the invoice that failed previously
      const invoicesRes = await request(app.getHttpServer())
        .get(`/api/v1/organizations/${orgId}/invoices?search=LOCKED-PERIOD-01`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      const invoiceId = invoicesRes.body.items[0].id;

      // Post now succeeds
      const postRes = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${orgId}/invoices/${invoiceId}/post`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .expect(200);

      expect(postRes.body.invoice.status).toBe('POSTED');
      expect(postRes.body.invoice.journalEntryId).toBeDefined();
    });
  });
});
