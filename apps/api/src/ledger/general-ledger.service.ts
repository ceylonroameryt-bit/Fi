import { Injectable } from '@nestjs/common';
import { AccountType, JournalStatus, JournalType, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { MoneyService } from '../accounting-engine/money.service';
import { DomainException } from '../common/errors/domain.exception';
import { parseIsoDate, toIsoDate } from '../common/utils/dates';

export interface LedgerFilterDto {
  accountId?: string;
  startDate?: string;
  endDate?: string;
  financialYearId?: string;
  periodId?: string;
  journalType?: JournalType;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface LedgerEntryView {
  id: string;
  date: string;
  postingDate: string;
  journalId: string;
  journalNumber: string;
  journalType: JournalType;
  reference: string | null;
  description: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  debit: string;
  credit: string;
  runningBalance: string | null;
  source: string;
}

@Injectable()
export class GeneralLedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly money: MoneyService,
  ) {}

  /**
   * Determine normal balance direction:
   * ASSET and EXPENSE -> DEBIT normal
   * LIABILITY, EQUITY, REVENUE -> CREDIT normal
   */
  isDebitNormal(accountType: AccountType): boolean {
    return accountType === AccountType.ASSET || accountType === AccountType.EXPENSE;
  }

  /**
   * Authoritative query for General Ledger entries across all accounts or filtered by account.
   * Only includes POSTED and REVERSED journals (Draft & Validated are strictly excluded).
   */
  async getGeneralLedger(organizationId: string, filter: LedgerFilterDto) {
    const page = filter.page && filter.page > 0 ? filter.page : 1;
    const pageSize = filter.pageSize && filter.pageSize > 0 ? filter.pageSize : 50;

    const dateFilter = await this.resolveDateRange(organizationId, filter);

    const where: Prisma.JournalLineWhereInput = {
      organizationId,
      journalEntry: {
        status: { in: [JournalStatus.POSTED, JournalStatus.REVERSED] },
        ...(filter.journalType ? { journalType: filter.journalType } : {}),
        ...(dateFilter.startDate || dateFilter.endDate
          ? {
              postingDate: {
                ...(dateFilter.startDate ? { gte: dateFilter.startDate } : {}),
                ...(dateFilter.endDate ? { lte: dateFilter.endDate } : {}),
              },
            }
          : {}),
      },
      ...(filter.accountId ? { accountId: filter.accountId } : {}),
      ...(filter.search
        ? {
            OR: [
              { description: { contains: filter.search, mode: 'insensitive' } },
              { journalEntry: { journalNumber: { contains: filter.search, mode: 'insensitive' } } },
              { journalEntry: { reference: { contains: filter.search, mode: 'insensitive' } } },
              { account: { code: { contains: filter.search, mode: 'insensitive' } } },
              { account: { name: { contains: filter.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [lines, total] = await Promise.all([
      this.prisma.journalLine.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [
          { journalEntry: { postingDate: 'desc' } },
          { journalEntry: { journalNumber: 'desc' } },
          { lineNumber: 'asc' },
        ],
        include: {
          account: true,
          journalEntry: {
            select: {
              id: true,
              journalNumber: true,
              journalType: true,
              sourceType: true,
              status: true,
              journalDate: true,
              postingDate: true,
              reference: true,
            },
          },
        },
      }),
      this.prisma.journalLine.count({ where }),
    ]);

    // Format lines with exact decimal arithmetic
    const entries: LedgerEntryView[] = lines.map((l) => ({
      id: l.id,
      date: toIsoDate(l.journalEntry.journalDate),
      postingDate: toIsoDate(l.journalEntry.postingDate),
      journalId: l.journalEntry.id,
      journalNumber: l.journalEntry.journalNumber,
      journalType: l.journalEntry.journalType,
      reference: l.journalEntry.reference,
      description: l.description ?? '',
      accountId: l.account.id,
      accountCode: l.account.code,
      accountName: l.account.name,
      accountType: l.account.accountType,
      debit: this.money.toDecimal(l.debit).toFixed(2),
      credit: this.money.toDecimal(l.credit).toFixed(2),
      runningBalance: null, // In multi-account view, do not display misleading zero balance
      source: l.journalEntry.sourceType,
    }));

    return {
      entries,
      total,
      page,
      pageSize,
      dateRange: {
        startDate: dateFilter.startDate ? toIsoDate(dateFilter.startDate) : null,
        endDate: dateFilter.endDate ? toIsoDate(dateFilter.endDate) : null,
      },
    };
  }

  /**
   * Detailed Account Ledger with Opening Balance, Running Balance per transaction, and Closing Balance.
   */
  async getAccountLedger(organizationId: string, accountId: string, filter: LedgerFilterDto) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, organizationId },
    });

    if (!account) {
      throw new DomainException('ACCOUNT_NOT_FOUND', 'Account was not found in this organisation');
    }

    const isDrNormal = this.isDebitNormal(account.accountType);
    const dateFilter = await this.resolveDateRange(organizationId, filter);

    // 1. Calculate opening balance: Sum of all posted lines strictly before startDate
    let openingBalance = this.money.ZERO;
    if (dateFilter.startDate) {
      const priorLines = await this.prisma.journalLine.findMany({
        where: {
          organizationId,
          accountId,
          journalEntry: {
            status: { in: [JournalStatus.POSTED, JournalStatus.REVERSED] },
            postingDate: { lt: dateFilter.startDate },
          },
        },
        select: { debit: true, credit: true },
      });

      for (const pl of priorLines) {
        const dr = this.money.toDecimal(pl.debit);
        const cr = this.money.toDecimal(pl.credit);
        openingBalance = isDrNormal
          ? openingBalance.add(dr).sub(cr)
          : openingBalance.add(cr).sub(dr);
      }
    }

    // 2. Fetch all transactions in chronological order for correct running balance calculation
    const lines = await this.prisma.journalLine.findMany({
      where: {
        organizationId,
        accountId,
        journalEntry: {
          status: { in: [JournalStatus.POSTED, JournalStatus.REVERSED] },
          ...(dateFilter.startDate || dateFilter.endDate
            ? {
                postingDate: {
                  ...(dateFilter.startDate ? { gte: dateFilter.startDate } : {}),
                  ...(dateFilter.endDate ? { lte: dateFilter.endDate } : {}),
                },
              }
            : {}),
        },
      },
      orderBy: [
        { journalEntry: { postingDate: 'asc' } },
        { journalEntry: { journalNumber: 'asc' } },
        { lineNumber: 'asc' },
      ],
      include: {
        journalEntry: {
          select: {
            id: true,
            journalNumber: true,
            journalType: true,
            sourceType: true,
            status: true,
            journalDate: true,
            postingDate: true,
            reference: true,
          },
        },
      },
    });

    let currentBalance = openingBalance;
    let periodDebits = this.money.ZERO;
    let periodCredits = this.money.ZERO;

    const transactions: LedgerEntryView[] = lines.map((l) => {
      const dr = this.money.toDecimal(l.debit);
      const cr = this.money.toDecimal(l.credit);

      periodDebits = periodDebits.add(dr);
      periodCredits = periodCredits.add(cr);

      currentBalance = isDrNormal
        ? currentBalance.add(dr).sub(cr)
        : currentBalance.add(cr).sub(dr);

      return {
        id: l.id,
        date: toIsoDate(l.journalEntry.journalDate),
        postingDate: toIsoDate(l.journalEntry.postingDate),
        journalId: l.journalEntry.id,
        journalNumber: l.journalEntry.journalNumber,
        journalType: l.journalEntry.journalType,
        reference: l.journalEntry.reference,
        description: l.description ?? '',
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        accountType: account.accountType,
        debit: dr.toFixed(2),
        credit: cr.toFixed(2),
        runningBalance: currentBalance.toFixed(2),
        source: l.journalEntry.sourceType,
      };
    });

    return {
      account: {
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.accountType,
        normalBalance: isDrNormal ? 'DEBIT' : 'CREDIT',
      },
      openingBalance: openingBalance.toFixed(2),
      totalDebits: periodDebits.toFixed(2),
      totalCredits: periodCredits.toFixed(2),
      closingBalance: currentBalance.toFixed(2),
      transactions,
      dateRange: {
        startDate: dateFilter.startDate ? toIsoDate(dateFilter.startDate) : null,
        endDate: dateFilter.endDate ? toIsoDate(dateFilter.endDate) : null,
      },
    };
  }

  /**
   * Export General Ledger entries as CSV formatted text.
   */
  async exportLedgerCsv(organizationId: string, filter: LedgerFilterDto): Promise<string> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, baseCurrency: true },
    });

    const result = filter.accountId
      ? await this.getAccountLedger(organizationId, filter.accountId, filter)
      : null;

    const rows: string[] = [];
    const timestamp = new Date().toISOString();
    rows.push(`"Organisation","${org?.name ?? 'Ledgerline'}"`);
    rows.push(`"Report","General Ledger"`);
    rows.push(`"Generated At","${timestamp}"`);
    rows.push(`"Currency","${org?.baseCurrency ?? 'GBP'}"`);
    rows.push('');

    if (result) {
      // Account specific export
      rows.push(`"Account","${result.account.code} - ${result.account.name} (${result.account.type})"`);
      rows.push(`"Normal Balance","${result.account.normalBalance}"`);
      rows.push(`"Opening Balance","${result.openingBalance}"`);
      rows.push(`"Total Debits","${result.totalDebits}"`);
      rows.push(`"Total Credits","${result.totalCredits}"`);
      rows.push(`"Closing Balance","${result.closingBalance}"`);
      rows.push('');
      rows.push('"Date","Posting Date","Journal Number","Reference","Description","Debit","Credit","Running Balance"');

      for (const t of result.transactions) {
        rows.push(
          `"${t.date}","${t.postingDate}","${t.journalNumber}","${t.reference ?? ''}","${t.description.replace(/"/g, '""')}","${t.debit}","${t.credit}","${t.runningBalance}"`,
        );
      }
    } else {
      // All accounts export
      const allResult = await this.getGeneralLedger(organizationId, {
        ...filter,
        page: 1,
        pageSize: 10000,
      });

      rows.push('"Date","Posting Date","Journal Number","Reference","Account Code","Account Name","Description","Debit","Credit"');
      for (const e of allResult.entries) {
        rows.push(
          `"${e.date}","${e.postingDate}","${e.journalNumber}","${e.reference ?? ''}","${e.accountCode}","${e.accountName.replace(/"/g, '""')}","${e.description.replace(/"/g, '""')}","${e.debit}","${e.credit}"`,
        );
      }
    }

    return rows.join('\r\n');
  }

  private async resolveDateRange(organizationId: string, filter: LedgerFilterDto) {
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (filter.periodId) {
      const period = await this.prisma.accountingPeriod.findFirst({
        where: { id: filter.periodId, organizationId },
      });
      if (period) {
        startDate = period.startDate;
        endDate = period.endDate;
      }
    } else if (filter.financialYearId) {
      const fy = await this.prisma.financialYear.findFirst({
        where: { id: filter.financialYearId, organizationId },
      });
      if (fy) {
        startDate = fy.startDate;
        endDate = fy.endDate;
      }
    } else {
      if (filter.startDate) {
        startDate = parseIsoDate(filter.startDate, 'startDate');
      }
      if (filter.endDate) {
        endDate = parseIsoDate(filter.endDate, 'endDate');
      }
    }

    return { startDate, endDate };
  }
}
