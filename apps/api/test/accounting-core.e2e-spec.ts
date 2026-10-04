import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/validation/validation.pipe';
import { RolesService } from '../src/roles/roles.service';
import cookieParser from 'cookie-parser';

describe('Ledgerline Accounting Core (Phases 1–8 E2E)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let viewerToken: string;
  let orgAId: string;
  let orgBId: string;
  let bankAccountId: string;
  let capitalAccountId: string;
  let softwareAccountId: string;
  let retainedEarningsAccountId: string;
  let draftJournalId: string;

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

  // ─────────────────────────── Phase 2: Auth ───────────────────────────

  it('1. Registers an Owner user', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `alice_${Date.now()}@example.com`,
        password: 'Password1234!',
        firstName: 'Alice',
        lastName: 'Owner',
      })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    ownerToken = res.body.accessToken;
  });

  it('2. Registers a Viewer user', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `viewer_${Date.now()}@example.com`,
        password: 'Password1234!',
        firstName: 'Charlie',
        lastName: 'Viewer',
      })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    viewerToken = res.body.accessToken;
  });

  // ─────────────────── Phase 3: Multi-Organisation ──────────────────────

  it('3. Creates Organisation A (Alpha Consulting Ltd, GBP)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Alpha Consulting Ltd',
        country: 'GB',
        baseCurrency: 'GBP',
        timezone: 'Europe/London',
        financialYearStartMonth: 4,
        financialYearStartDay: 1,
        useDefaultChartOfAccounts: true,
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('Alpha Consulting Ltd');
    orgAId = res.body.id;
  });

  it('4. Creates Organisation B (Beta Retail Ltd, USD)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Beta Retail Ltd',
        country: 'US',
        baseCurrency: 'USD',
        timezone: 'America/New_York',
        useDefaultChartOfAccounts: true,
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    orgBId = res.body.id;
  });

  it('5. Invites Viewer to Organisation A as VIEWER role', async () => {
    // Get roles for Org A
    const rolesRes = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgAId}/roles`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const viewerRole = rolesRes.body.find((r: any) => r.systemKey === 'VIEWER');
    expect(viewerRole).toBeDefined();

    // Get viewer user email
    const meRes = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        email: meRes.body.email,
        roleId: viewerRole.id,
      })
      .expect(201);
  });

  // ─────────────────── Phase 5: Chart of Accounts ───────────────────────

  it('6. Verifies Chart of Accounts was loaded and retrieves IDs', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgAId}/accounts`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.length).toBeGreaterThan(10);
    const bank = res.body.find((a: any) => a.code === '1010');
    const capital = res.body.find((a: any) => a.code === '3000');
    const software = res.body.find((a: any) => a.code === '6300');
    const retainedEarnings = res.body.find((a: any) => a.code === '3300');

    expect(bank).toBeDefined();
    expect(capital).toBeDefined();
    expect(software).toBeDefined();
    expect(retainedEarnings).toBeDefined();
    expect(retainedEarnings.allowManualPosting).toBe(false);

    bankAccountId = bank.id;
    capitalAccountId = capital.id;
    softwareAccountId = software.id;
    retainedEarningsAccountId = retainedEarnings.id;
  });

  it('7. Rejects duplicate account code within Organisation A (409 Conflict)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/accounts`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        code: '1010',
        name: 'Another Bank Account',
        accountType: 'ASSET',
        accountSubtype: 'BANK',
      })
      .expect(409);

    expect(res.body.error.code).toBe('DUPLICATE_ACCOUNT_CODE');
  });

  // ────────────── Phase 6: Financial Years & Accounting Periods ─────────

  it('8. Creates Financial Year 01 April 2026 to 31 March 2027 and auto-generates 12 periods', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/financial-years`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'FY 2026/2027',
        startDate: '2026-04-01',
        endDate: '2027-03-31',
        generatePeriods: true,
      })
      .expect(201);

    expect(res.body.periods.length).toBe(12);
    expect(res.body.periods[0].name).toBe('April 2026');
  });

  it('9. Rejects overlapping Financial Year (409 Conflict)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/financial-years`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Overlapping Year',
        startDate: '2026-10-01',
        endDate: '2027-09-30',
      })
      .expect(409);

    expect(res.body.error.code).toBe('FINANCIAL_YEAR_OVERLAP');
  });

  // ─────────────────── Phases 7 & 8: Manual Journal & Validation ────────

  it('10. Creates a draft manual journal (Initial owner investment, £25,000)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/journals`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        journalDate: '2026-04-15',
        postingDate: '2026-04-15',
        description: 'Initial owner investment',
        reference: 'OWNER-001',
        lines: [
          {
            accountId: bankAccountId,
            description: 'Main Bank Account deposit',
            debit: 25000,
            credit: 0,
          },
          {
            accountId: capitalAccountId,
            description: 'Owner Capital credit',
            debit: 0,
            credit: 25000,
          },
        ],
      })
      .expect(201);

    expect(res.body.journalNumber).toMatch(/^JE-2026-\d{6}$/);
    expect(res.body.status).toBe('DRAFT');
    expect(res.body.totalDebit).toBe('25000.0000');
    expect(res.body.totalCredit).toBe('25000.0000');
    expect(res.body.isBalanced).toBe(true);

    draftJournalId = res.body.id;
  });

  it('11. Validates the draft journal -> changes to VALIDATED', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/journals/${draftJournalId}/validate`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.isValid).toBe(true);
    expect(res.body.totalDebit).toBe('25000.0000');
    expect(res.body.totalCredit).toBe('25000.0000');
    expect(res.body.difference).toBe('0.0000');
    expect(res.body.journal.status).toBe('VALIDATED');
  });

  it('12. Modifying a VALIDATED journal resets status back to DRAFT', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${orgAId}/journals/${draftJournalId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        description: 'Updated owner investment description',
      })
      .expect(200);

    expect(res.body.status).toBe('DRAFT');
    expect(res.body.validatedAt).toBeNull();
  });

  it('13. Rejects an unbalanced journal (DR £10,000, CR £9,000 -> Diff £1,000)', async () => {
    // Create unbalanced draft
    const draftRes = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/journals`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        journalDate: '2026-04-20',
        description: 'Unbalanced draft',
        lines: [
          { accountId: bankAccountId, debit: 10000, credit: 0 },
          { accountId: capitalAccountId, debit: 0, credit: 9000 },
        ],
      })
      .expect(201);

    const valRes = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/journals/${draftRes.body.id}/validate`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(valRes.body.isValid).toBe(false);
    expect(valRes.body.difference).toBe('1000.0000');
    expect(valRes.body.errors.some((e: string) => e.includes('unbalanced'))).toBe(true);
  });

  it('14. Rejects a journal referencing an archived account', async () => {
    // Archive software account
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/accounts/${softwareAccountId}/archive`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    // Create journal using archived account
    const draftRes = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/journals`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        journalDate: '2026-04-22',
        description: 'Using archived account',
        lines: [
          { accountId: softwareAccountId, debit: 500, credit: 0 },
          { accountId: bankAccountId, debit: 0, credit: 500 },
        ],
      })
      .expect(201);

    const valRes = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/journals/${draftRes.body.id}/validate`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(valRes.body.isValid).toBe(false);
    expect(valRes.body.errors.some((e: string) => e.includes('archived'))).toBe(true);
  });

  it('15. Rejects a journal referencing an account with allow_manual_posting = false', async () => {
    const draftRes = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/journals`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        journalDate: '2026-04-22',
        description: 'Using control account',
        lines: [
          { accountId: retainedEarningsAccountId, debit: 500, credit: 0 },
          { accountId: bankAccountId, debit: 0, credit: 500 },
        ],
      })
      .expect(201);

    const valRes = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/journals/${draftRes.body.id}/validate`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(valRes.body.isValid).toBe(false);
    expect(valRes.body.errors.some((e: string) => e.includes('manual postings'))).toBe(true);
  });

  it('16. Rejects journal referencing an account belonging to another organisation (Tenant Isolation)', async () => {
    // Get account from Org B
    const orgBAccounts = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgBId}/accounts`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const orgBAcc = orgBAccounts.body[0];

    // Attempt to create journal in Org A using Org B's account -> Foreign key / tenant constraint violation
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/journals`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        journalDate: '2026-04-25',
        description: 'Cross tenant attempt',
        lines: [
          { accountId: orgBAcc.id, debit: 100, credit: 0 },
          { accountId: bankAccountId, debit: 0, credit: 100 },
        ],
      })
      .expect(409); // Database foreign key (organizationId, accountId) rejects it!
  });

  it('17. Rejects journal validation when posting date belongs to a HARD_LOCKED period', async () => {
    // Get periods
    const periodsRes = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgAId}/periods`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const aprilPeriod = periodsRes.body.find((p: any) => p.name === 'April 2026');

    // Hard-lock April 2026
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/periods/${aprilPeriod.id}/hard-lock`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    // Create journal in April 2026
    const draftRes = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/journals`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        journalDate: '2026-04-28',
        postingDate: '2026-04-28',
        description: 'Posting to locked period',
        lines: [
          { accountId: bankAccountId, debit: 100, credit: 0 },
          { accountId: capitalAccountId, debit: 0, credit: 100 },
        ],
      })
      .expect(201);

    const valRes = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/journals/${draftRes.body.id}/validate`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(valRes.body.isValid).toBe(false);
    expect(valRes.body.errors.some((e: string) => e.includes('hard-locked'))).toBe(true);

    // Unlock period again for other tests
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/periods/${aprilPeriod.id}/unlock`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
  });

  it('18. Rejects Viewer user from creating a journal (403 Forbidden)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/journals`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        journalDate: '2026-04-29',
        description: 'Viewer attempting to create journal',
        lines: [
          { accountId: bankAccountId, debit: 100, credit: 0 },
          { accountId: capitalAccountId, debit: 0, credit: 100 },
        ],
      })
      .expect(403);
  });

  it('19. Viewer cannot access Organisation B data (Direct ID guessing / Tenant Isolation)', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgBId}/accounts`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(403);
  });

  it('20. Verifies Audit Trail recorded sensitive actions', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgAId}/audit-logs`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.items.length).toBeGreaterThan(5);
    const eventTypes = res.body.items.map((i: any) => i.eventType);
    expect(eventTypes).toContain('ORGANIZATION_CREATED');
    expect(eventTypes).toContain('USER_INVITED');
    expect(eventTypes).toContain('FINANCIAL_YEAR_CREATED');
    expect(eventTypes).toContain('JOURNAL_CREATED');
    expect(eventTypes).toContain('JOURNAL_VALIDATED');
  });

  // ─────────────────────────── Phase 9: Journal Posting ───────────────────────────

  it('21. Validates and Posts journal JE-2026-000001 (Bank DR 25,000, Capital CR 25,000)', async () => {
    // Re-validate draftJournalId
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/journals/${draftJournalId}/validate`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    // Post journal
    const postRes = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/journals/${draftJournalId}/post`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(postRes.body.status).toBe('POSTED');
    expect(postRes.body.journalId).toBe(draftJournalId);
    expect(postRes.body.postedAt).toBeDefined();
    expect(postRes.body.totalDebit).toBe('25000.0000');
    expect(postRes.body.totalCredit).toBe('25000.0000');
    expect(postRes.body.difference).toBe('0.0000');
  });

  it('22. Rejects duplicate posting of already posted journal (JOURNAL_ALREADY_POSTED / 409)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/journals/${draftJournalId}/post`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(409);

    expect(res.body.error.code).toBe('JOURNAL_ALREADY_POSTED');
  });

  it('23. Rejects Viewer user from posting journals (403 Forbidden)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/journals/${draftJournalId}/post`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(403);
  });

  // ─────────────────────────── Phase 11: General Ledger ───────────────────────────

  it('24. Authoritative General Ledger contains posted entries with correct running balance', async () => {
    // Check all GL entries
    const glRes = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgAId}/general-ledger`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(glRes.body.total).toBe(2);
    expect(glRes.body.entries.some((e: any) => e.accountCode === '1010' && e.debit === '25000.00')).toBe(true);
    expect(glRes.body.entries.some((e: any) => e.accountCode === '3000' && e.credit === '25000.00')).toBe(true);

    // Check account-specific ledger for Bank Account (Debit normal: Running Balance = 25,000)
    const bankLedgerRes = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgAId}/general-ledger/accounts/${bankAccountId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(bankLedgerRes.body.account.code).toBe('1010');
    expect(bankLedgerRes.body.account.normalBalance).toBe('DEBIT');
    expect(bankLedgerRes.body.openingBalance).toBe('0.00');
    expect(bankLedgerRes.body.totalDebits).toBe('25000.00');
    expect(bankLedgerRes.body.totalCredits).toBe('0.00');
    expect(bankLedgerRes.body.closingBalance).toBe('25000.00');
    expect(bankLedgerRes.body.transactions[0].runningBalance).toBe('25000.00');
  });

  it('25. Posts second journal (Rent DR £2,000, Bank CR £2,000) and verifies Bank balance becomes £23,000', async () => {
    // Find Rent account (6000)
    const accountsRes = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgAId}/accounts`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const rentAccount = accountsRes.body.find((a: any) => a.code === '6000');

    // Create draft rent journal
    const j2Res = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/journals`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        journalDate: '2026-04-05',
        postingDate: '2026-04-05',
        description: 'Office Rent Payment',
        lines: [
          { accountId: rentAccount.id, debit: 2000, credit: 0 },
          { accountId: bankAccountId, debit: 0, credit: 2000 },
        ],
      })
      .expect(201);

    // Validate
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/journals/${j2Res.body.id}/validate`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    // Post
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/journals/${j2Res.body.id}/post`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    // Verify Bank account closing balance in General Ledger is exactly £23,000.00!
    const bankLedger = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgAId}/general-ledger/accounts/${bankAccountId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(bankLedger.body.totalDebits).toBe('25000.00');
    expect(bankLedger.body.totalCredits).toBe('2000.00');
    expect(bankLedger.body.closingBalance).toBe('23000.00');
  });

  // ─────────────────────────── Phase 12: Trial Balance ───────────────────────────

  it('26. Generates balanced Trial Balance (Total Debit = Total Credit = £25,000.00, Diff = £0.00)', async () => {
    const tbRes = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgAId}/reports/trial-balance`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(tbRes.body.isBalanced).toBe(true);
    expect(tbRes.body.difference).toBe('0.00');
    expect(tbRes.body.totalDebit).toBe('25000.00');
    expect(tbRes.body.totalCredit).toBe('25000.00');

    // Bank account debit balance = 23,000
    const bankRow = tbRes.body.accounts.find((a: any) => a.accountCode === '1010');
    expect(bankRow.debitBalance).toBe('23000.00');

    // Rent account debit balance = 2,000
    const rentRow = tbRes.body.accounts.find((a: any) => a.accountCode === '6000');
    expect(rentRow.debitBalance).toBe('2000.00');

    // Capital account credit balance = 25,000
    const capitalRow = tbRes.body.accounts.find((a: any) => a.accountCode === '3000');
    expect(capitalRow.creditBalance).toBe('25000.00');
  });

  it('27. DRAFT and VALIDATED journals are strictly excluded from General Ledger and Trial Balance', async () => {
    // Create an unposted draft journal of £500,000
    const draftRes = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/journals`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        journalDate: '2026-04-12',
        description: 'Unposted draft millions',
        lines: [
          { accountId: bankAccountId, debit: 500000, credit: 0 },
          { accountId: capitalAccountId, debit: 0, credit: 500000 },
        ],
      })
      .expect(201);

    // Validate it (status becomes VALIDATED)
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/journals/${draftRes.body.id}/validate`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    // Verify GL still has bank balance of £23,000 (not £523,000!)
    const bankLedger = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgAId}/general-ledger/accounts/${bankAccountId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(bankLedger.body.closingBalance).toBe('23000.00');

    // Verify TB still has total debits of £25,000 (not £525,000!)
    const tbRes = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgAId}/reports/trial-balance`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(tbRes.body.totalDebit).toBe('25000.00');
  });

  // ─────────────────────────── Phase 10: Reversals ───────────────────────────

  it('28. Reverses Journal 1 (JE-2026-000001) -> creates Reversal Journal in status POSTED', async () => {
    const revRes = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/journals/${draftJournalId}/reverse`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        reversalDate: '2026-04-15',
        reason: 'Correction of initial investment',
      })
      .expect(200);

    expect(revRes.body.originalJournal.status).toBe('REVERSED');
    expect(revRes.body.originalJournal.reversedByJournalId).toBeDefined();
    expect(revRes.body.reversalJournal.status).toBe('POSTED');
    expect(revRes.body.reversalJournal.reversalOfJournalId).toBe(draftJournalId);
  });

  it('29. Rejects second reversal of already reversed journal (409 Conflict)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/journals/${draftJournalId}/reverse`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({})
      .expect(409);

    expect(res.body.error.code).toBe('JOURNAL_ALREADY_REVERSED');
  });

  it('30. General Ledger & Trial Balance reflect reversal (Owner Capital net effect is £0.00)', async () => {
    const capLedger = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgAId}/general-ledger/accounts/${capitalAccountId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    // Initial contribution £25k CR + Reversal £25k DR -> Closing balance is £0.00
    expect(capLedger.body.totalDebits).toBe('25000.00');
    expect(capLedger.body.totalCredits).toBe('25000.00');
    expect(capLedger.body.closingBalance).toBe('0.00');

    // Trial balance still balances
    const tbRes = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgAId}/reports/trial-balance`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(tbRes.body.isBalanced).toBe(true);
    expect(tbRes.body.difference).toBe('0.00');
  });

  // ─────────────────────────── Phase 13: Integrity Checks ───────────────────────────

  it('31. Accounting Integrity Service verifies all 7 controls pass', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgAId}/accounting-integrity`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.allPassed).toBe(true);
    expect(res.body.totalChecks).toBe(7);
    expect(res.body.passedChecks).toBe(7);
    expect(res.body.failedChecks).toBe(0);
  });

  // ─────────────────────────── Phase 14: CSV Exports ───────────────────────────

  it('32. Exports General Ledger CSV document', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgAId}/general-ledger/export`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect('Content-Type', /text\/csv/)
      .expect(200);

    expect(res.text).toContain('General Ledger');
    expect(res.text).toContain('Alpha Consulting Ltd');
  });

  it('33. Exports Trial Balance CSV document', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgAId}/reports/trial-balance/export`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect('Content-Type', /text\/csv/)
      .expect(200);

    expect(res.text).toContain('Trial Balance');
    expect(res.text).toContain('Alpha Consulting Ltd');
    expect(res.text).toContain('Balanced');
  });

  it('34. Verifies Audit Trail captures JOURNAL_POSTED and reversal events', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgAId}/audit-logs`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const eventTypes = res.body.items.map((i: any) => i.eventType);
    expect(eventTypes).toContain('JOURNAL_POSTED');
    expect(eventTypes).toContain('JOURNAL_REVERSAL_CREATED');
    expect(eventTypes).toContain('JOURNAL_REVERSED');
  });
});
