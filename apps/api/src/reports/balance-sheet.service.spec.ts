import { BalanceSheetService } from './balance-sheet.service';
import { MoneyService } from '../accounting-engine/money.service';
import { AccountSubtype, AccountType } from '@prisma/client';

describe('BalanceSheetService', () => {
  let service: BalanceSheetService;
  let money: MoneyService;

  const mockOrg = {
    id: 'org-1',
    name: 'Blynt Petrol Station Ltd',
    baseCurrency: 'GBP',
  };

  const mockAccounts = [
    {
      id: 'acc-bank',
      code: '1000',
      name: 'Bank Current Account',
      accountType: AccountType.ASSET,
      accountSubtype: AccountSubtype.BANK,
    },
    {
      id: 'acc-ar',
      code: '1100',
      name: 'Accounts Receivable',
      accountType: AccountType.ASSET,
      accountSubtype: AccountSubtype.ACCOUNTS_RECEIVABLE,
    },
    {
      id: 'acc-ap',
      code: '2100',
      name: 'Accounts Payable',
      accountType: AccountType.LIABILITY,
      accountSubtype: AccountSubtype.ACCOUNTS_PAYABLE,
    },
    {
      id: 'acc-equity',
      code: '3000',
      name: 'Share Capital',
      accountType: AccountType.EQUITY,
      accountSubtype: AccountSubtype.OWNER_EQUITY,
    },
    {
      id: 'acc-revenue',
      code: '4000',
      name: 'Sales Revenue',
      accountType: AccountType.REVENUE,
      accountSubtype: AccountSubtype.SALES,
    },
    {
      id: 'acc-expense',
      code: '6000',
      name: 'Operating Expense',
      accountType: AccountType.EXPENSE,
      accountSubtype: AccountSubtype.OPERATING_EXPENSE,
    },
  ];

  // Invariant test:
  // Bank: 35,000 debit
  // AR: 15,000 debit
  // Total Assets = 50,000
  // AP: 10,000 credit (Total Liabilities = 10,000)
  // Equity: 20,000 credit
  // Revenue: 30,000 credit
  // Expense: 10,000 debit (Current Year Net Income = 20,000)
  // Total Equity = 20,000 + 20,000 = 40,000
  // Total Liabilities & Equity = 10,000 + 40,000 = 50,000 (BALANCED!)
  const mockLines = [
    { accountId: 'acc-bank', debit: '35000.00', credit: '0.00' },
    { accountId: 'acc-ar', debit: '15000.00', credit: '0.00' },
    { accountId: 'acc-ap', debit: '0.00', credit: '10000.00' },
    { accountId: 'acc-equity', debit: '0.00', credit: '20000.00' },
    { accountId: 'acc-revenue', debit: '0.00', credit: '30000.00' },
    { accountId: 'acc-expense', debit: '10000.00', credit: '0.00' },
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
    service = new BalanceSheetService(mockPrisma as any, money);
    jest.clearAllMocks();
    mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
    mockPrisma.account.findMany.mockResolvedValue(mockAccounts);
    mockPrisma.journalLine.findMany.mockResolvedValue(mockLines);
  });

  it('correctly aggregates Assets, Liabilities, and Equity and satisfies the fundamental accounting invariant', async () => {
    const report = await service.generateBalanceSheet('org-1', {
      asOfDate: '2026-12-31',
    });

    expect(report.organizationName).toBe('Blynt Petrol Station Ltd');
    expect(report.totalAssets).toBe('50000.00');
    expect(report.totalLiabilities).toBe('10000.00');
    expect(report.currentYearEarnings).toBe('20000.00');
    expect(report.totalEquity).toBe('40000.00');
    expect(report.totalLiabilitiesAndEquity).toBe('50000.00');
    expect(report.isBalanced).toBe(true);
    expect(report.difference).toBe('0.00');
  });

  it('exports valid CSV formatted string with balance invariant status', async () => {
    const csv = await service.exportBalanceSheetCsv('org-1', {
      asOfDate: '2026-12-31',
    });

    expect(csv).toContain('Balance Sheet Statement');
    expect(csv).toContain('TOTAL ASSETS');
    expect(csv).toContain('TOTAL LIABILITIES & EQUITY');
    expect(csv).toContain('BALANCED');
  });
});
