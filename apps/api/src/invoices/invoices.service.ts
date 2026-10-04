import { Injectable } from '@nestjs/common';
import {
  AccountSubtype,
  InvoiceStatus,
  JournalType,
  Prisma,
} from '@prisma/client';
import { PrismaService, Tx } from '../database/prisma.service';
import { DomainException } from '../common/errors/domain.exception';
import type { Actor, OrgContext } from '../common/types/request-context.types';
import { AuditService } from '../audit/audit.service';
import { AuditEvents } from '../audit/audit-events';
import { MoneyService } from '../accounting-engine/money.service';
import { JournalPostingService } from '../accounting-engine/journal-posting.service';
import { JournalReversalService } from '../accounting-engine/journal-reversal.service';
import { JournalsService } from '../journals/journals.service';
import { parseIsoDate } from '../common/utils/dates';
import type {
  CreateInvoiceDto,
  InvoiceFilterQueryDto,
  UpdateInvoiceDto,
  VoidInvoiceDto,
} from './dto/invoice.dto';

const invoiceInclude = {
  contact: true,
  createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
  journalEntry: {
    select: {
      id: true,
      journalNumber: true,
      status: true,
      reversedByJournalId: true,
      reversedByJournal: { select: { id: true, journalNumber: true } },
    },
  },
  lines: {
    include: { account: { select: { id: true, code: true, name: true, accountType: true } } },
    orderBy: { lineNumber: 'asc' as const },
  },
} as const;

export type InvoiceWithRelations = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly money: MoneyService,
    private readonly postingService: JournalPostingService,
    private readonly reversalService: JournalReversalService,
    private readonly journalsService: JournalsService,
  ) {}

  async listInvoices(organizationId: string, filter: InvoiceFilterQueryDto) {
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 50;

    const where: Prisma.InvoiceWhereInput = {
      organizationId,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.contactId ? { contactId: filter.contactId } : {}),
      ...(filter.search
        ? {
            OR: [
              { invoiceNumber: { contains: filter.search, mode: 'insensitive' } },
              { reference: { contains: filter.search, mode: 'insensitive' } },
              { contact: { name: { contains: filter.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ issueDate: 'desc' }, { invoiceNumber: 'desc' }],
        include: {
          contact: { select: { id: true, name: true, email: true, companyName: true } },
          createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
          lines: {
            include: { account: { select: { id: true, code: true, name: true } } },
            orderBy: { lineNumber: 'asc' },
          },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getInvoice(organizationId: string, invoiceId: string): Promise<InvoiceWithRelations> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId },
      include: invoiceInclude,
    });

    if (!invoice) {
      throw new DomainException('INVOICE_NOT_FOUND', 'Invoice not found in this organisation');
    }

    return invoice;
  }

  async createInvoice(organizationId: string, dto: CreateInvoiceDto, orgContext: OrgContext, actor: Actor) {
    // 1. Validate customer contact
    const contact = await this.prisma.contact.findFirst({
      where: { id: dto.contactId, organizationId },
    });
    if (!contact) {
      throw new DomainException('CONTACT_NOT_FOUND', 'Customer contact not found in this organisation');
    }

    const issueDate = parseIsoDate(dto.issueDate, 'issueDate');
    const dueDate = parseIsoDate(dto.dueDate, 'dueDate');
    const currency = dto.currency || contact.currency || orgContext.baseCurrency;

    // 2. Compute line totals and invoice totals with Decimal precision
    const { calculatedLines, subtotal, taxTotal, totalAmount } = this.calculateInvoiceTotals(dto.lines);

    const year = issueDate.getUTCFullYear();

    return this.prisma.transaction(async (tx) => {
      // 3. Generate sequential invoice number: INV-YYYY-XXXXXX
      const invoiceNumber = await this.allocateInvoiceNumber(tx, organizationId, year);

      // 4. Create Invoice & Lines
      const invoice = await tx.invoice.create({
        data: {
          organizationId,
          contactId: dto.contactId,
          invoiceNumber,
          reference: dto.reference,
          issueDate,
          dueDate,
          currency,
          subtotal,
          taxTotal,
          totalAmount,
          status: InvoiceStatus.DRAFT,
          notes: dto.notes,
          terms: dto.terms,
          createdById: actor.userId!,
          lines: {
            create: calculatedLines.map((l, index) => ({
              lineNumber: index + 1,
              accountId: l.accountId,
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              taxRate: l.taxRate,
              taxAmount: l.taxAmount,
              lineTotal: l.lineTotal,
            })),
          },
        },
        include: {
          lines: true,
          contact: true,
        },
      });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.INVOICE_CREATED,
        entityType: 'INVOICE',
        entityId: invoice.id,
        newValues: {
          invoiceNumber: invoice.invoiceNumber,
          totalAmount: totalAmount.toString(),
          contactId: contact.id,
        },
      });

      return invoice;
    });
  }

  async updateInvoice(
    organizationId: string,
    invoiceId: string,
    dto: UpdateInvoiceDto,
    _orgContext: OrgContext,
    actor: Actor,
  ) {
    const existing = await this.getInvoice(organizationId, invoiceId);

    if (existing.status !== InvoiceStatus.DRAFT) {
      throw new DomainException(
        'INVOICE_INVALID_STATE',
        `Only DRAFT invoices can be edited (current status: ${existing.status})`,
      );
    }

    if (dto.contactId) {
      const contact = await this.prisma.contact.findFirst({
        where: { id: dto.contactId, organizationId },
      });
      if (!contact) {
        throw new DomainException('CONTACT_NOT_FOUND', 'Customer contact not found in this organisation');
      }
    }

    return this.prisma.transaction(async (tx) => {
      let subtotal = existing.subtotal;
      let taxTotal = existing.taxTotal;
      let totalAmount = existing.totalAmount;

      if (dto.lines && dto.lines.length > 0) {
        const calculated = this.calculateInvoiceTotals(dto.lines);
        subtotal = calculated.subtotal;
        taxTotal = calculated.taxTotal;
        totalAmount = calculated.totalAmount;

        // Delete existing lines and re-create
        await tx.invoiceLine.deleteMany({ where: { invoiceId, organizationId } });
        await tx.invoiceLine.createMany({
          data: calculated.calculatedLines.map((l, idx) => ({
            organizationId,
            invoiceId,
            lineNumber: idx + 1,
            accountId: l.accountId,
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            taxRate: l.taxRate,
            taxAmount: l.taxAmount,
            lineTotal: l.lineTotal,
          })),
        });
      }

      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          ...(dto.contactId ? { contactId: dto.contactId } : {}),
          ...(dto.issueDate ? { issueDate: parseIsoDate(dto.issueDate, 'issueDate') } : {}),
          ...(dto.dueDate ? { dueDate: parseIsoDate(dto.dueDate, 'dueDate') } : {}),
          ...(dto.reference !== undefined ? { reference: dto.reference } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
          ...(dto.terms !== undefined ? { terms: dto.terms } : {}),
          subtotal,
          taxTotal,
          totalAmount,
          updatedById: actor.userId,
        },
      });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.INVOICE_UPDATED,
        entityType: 'INVOICE',
        entityId: invoiceId,
        oldValues: existing,
        newValues: updated,
      });

      return updated;
    });
  }

  async deleteDraftInvoice(organizationId: string, invoiceId: string, actor: Actor) {
    const existing = await this.getInvoice(organizationId, invoiceId);

    if (existing.status !== InvoiceStatus.DRAFT) {
      throw new DomainException(
        'INVOICE_INVALID_STATE',
        `Only DRAFT invoices can be deleted (current status: ${existing.status})`,
      );
    }

    await this.prisma.transaction(async (tx) => {
      await tx.invoiceLine.deleteMany({ where: { invoiceId, organizationId } });
      await tx.invoice.delete({ where: { id: invoiceId } });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.INVOICE_DELETED_DRAFT,
        entityType: 'INVOICE',
        entityId: invoiceId,
        oldValues: { invoiceNumber: existing.invoiceNumber },
      });
    });

    return { success: true };
  }

  /**
   * Posts an approved invoice into the General Ledger.
   * Interfaces directly with JournalPostingService as the authoritative accounting engine entry point!
   */
  async postInvoice(organizationId: string, invoiceId: string, orgContext: OrgContext, actor: Actor) {
    const invoice = await this.getInvoice(organizationId, invoiceId);

    if (invoice.status === InvoiceStatus.POSTED) {
      throw new DomainException('INVOICE_ALREADY_POSTED', 'Invoice has already been posted to General Ledger');
    }
    if (invoice.status === InvoiceStatus.VOIDED) {
      throw new DomainException('INVOICE_INVALID_STATE', 'Cannot post a voided invoice');
    }
    if (!invoice.lines || invoice.lines.length === 0) {
      throw new DomainException('INVOICE_NO_LINES', 'Invoice has no line items to post');
    }

    // 1. Identify Accounts Receivable account (customer specific or default nominal)
    let arAccount = null;
    if (invoice.contact.receivableAccountId) {
      arAccount = await this.prisma.account.findFirst({
        where: { id: invoice.contact.receivableAccountId, organizationId, isActive: true },
      });
    }
    if (!arAccount) {
      arAccount = await this.prisma.account.findFirst({
        where: {
          organizationId,
          isActive: true,
          OR: [{ code: '1100' }, { accountSubtype: AccountSubtype.ACCOUNTS_RECEIVABLE }],
        },
      });
    }
    if (!arAccount) {
      throw new DomainException(
        'ACCOUNT_NOT_FOUND',
        'Accounts Receivable nominal account (1100) not found in organisation Chart of Accounts',
      );
    }

    // 2. Identify Tax Payable account if tax is present
    const taxTotalDec = this.money.toDecimal(invoice.taxTotal);
    let taxAccount = null;
    if (taxTotalDec.greaterThan(0)) {
      taxAccount = await this.prisma.account.findFirst({
        where: {
          organizationId,
          isActive: true,
          OR: [{ code: '2100' }, { accountSubtype: AccountSubtype.TAX_PAYABLE }],
        },
      });
      if (!taxAccount) {
        throw new DomainException(
          'ACCOUNT_NOT_FOUND',
          'Tax Payable nominal account (2100) not found in organisation Chart of Accounts',
        );
      }
    }

    // 3. Construct Double-Entry Journal Lines:
    // Debit: Accounts Receivable (full invoice total)
    // Credit: Each line's revenue account (net line amounts)
    // Credit: Tax Payable (tax total)
    const journalLines: Array<{
      accountId: string;
      description: string;
      debit: number;
      credit: number;
    }> = [];

    // Line 1: Debtors Control / Accounts Receivable (DEBIT)
    journalLines.push({
      accountId: arAccount.id,
      description: `Sales Invoice ${invoice.invoiceNumber} - ${invoice.contact.name}`,
      debit: Number(invoice.totalAmount),
      credit: 0,
    });

    // Lines 2..N: Revenue Accounts (CREDIT)
    for (const line of invoice.lines) {
      const lineSubtotal = Number(line.quantity) * Number(line.unitPrice);
      journalLines.push({
        accountId: line.accountId,
        description: line.description || `Sales: ${invoice.invoiceNumber}`,
        debit: 0,
        credit: lineSubtotal,
      });
    }

    // Line N+1: Tax Payable if applicable (CREDIT)
    if (taxTotalDec.greaterThan(0) && taxAccount) {
      journalLines.push({
        accountId: taxAccount.id,
        description: `VAT / Sales Tax on Invoice ${invoice.invoiceNumber}`,
        debit: 0,
        credit: Number(taxTotalDec),
      });
    }

    // 4. Create and validate the journal entry via JournalsService
    const issueDateStr = invoice.issueDate.toISOString().slice(0, 10);
    const draftJournal = await this.journalsService.createDraftJournal(
      organizationId,
      {
        journalType: JournalType.SALES,
        journalDate: issueDateStr,
        postingDate: issueDateStr,
        description: `Sales Invoice ${invoice.invoiceNumber} - ${invoice.contact.name}`,
        reference: invoice.reference ?? invoice.invoiceNumber,
        currency: invoice.currency,
        lines: journalLines,
      },
      orgContext,
      actor,
    );

    // 5. Run Journal Validation Engine
    const validation = await this.journalsService.validateJournal(
      organizationId,
      draftJournal.id,
      orgContext,
      actor,
    );

    if (!validation.isValid) {
      throw new DomainException(
        'POSTING_VALIDATION_FAILED',
        `Invoice journal validation failed: ${validation.errors.join('; ')}`,
      );
    }

    // 6. Post the journal entry through the Journal Posting Engine
    const postingResult = await this.postingService.postJournal(
      organizationId,
      draftJournal.id,
      orgContext,
      actor,
    );

    // 7. Update Invoice: Link to posted journal and mark POSTED
    const postedInvoice = await this.prisma.transaction(async (tx) => {
      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: InvoiceStatus.POSTED,
          journalEntryId: draftJournal.id,
          postedById: actor.userId,
          postedAt: new Date(),
          updatedById: actor.userId,
        },
        include: {
          contact: true,
          journalEntry: true,
          lines: { include: { account: true } },
        },
      });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.INVOICE_POSTED,
        entityType: 'INVOICE',
        entityId: invoiceId,
        newValues: {
          invoiceNumber: updated.invoiceNumber,
          journalNumber: postingResult.journalNumber,
          status: updated.status,
          totalAmount: updated.totalAmount.toString(),
        },
      });

      return updated;
    });

    return {
      invoice: postedInvoice,
      postingResult,
    };
  }

  /**
   * Voids a posted invoice by triggering journal reversal.
   */
  async voidInvoice(
    organizationId: string,
    invoiceId: string,
    dto: VoidInvoiceDto,
    orgContext: OrgContext,
    actor: Actor,
  ) {
    const invoice = await this.getInvoice(organizationId, invoiceId);

    if (invoice.status === InvoiceStatus.VOIDED) {
      throw new DomainException('INVOICE_ALREADY_VOIDED', 'Invoice has already been voided');
    }
    if (invoice.status !== InvoiceStatus.POSTED) {
      throw new DomainException(
        'INVOICE_CANNOT_VOID',
        `Only POSTED invoices can be voided (current status: ${invoice.status})`,
      );
    }

    if (!invoice.journalEntryId) {
      throw new DomainException('INVOICE_INVALID_STATE', 'Invoice is missing linked journal entry');
    }

    // 1. Reverse the linked journal via JournalReversalService
    const reversal = await this.reversalService.reverseJournal(
      organizationId,
      invoice.journalEntryId,
      {
        reason: dto.reason ?? `Voiding Invoice ${invoice.invoiceNumber}`,
      },
      orgContext,
      actor,
    );

    // 2. Update invoice status to VOIDED
    const voided = await this.prisma.transaction(async (tx) => {
      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: InvoiceStatus.VOIDED,
          voidReason: dto.reason ?? 'Voided by user',
          voidedById: actor.userId,
          voidedAt: new Date(),
          updatedById: actor.userId,
        },
        include: {
          contact: true,
          journalEntry: true,
        },
      });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.INVOICE_VOIDED,
        entityType: 'INVOICE',
        entityId: invoiceId,
        newValues: {
          invoiceNumber: updated.invoiceNumber,
          status: updated.status,
          reversalJournalNumber: reversal.reversalJournal.journalNumber,
          voidReason: updated.voidReason,
        },
      });

      return updated;
    });

    return {
      invoice: voided,
      reversal,
    };
  }

  private calculateInvoiceTotals(
    lines: Array<{
      accountId: string;
      description: string;
      quantity: number;
      unitPrice: number;
      taxRate?: number;
    }>,
  ) {
    let subtotal = this.money.ZERO;
    let taxTotal = this.money.ZERO;
    let totalAmount = this.money.ZERO;

    const calculatedLines = lines.map((line) => {
      const qtyDec = this.money.toDecimal(line.quantity || 1);
      const priceDec = this.money.toDecimal(line.unitPrice || 0);
      const taxRateDec = this.money.toDecimal(line.taxRate || 0);

      const lineNet = qtyDec.mul(priceDec);
      const lineTax = lineNet.mul(taxRateDec);
      const lineTotal = lineNet.add(lineTax);

      subtotal = subtotal.add(lineNet);
      taxTotal = taxTotal.add(lineTax);
      totalAmount = totalAmount.add(lineTotal);

      return {
        accountId: line.accountId,
        description: line.description,
        quantity: new Prisma.Decimal(qtyDec.toString()),
        unitPrice: new Prisma.Decimal(priceDec.toString()),
        taxRate: new Prisma.Decimal(taxRateDec.toString()),
        taxAmount: new Prisma.Decimal(lineTax.toString()),
        lineTotal: new Prisma.Decimal(lineTotal.toString()),
      };
    });

    return {
      calculatedLines,
      subtotal: new Prisma.Decimal(subtotal.toString()),
      taxTotal: new Prisma.Decimal(taxTotal.toString()),
      totalAmount: new Prisma.Decimal(totalAmount.toString()),
    };
  }

  private async allocateInvoiceNumber(tx: Tx, organizationId: string, year: number): Promise<string> {
    const sequenceKey = `INVOICE_${year}`;

    let sequence = await tx.organizationSequence.upsert({
      where: {
        organizationId_sequenceKey: {
          organizationId,
          sequenceKey,
        },
      },
      create: {
        organizationId,
        sequenceKey,
        currentValue: 1,
      },
      update: {
        currentValue: { increment: 1 },
      },
    });

    let candidateNumber = `INV-${year}-${sequence.currentValue.toString().padStart(6, '0')}`;
    let exists = await tx.invoice.findUnique({
      where: {
        organizationId_invoiceNumber: {
          organizationId,
          invoiceNumber: candidateNumber,
        },
      },
    });

    while (exists) {
      sequence = await tx.organizationSequence.update({
        where: {
          organizationId_sequenceKey: {
            organizationId,
            sequenceKey,
          },
        },
        data: {
          currentValue: { increment: 1 },
        },
      });
      candidateNumber = `INV-${year}-${sequence.currentValue.toString().padStart(6, '0')}`;
      exists = await tx.invoice.findUnique({
        where: {
          organizationId_invoiceNumber: {
            organizationId,
            invoiceNumber: candidateNumber,
          },
        },
      });
    }

    return candidateNumber;
  }
}
