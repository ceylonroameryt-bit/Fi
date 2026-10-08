import { ProfitAndLossService } from './profit-and-loss.service';
import { MoneyService } from '../accounting-engine/money.service';
import { AccountSubtype, AccountType } from '@prisma/client';

describe('ProfitAndLossService', () => {
  let service: ProfitAndLossService;
  let money: MoneyService;

  const mockOrg = {
    id: 'org-1',
    name: 'Blynt Petrol Station Ltd',
    baseCurrency: 'GBP',
  };

  const mockAccounts = [
    {
      id: 'acc-sales',
      code: '4000',
      name: 'Fuel Sales Revenue',
      accountType: AccountType.REVENUE,
      accountSubtype: AccountSubtype.SALES,
    },
    {
      id: 'acc-cogs',
      code: '5000',
      name: 'Cost of Goods Sold - Fuel',
      accountType: AccountType.EXPENSE,
      accountSubtype: AccountSubtype.COST_OF_SALES,
    },
    {
      id: 'acc-rent',
      code: '6100',
      name: 'Rent Expense',
      accountType: AccountType.EXPENSE,
      accountSubtype: AccountSubtype.OPERATING_EXPENSE,
    },
  ];

  const mockLines = [
    // Revenue: 50,000 credit
    {
      accountId: 'acc-sales',
      debit: '0.00',
      credit: '50000.00',
    },
    // COGS: 30,000 debit
    {
      accountId: 'acc-cogs',
      debit: '30000.00',
      credit: '0.00',
    },
    // Rent: 5,000 debit
    {
      accountId: 'acc-rent',
      debit: '5000.00',
      credit: '0.00',
    },
  ];

  const mockPrisma = {
    organization: {
      findUnique: jest.fn().mockResolvedValue(mockOrg),
    },
    account: {
      findMany: jest.fn().mockResolvedValue(mockAccounts),
    },
    journalLine: {
      findMany: jest.fn().mockResolvedValue(mockLines),
    },
  };

  beforeEach(() => {
    money = new MoneyService();
    service = new ProfitAndLossService(mockPrisma as any, money);
    jest.clearAllMocks();
    mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
    mockPrisma.account.findMany.mockResolvedValue(mockAccounts);
    mockPrisma.journalLine.findMany.mockResolvedValue(mockLines);
  });

  it('correctly calculates Revenue, COGS, Gross Profit, Opex, and Net Profit', async () => {
    const report = await service.generateProfitAndLoss('org-1', {
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });

    expect(report.organizationName).toBe('Blynt Petrol Station Ltd');
    expect(report.revenue.total).toBe('50000.00');
    expect(report.costOfSales.total).toBe('30000.00');
    expect(report.grossProfit).toBe('20000.00'); // 50,000 - 30,000
    expect(report.operatingExpenses.total).toBe('5000.00');
    expect(report.operatingProfit).toBe('15000.00'); // 20,000 - 5,000
    expect(report.netProfit).toBe('15000.00');
    expect(report.isProfitable).toBe(true);
  });

  it('exports valid CSV formatted string with all P&L sections', async () => {
    const csv = await service.exportProfitAndLossCsv('org-1', {
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });

    expect(csv).toContain('Profit & Loss Statement');
    expect(csv).toContain('GROSS PROFIT');
    expect(csv).toContain('NET PROFIT / (LOSS)');
    expect(csv).toContain('50000.00');
  });
});
