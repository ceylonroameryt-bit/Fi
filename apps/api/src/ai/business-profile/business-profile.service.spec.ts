import { Prisma } from '@prisma/client';
import { BusinessProfileService } from './business-profile.service';
import { MoneyService } from '../../accounting-engine/money.service';

const D = (v: string) => new Prisma.Decimal(v);
const control = (contactId: string, debit: string, credit: string, code = '1100') => ({
  contactId,
  debit: D(debit),
  credit: D(credit),
  accountId: `acc-${code}`,
  taxCodeId: null,
  account: { code, name: 'Control' },
  taxCode: null,
});
const coded = (accountCode: string, tax: string, debit: string, credit: string) => ({
  contactId: null,
  debit: D(debit),
  credit: D(credit),
  accountId: `acc-${accountCode}`,
  taxCodeId: `tc-${tax}`,
  account: { code: accountCode, name: `Account ${accountCode}` },
  taxCode: { code: tax },
});

describe('BusinessProfileService', () => {
  let prisma: any;
  let service: BusinessProfileService;
  const now = new Date('2026-10-15T00:00:00Z');

  beforeEach(() => {
    prisma = {
      journalEntry: {
        findMany: jest.fn().mockResolvedValue([
          { sourceType: 'BILL', postingDate: new Date('2026-09-01'), lines: [control('sup-1', '0', '120', '2000'), coded('6100', 'UK_SR', '100', '0')] },
          { sourceType: 'BILL', postingDate: new Date('2026-08-01'), lines: [control('sup-1', '0', '60', '2000'), coded('6100', 'UK_SR', '50', '0')] },
          { sourceType: 'BILL', postingDate: new Date('2026-07-01'), lines: [control('sup-1', '0', '10', '2000'), coded('6200', 'UK_ZR', '10', '0')] },
          { sourceType: 'BILL', postingDate: new Date('2026-06-01'), lines: [control('sup-2', '0', '500', '2000'), coded('1500', 'UK_SR', '500', '0')] },
          { sourceType: 'INVOICE', postingDate: new Date('2026-09-15'), lines: [control('cus-1', '1200', '0'), coded('4000', 'UK_SR', '0', '1000')] },
        ]),
      },
      contact: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'sup-1', name: 'Office Supplies Ltd' },
          { id: 'sup-2', name: 'Dell UK' },
          { id: 'cus-1', name: 'Acme Ltd' },
        ]),
      },
      organizationBusinessContext: {
        upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve(create)),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    service = new BusinessProfileService(prisma, new MoneyService());
  });

  it('derives usual suppliers/customers and coding habits from posted ledger history only', async () => {
    const profile = await service.refresh('org-1', now);

    const where = prisma.journalEntry.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ organizationId: 'org-1', status: 'POSTED', sourceType: { in: ['INVOICE', 'BILL'] } });
    expect(where.postingDate.gte.toISOString().slice(0, 10)).toBe('2025-10-15');

    expect(profile.usualSuppliers).toEqual([
      { contactId: 'sup-2', name: 'Dell UK', transactionCount: 1, totalAmount: '500.00', lastDate: '2026-06-01' },
      { contactId: 'sup-1', name: 'Office Supplies Ltd', transactionCount: 3, totalAmount: '190.00', lastDate: '2026-09-01' },
    ]);
    expect(profile.usualCustomers).toEqual([
      { contactId: 'cus-1', name: 'Acme Ltd', transactionCount: 1, totalAmount: '1200.00', lastDate: '2026-09-15' },
    ]);
    expect(profile.codingHabits).toEqual(
      expect.arrayContaining([
        { contactId: 'sup-1', role: 'SUPPLIER', accountId: 'acc-6100', accountCode: '6100', taxCode: 'UK_SR', count: 2, share: '0.67' },
        { contactId: 'sup-1', role: 'SUPPLIER', accountId: 'acc-6200', accountCode: '6200', taxCode: 'UK_ZR', count: 1, share: '0.33' },
        { contactId: 'sup-2', role: 'SUPPLIER', accountId: 'acc-1500', accountCode: '1500', taxCode: 'UK_SR', count: 1, share: '1.00' },
      ]),
    );
    expect(profile.profileRefreshedAt).toEqual(now);
  });

  it('never invents a VAT scheme or industry when none has been set', async () => {
    const profile = await service.get('org-1');
    expect(profile.vatScheme).toBeNull();
    expect(profile.industry).toBeNull();
    expect(prisma.organizationBusinessContext.upsert).not.toHaveBeenCalled();
  });

  it('writes the refreshed profile without touching person-entered fields', async () => {
    await service.refresh('org-1', now);
    const { update } = prisma.organizationBusinessContext.upsert.mock.calls[0][0];
    expect(Object.keys(update).sort()).toEqual(['codingHabits', 'profileRefreshedAt', 'usualCustomers', 'usualSuppliers']);
  });
});
