import { Injectable } from '@nestjs/common';
import { AccountSubtype, AccountType, JournalStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { MoneyService } from '../accounting-engine/money.service';
import { parseIsoDate, toIsoDate } from '../common/utils/dates';
import { toCsvRow } from '../common/utils/csv';
import { DomainException } from '../common/errors/domain.exception';

export interface BalanceSheetFilterDto {
  asOfDate?: string;
  financialYearId?: string;
  periodId?: string;
}

export interface BalanceSheetAccountRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountSubtype: AccountSubtype | null;
  amount: string;
}

export interface BalanceSheetSection {
  title: string;
  accounts: BalanceSheetAccountRow[];
  total: string;
}

export interface BalanceSheetReport {
  organizationId: string;
  organizationName: string;
  baseCurrency: string;
  asOfDate: string;
  currentAssets: BalanceSheetSection;
  nonCurrentAssets: BalanceSheetSection;
  totalAssets: string;
  currentLiabilities: BalanceSheetSection;
  nonCurrentLiabilities: BalanceSheetSection;
  totalLiabilities: string;
  equity: BalanceSheetSection;
  currentYearEarnings: string;
  totalEquity: string;
  totalLiabilitiesAndEquity: string;
  isBalanced: boolean;
  difference: string;
}

@Injectable()
export class BalanceSheetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly money: MoneyService,
  ) {}

  async generateBalanceSheet(
    organizationId: string,
    filter: BalanceSheetFilterDto,
  ): Promise<BalanceSheetReport> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, baseCurrency: true },
    });

    if (!org) {
      throw new DomainException('NOT_FOUND', 'Organisation not found');
    }

    const asOfDate = await this.resolveAsOfDate(organizationId, filter);

    // 1. Fetch all accounts
    const accounts = await this.prisma.account.findMany({
      where: { organizationId },
      orderBy: { code: 'asc' },
    });

    // 2. Fetch all posted lines up to asOfDate
    const lines = await this.prisma.journalLine.findMany({
      where: {
        organizationId,
        journalEntry: {
          status: { in: [JournalStatus.POSTED, JournalStatus.REVERSED] },
          postingDate: { lte: asOfDate },
        },
      },
      select: {
        accountId: true,
        debit: true,
        credit: true,
      },
    });

    // 3. Aggregate totals per account
    const debitByAccount = new Map<string, Prisma.Decimal>();
    const creditByAccount = new Map<string, Prisma.Decimal>();

    for (const l of lines) {
      const currentDr = debitByAccount.get(l.accountId) ?? this.money.ZERO;
      const currentCr = creditByAccount.get(l.accountId) ?? this.money.ZERO;
      debitByAccount.set(l.accountId, currentDr.add(this.money.toDecimal(l.debit)));
      creditByAccount.set(l.accountId, currentCr.add(this.money.toDecimal(l.credit)));
    }

    // 4. Categorize assets, liabilities, and equity
    const currentAssetRows: BalanceSheetAccountRow[] = [];
    const nonCurrentAssetRows: BalanceSheetAccountRow[] = [];
    const currentLiabRows: BalanceSheetAccountRow[] = [];
    const nonCurrentLiabRows: BalanceSheetAccountRow[] = [];
    const equityRows: BalanceSheetAccountRow[] = [];

    let totalCurrentAssets = this.money.ZERO;
    let totalNonCurrentAssets = this.money.ZERO;
    let totalCurrentLiab = this.money.ZERO;
    let totalNonCurrentLiab = this.money.ZERO;
    let totalEquityAccounts = this.money.ZERO;

    // Track Revenue and Expenses for dynamic Current Year Earnings calculation
    let cumulativeRevenue = this.money.ZERO;
    let cumulativeExpenses = this.money.ZERO;

    for (const acc of accounts) {
      const sumDr = debitByAccount.get(acc.id) ?? this.money.ZERO;
      const sumCr = creditByAccount.get(acc.id) ?? this.money.ZERO;

      if (acc.accountType === AccountType.REVENUE) {
        cumulativeRevenue = cumulativeRevenue.add(sumCr.sub(sumDr));
        continue;
      }

      if (acc.accountType === AccountType.EXPENSE) {
        cumulativeExpenses = cumulativeExpenses.add(sumDr.sub(sumCr));
        continue;
      }

      if (sumDr.isZero() && sumCr.isZero()) continue;

      if (acc.accountType === AccountType.ASSET) {
        // Asset normal: Debit (Net = Dr - Cr)
        const netAsset = sumDr.sub(sumCr);
        if (netAsset.isZero()) continue;

        const row: BalanceSheetAccountRow = {
          accountId: acc.id,
          accountCode: acc.code,
          accountName: acc.name,
          accountSubtype: acc.accountSubtype,
          amount: netAsset.toFixed(2),
        };

        if (
          acc.accountSubtype === AccountSubtype.FIXED_ASSET ||
          acc.accountSubtype === AccountSubtype.ACCUMULATED_DEPRECIATION
        ) {
          nonCurrentAssetRows.push(row);
          totalNonCurrentAssets = totalNonCurrentAssets.add(netAsset);
        } else {
          currentAssetRows.push(row);
          totalCurrentAssets = totalCurrentAssets.add(netAsset);
        }
      } else if (acc.accountType === AccountType.LIABILITY) {
        // Liability normal: Credit (Net = Cr - Dr)
        const netLiab = sumCr.sub(sumDr);
        if (netLiab.isZero()) continue;

        const row: BalanceSheetAccountRow = {
          accountId: acc.id,
          accountCode: acc.code,
          accountName: acc.name,
          accountSubtype: acc.accountSubtype,
          amount: netLiab.toFixed(2),
        };

        if (acc.accountSubtype === AccountSubtype.LONG_TERM_LIABILITY) {
          nonCurrentLiabRows.push(row);
          totalNonCurrentLiab = totalNonCurrentLiab.add(netLiab);
        } else {
          currentLiabRows.push(row);
          totalCurrentLiab = totalCurrentLiab.add(netLiab);
        }
      } else if (acc.accountType === AccountType.EQUITY) {
        // Equity normal: Credit (Net = Cr - Dr)
        const netEq = sumCr.sub(sumDr);
        if (netEq.isZero()) continue;

        equityRows.push({
          accountId: acc.id,
          accountCode: acc.code,
          accountName: acc.name,
          accountSubtype: acc.accountSubtype,
          amount: netEq.toFixed(2),
        });
        totalEquityAccounts = totalEquityAccounts.add(netEq);
      }
    }

    const currentYearEarnings = cumulativeRevenue.sub(cumulativeExpenses);
    const totalAssets = totalCurrentAssets.add(totalNonCurrentAssets);
    const totalLiabilities = totalCurrentLiab.add(totalNonCurrentLiab);
    const totalEquity = totalEquityAccounts.add(currentYearEarnings);
    const totalLiabilitiesAndEquity = totalLiabilities.add(totalEquity);

    const difference = totalAssets.sub(totalLiabilitiesAndEquity).abs();
    const isBalanced = difference.lessThan(0.01);

    return {
      organizationId,
      organizationName: org.name,
      baseCurrency: org.baseCurrency,
      asOfDate: toIsoDate(asOfDate),
      currentAssets: {
        title: 'Current Assets',
        accounts: currentAssetRows,
        total: totalCurrentAssets.toFixed(2),
      },
      nonCurrentAssets: {
        title: 'Non-Current Assets',
        accounts: nonCurrentAssetRows,
        total: totalNonCurrentAssets.toFixed(2),
      },
      totalAssets: totalAssets.toFixed(2),
      currentLiabilities: {
        title: 'Current Liabilities',
        accounts: currentLiabRows,
        total: totalCurrentLiab.toFixed(2),
      },
      nonCurrentLiabilities: {
        title: 'Non-Current Liabilities',
        accounts: nonCurrentLiabRows,
        total: totalNonCurrentLiab.toFixed(2),
      },
      totalLiabilities: totalLiabilities.toFixed(2),
      equity: {
        title: 'Equity',
        accounts: equityRows,
        total: totalEquityAccounts.toFixed(2),
      },
      currentYearEarnings: currentYearEarnings.toFixed(2),
      totalEquity: totalEquity.toFixed(2),
      totalLiabilitiesAndEquity: totalLiabilitiesAndEquity.toFixed(2),
      isBalanced,
      difference: difference.toFixed(2),
    };
  }

  async exportBalanceSheetCsv(organizationId: string, filter: BalanceSheetFilterDto): Promise<string> {
    const report = await this.generateBalanceSheet(organizationId, filter);
    const rows: string[][] = [
      ['Blynt — Balance Sheet Statement'],
      ['Organisation', report.organizationName],
      ['As of Date', report.asOfDate],
      ['Currency', report.baseCurrency],
      [],
      ['Code', 'Account', 'Amount'],
      ['--- CURRENT ASSETS ---'],
    ];

    for (const ca of report.currentAssets.accounts) {
      rows.push([ca.accountCode, ca.accountName, ca.amount]);
    }
    rows.push(['', 'Total Current Assets', report.currentAssets.total]);

    if (report.nonCurrentAssets.accounts.length > 0) {
      rows.push(['--- NON-CURRENT ASSETS ---']);
      for (const nca of report.nonCurrentAssets.accounts) {
        rows.push([nca.accountCode, nca.accountName, nca.amount]);
      }
      rows.push(['', 'Total Non-Current Assets', report.nonCurrentAssets.total]);
    }
    rows.push(['', 'TOTAL ASSETS', report.totalAssets]);
    rows.push([]);

    rows.push(['--- CURRENT LIABILITIES ---']);
    for (const cl of report.currentLiabilities.accounts) {
      rows.push([cl.accountCode, cl.accountName, cl.amount]);
    }
    rows.push(['', 'Total Current Liabilities', report.currentLiabilities.total]);

    if (report.nonCurrentLiabilities.accounts.length > 0) {
      rows.push(['--- NON-CURRENT LIABILITIES ---']);
      for (const ncl of report.nonCurrentLiabilities.accounts) {
        rows.push([ncl.accountCode, ncl.accountName, ncl.amount]);
      }
      rows.push(['', 'Total Non-Current Liabilities', report.nonCurrentLiabilities.total]);
    }
    rows.push(['', 'TOTAL LIABILITIES', report.totalLiabilities]);
    rows.push([]);

    rows.push(['--- EQUITY ---']);
    for (const eq of report.equity.accounts) {
      rows.push([eq.accountCode, eq.accountName, eq.amount]);
    }
    rows.push(['', 'Current Period Earnings', report.currentYearEarnings]);
    rows.push(['', 'TOTAL EQUITY', report.totalEquity]);
    rows.push([]);

    rows.push(['', 'TOTAL LIABILITIES & EQUITY', report.totalLiabilitiesAndEquity]);
    rows.push(['', 'BALANCE INVARIANT STATUS', report.isBalanced ? 'BALANCED' : 'UNBALANCED']);

    return rows.map(toCsvRow).join('\r\n');
  }

  private async resolveAsOfDate(organizationId: string, filter: BalanceSheetFilterDto): Promise<Date> {
    if (filter.periodId) {
      const period = await this.prisma.accountingPeriod.findFirst({
        where: { id: filter.periodId, organizationId },
      });
      if (!period) throw new DomainException('PERIOD_NOT_FOUND', 'Accounting period not found');
      return period.endDate;
    }

    if (filter.financialYearId) {
      const fy = await this.prisma.financialYear.findFirst({
        where: { id: filter.financialYearId, organizationId },
      });
      if (!fy) throw new DomainException('FINANCIAL_YEAR_NOT_FOUND', 'Financial year not found');
      return fy.endDate;
    }

    if (filter.asOfDate) {
      return parseIsoDate(filter.asOfDate, 'asOfDate');
    }

    return new Date();
  }
}
