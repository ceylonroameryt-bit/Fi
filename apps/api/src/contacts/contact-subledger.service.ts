import { Injectable } from '@nestjs/common';
import { AccountSubtype, JournalStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { MoneyService } from '../accounting-engine/money.service';
import { DomainException } from '../common/errors/domain.exception';
import { parseIsoDate, toIsoDate } from '../common/utils/dates';
import type { ContactActivityQueryDto, ContactStatementQueryDto } from './dto/contact.dto';
import { isCustomer, isSupplier } from './contact-type.rules';

export interface StatementItem {
  id: string;
  date: string;
  postingDate: string;
  journalId: string;
  journalNumber: string;
  reference: string | null;
  sourceType: string;
  sourceId: string | null;
  description: string;
  debit: string;
  credit: string;
  runningBalance: string;
}

export interface StatementResult {
  contactId: string;
  contactName: string;
  currency: string;
  from: string | null;
  to: string | null;
  openingBalance: string;
  closingBalance: string;
  items: StatementItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ActivityItem {
  id: string;
  timestamp: string;
  type: 'INVOICE_CREATED' | 'INVOICE_POSTED' | 'INVOICE_VOIDED' | 'JOURNAL_LINE' | 'CONTACT_EVENT';
  title: string;
  description: string;
  reference?: string | null;
  amount?: string | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ContactSubledgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly money: MoneyService,
  ) {}

  /**
   * Authoritative Customer balance derived strictly from POSTED/REVERSED AR journal lines.
   * AR normal balance is DEBIT: sum(debit) - sum(credit).
   */
  async getCustomerBalance(organizationId: string, contactId: string): Promise<string> {
    const lines = await this.prisma.journalLine.findMany({
      where: {
        organizationId,
        contactId,
        journalEntry: {
          status: { in: [JournalStatus.POSTED, JournalStatus.REVERSED] },
        },
        account: {
          OR: [
            { accountSubtype: AccountSubtype.ACCOUNTS_RECEIVABLE },
            { code: '1100' },
          ],
        },
      },
      select: { debit: true, credit: true },
    });

    let balance = this.money.ZERO;
    for (const l of lines) {
      balance = balance.add(this.money.toDecimal(l.debit)).sub(this.money.toDecimal(l.credit));
    }

    return balance.toFixed(2);
  }

  /**
   * Authoritative Supplier balance derived strictly from POSTED/REVERSED AP journal lines.
   * AP normal balance is CREDIT: sum(credit) - sum(debit).
   */
  async getSupplierBalance(organizationId: string, contactId: string): Promise<string> {
    const lines = await this.prisma.journalLine.findMany({
      where: {
        organizationId,
        contactId,
        journalEntry: {
          status: { in: [JournalStatus.POSTED, JournalStatus.REVERSED] },
        },
        account: {
          OR: [
            { accountSubtype: AccountSubtype.ACCOUNTS_PAYABLE },
            { code: '2000' },
          ],
        },
      },
      select: { debit: true, credit: true },
    });

    let balance = this.money.ZERO;
    for (const l of lines) {
      balance = balance.add(this.money.toDecimal(l.credit)).sub(this.money.toDecimal(l.debit));
    }

    return balance.toFixed(2);
  }

  /**
   * Combined customer/supplier balances.
   */
  async getContactBalance(organizationId: string, contactId: string) {
    const [customerBalance, supplierBalance] = await Promise.all([
      this.getCustomerBalance(organizationId, contactId),
      this.getSupplierBalance(organizationId, contactId),
    ]);

    const custDec = this.money.toDecimal(customerBalance);
    const suppDec = this.money.toDecimal(supplierBalance);
    const netBalance = custDec.sub(suppDec).toFixed(2);

    return {
      customerBalance,
      supplierBalance,
      netBalance,
    };
  }

  /**
   * Customer Statement:
   * Only for CUSTOMER or BOTH contacts.
   * Calculates opening balance before `from`, transactions with running balance, and closing balance.
   */
  async getCustomerStatement(
    organizationId: string,
    contactId: string,
    query: ContactStatementQueryDto,
  ): Promise<StatementResult> {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, organizationId },
      include: { organization: { select: { baseCurrency: true } } },
    });

    if (!contact) {
      throw new DomainException('CONTACT_NOT_FOUND', 'Contact not found in this organisation');
    }

    if (!isCustomer(contact)) {
      throw new DomainException('CONTACT_NOT_CUSTOMER', 'Customer statements are only available for customer contacts');
    }

    const fromDate = query.from ? parseIsoDate(query.from, 'from') : null;
    const toDate = query.to ? parseIsoDate(query.to, 'to') : null;
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 50;

    const baseWhere: Prisma.JournalLineWhereInput = {
      organizationId,
      contactId,
      journalEntry: {
        status: { in: [JournalStatus.POSTED, JournalStatus.REVERSED] },
      },
      account: {
        OR: [
          { accountSubtype: AccountSubtype.ACCOUNTS_RECEIVABLE },
          { code: '1100' },
        ],
      },
    };

    // 1. Calculate opening balance: Sum of all posted lines strictly before fromDate
    let openingBalance = this.money.ZERO;
    if (fromDate) {
      const priorLines = await this.prisma.journalLine.findMany({
        where: {
          ...baseWhere,
          journalEntry: {
            status: { in: [JournalStatus.POSTED, JournalStatus.REVERSED] },
            postingDate: { lt: fromDate },
          },
        },
        select: { debit: true, credit: true },
      });

      for (const pl of priorLines) {
        openingBalance = openingBalance
          .add(this.money.toDecimal(pl.debit))
          .sub(this.money.toDecimal(pl.credit));
      }
    }

    // 2. Fetch all period lines
    const periodWhere: Prisma.JournalLineWhereInput = {
      ...baseWhere,
      ...(fromDate || toDate
        ? {
            journalEntry: {
              status: { in: [JournalStatus.POSTED, JournalStatus.REVERSED] },
              postingDate: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            },
          }
        : {}),
    };

    const total = await this.prisma.journalLine.count({ where: periodWhere });
    const totalPages = Math.ceil(total / pageSize) || 1;

    // Fetch prior items within this period up to the current page skip for running balance baseline
    let runningBalance = openingBalance;
    const skip = (page - 1) * pageSize;
    if (skip > 0) {
      const priorInPeriod = await this.prisma.journalLine.findMany({
        where: periodWhere,
        take: skip,
        orderBy: [
          { journalEntry: { postingDate: 'asc' } },
          { journalEntry: { journalNumber: 'asc' } },
          { lineNumber: 'asc' },
          { id: 'asc' },
        ],
        select: { debit: true, credit: true },
      });

      for (const p of priorInPeriod) {
        runningBalance = runningBalance
          .add(this.money.toDecimal(p.debit))
          .sub(this.money.toDecimal(p.credit));
      }
    }

    // Fetch current page lines
    const pageLines = await this.prisma.journalLine.findMany({
      where: periodWhere,
      skip,
      take: pageSize,
      orderBy: [
        { journalEntry: { postingDate: 'asc' } },
        { journalEntry: { journalNumber: 'asc' } },
        { lineNumber: 'asc' },
        { id: 'asc' },
      ],
      include: {
        journalEntry: {
          select: {
            id: true,
            journalNumber: true,
            journalDate: true,
            postingDate: true,
            reference: true,
            sourceType: true,
            sourceId: true,
            description: true,
          },
        },
      },
    });

    const items: StatementItem[] = [];
    for (const line of pageLines) {
      const dr = this.money.toDecimal(line.debit);
      const cr = this.money.toDecimal(line.credit);
      runningBalance = runningBalance.add(dr).sub(cr);

      items.push({
        id: line.id,
        date: toIsoDate(line.journalEntry.journalDate),
        postingDate: toIsoDate(line.journalEntry.postingDate),
        journalId: line.journalEntry.id,
        journalNumber: line.journalEntry.journalNumber,
        reference: line.journalEntry.reference,
        sourceType: line.journalEntry.sourceType,
        sourceId: line.journalEntry.sourceId,
        description: line.description || line.journalEntry.description,
        debit: dr.toFixed(2),
        credit: cr.toFixed(2),
        runningBalance: runningBalance.toFixed(2),
      });
    }

    // 3. Calculate closing balance for the entire period up to toDate
    let closingBalance = openingBalance;
    const allPeriodLines = await this.prisma.journalLine.findMany({
      where: periodWhere,
      select: { debit: true, credit: true },
    });
    for (const apl of allPeriodLines) {
      closingBalance = closingBalance
        .add(this.money.toDecimal(apl.debit))
        .sub(this.money.toDecimal(apl.credit));
    }

    return {
      contactId: contact.id,
      contactName: contact.name,
      currency: contact.organization.baseCurrency,
      from: fromDate ? toIsoDate(fromDate) : null,
      to: toDate ? toIsoDate(toDate) : null,
      openingBalance: openingBalance.toFixed(2),
      closingBalance: closingBalance.toFixed(2),
      items,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Supplier Statement:
   * Only for SUPPLIER or BOTH contacts.
   * Follows exact symmetrical AP double-entry rules.
   */
  async getSupplierStatement(
    organizationId: string,
    contactId: string,
    query: ContactStatementQueryDto,
  ): Promise<StatementResult> {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, organizationId },
      include: { organization: { select: { baseCurrency: true } } },
    });

    if (!contact) {
      throw new DomainException('CONTACT_NOT_FOUND', 'Contact not found in this organisation');
    }

    if (!isSupplier(contact)) {
      throw new DomainException('CONTACT_NOT_SUPPLIER', 'Supplier statements are only available for supplier contacts');
    }

    const fromDate = query.from ? parseIsoDate(query.from, 'from') : null;
    const toDate = query.to ? parseIsoDate(query.to, 'to') : null;
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 50;

    const baseWhere: Prisma.JournalLineWhereInput = {
      organizationId,
      contactId,
      journalEntry: {
        status: { in: [JournalStatus.POSTED, JournalStatus.REVERSED] },
      },
      account: {
        OR: [
          { accountSubtype: AccountSubtype.ACCOUNTS_PAYABLE },
          { code: '2000' },
        ],
      },
    };

    // Opening balance: AP normal balance is Credit: sum(credit) - sum(debit)
    let openingBalance = this.money.ZERO;
    if (fromDate) {
      const priorLines = await this.prisma.journalLine.findMany({
        where: {
          ...baseWhere,
          journalEntry: {
            status: { in: [JournalStatus.POSTED, JournalStatus.REVERSED] },
            postingDate: { lt: fromDate },
          },
        },
        select: { debit: true, credit: true },
      });

      for (const pl of priorLines) {
        openingBalance = openingBalance
          .add(this.money.toDecimal(pl.credit))
          .sub(this.money.toDecimal(pl.debit));
      }
    }

    const periodWhere: Prisma.JournalLineWhereInput = {
      ...baseWhere,
      ...(fromDate || toDate
        ? {
            journalEntry: {
              status: { in: [JournalStatus.POSTED, JournalStatus.REVERSED] },
              postingDate: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            },
          }
        : {}),
    };

    const total = await this.prisma.journalLine.count({ where: periodWhere });
    const totalPages = Math.ceil(total / pageSize) || 1;

    let runningBalance = openingBalance;
    const skip = (page - 1) * pageSize;
    if (skip > 0) {
      const priorInPeriod = await this.prisma.journalLine.findMany({
        where: periodWhere,
        take: skip,
        orderBy: [
          { journalEntry: { postingDate: 'asc' } },
          { journalEntry: { journalNumber: 'asc' } },
          { lineNumber: 'asc' },
          { id: 'asc' },
        ],
        select: { debit: true, credit: true },
      });

      for (const p of priorInPeriod) {
        runningBalance = runningBalance
          .add(this.money.toDecimal(p.credit))
          .sub(this.money.toDecimal(p.debit));
      }
    }

    const pageLines = await this.prisma.journalLine.findMany({
      where: periodWhere,
      skip,
      take: pageSize,
      orderBy: [
        { journalEntry: { postingDate: 'asc' } },
        { journalEntry: { journalNumber: 'asc' } },
        { lineNumber: 'asc' },
        { id: 'asc' },
      ],
      include: {
        journalEntry: {
          select: {
            id: true,
            journalNumber: true,
            journalDate: true,
            postingDate: true,
            reference: true,
            sourceType: true,
            sourceId: true,
            description: true,
          },
        },
      },
    });

    const items: StatementItem[] = [];
    for (const line of pageLines) {
      const dr = this.money.toDecimal(line.debit);
      const cr = this.money.toDecimal(line.credit);
      runningBalance = runningBalance.add(cr).sub(dr);

      items.push({
        id: line.id,
        date: toIsoDate(line.journalEntry.journalDate),
        postingDate: toIsoDate(line.journalEntry.postingDate),
        journalId: line.journalEntry.id,
        journalNumber: line.journalEntry.journalNumber,
        reference: line.journalEntry.reference,
        sourceType: line.journalEntry.sourceType,
        sourceId: line.journalEntry.sourceId,
        description: line.description || line.journalEntry.description,
        debit: dr.toFixed(2),
        credit: cr.toFixed(2),
        runningBalance: runningBalance.toFixed(2),
      });
    }

    let closingBalance = openingBalance;
    const allPeriodLines = await this.prisma.journalLine.findMany({
      where: periodWhere,
      select: { debit: true, credit: true },
    });
    for (const apl of allPeriodLines) {
      closingBalance = closingBalance
        .add(this.money.toDecimal(apl.credit))
        .sub(this.money.toDecimal(apl.debit));
    }

    return {
      contactId: contact.id,
      contactName: contact.name,
      currency: contact.organization.baseCurrency,
      from: fromDate ? toIsoDate(fromDate) : null,
      to: toDate ? toIsoDate(toDate) : null,
      openingBalance: openingBalance.toFixed(2),
      closingBalance: closingBalance.toFixed(2),
      items,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Presentation timeline over authoritative entities (invoices, posted subledger movements, audit events).
   */
  async getContactActivity(
    organizationId: string,
    contactId: string,
    query: ContactActivityQueryDto,
  ): Promise<{ items: ActivityItem[]; total: number; page: number; pageSize: number; totalPages: number }> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 20;

    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, organizationId },
      include: {
        invoices: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            issueDate: true,
            totalAmount: true,
            createdAt: true,
            postedAt: true,
            voidedAt: true,
          },
        },
        journalLines: {
          where: {
            journalEntry: {
              status: { in: [JournalStatus.POSTED, JournalStatus.REVERSED] },
            },
          },
          select: {
            id: true,
            debit: true,
            credit: true,
            description: true,
            journalEntry: {
              select: {
                id: true,
                journalNumber: true,
                postingDate: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!contact) {
      throw new DomainException('CONTACT_NOT_FOUND', 'Contact not found in this organisation');
    }

    const activity: ActivityItem[] = [];

    // Invoices activity
    for (const inv of contact.invoices) {
      activity.push({
        id: `inv-created-${inv.id}`,
        timestamp: inv.createdAt.toISOString(),
        type: 'INVOICE_CREATED',
        title: `Draft Invoice ${inv.invoiceNumber}`,
        description: `Created invoice for ${this.money.toDecimal(inv.totalAmount).toFixed(2)}`,
        reference: inv.invoiceNumber,
        amount: this.money.toDecimal(inv.totalAmount).toFixed(2),
      });

      if (inv.postedAt) {
        activity.push({
          id: `inv-posted-${inv.id}`,
          timestamp: inv.postedAt.toISOString(),
          type: 'INVOICE_POSTED',
          title: `Posted Invoice ${inv.invoiceNumber}`,
          description: `Invoice posted to General Ledger`,
          reference: inv.invoiceNumber,
          amount: this.money.toDecimal(inv.totalAmount).toFixed(2),
        });
      }

      if (inv.voidedAt) {
        activity.push({
          id: `inv-voided-${inv.id}`,
          timestamp: inv.voidedAt.toISOString(),
          type: 'INVOICE_VOIDED',
          title: `Voided Invoice ${inv.invoiceNumber}`,
          description: `Invoice voided and journal entry reversed`,
          reference: inv.invoiceNumber,
          amount: this.money.toDecimal(inv.totalAmount).toFixed(2),
        });
      }
    }

    // Subledger movements
    for (const jl of contact.journalLines) {
      const dr = this.money.toDecimal(jl.debit);
      const cr = this.money.toDecimal(jl.credit);
      const isDr = dr.greaterThan(0);

      activity.push({
        id: `jl-${jl.id}`,
        timestamp: jl.journalEntry.createdAt.toISOString(),
        type: 'JOURNAL_LINE',
        title: `Ledger Entry ${jl.journalEntry.journalNumber}`,
        description: jl.description || (isDr ? `Debit ${dr.toFixed(2)}` : `Credit ${cr.toFixed(2)}`),
        reference: jl.journalEntry.journalNumber,
        amount: isDr ? dr.toFixed(2) : cr.toFixed(2),
      });
    }

    // Sort timeline descending
    activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const total = activity.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const paginatedItems = activity.slice((page - 1) * pageSize, page * pageSize);

    return {
      items: paginatedItems,
      total,
      page,
      pageSize,
      totalPages,
    };
  }
}
