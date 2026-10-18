import { Injectable } from '@nestjs/common';
import { BillStatus, InvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { parseIsoDate, toIsoDate } from '../common/utils/dates';
import { toCsvRow } from '../common/utils/csv';
import { DomainException } from '../common/errors/domain.exception';

export type AgeingBucket = 'CURRENT' | '1_30' | '31_60' | '61_90' | '90_PLUS';

export interface AgeingBucketTotals {
  current: string;
  days1To30: string;
  days31To60: string;
  days61To90: string;
  days90Plus: string;
  total: string;
}

export interface AgeingItem {
  id: string;
  referenceNumber: string;
  issueDate: string;
  dueDate: string;
  totalAmount: string;
  amountPaid: string;
  amountDue: string;
  daysOverdue: number;
  bucket: AgeingBucket;
}

export interface ContactRef {
  id: string;
  name: string;
  companyName: string | null;
}

export interface ContactAgeingGroup {
  contactId: string;
  contactName: string;
  companyName: string | null;
  items: AgeingItem[];
  totals: AgeingBucketTotals;
}

export interface AgeingReport {
  organizationId: string;
  organizationName: string;
  baseCurrency: string;
  asOfDate: string;
  reportType: 'AR_AGEING' | 'AP_AGEING';
  groups: ContactAgeingGroup[];
  summaryTotals: AgeingBucketTotals;
  totalCount: number;
}

export interface AgeingFilterDto {
  asOfDate?: string;
  contactId?: string;
}

@Injectable()
export class ArApAgeingService {
  constructor(private readonly prisma: PrismaService) {}

  private classifyBucket(dueDate: Date, asOfDate: Date): { bucket: AgeingBucket; daysOverdue: number } {
    const diffMs = asOfDate.getTime() - dueDate.getTime();
    const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (daysOverdue <= 0) {
      return { bucket: 'CURRENT', daysOverdue: Math.max(0, daysOverdue) };
    }
    if (daysOverdue <= 30) {
      return { bucket: '1_30', daysOverdue };
    }
    if (daysOverdue <= 60) {
      return { bucket: '31_60', daysOverdue };
    }
    if (daysOverdue <= 90) {
      return { bucket: '61_90', daysOverdue };
    }
    return { bucket: '90_PLUS', daysOverdue };
  }

  async generateArAgeing(
    organizationId: string,
    filter: AgeingFilterDto,
  ): Promise<AgeingReport> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) {
      throw new DomainException('NOT_FOUND', 'Organisation not found');
    }

    const asOfDate = filter.asOfDate ? parseIsoDate(filter.asOfDate) : new Date();

    const invoices = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        status: { in: [InvoiceStatus.POSTED, InvoiceStatus.PARTIALLY_PAID] },
        issueDate: { lte: asOfDate },
        ...(filter.contactId ? { contactId: filter.contactId } : {}),
      },
      include: {
        contact: {
          select: { id: true, name: true, companyName: true },
        },
      },
      orderBy: [{ contact: { name: 'asc' } }, { dueDate: 'asc' }],
    });

    const contactGroupsMap = new Map<string, { contact: ContactRef; items: AgeingItem[] }>();

    let totalCurrent = new Prisma.Decimal('0');
    let total1To30 = new Prisma.Decimal('0');
    let total31To60 = new Prisma.Decimal('0');
    let total61To90 = new Prisma.Decimal('0');
    let total90Plus = new Prisma.Decimal('0');
    let grandTotal = new Prisma.Decimal('0');

    let totalItemsCount = 0;

    for (const inv of invoices) {
      const totalAmountDec = new Prisma.Decimal(inv.totalAmount.toString());
      const amountPaidDec = new Prisma.Decimal(inv.amountPaid.toString());
      const amountDueDec = totalAmountDec.sub(amountPaidDec);

      // Only include invoices with remaining unpaid amount
      if (amountDueDec.lte(0)) {
        continue;
      }

      totalItemsCount++;
      const { bucket, daysOverdue } = this.classifyBucket(inv.dueDate, asOfDate);

      const item: AgeingItem = {
        id: inv.id,
        referenceNumber: inv.invoiceNumber,
        issueDate: toIsoDate(inv.issueDate),
        dueDate: toIsoDate(inv.dueDate),
        totalAmount: totalAmountDec.toFixed(2),
        amountPaid: amountPaidDec.toFixed(2),
        amountDue: amountDueDec.toFixed(2),
        daysOverdue,
        bucket,
      };

      if (!contactGroupsMap.has(inv.contactId)) {
        contactGroupsMap.set(inv.contactId, {
          contact: inv.contact,
          items: [],
        });
      }
      contactGroupsMap.get(inv.contactId)!.items.push(item);

      // Add to summary totals
      grandTotal = grandTotal.add(amountDueDec);
      if (bucket === 'CURRENT') totalCurrent = totalCurrent.add(amountDueDec);
      else if (bucket === '1_30') total1To30 = total1To30.add(amountDueDec);
      else if (bucket === '31_60') total31To60 = total31To60.add(amountDueDec);
      else if (bucket === '61_90') total61To90 = total61To90.add(amountDueDec);
      else if (bucket === '90_PLUS') total90Plus = total90Plus.add(amountDueDec);
    }

    const groups: ContactAgeingGroup[] = Array.from(contactGroupsMap.values()).map(
      ({ contact, items }) => {
        let cCurrent = new Prisma.Decimal('0');
        let c1To30 = new Prisma.Decimal('0');
        let c31To60 = new Prisma.Decimal('0');
        let c61To90 = new Prisma.Decimal('0');
        let c90Plus = new Prisma.Decimal('0');
        let cTotal = new Prisma.Decimal('0');

        for (const it of items) {
          const due = new Prisma.Decimal(it.amountDue);
          cTotal = cTotal.add(due);
          if (it.bucket === 'CURRENT') cCurrent = cCurrent.add(due);
          else if (it.bucket === '1_30') c1To30 = c1To30.add(due);
          else if (it.bucket === '31_60') c31To60 = c31To60.add(due);
          else if (it.bucket === '61_90') c61To90 = c61To90.add(due);
          else if (it.bucket === '90_PLUS') c90Plus = c90Plus.add(due);
        }

        return {
          contactId: contact.id,
          contactName: contact.name,
          companyName: contact.companyName ?? null,
          items,
          totals: {
            current: cCurrent.toFixed(2),
            days1To30: c1To30.toFixed(2),
            days31To60: c31To60.toFixed(2),
            days61To90: c61To90.toFixed(2),
            days90Plus: c90Plus.toFixed(2),
            total: cTotal.toFixed(2),
          },
        };
      },
    );

    return {
      organizationId,
      organizationName: org.name,
      baseCurrency: org.baseCurrency,
      asOfDate: toIsoDate(asOfDate),
      reportType: 'AR_AGEING',
      groups,
      summaryTotals: {
        current: totalCurrent.toFixed(2),
        days1To30: total1To30.toFixed(2),
        days31To60: total31To60.toFixed(2),
        days61To90: total61To90.toFixed(2),
        days90Plus: total90Plus.toFixed(2),
        total: grandTotal.toFixed(2),
      },
      totalCount: totalItemsCount,
    };
  }

  async generateApAgeing(
    organizationId: string,
    filter: AgeingFilterDto,
  ): Promise<AgeingReport> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) {
      throw new DomainException('NOT_FOUND', 'Organisation not found');
    }

    const asOfDate = filter.asOfDate ? parseIsoDate(filter.asOfDate) : new Date();

    const bills = await this.prisma.bill.findMany({
      where: {
        organizationId,
        status: BillStatus.POSTED,
        issueDate: { lte: asOfDate },
        ...(filter.contactId ? { contactId: filter.contactId } : {}),
      },
      include: {
        contact: {
          select: { id: true, name: true, companyName: true },
        },
      },
      orderBy: [{ contact: { name: 'asc' } }, { dueDate: 'asc' }],
    });

    const contactGroupsMap = new Map<string, { contact: ContactRef; items: AgeingItem[] }>();

    let totalCurrent = new Prisma.Decimal('0');
    let total1To30 = new Prisma.Decimal('0');
    let total31To60 = new Prisma.Decimal('0');
    let total61To90 = new Prisma.Decimal('0');
    let total90Plus = new Prisma.Decimal('0');
    let grandTotal = new Prisma.Decimal('0');

    let totalItemsCount = 0;

    for (const bill of bills) {
      const totalAmountDec = new Prisma.Decimal(bill.totalAmount.toString());
      const amountPaidDec = new Prisma.Decimal(bill.amountPaid.toString());
      const amountDueDec = totalAmountDec.sub(amountPaidDec);

      // Only include bills with remaining unpaid amount
      if (amountDueDec.lte(0)) {
        continue;
      }

      totalItemsCount++;
      const { bucket, daysOverdue } = this.classifyBucket(bill.dueDate, asOfDate);

      const item: AgeingItem = {
        id: bill.id,
        referenceNumber: bill.billNumber,
        issueDate: toIsoDate(bill.issueDate),
        dueDate: toIsoDate(bill.dueDate),
        totalAmount: totalAmountDec.toFixed(2),
        amountPaid: amountPaidDec.toFixed(2),
        amountDue: amountDueDec.toFixed(2),
        daysOverdue,
        bucket,
      };

      if (!contactGroupsMap.has(bill.contactId)) {
        contactGroupsMap.set(bill.contactId, {
          contact: bill.contact,
          items: [],
        });
      }
      contactGroupsMap.get(bill.contactId)!.items.push(item);

      grandTotal = grandTotal.add(amountDueDec);
      if (bucket === 'CURRENT') totalCurrent = totalCurrent.add(amountDueDec);
      else if (bucket === '1_30') total1To30 = total1To30.add(amountDueDec);
      else if (bucket === '31_60') total31To60 = total31To60.add(amountDueDec);
      else if (bucket === '61_90') total61To90 = total61To90.add(amountDueDec);
      else if (bucket === '90_PLUS') total90Plus = total90Plus.add(amountDueDec);
    }

    const groups: ContactAgeingGroup[] = Array.from(contactGroupsMap.values()).map(
      ({ contact, items }) => {
        let cCurrent = new Prisma.Decimal('0');
        let c1To30 = new Prisma.Decimal('0');
        let c31To60 = new Prisma.Decimal('0');
        let c61To90 = new Prisma.Decimal('0');
        let c90Plus = new Prisma.Decimal('0');
        let cTotal = new Prisma.Decimal('0');

        for (const it of items) {
          const due = new Prisma.Decimal(it.amountDue);
          cTotal = cTotal.add(due);
          if (it.bucket === 'CURRENT') cCurrent = cCurrent.add(due);
          else if (it.bucket === '1_30') c1To30 = c1To30.add(due);
          else if (it.bucket === '31_60') c31To60 = c31To60.add(due);
          else if (it.bucket === '61_90') c61To90 = c61To90.add(due);
          else if (it.bucket === '90_PLUS') c90Plus = c90Plus.add(due);
        }

        return {
          contactId: contact.id,
          contactName: contact.name,
          companyName: contact.companyName ?? null,
          items,
          totals: {
            current: cCurrent.toFixed(2),
            days1To30: c1To30.toFixed(2),
            days31To60: c31To60.toFixed(2),
            days61To90: c61To90.toFixed(2),
            days90Plus: c90Plus.toFixed(2),
            total: cTotal.toFixed(2),
          },
        };
      },
    );

    return {
      organizationId,
      organizationName: org.name,
      baseCurrency: org.baseCurrency,
      asOfDate: toIsoDate(asOfDate),
      reportType: 'AP_AGEING',
      groups,
      summaryTotals: {
        current: totalCurrent.toFixed(2),
        days1To30: total1To30.toFixed(2),
        days31To60: total31To60.toFixed(2),
        days61To90: total61To90.toFixed(2),
        days90Plus: total90Plus.toFixed(2),
        total: grandTotal.toFixed(2),
      },
      totalCount: totalItemsCount,
    };
  }

  async exportArAgeingCsv(organizationId: string, filter: AgeingFilterDto): Promise<string> {
    const report = await this.generateArAgeing(organizationId, filter);
    return this.renderAgeingCsv(report, 'Customer / Debtor', 'Invoice #');
  }

  async exportApAgeingCsv(organizationId: string, filter: AgeingFilterDto): Promise<string> {
    const report = await this.generateApAgeing(organizationId, filter);
    return this.renderAgeingCsv(report, 'Supplier / Creditor', 'Bill #');
  }

  private renderAgeingCsv(report: AgeingReport, contactLabel: string, refLabel: string): string {
    const rows: string[][] = [
      [`${report.organizationName} - ${report.reportType === 'AR_AGEING' ? 'Aged Debtors (AR Ageing)' : 'Aged Creditors (AP Ageing)'}`],
      [`As of Date: ${report.asOfDate}`, `Currency: ${report.baseCurrency}`],
      [],
      [
        contactLabel,
        refLabel,
        'Issue Date',
        'Due Date',
        'Days Overdue',
        'Current',
        '1-30 Days',
        '31-60 Days',
        '61-90 Days',
        '90+ Days',
        'Total Amount Due',
      ],
    ];

    for (const group of report.groups) {
      for (const item of group.items) {
        rows.push([
          group.contactName,
          item.referenceNumber,
          item.issueDate,
          item.dueDate,
          item.daysOverdue.toString(),
          item.bucket === 'CURRENT' ? item.amountDue : '0.00',
          item.bucket === '1_30' ? item.amountDue : '0.00',
          item.bucket === '31_60' ? item.amountDue : '0.00',
          item.bucket === '61_90' ? item.amountDue : '0.00',
          item.bucket === '90_PLUS' ? item.amountDue : '0.00',
          item.amountDue,
        ]);
      }
      // Subtotal row
      rows.push([
        `Total ${group.contactName}`,
        '',
        '',
        '',
        '',
        group.totals.current,
        group.totals.days1To30,
        group.totals.days31To60,
        group.totals.days61To90,
        group.totals.days90Plus,
        group.totals.total,
      ]);
      rows.push([]);
    }

    // Grand total row
    rows.push([
      'GRAND TOTAL',
      '',
      '',
      '',
      '',
      report.summaryTotals.current,
      report.summaryTotals.days1To30,
      report.summaryTotals.days31To60,
      report.summaryTotals.days61To90,
      report.summaryTotals.days90Plus,
      report.summaryTotals.total,
    ]);

    return rows.map(toCsvRow).join('\r\n');
  }
}
