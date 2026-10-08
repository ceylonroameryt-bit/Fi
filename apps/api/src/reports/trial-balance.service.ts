import { Injectable } from '@nestjs/common';
import { AccountType, JournalStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { MoneyService } from '../accounting-engine/money.service';
import { parseIsoDate, toIsoDate } from '../common/utils/dates';
import { toCsvRow } from '../common/utils/csv';
import { DomainException } from '../common/errors/domain.exception';

export interface TrialBalanceFilterDto {
  asOfDate?: string;
  financialYearId?: string;
  periodId?: string;
}

export interface TrialBalanceAccountRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  normalBalance: 'DEBIT' | 'CREDIT';
  grossDebit: string;
  grossCredit: string;
  debitBalance: string;
  creditBalance: string;
}

export interface TrialBalanceReport {
  organizationId: string;
  organizationName: string;
  baseCurrency: string;
  asOfDate: string;
  filterApplied: {
    asOfDate?: string;
    financialYearId?: string;
    periodId?: string;
    periodName?: string;
    financialYearName?: string;
  };
  accounts: TrialBalanceAccountRow[];
  totalDebit: string;
  totalCredit: string;
  difference: string;
  isBalanced: boolean;
}

@Injectable()
export class TrialBalanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly money: MoneyService,
  ) {}

  isDebitNormal(accountType: AccountType): boolean {
    return accountType === AccountType.ASSET || accountType === AccountType.EXPENSE;
  }

  /**
   * Generates the authoritative Trial Balance report.
   * STRICT RULE: Generated exclusively from POSTED and REVERSED journal lines.
   * DRAFT and VALIDATED journals are never included.
   */
  async generateTrialBalance(
    organizationId: string,
    filter: TrialBalanceFilterDto,
  ): Promise<TrialBalanceReport> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, baseCurrency: true },
    });

    const dateFilter = await this.resolveAsOfDate(organizationId, filter);

    // 1. Fetch all accounts for this organisation
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
          ...(dateFilter.asOfDate
            ? {
                postingDate: {
                  lte: dateFilter.asOfDate,
                },
              }
            : {}),
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

    let overallDebitBalance = this.money.ZERO;
    let overallCreditBalance = this.money.ZERO;
    let underlyingDebitTotal = this.money.ZERO;
    let underlyingCreditTotal = this.money.ZERO;

    const accountRows: TrialBalanceAccountRow[] = [];

    for (const acc of accounts) {
      const sumDr = debitByAccount.get(acc.id) ?? this.money.ZERO;
      const sumCr = creditByAccount.get(acc.id) ?? this.money.ZERO;

      // Skip accounts with zero activity
      if (sumDr.isZero() && sumCr.isZero()) {
        continue;
      }

      const isDrNormal = this.isDebitNormal(acc.accountType);
      let debitBal = this.money.ZERO;
      let creditBal = this.money.ZERO;

      if (isDrNormal) {
        // Net Dr = Dr - Cr
        const net = sumDr.sub(sumCr);
        if (net.greaterThanOrEqualTo(0)) {
          debitBal = net;
        } else {
          creditBal = net.abs();
        }
      } else {
        // Net Cr = Cr - Dr
        const net = sumCr.sub(sumDr);
        if (net.greaterThanOrEqualTo(0)) {
          creditBal = net;
        } else {
          debitBal = net.abs();
        }
      }

      // Displayed values rounded to DISPLAY_SCALE (2)
      const displayDrBal = this.money.round(debitBal, 2);
      const displayCrBal = this.money.round(creditBal, 2);

      // Reconcile displayed totals directly with displayed row amounts
      overallDebitBalance = overallDebitBalance.add(displayDrBal);
      overallCreditBalance = overallCreditBalance.add(displayCrBal);
      underlyingDebitTotal = underlyingDebitTotal.add(debitBal);
      underlyingCreditTotal = underlyingCreditTotal.add(creditBal);

      accountRows.push({
        accountId: acc.id,
        accountCode: acc.code,
        accountName: acc.name,
        accountType: acc.accountType,
        normalBalance: isDrNormal ? 'DEBIT' : 'CREDIT',
        grossDebit: this.money.round(sumDr, 2).toFixed(2),
        grossCredit: this.money.round(sumCr, 2).toFixed(2),
        debitBalance: displayDrBal.toFixed(2),
        creditBalance: displayCrBal.toFixed(2),
      });
    }

    const isBalanced = underlyingDebitTotal.sub(underlyingCreditTotal).isZero();
    const totalDebit = overallDebitBalance;
    let totalCredit = overallCreditBalance;
    let difference = overallDebitBalance.sub(overallCreditBalance);

    if (isBalanced) {
      difference = this.money.ZERO;
      if (!totalDebit.equals(totalCredit)) {
        totalCredit = totalDebit;
      }
    }

    return {
      organizationId,
      organizationName: org?.name ?? 'Blynt',
      baseCurrency: org?.baseCurrency ?? 'GBP',
      asOfDate: dateFilter.asOfDate ? toIsoDate(dateFilter.asOfDate) : toIsoDate(new Date()),
      filterApplied: {
        asOfDate: dateFilter.asOfDate ? toIsoDate(dateFilter.asOfDate) : undefined,
        financialYearId: filter.financialYearId,
        periodId: filter.periodId,
        periodName: dateFilter.periodName,
        financialYearName: dateFilter.financialYearName,
      },
      accounts: accountRows,
      totalDebit: totalDebit.toFixed(2),
      totalCredit: totalCredit.toFixed(2),
      difference: difference.toFixed(2),
      isBalanced,
    };
  }

  /**
   * Export Trial Balance as CSV formatted document.
   */
  async exportTrialBalanceCsv(organizationId: string, filter: TrialBalanceFilterDto): Promise<string> {
    const tb = await this.generateTrialBalance(organizationId, filter);

    const rows: string[] = [];
    const timestamp = new Date().toISOString();
    rows.push(toCsvRow(['Organisation', tb.organizationName]));
    rows.push(toCsvRow(['Report', 'Trial Balance']));
    rows.push(toCsvRow(['As of Date', tb.asOfDate]));
    rows.push(toCsvRow(['Generated At', timestamp]));
    rows.push(toCsvRow(['Currency', tb.baseCurrency]));
    rows.push(toCsvRow(['Status', tb.isBalanced ? 'Balanced' : 'Unbalanced']));
    rows.push('');
    rows.push(toCsvRow(['Code', 'Account Name', 'Type', 'Debit Balance', 'Credit Balance']));

    for (const a of tb.accounts) {
      rows.push(toCsvRow([a.accountCode, a.accountName, a.accountType, a.debitBalance, a.creditBalance]));
    }

    rows.push('');
    rows.push(toCsvRow(['TOTAL', '', '', tb.totalDebit, tb.totalCredit]));
    rows.push(toCsvRow(['DIFFERENCE', '', '', tb.difference, '']));

    return rows.join('\r\n');
  }

  private async resolveAsOfDate(
    organizationId: string,
    filter: TrialBalanceFilterDto,
  ): Promise<{ asOfDate?: Date; periodName?: string; financialYearName?: string }> {
    if (filter.periodId) {
      const period = await this.prisma.accountingPeriod.findFirst({
        where: { id: filter.periodId, organizationId },
      });
      if (!period) {
        throw new DomainException(
          'PERIOD_NOT_FOUND',
          'Requested accounting period was not found in this organisation',
        );
      }
      return { asOfDate: period.endDate, periodName: period.name };
    }

    if (filter.financialYearId) {
      const fy = await this.prisma.financialYear.findFirst({
        where: { id: filter.financialYearId, organizationId },
      });
      if (!fy) {
        throw new DomainException(
          'FINANCIAL_YEAR_NOT_FOUND',
          'Requested financial year was not found in this organisation',
        );
      }
      return { asOfDate: fy.endDate, financialYearName: fy.name };
    }

    if (filter.asOfDate) {
      return { asOfDate: parseIsoDate(filter.asOfDate, 'asOfDate') };
    }

    return { asOfDate: new Date() };
  }
}
