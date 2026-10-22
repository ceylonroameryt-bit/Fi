import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { Prisma } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { createValidationPipe } from '../src/common/validation/validation.pipe';
import { RolesService } from '../src/roles/roles.service';
import { loadTaxCodeIds } from './tax-codes.helper';

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

/**
 * Code review fixes for payments, credit notes, bank reconciliation and ageing:
 * VAT on credit notes, allocation integrity, void guards, bank double-posting, as-at ageing.
 */
describe('Sales & purchases integrity (code review E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let orgId: string;
  let otherOrgId: string;
  let tax: Record<string, string>;
  const acc: Record<string, string> = {};
  let customerId: string;
  let bothId: string;
  let supplierId: string;
  let invoiceId: string;
  const run = Date.now();

  const http = () => request(app.getHttpServer());
  const authFor = (org: () => string) => (r: request.Test) => r.set('Authorization', `Bearer ${token}`).set('x-organization-id', org());
  const auth = authFor(() => orgId);
  const api = (p: string) => `/api/v1/organizations/${orgId}${p}`;
  const vatReturn = async () => (await auth(http().get(api('/vat-return?from=2026-04-01&to=2026-06-30'))).expect(200)).body;
  const trialBalance = async () => (await auth(http().get(api('/reports/trial-balance'))).expect(200)).body;
  const delta = (a: any, b: any, box: string) => D(a.boxes[box]).minus(D(b.boxes[box])).toFixed(2);

  async function postedInvoice(contactId: string, date: string, net: string, due = date) {
    const inv = (
      await auth(http().post(api('/invoices')))
        .send({ contactId, issueDate: date, dueDate: due, lines: [{ accountId: acc['4000'], description: 'Goods', quantity: 1, unitPrice: net, taxCodeId: tax.UK_SR }] })
        .expect(201)
    ).body;
    await auth(http().post(api(`/invoices/${inv.id}/post`))).send({}).expect(200);
    return inv.id as string;
  }
  async function postedBill(contactId: string, date: string, net: string) {
    const bill = (
      await auth(http().post(api('/bills')))
        .send({ contactId, supplierInvoiceNumber: `S-${Math.random()}`, issueDate: date, lines: [{ accountId: acc['6700'], description: 'Supplies', netAmount: net, taxCodeId: tax.UK_SR }] })
        .expect(201)
    ).body;
    await auth(http().post(api(`/bills/${bill.id}/approve`))).send({}).expect(200);
    return bill.id as string;
  }
  const receipt = (contactId: string, amount: number, date: string, extra: Record<string, unknown> = {}) =>
    auth(http().post(api('/payments'))).send({ kind: 'CUSTOMER_RECEIPT', contactId, amount, paymentDate: date, ...extra });

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
    const newOrg = async (name: string) =>
      (await http().post('/api/v1/organizations').set('Authorization', `Bearer ${token}`).send({ name, country: 'GB', baseCurrency: 'GBP', timezone: 'Europe/London' }).expect(201)).body.id as string;
    orgId = await newOrg(`Integrity ${run} Ltd`);
    otherOrgId = await newOrg(`Integrity Other ${run} Ltd`);
    for (const id of [orgId, otherOrgId]) {
      await authFor(() => id)(http().post(`/api/v1/organizations/${id}/financial-years`)).send({ name: 'FY', startDate: '2026-04-01', endDate: '2027-03-31', generatePeriods: true }).expect(201);
    }
    for (const a of await prisma.account.findMany({ where: { organizationId: orgId } })) acc[a.code] = a.id;
    const contact = async (name: string, type: string) => (await auth(http().post(api('/contacts'))).send({ name: `${name} ${run}`, type, country: 'GB' }).expect(201)).body.id as string;
    customerId = await contact('Customer', 'CUSTOMER');
    bothId = await contact('Trading Partner', 'BOTH');
    supplierId = await contact('Supplier', 'SUPPLIER');
    invoiceId = await postedInvoice(customerId, '2026-05-01', '1000.00', '2026-05-31');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('credit notes: VAT from tax codes, analysed in the ledger', () => {
    let cnId: string;

    it('refuses client-supplied VAT figures', async () => {
      await auth(http().post(api('/credit-notes')))
        .send({ kind: 'SALES_CREDIT_NOTE', contactId: customerId, issueDate: '2026-05-10', lines: [{ accountId: acc['4000'], description: 'x', netAmount: 100, taxCodeId: tax.UK_SR, taxAmount: 0 }] })
        .expect(400);
    });

    it('calculates VAT from the tax code and reduces boxes 1 and 6 when posted; trial balance still balances', async () => {
      const cn = (
        await auth(http().post(api('/credit-notes')))
          .send({ kind: 'SALES_CREDIT_NOTE', contactId: customerId, issueDate: '2026-05-10', relatedInvoiceId: invoiceId, lines: [{ accountId: acc['4000'], description: 'Returned', netAmount: 100, taxCodeId: tax.UK_SR }] })
          .expect(201)
      ).body;
      cnId = cn.id;
      expect(D(cn.taxTotal).toFixed(2)).toBe('20.00');
      expect(D(cn.totalAmount).toFixed(2)).toBe('120.00');

      const before = await vatReturn();
      await auth(http().post(api(`/credit-notes/${cn.id}/post`))).send({}).expect(200);
      const after = await vatReturn();
      expect(delta(after, before, 'box1')).toBe('-20.00');
      expect(delta(after, before, 'box6')).toBe('-100.00');
      expect(after.reconciliation.reconciled).toBe(true);
      expect((await trialBalance()).isBalanced).toBe(true);
    });

    it('a credit note without a tax code cannot be posted', async () => {
      const cn = (
        await auth(http().post(api('/credit-notes'))).send({ kind: 'SALES_CREDIT_NOTE', contactId: customerId, issueDate: '2026-05-11', lines: [{ accountId: acc['4000'], description: 'x', netAmount: 10 }] }).expect(201)
      ).body;
      expect(JSON.stringify((await auth(http().post(api(`/credit-notes/${cn.id}/post`))).send({}).expect(422)).body)).toContain('TAX_CODE_REQUIRED');
    });

    it('cannot credit more than is left on the invoice, or relate to the wrong document type', async () => {
      const over = await auth(http().post(api('/credit-notes')))
        .send({ kind: 'SALES_CREDIT_NOTE', contactId: customerId, issueDate: '2026-05-12', relatedInvoiceId: invoiceId, lines: [{ accountId: acc['4000'], description: 'x', netAmount: 950, taxCodeId: tax.UK_SR }] })
        .expect(422);
      expect(JSON.stringify(over.body)).toContain('OVER_CREDIT'); // 1,200 − 120 already credited = 1,080 left
      await auth(http().post(api('/credit-notes')))
        .send({ kind: 'SUPPLIER_CREDIT_NOTE', contactId: supplierId, issueDate: '2026-05-12', relatedInvoiceId: invoiceId, lines: [{ accountId: acc['6700'], description: 'x', netAmount: 10, taxCodeId: tax.UK_SR }] })
        .expect(400);
    });

    it('a sales credit note can only be allocated to invoices', async () => {
      const billId = await postedBill(bothId, '2026-05-02', '50.00');
      const cn = (
        await auth(http().post(api('/credit-notes'))).send({ kind: 'SALES_CREDIT_NOTE', contactId: bothId, issueDate: '2026-05-12', lines: [{ accountId: acc['4000'], description: 'x', netAmount: 10, taxCodeId: tax.UK_SR }] }).expect(201)
      ).body;
      await auth(http().post(api(`/credit-notes/${cn.id}/post`))).send({}).expect(200);
      const res = await auth(http().post(api(`/credit-notes/${cn.id}/allocate`))).send({ allocations: [{ billId, amount: 5 }] }).expect(422);
      expect(JSON.stringify(res.body)).toContain('ALLOCATION_TARGET_INVALID');
    });

    afterAll(() => expect(cnId).toBeTruthy());
  });

  describe('payments and allocations', () => {
    it('payments must use a bank or cash account, in the base currency, for the right kind of contact', async () => {
      expect(JSON.stringify((await receipt(customerId, 10, '2026-05-15', { bankAccountNominalId: acc['4000'] }).expect(404)).body)).toContain('BANK_ACCOUNT_NOT_FOUND');
      expect(JSON.stringify((await receipt(customerId, 10, '2026-05-15', { currency: 'EUR' }).expect(422)).body)).toContain('UNSUPPORTED_CURRENCY');
      expect(JSON.stringify((await receipt(supplierId, 10, '2026-05-15').expect(400)).body)).toContain('CONTACT_TYPE_MISMATCH');
      await receipt(customerId, 10.005, '2026-05-15').expect(400);
    });

    it('a customer receipt cannot pay a bill, and refunds are not allocated', async () => {
      const billId = await postedBill(bothId, '2026-05-03', '40.00');
      const r = (await receipt(bothId, 48, '2026-05-15').expect(201)).body;
      expect(JSON.stringify((await auth(http().post(api(`/payments/${r.id}/allocate`))).send({ allocations: [{ billId, amount: 48 }] }).expect(422)).body)).toContain('ALLOCATION_TARGET_INVALID');
      const refund = (await auth(http().post(api('/payments'))).send({ kind: 'CUSTOMER_REFUND', contactId: customerId, amount: 5, paymentDate: '2026-05-15' }).expect(201)).body;
      expect(JSON.stringify((await auth(http().post(api(`/payments/${refund.id}/allocate`))).send({ allocations: [{ invoiceId, amount: 5 }] }).expect(422)).body)).toContain('ALLOCATION_TARGET_INVALID');
    });

    it('two receipts allocated at the same moment cannot over-pay an invoice', async () => {
      const inv = await postedInvoice(customerId, '2026-05-04', '500.00'); // 600.00
      const r1 = (await receipt(customerId, 400, '2026-05-16').expect(201)).body;
      const r2 = (await receipt(customerId, 400, '2026-05-16').expect(201)).body;
      const results = await Promise.all([
        auth(http().post(api(`/payments/${r1.id}/allocate`))).send({ allocations: [{ invoiceId: inv, amount: 400 }] }),
        auth(http().post(api(`/payments/${r2.id}/allocate`))).send({ allocations: [{ invoiceId: inv, amount: 400 }] }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 422]);
      const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: inv } });
      expect(invoice.amountPaid.toFixed(2)).toBe('400.00');
      const active = await prisma.paymentAllocation.aggregate({ where: { invoiceId: inv, isReversed: false }, _sum: { amount: true } });
      expect(D(active._sum.amount!).toFixed(2)).toBe('400.00');
    });

    it('an invoice or bill with allocations cannot be voided until they are reversed', async () => {
      const inv = await postedInvoice(customerId, '2026-05-05', '100.00');
      const r = (await receipt(customerId, 120, '2026-05-17', { allocations: [{ invoiceId: inv, amount: 120 }] }).expect(201)).body;
      expect(JSON.stringify((await auth(http().post(api(`/invoices/${inv}/void`))).send({ reason: 'mistake' }).expect(409)).body)).toContain('DOCUMENT_HAS_ALLOCATIONS');
      const allocationId = (await prisma.paymentAllocation.findFirstOrThrow({ where: { paymentId: r.id } })).id;
      await auth(http().delete(api(`/payments/${r.id}/allocations/${allocationId}`))).expect(200);
      await auth(http().post(api(`/invoices/${inv}/void`))).send({ reason: 'mistake' }).expect(200);
      expect((await trialBalance()).isBalanced).toBe(true);
    });
  });

  describe('bank reconciliation', () => {
    let bankAccountId: string;
    let importId: string;
    const line = (amount: string, date = '2026-05-20') =>
      prisma.bankStatementLine.create({ data: { organizationId: orgId, bankAccountId, importId, transactionDate: new Date(date), description: `Line ${amount}`, amount: D(amount) } });

    beforeAll(async () => {
      bankAccountId = (await auth(http().post(api('/bank-accounts'))).send({ name: 'Main', nominalAccountId: acc['1010'] }).expect(201)).body.id;
      const user = await prisma.user.findFirstOrThrow({ where: { email: 'owner@democonsulting.com' } });
      importId = (await prisma.bankStatementImport.create({ data: { organizationId: orgId, bankAccountId, fileName: 't.csv', fileFormat: 'CSV', fileSha256: 'a'.repeat(64), importedById: user.id } })).id;
    });

    it('quick-create with a VAT code reclaims the VAT; the same line cannot be posted twice or unmatched', async () => {
      const l = await line('-120.00');
      const before = await vatReturn();
      const res = (await auth(http().post(api(`/bank-statements/lines/${l.id}/quick-create`))).send({ accountId: acc['6700'], taxCodeId: tax.UK_SR }).expect(200)).body;
      const journal = await prisma.journalEntry.findFirstOrThrow({ where: { id: res.journalId }, include: { lines: { include: { account: true } } } });
      expect(journal.lines.find((x) => x.accountId === acc['6700'])!.debit.toFixed(2)).toBe('100.00');
      expect(journal.lines.find((x) => x.account.accountSubtype === 'TAX_PAYABLE')!.debit.toFixed(2)).toBe('20.00');
      expect(delta(await vatReturn(), before, 'box4')).toBe('20.00');

      expect(JSON.stringify((await auth(http().post(api(`/bank-statements/lines/${l.id}/quick-create`))).send({ accountId: acc['6700'] }).expect(409)).body)).toContain('BANK_TRANSACTION_ALREADY_RECONCILED');
      await auth(http().post(api(`/bank-statements/lines/${l.id}/unmatch`))).send({}).expect(409);
      expect((await trialBalance()).isBalanced).toBe(true);
    });

    it("matching checks the entry belongs to this organisation, is posted, and has the same amount", async () => {
      const l = await line('48.00');
      const foreign = (
        await authFor(() => otherOrgId)(http().post(`/api/v1/organizations/${otherOrgId}/contacts`)).send({ name: `X ${run}`, type: 'CUSTOMER', country: 'GB' }).expect(201)
      ).body.id;
      const foreignPayment = (
        await authFor(() => otherOrgId)(http().post(`/api/v1/organizations/${otherOrgId}/payments`)).send({ kind: 'CUSTOMER_RECEIPT', contactId: foreign, amount: 48, paymentDate: '2026-05-20' }).expect(201)
      ).body;
      await auth(http().post(api(`/bank-statements/lines/${l.id}/match`))).send({ matchedPaymentId: foreignPayment.id }).expect(422);
      const wrongAmount = (await receipt(customerId, 47, '2026-05-20', { bankAccountNominalId: acc['1010'] }).expect(201)).body;
      await auth(http().post(api(`/bank-statements/lines/${l.id}/match`))).send({ matchedPaymentId: wrongAmount.id }).expect(422);
      const right = (await receipt(customerId, 48, '2026-05-20', { bankAccountNominalId: acc['1010'] }).expect(201)).body;
      await auth(http().post(api(`/bank-statements/lines/${l.id}/match`))).send({ matchedPaymentId: right.id }).expect(200);
      await auth(http().post(api(`/bank-statements/lines/${l.id}/match`))).send({ matchedPaymentId: right.id }).expect(409);
    });
  });

  describe('ageing as at a past date', () => {
    it('counts only payments made on or before the date', async () => {
      const ageContact = (await auth(http().post(api('/contacts'))).send({ name: `Ageing ${run}`, type: 'CUSTOMER', country: 'GB' }).expect(201)).body.id;
      const inv = await postedInvoice(ageContact, '2026-05-01', '100.00', '2026-05-31'); // 120.00
      await receipt(ageContact, 50, '2026-06-15', { allocations: [{ invoiceId: inv, amount: 50 }] }).expect(201);
      const outstanding = async (asOf: string) => {
        const r = (await auth(http().get(api(`/reports/ar-ageing?asOfDate=${asOf}&contactId=${ageContact}`))).expect(200)).body;
        return JSON.stringify(r).includes('"amountDue":"120.00"') ? '120.00' : JSON.stringify(r).includes('"amountDue":"70.00"') ? '70.00' : 'other';
      };
      expect(await outstanding('2026-06-10')).toBe('120.00');
      expect(await outstanding('2026-06-20')).toBe('70.00');
    });
  });
});
