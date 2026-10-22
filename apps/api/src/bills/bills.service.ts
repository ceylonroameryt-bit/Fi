import { Injectable } from '@nestjs/common';
import {
  AccountSubtype,
  BillStatus,
  ContactStatus,
  ContactType,
  JournalSourceType,
  JournalStatus,
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
import { JournalValidationService } from '../accounting-engine/journal-validation.service';
import { JournalsService } from '../journals/journals.service';
import { StorageService } from '../common/storage/storage.service';
import { addDays, parseIsoDate } from '../common/utils/dates';
import { TaxCodesService } from '../tax/tax-codes.service';
import { calculateVat } from '../tax/vat-calculation';
import { buildBillJournalLines } from './bill-journal';
import type { ApproveBillDto, BillFilterQueryDto, BillLineDto, CreateBillDto, UpdateBillDto, VoidBillDto } from './dto/bill.dto';

const billInclude = {
  contact: { select: { id: true, name: true, vatNumber: true, paymentTermsDays: true } },
  lines: {
    include: {
      account: { select: { id: true, code: true, name: true } },
      taxCode: { select: { id: true, code: true, name: true, treatment: true } },
    },
    orderBy: { lineNumber: 'asc' as const },
  },
  journalEntry: { select: { id: true, journalNumber: true, status: true, reversedByJournalId: true } },
  sourceDocument: { select: { id: true, fileName: true, mimeType: true } },
} satisfies Prisma.BillInclude;

/**
 * Supplier bills: DRAFT -> (approve) -> POSTED -> VOIDED. Approval by a person with bill.approve
 * posts Dr expense/asset per line, Dr input VAT, Cr creditors through the posting engine in one
 * transaction. Posted bills are never edited; they are voided by reversal.
 */
@Injectable()
export class BillsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly money: MoneyService,
    private readonly postingService: JournalPostingService,
    private readonly reversalService: JournalReversalService,
    private readonly validator: JournalValidationService,
    private readonly journals: JournalsService,
    private readonly taxCodes: TaxCodesService,
    private readonly storage: StorageService,
  ) {}

  list(organizationId: string, filter: BillFilterQueryDto) {
    return this.prisma.bill.findMany({
      where: { organizationId, ...(filter.status ? { status: filter.status } : {}), ...(filter.contactId ? { contactId: filter.contactId } : {}) },
      include: { contact: { select: { id: true, name: true } } },
      orderBy: [{ issueDate: 'desc' }, { billNumber: 'desc' }],
    });
  }

  async get(organizationId: string, billId: string) {
    const bill = await this.prisma.bill.findFirst({ where: { id: billId, organizationId }, include: billInclude });
    if (!bill) throw new DomainException('BILL_NOT_FOUND', 'Bill not found in this organisation');

    const allocations = await this.prisma.paymentAllocation.findMany({
      where: { billId, organizationId, isReversed: false },
      include: {
        payment: {
          select: {
            id: true,
            paymentDate: true,
            reference: true,
            kind: true,
            amount: true,
          },
        },
        creditNote: {
          select: {
            id: true,
            creditNoteNumber: true,
            issueDate: true,
            totalAmount: true,
          },
        },
      },
      orderBy: { allocationDate: 'desc' },
    });

    const totalDec = new Prisma.Decimal(bill.totalAmount.toString());
    const paidDec = new Prisma.Decimal(bill.amountPaid.toString());
    const amountDue = Prisma.Decimal.max(new Prisma.Decimal('0'), totalDec.sub(paidDec));

    return {
      ...bill,
      allocations,
      amountDue,
      warnings: await this.duplicateWarnings(this.prisma, bill),
    };
  }

  async create(organizationId: string, dto: CreateBillDto, orgContext: OrgContext, actor: Actor, tx?: Tx) {
    const run = async (client: Tx) => {
      const contact = await this.supplier(client, organizationId, dto.contactId);
      const issueDate = parseIsoDate(dto.issueDate, 'issueDate');
      // Due date: as stated, otherwise from the supplier's agreed payment terms.
      const dueDate = dto.dueDate ? parseIsoDate(dto.dueDate, 'dueDate') : addDays(issueDate, contact.paymentTermsDays);
      if (dueDate < issueDate) throw new DomainException('VALIDATION_FAILED', 'dueDate cannot be before issueDate');
      const currency = dto.currency ?? orgContext.baseCurrency;
      if (currency !== orgContext.baseCurrency) {
        throw new DomainException('UNSUPPORTED_CURRENCY', `Only ${orgContext.baseCurrency} bills are supported`);
      }
      if (dto.sourceDocumentId) {
        const doc = await client.aiDocument.findFirst({ where: { id: dto.sourceDocumentId, organizationId }, select: { id: true } });
        if (!doc) throw new DomainException('NOT_FOUND', 'Source document not found in this organisation');
      }
      const totals = await this.calculate(dto.lines, issueDate);
      const billNumber = await this.allocateBillNumber(client, organizationId, issueDate.getUTCFullYear());

      const bill = await client.bill.create({
        data: {
          organizationId,
          contactId: contact.id,
          billNumber,
          supplierInvoiceNumber: dto.supplierInvoiceNumber,
          issueDate,
          dueDate,
          currency,
          subtotal: totals.subtotal,
          taxTotal: totals.taxTotal,
          totalAmount: totals.total,
          notes: dto.notes,
          sourceDocumentId: dto.sourceDocumentId,
          createdById: actor.userId!,
          // organizationId on lines comes from the composite (organizationId, billId) relation.
          lines: { create: totals.lines },
        },
        include: billInclude,
      });
      await this.audit.record(client, actor, {
        organizationId,
        eventType: AuditEvents.BILL_CREATED,
        entityType: 'BILL',
        entityId: bill.id,
        newValues: { billNumber, supplierInvoiceNumber: bill.supplierInvoiceNumber, total: bill.totalAmount.toString(), sourceDocumentId: bill.sourceDocumentId },
      });
      return { ...bill, warnings: await this.duplicateWarnings(client, bill) };
    };
    return tx ? run(tx) : this.prisma.transaction(run);
  }

  async update(organizationId: string, billId: string, dto: UpdateBillDto, actor: Actor) {
    return this.prisma.transaction(async (tx) => {
      const bill = await this.lockDraft(tx, organizationId, billId);
      const issueDate = dto.issueDate ? parseIsoDate(dto.issueDate, 'issueDate') : bill.issueDate;
      const dueDate = dto.dueDate ? parseIsoDate(dto.dueDate, 'dueDate') : bill.dueDate;
      if (dueDate < issueDate) throw new DomainException('VALIDATION_FAILED', 'dueDate cannot be before issueDate');
      const data: Prisma.BillUpdateInput = {
        supplierInvoiceNumber: dto.supplierInvoiceNumber,
        issueDate,
        dueDate,
        notes: dto.notes,
        updatedById: actor.userId,
      };
      if (dto.lines) {
        const totals = await this.calculate(dto.lines, issueDate);
        await tx.billLine.deleteMany({ where: { billId, organizationId } });
        await tx.billLine.createMany({ data: totals.lines.map((l) => ({ organizationId, billId, ...l })) });
        Object.assign(data, { subtotal: totals.subtotal, taxTotal: totals.taxTotal, totalAmount: totals.total });
      }
      const updated = await tx.bill.update({ where: { id: billId }, data, include: billInclude });
      await this.audit.record(tx, actor, { organizationId, eventType: AuditEvents.BILL_UPDATED, entityType: 'BILL', entityId: billId });
      return { ...updated, warnings: await this.duplicateWarnings(tx, updated) };
    });
  }

  async remove(organizationId: string, billId: string, actor: Actor) {
    return this.prisma.transaction(async (tx) => {
      const bill = await this.lockDraft(tx, organizationId, billId);
      await tx.bill.delete({ where: { id: bill.id } });
      await this.audit.record(tx, actor, { organizationId, eventType: AuditEvents.BILL_DELETED, entityType: 'BILL', entityId: billId, oldValues: { billNumber: bill.billNumber } });
      return { success: true };
    });
  }

  /** Approval posts the bill: Dr expense/asset, Dr input VAT, Cr creditors, all through the posting engine. */
  async approve(organizationId: string, billId: string, dto: ApproveBillDto, orgContext: OrgContext, actor: Actor) {
    this.postingService.checkPostingPermission(orgContext);
    return this.prisma.transaction(async (tx) => {
      const bill = await this.lockDraft(tx, organizationId, billId);
      const full = await tx.bill.findFirstOrThrow({ where: { id: bill.id }, include: { ...billInclude, contact: true } });

      const uncoded = full.lines.filter((l) => !l.taxCodeId || !l.taxCode).map((l) => l.lineNumber);
      if (uncoded.length > 0) {
        throw new DomainException('TAX_CODE_REQUIRED', `Every line needs a tax code before approval (lines ${uncoded.join(', ')})`, { lineNumbers: uncoded });
      }
      const duplicates = await this.duplicateWarnings(tx, full);
      if (duplicates.length > 0 && !dto.duplicateOverrideReason) {
        throw new DomainException('BILL_DUPLICATE', duplicates[0], { duplicates });
      }

      const creditors = await this.creditorsAccount(tx, organizationId, full.contact.payableAccountId);
      const vatAccount = await tx.account.findFirst({
        where: { organizationId, isActive: true, accountSubtype: AccountSubtype.TAX_PAYABLE },
        orderBy: { code: 'asc' },
      });
      const label = `Bill ${full.billNumber} – ${full.contact.name} ${full.supplierInvoiceNumber}`;
      const journalLines = buildBillJournalLines(this.money, {
        lines: full.lines.map((l) => ({
          accountId: l.accountId,
          description: l.description,
          net: this.money.toDecimal(l.netAmount),
          vatCharged: this.money.toDecimal(l.taxAmount),
          taxCodeId: l.taxCodeId!,
          treatment: l.taxCode!.treatment,
          rate: this.money.toDecimal(l.taxRate),
        })),
        vatAccountId: vatAccount?.id ?? null,
        creditorsAccountId: creditors.id,
        contactId: full.contactId,
        label: label.slice(0, 255),
      });

      const now = new Date();
      await tx.bill.update({ where: { id: full.id }, data: { status: BillStatus.APPROVED, approvedById: actor.userId, approvedAt: now } });
      const journalNumber = await this.journals.allocateJournalNumber(tx, organizationId, full.issueDate.getUTCFullYear());
      const journal = await tx.journalEntry.create({
        data: {
          organizationId,
          journalNumber,
          journalType: JournalType.PURCHASE,
          journalDate: full.issueDate,
          postingDate: full.issueDate,
          description: label.slice(0, 500),
          reference: full.supplierInvoiceNumber.slice(0, 100),
          sourceType: JournalSourceType.BILL,
          sourceId: full.id,
          currency: full.currency,
          status: JournalStatus.DRAFT,
          createdById: actor.userId!,
          lines: {
            create: journalLines.map((l, i) => ({
              lineNumber: i + 1,
              accountId: l.accountId,
              description: l.description.slice(0, 255),
              debit: l.debit,
              credit: l.credit,
              currency: full.currency,
              contactId: l.contactId ?? null,
              ...(l.taxCodeId ? { taxCodeId: l.taxCodeId, taxDirection: l.taxDirection, taxNetAmount: l.taxNetAmount, taxAmount: l.taxAmount } : {}),
            })),
          },
        },
      });

      const validation = await this.validator.validateJournal(journal.id, orgContext, tx);
      if (!validation.isValid) {
        throw new DomainException('POSTING_VALIDATION_FAILED', `Bill journal validation failed: ${validation.errors.join('; ')}`, { errors: validation.errors });
      }
      await tx.journalEntry.update({
        where: { id: journal.id },
        data: { status: JournalStatus.VALIDATED, periodId: validation.periodId, validatedById: actor.userId, validatedAt: now },
      });
      const postingResult = await this.postingService.postJournal(organizationId, journal.id, orgContext, actor, tx);

      const posted = await tx.bill.update({
        where: { id: full.id },
        data: { status: BillStatus.POSTED, journalEntryId: journal.id, postedById: actor.userId, postedAt: new Date(), updatedById: actor.userId },
        include: billInclude,
      });
      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.BILL_POSTED,
        entityType: 'BILL',
        entityId: full.id,
        newValues: {
          billNumber: full.billNumber,
          journalNumber: postingResult.journalNumber,
          total: full.totalAmount.toString(),
          ...(dto.duplicateOverrideReason ? { duplicateOverrideReason: dto.duplicateOverrideReason, duplicates } : {}),
        },
      });
      return { bill: posted, postingResult };
    });
  }

  async void(organizationId: string, billId: string, dto: VoidBillDto, orgContext: OrgContext, actor: Actor) {
    this.reversalService.validateReversalPermission(orgContext);
    return this.prisma.transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM bills WHERE id = ${billId}::uuid AND organization_id = ${organizationId}::uuid FOR UPDATE`;
      const bill = await tx.bill.findFirst({ where: { id: billId, organizationId } });
      if (!bill) throw new DomainException('BILL_NOT_FOUND', 'Bill not found in this organisation');
      if (bill.status !== BillStatus.POSTED || !bill.journalEntryId) {
        throw new DomainException('BILL_INVALID_STATE', `Only posted bills can be voided (status ${bill.status})`);
      }
      const allocated = await tx.paymentAllocation.count({ where: { organizationId, billId, isReversed: false } });
      if (allocated > 0) {
        throw new DomainException('DOCUMENT_HAS_ALLOCATIONS', `Bill ${bill.billNumber} has ${allocated} payment or credit allocation(s); reverse them before voiding`);
      }
      const reversal = await this.reversalService.reverseJournal(
        organizationId,
        bill.journalEntryId,
        { reason: dto.reason ?? `Voiding bill ${bill.billNumber}` },
        orgContext,
        actor,
        tx,
      );
      const voided = await tx.bill.update({
        where: { id: billId },
        data: { status: BillStatus.VOIDED, voidReason: dto.reason ?? 'Voided by user', voidedById: actor.userId, voidedAt: new Date() },
        include: billInclude,
      });
      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.BILL_VOIDED,
        entityType: 'BILL',
        entityId: billId,
        newValues: { reversalJournalNumber: reversal.reversalJournal.journalNumber, reason: voided.voidReason },
      });
      return { bill: voided, reversal };
    });
  }

  /** The source document file attached to a bill. */
  async attachment(organizationId: string, billId: string) {
    const bill = await this.prisma.bill.findFirst({
      where: { id: billId, organizationId },
      include: { sourceDocument: { select: { fileKey: true, fileName: true, mimeType: true } } },
    });
    if (!bill) throw new DomainException('BILL_NOT_FOUND', 'Bill not found in this organisation');
    if (!bill.sourceDocument) throw new DomainException('NOT_FOUND', 'This bill has no attached document');
    const file = await this.storage.getObject(bill.sourceDocument.fileKey);
    return { body: file.body, fileName: bill.sourceDocument.fileName, mimeType: bill.sourceDocument.mimeType };
  }

  // --- helpers ---

  private async supplier(client: Tx, organizationId: string, contactId: string) {
    const contact = await client.contact.findFirst({ where: { id: contactId, organizationId } });
    if (!contact) throw new DomainException('CONTACT_NOT_FOUND', 'Supplier not found in this organisation');
    if (contact.status === ContactStatus.ARCHIVED) throw new DomainException('CONTACT_ARCHIVED', 'Cannot bill an archived supplier');
    if (contact.type !== ContactType.SUPPLIER && contact.type !== ContactType.BOTH) {
      throw new DomainException('CONTACT_NOT_SUPPLIER', 'Contact is not configured as a supplier');
    }
    return contact;
  }

  private async lockDraft(tx: Tx, organizationId: string, billId: string) {
    await tx.$queryRaw`SELECT id FROM bills WHERE id = ${billId}::uuid AND organization_id = ${organizationId}::uuid FOR UPDATE`;
    const bill = await tx.bill.findFirst({ where: { id: billId, organizationId } });
    if (!bill) throw new DomainException('BILL_NOT_FOUND', 'Bill not found in this organisation');
    if (bill.status !== BillStatus.DRAFT) {
      throw new DomainException('BILL_INVALID_STATE', `Only draft bills can be changed (status ${bill.status})`);
    }
    return bill;
  }

  private async creditorsAccount(tx: Tx, organizationId: string, preferredId: string | null) {
    if (preferredId) {
      const preferred = await tx.account.findFirst({ where: { id: preferredId, organizationId, isActive: true } });
      if (preferred) return preferred;
    }
    const candidates = await tx.account.findMany({
      where: { organizationId, isActive: true, accountSubtype: AccountSubtype.ACCOUNTS_PAYABLE },
      orderBy: { code: 'asc' },
    });
    if (candidates.length === 0) throw new DomainException('ACCOUNT_NOT_FOUND', 'No creditors control account (subtype ACCOUNTS_PAYABLE)');
    return candidates[0];
  }

  /** Other non-voided bills from the same supplier with the same invoice number. */
  private async duplicateWarnings(client: Tx | PrismaService, bill: { id: string; organizationId: string; contactId: string; supplierInvoiceNumber: string }) {
    const others = await client.bill.findMany({
      where: {
        organizationId: bill.organizationId,
        contactId: bill.contactId,
        id: { not: bill.id },
        status: { not: BillStatus.VOIDED },
        supplierInvoiceNumber: { equals: bill.supplierInvoiceNumber, mode: 'insensitive' },
      },
      select: { billNumber: true, status: true },
    });
    return others.map((o) => `Possible duplicate: ${o.billNumber} (${o.status}) has the same supplier invoice number ${bill.supplierInvoiceNumber}`);
  }

  /** Net per line to the penny; VAT via the shared calculateVat with the code's rate on the issue date. */
  private async calculate(lines: BillLineDto[], issueDate: Date) {
    const prepared = await Promise.all(
      lines.map(async (l, i) => {
        const hasQty = l.quantity !== undefined && l.unitPrice !== undefined;
        if (!hasQty && l.netAmount === undefined) {
          throw new DomainException('VALIDATION_FAILED', `Line ${i + 1}: give quantity and unitPrice, or netAmount`);
        }
        const quantity = hasQty ? this.money.round(l.quantity!, 4) : null;
        const unitPrice = hasQty ? this.money.round(l.unitPrice!, 4) : null;
        const fromQty = hasQty ? this.money.round(quantity!.mul(unitPrice!), 2) : null;
        const printed = l.netAmount !== undefined ? this.money.round(l.netAmount, 2) : null;
        if (fromQty && printed && !fromQty.equals(printed)) {
          throw new DomainException('VALIDATION_FAILED', `Line ${i + 1}: ${quantity} x ${unitPrice} = ${fromQty.toFixed(2)}, not ${printed.toFixed(2)}`);
        }
        const net = (printed ?? fromQty)!;
        const code = l.taxCodeId ? await this.taxCodes.resolve(l.taxCodeId, issueDate) : null;
        return { l, quantity, unitPrice, net, code };
      }),
    );
    // Lines without a tax code carry no VAT until coded (approval requires a code).
    const vat = calculateVat(this.money, {
      lines: prepared.map((p) => ({ amount: p.net, rate: p.code?.rate ?? 0, treatment: p.code?.treatment ?? 'OUTSIDE_SCOPE' })),
      amountMode: 'NET',
      rounding: 'LINE',
    });
    return {
      lines: prepared.map((p, i) => ({
        lineNumber: i + 1,
        accountId: p.l.accountId,
        description: p.l.description,
        quantity: p.quantity,
        unitPrice: p.unitPrice,
        netAmount: vat.lines[i].net,
        taxCodeId: p.code?.id ?? null,
        taxRate: p.code?.rate ?? new Prisma.Decimal(0),
        taxAmount: vat.lines[i].vat,
        lineTotal: vat.lines[i].gross,
      })),
      subtotal: vat.totalNet,
      taxTotal: vat.totalVat,
      total: vat.totalGross,
    };
  }

  private async allocateBillNumber(tx: Tx, organizationId: string, year: number): Promise<string> {
    const sequenceKey = `BILL_${year}`;
    const sequence = await tx.organizationSequence.upsert({
      where: { organizationId_sequenceKey: { organizationId, sequenceKey } },
      create: { organizationId, sequenceKey, currentValue: 1 },
      update: { currentValue: { increment: 1 } },
    });
    return `BILL-${year}-${sequence.currentValue.toString().padStart(6, '0')}`;
  }
}
