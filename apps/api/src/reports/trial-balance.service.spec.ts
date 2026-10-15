import { Test, TestingModule } from '@nestjs/testing';
import { AccountType, JournalStatus, Prisma } from '@prisma/client';
import { TrialBalanceService } from './trial-balance.service';
import { MoneyService } from '../accounting-engine/money.service';
import { PrismaService } from '../database/prisma.service';

describe('TrialBalanceService (Phase 12)', () => {
  let service: TrialBalanceService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      account: {
        findMany: jest.fn(),
      },
      journalLine: {
        findMany: jest.fn(),
      },
      accountingPeriod: {
        findFirst: jest.fn(),
      },
      financialYear: {
        findFirst: jest.fn(),
      },
      organization: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [TrialBalanceService, MoneyService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<TrialBalanceService>(TrialBalanceService);
  });

  it('generates a balanced Trial Balance where Total Debit equals Total Credit', async () => {
    prisma.organization.findUnique.mockResolvedValue({
      name: 'Alpha Ltd',
      baseCurrency: 'GBP',
    });

    prisma.account.findMany.mockResolvedValue([
      { id: 'acc-1', code: '1010', name: 'Bank', accountType: AccountType.ASSET },
      { id: 'acc-2', code: '3010', name: 'Capital', accountType: AccountType.EQUITY },
    ]);

    // Posted lines: Bank DR 25,000, Capital CR 25,000
    prisma.journalLine.findMany.mockResolvedValue([
      { accountId: 'acc-1', debit: 25000, credit: 0 },
      { accountId: 'acc-2', debit: 0, credit: 25000 },
    ]);

    const result = await service.generateTrialBalance('org-123', {});

    expect(result.isBalanced).toBe(true);
    expect(result.difference).toBe('0.00');
    expect(result.totalDebit).toBe('25000.00');
    expect(result.totalCredit).toBe('25000.00');
    expect(result.accounts).toHaveLength(2);

    const bank = result.accounts.find((a) => a.accountCode === '1010')!;
    expect(bank.debitBalance).toBe('25000.00');
    expect(bank.creditBalance).toBe('0.00');

    const capital = result.accounts.find((a) => a.accountCode === '3010')!;
    expect(capital.creditBalance).toBe('25000.00');
    expect(capital.debitBalance).toBe('0.00');
  });

  it('totals equal the sum of displayed rows even when sub-penny balances round apart', async () => {
    prisma.organization.findUnique.mockResolvedValue({ name: 'Alpha Ltd', baseCurrency: 'GBP' });
    prisma.account.findMany.mockResolvedValue([
      { id: 'acc-1', code: '1010', name: 'Bank', accountType: AccountType.ASSET },
      { id: 'acc-2', code: '4000', name: 'Sales', accountType: AccountType.REVENUE },
      { id: 'acc-3', code: '4100', name: 'Other Income', accountType: AccountType.REVENUE },
    ]);
    // Ledger balances exactly at 4dp, but each credit row rounds down while the debit rounds up.
    prisma.journalLine.findMany.mockResolvedValue([
      { accountId: 'acc-1', debit: new Prisma.Decimal('10.0060'), credit: new Prisma.Decimal(0) },
      { accountId: 'acc-2', debit: new Prisma.Decimal(0), credit: new Prisma.Decimal('5.0030') },
      { accountId: 'acc-3', debit: new Prisma.Decimal(0), credit: new Prisma.Decimal('5.0030') },
    ]);

    const result = await service.generateTrialBalance('org-123', {});

    const sum = (key: 'debitBalance' | 'creditBalance') =>
      result.accounts.reduce((acc, r) => acc.plus(r[key]), new Prisma.Decimal(0)).toFixed(2);

    expect(result.isBalanced).toBe(true);
    expect(result.totalDebit).toBe(sum('debitBalance'));
    expect(result.totalCredit).toBe(sum('creditBalance'));
    expect(result.totalDebit).toBe('10.01');
    expect(result.totalCredit).toBe('10.00');
    expect(result.difference).toBe('0.00');
    expect(result.roundingDifference).toBe('0.01');
  });

  it('reports the true ledger difference when unbalanced, separate from display rounding', async () => {
    prisma.organization.findUnique.mockResolvedValue({ name: 'Alpha Ltd', baseCurrency: 'GBP' });
    prisma.account.findMany.mockResolvedValue([
      { id: 'acc-1', code: '1010', name: 'Bank', accountType: AccountType.ASSET },
      { id: 'acc-2', code: '3010', name: 'Capital', accountType: AccountType.EQUITY },
    ]);
    prisma.journalLine.findMany.mockResolvedValue([
      { accountId: 'acc-1', debit: new Prisma.Decimal('100.00'), credit: new Prisma.Decimal(0) },
      { accountId: 'acc-2', debit: new Prisma.Decimal(0), credit: new Prisma.Decimal('99.50') },
    ]);

    const result = await service.generateTrialBalance('org-123', {});

    expect(result.isBalanced).toBe(false);
    expect(result.difference).toBe('0.50');
    expect(result.roundingDifference).toBe('0.00');
  });

  it('queries only POSTED and REVERSED status lines', async () => {
    prisma.organization.findUnique.mockResolvedValue({ name: 'Alpha Ltd', baseCurrency: 'GBP' });
    prisma.account.findMany.mockResolvedValue([]);
    prisma.journalLine.findMany.mockResolvedValue([]);

    await service.generateTrialBalance('org-123', {});

    const query = prisma.journalLine.findMany.mock.calls[0][0];
    expect(query.where.journalEntry.status).toEqual({
      in: [JournalStatus.POSTED, JournalStatus.REVERSED],
    });
  });

  it('exports formatted CSV document', async () => {
    prisma.organization.findUnique.mockResolvedValue({
      name: 'Alpha Ltd',
      baseCurrency: 'GBP',
    });
    prisma.account.findMany.mockResolvedValue([]);
    prisma.journalLine.findMany.mockResolvedValue([]);

    const csv = await service.exportTrialBalanceCsv('org-123', {});

    expect(csv).toContain('"Organisation","Alpha Ltd"');
    expect(csv).toContain('"Report","Trial Balance"');
    expect(csv).toContain('"Status","Balanced"');
  });

  it('throws PERIOD_NOT_FOUND when non-existent periodId is requested', async () => {
    prisma.accountingPeriod.findFirst.mockResolvedValue(null);

    await expect(service.generateTrialBalance('org-123', { periodId: 'missing-period' })).rejects.toThrow(
      'Requested accounting period was not found in this organisation',
    );
  });

  it('throws FINANCIAL_YEAR_NOT_FOUND when non-existent financialYearId is requested', async () => {
    prisma.financialYear.findFirst.mockResolvedValue(null);

    await expect(service.generateTrialBalance('org-123', { financialYearId: 'missing-fy' })).rejects.toThrow(
      'Requested financial year was not found in this organisation',
    );
  });
});
