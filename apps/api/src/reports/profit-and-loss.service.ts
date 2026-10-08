import { Injectable } from '@nestjs/common';
import { AccountSubtype, AccountType, JournalStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { MoneyService } from '../accounting-engine/money.service';
import { parseIsoDate, toIsoDate } from '../common/utils/dates';
import { toCsvRow } from '../common/utils/csv';
import { DomainException } from '../common/errors/domain.exception';

export interface ProfitAndLossFilterDto {
  startDate?: string;
  endDate?: string;
  financialYearId?: string;
  periodId?: string;
}

export interface PnlAccountRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountSubtype: AccountSubtype | null;
  amount: string;
}

export interface PnlCategorySection {
  title: string;
  accounts: PnlAccountRow[];
  total: string;
}

export interface ProfitAndLossReport {
  organizationId: string;
  organizationName: string;
  baseCurrency: string;
  startDate: string;
  endDate: string;
  revenue: PnlCategorySection;
  costOfSales: PnlCategorySection;
  grossProfit: string;
  operatingExpenses: PnlCategorySection;
  operatingProfit: string;
  otherExpenses: PnlCategorySection;
  netProfit: string;
  isProfitable: boolean;
}

@Injectable()
export class ProfitAndLossService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly money: MoneyService,
  ) {}

  async generateProfitAndLoss(
    organizationId: string,
    filter: ProfitAndLossFilterDto,
  ): Promise<ProfitAndLossReport> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, baseCurrency: true },
    });

    if (!org) {
      throw new DomainException('NOT_FOUND', 'Organisation not found');
    }

    const { startDate, endDate } = await this.resolveDateRange(organizationId, filter);

    // 1. Fetch all Revenue and Expense accounts
    const accounts = await this.prisma.account.findMany({
      where: {
        organizationId,
        accountType: { in: [AccountType.REVENUE, AccountType.EXPENSE] },
      },
      orderBy: { code: 'asc' },
    });

    // 2. Fetch posted lines in date range
    const lines = await this.prisma.journalLine.findMany({
      where: {
        organizationId,
        journalEntry: {
          status: { in: [JournalStatus.POSTED, JournalStatus.REVERSED] },
          postingDate: {
            gte: startDate,
            lte: endDate,
          },
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

    // 4. Categorize accounts
    const revenueRows: PnlAccountRow[] = [];
    const cosRows: PnlAccountRow[] = [];
    const opexRows: PnlAccountRow[] = [];
    const otherRows: PnlAccountRow[] = [];

    let totalRevenue = this.money.ZERO;
    let totalCos = this.money.ZERO;
    let totalOpex = this.money.ZERO;
    let totalOther = this.money.ZERO;

    for (const acc of accounts) {
      const sumDr = debitByAccount.get(acc.id) ?? this.money.ZERO;
      const sumCr = creditByAccount.get(acc.id) ?? this.money.ZERO;

      if (sumDr.isZero() && sumCr.isZero()) continue;

      if (acc.accountType === AccountType.REVENUE) {
        // Revenue normal is Credit: Net = Cr - Dr
        const netRevenue = sumCr.sub(sumDr);
        if (!netRevenue.isZero()) {
          revenueRows.push({
            accountId: acc.id,
            accountCode: acc.code,
            accountName: acc.name,
            accountSubtype: acc.accountSubtype,
            amount: netRevenue.toFixed(2),
          });
          totalRevenue = totalRevenue.add(netRevenue);
        }
      } else {
        // Expense normal is Debit: Net = Dr - Cr
        const netExp = sumDr.sub(sumCr);
        if (netExp.isZero()) continue;

        const row: PnlAccountRow = {
          accountId: acc.id,
          accountCode: acc.code,
          accountName: acc.name,
          accountSubtype: acc.accountSubtype,
          amount: netExp.toFixed(2),
        };

        if (acc.accountSubtype === AccountSubtype.COST_OF_SALES) {
          cosRows.push(row);
          totalCos = totalCos.add(netExp);
        } else if (
          acc.accountSubtype === AccountSubtype.TAX_PAYABLE ||
          acc.name.toLowerCase().includes('tax') ||
          acc.name.toLowerCase().includes('interest')
        ) {
          otherRows.push(row);
          totalOther = totalOther.add(netExp);
        } else {
          opexRows.push(row);
          totalOpex = totalOpex.add(netExp);
        }
      }
    }

    const grossProfit = totalRevenue.sub(totalCos);
    const operatingProfit = grossProfit.sub(totalOpex);
    const netProfit = operatingProfit.sub(totalOther);

    return {
      organizationId,
      organizationName: org.name,
      baseCurrency: org.baseCurrency,
      startDate: toIsoDate(startDate),
      endDate: toIsoDate(endDate),
      revenue: {
        title: 'Operating Revenue',
        accounts: revenueRows,
        total: totalRevenue.toFixed(2),
      },
      costOfSales: {
        title: 'Cost of Sales (COGS)',
        accounts: cosRows,
        total: totalCos.toFixed(2),
      },
      grossProfit: grossProfit.toFixed(2),
      operatingExpenses: {
        title: 'Operating Expenses',
        accounts: opexRows,
        total: totalOpex.toFixed(2),
      },
      operatingProfit: operatingProfit.toFixed(2),
      otherExpenses: {
        title: 'Other Expenses & Finance Costs',
        accounts: otherRows,
        total: totalOther.toFixed(2),
      },
      netProfit: netProfit.toFixed(2),
      isProfitable: netProfit.greaterThanOrEqualTo(0),
    };
  }

  async exportProfitAndLossCsv(organizationId: string, filter: ProfitAndLossFilterDto): Promise<string> {
    const report = await this.generateProfitAndLoss(organizationId, filter);
    const rows: string[][] = [
      ['Blynt — Profit & Loss Statement'],
      ['Organisation', report.organizationName],
      ['Period', `${report.startDate} to ${report.endDate}`],
      ['Currency', report.baseCurrency],
      [],
      ['Code', 'Account', 'Amount'],
      ['--- OPERATING REVENUE ---'],
    ];

    for (const r of report.revenue.accounts) {
      rows.push([r.accountCode, r.accountName, r.amount]);
    }
    rows.push(['', 'Total Operating Revenue', report.revenue.total]);
    rows.push([]);

    rows.push(['--- COST OF SALES ---']);
    for (const c of report.costOfSales.accounts) {
      rows.push([c.accountCode, c.accountName, c.amount]);
    }
    rows.push(['', 'Total Cost of Sales', report.costOfSales.total]);
    rows.push(['', 'GROSS PROFIT', report.grossProfit]);
    rows.push([]);

    rows.push(['--- OPERATING EXPENSES ---']);
    for (const o of report.operatingExpenses.accounts) {
      rows.push([o.accountCode, o.accountName, o.amount]);
    }
    rows.push(['', 'Total Operating Expenses', report.operatingExpenses.total]);
    rows.push(['', 'OPERATING PROFIT (EBIT)', report.operatingProfit]);
    rows.push([]);

    if (report.otherExpenses.accounts.length > 0) {
      rows.push(['--- OTHER EXPENSES ---']);
      for (const ot of report.otherExpenses.accounts) {
        rows.push([ot.accountCode, ot.accountName, ot.amount]);
      }
      rows.push(['', 'Total Other Expenses', report.otherExpenses.total]);
      rows.push([]);
    }

    rows.push(['', 'NET PROFIT / (LOSS)', report.netProfit]);

    return rows.map(toCsvRow).join('\r\n');
  }

  private async resolveDateRange(
    organizationId: string,
    filter: ProfitAndLossFilterDto,
  ): Promise<{ startDate: Date; endDate: Date }> {
    if (filter.periodId) {
      const period = await this.prisma.accountingPeriod.findFirst({
        where: { id: filter.periodId, organizationId },
      });
      if (!period) throw new DomainException('PERIOD_NOT_FOUND', 'Accounting period not found');
      return { startDate: period.startDate, endDate: period.endDate };
    }

    if (filter.financialYearId) {
      const fy = await this.prisma.financialYear.findFirst({
        where: { id: filter.financialYearId, organizationId },
      });
      if (!fy) throw new DomainException('FINANCIAL_YEAR_NOT_FOUND', 'Financial year not found');
      return { startDate: fy.startDate, endDate: fy.endDate };
    }

    const endDate = filter.endDate ? parseIsoDate(filter.endDate, 'endDate') : new Date();
    const startDate = filter.startDate
      ? parseIsoDate(filter.startDate, 'startDate')
      : new Date(Date.UTC(endDate.getUTCFullYear(), 0, 1));

    return { startDate, endDate };
  }
}
