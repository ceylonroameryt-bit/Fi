import { Injectable } from '@nestjs/common';
import {
  AccountSubtype,
  AllocationSourceType,
  AllocationTargetType,
  BillStatus,
  ContactType,
  CreditNoteKind,
  CreditNoteStatus,
  InvoiceStatus,
  JournalSourceType,
  JournalStatus,
  JournalType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { JournalsService } from '../journals/journals.service';
import { JournalValidationService } from '../accounting-engine/journal-validation.service';
import { JournalPostingService } from '../accounting-engine/journal-posting.service';
import { JournalReversalService } from '../accounting-engine/journal-reversal.service';
import { MoneyService } from '../accounting-engine/money.service';
import { AuditService } from '../audit/audit.service';
import { AuditEvents } from '../audit/audit-events';
import { DomainException } from '../common/errors/domain.exception';
import type { Actor, OrgContext } from '../common/types/request-context.types';
import { CreateCreditNoteDto } from './dto/create-credit-note.dto';
import { AllocateCreditNoteDto } from './dto/allocate-credit-note.dto';
import { CreditNoteFilterQueryDto } from './dto/credit-note-query.dto';
import { VoidCreditNoteDto } from './dto/void-credit-note.dto';
import { TaxCodesService } from '../tax/tax-codes.service';
import { calculateVat } from '../tax/vat-calculation';
import { INPUT_ONLY_TREATMENTS } from '../tax/vat-boxes';
import { buildCreditNoteJournalLines } from './credit-note-journal';
import { allocationAmount, assertAllocationTargets, creditNoteTarget, lockRows } from '../payments/allocation-rules';

const creditNoteInclude = {
  contact: {
    select: {
      id: true,
      name: true,
      type: true,
      email: true,
      companyName: true,
    },
  },
  lines: {
    include: {
      account: { select: { id: true, code: true, name: true, accountType: true } },
      taxCode: { select: { id: true, code: true, name: true, treatment: true } },
    },
    orderBy: { lineNumber: 'asc' as const },
  },
  journalEntry: {
    select: {
      id: true,
      journalNumber: true,
      status: true,
      postingDate: true,
    },
  },
  allocations: {
    where: { isReversed: false },
    orderBy: { createdAt: 'desc' as const },
  },
} as const;

@Injectable()
export class CreditNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journalsService: JournalsService,
    private readonly validator: JournalValidationService,
    private readonly posting: JournalPostingService,
    private readonly reversal: JournalReversalService,
    private readonly money: MoneyService,
    private readonly audit: AuditService,
    private readonly taxCodes: TaxCodesService,
  ) {}

  async listCreditNotes(organizationId: string, query: CreditNoteFilterQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Prisma.CreditNoteWhereInput = {
      organizationId,
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.contactId ? { contactId: query.contactId } : {}),
      ...(query.startDate || query.endDate
        ? {
            issueDate: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.creditNote.findMany({
        where,
        include: creditNoteInclude,
        orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.creditNote.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getCreditNote(organizationId: string, creditNoteId: string) {
    const creditNote = await this.prisma.creditNote.findFirst({
      where: { id: creditNoteId, organizationId },
      include: creditNoteInclude,
    });

    if (!creditNote) {
      throw new DomainException('CREDIT_NOTE_NOT_FOUND', 'Credit note not found in this organisation');
    }

    // Attach enriched invoice/bill info for allocations
    const invoiceIds = creditNote.allocations
      .map((a) => a.invoiceId)
      .filter((id): id is string => Boolean(id));
    const billIds = creditNote.allocations
      .map((a) => a.billId)
      .filter((id): id is string => Boolean(id));

    const [invoices, bills] = await Promise.all([
      invoiceIds.length > 0
        ? this.prisma.invoice.findMany({
            where: { id: { in: invoiceIds }, organizationId },
            select: { id: true, invoiceNumber: true, totalAmount: true, amountPaid: true },
          })
        : [],
      billIds.length > 0
        ? this.prisma.bill.findMany({
            where: { id: { in: billIds }, organizationId },
            select: { id: true, billNumber: true, totalAmount: true, amountPaid: true },
          })
        : [],
    ]);

    const invoiceMap = new Map(invoices.map((inv) => [inv.id, inv]));
    const billMap = new Map(bills.map((b) => [b.id, b]));

    const enrichedAllocations = creditNote.allocations.map((a) => ({
      ...a,
      invoice: a.invoiceId ? invoiceMap.get(a.invoiceId) ?? null : null,
      bill: a.billId ? billMap.get(a.billId) ?? null : null,
    }));

    const totalDec = new Prisma.Decimal(creditNote.totalAmount.toString());
    const allocatedDec = new Prisma.Decimal(creditNote.amountAllocated.toString());
    const availableBalance = Prisma.Decimal.max(new Prisma.Decimal('0'), totalDec.sub(allocatedDec));

    return {
      ...creditNote,
      allocations: enrichedAllocations,
      availableBalance,
    };
  }

  async createCreditNote(
    organizationId: string,
    dto: CreateCreditNoteDto,
    orgContext: OrgContext,
    actor: Actor,
  ) {
    const issueDate = new Date(dto.issueDate);
    if (isNaN(issueDate.getTime())) {
      throw new DomainException('INVALID_DATE', 'Invalid credit note date format');
    }

    if (!dto.lines || dto.lines.length === 0) {
      throw new DomainException('CREDIT_NOTE_NO_LINES', 'Credit note must have at least one line item');
    }

    return this.prisma.$transaction(async (tx) => {
      const contact = await tx.contact.findFirst({
        where: { id: dto.contactId, organizationId },
      });
      if (!contact) {
        throw new DomainException('CONTACT_NOT_FOUND', 'Contact not found in this organisation');
      }

      const sales = dto.kind === CreditNoteKind.SALES_CREDIT_NOTE;
      if (sales ? contact.type === ContactType.SUPPLIER : contact.type === ContactType.CUSTOMER) {
        throw new DomainException('CONTACT_TYPE_MISMATCH', sales ? 'A sales credit note needs a customer' : 'A supplier credit note needs a supplier');
      }
      const currency = dto.currency ?? orgContext.baseCurrency;
      if (currency !== orgContext.baseCurrency) {
        throw new DomainException('UNSUPPORTED_CURRENCY', `Only ${orgContext.baseCurrency} credit notes are supported`);
      }
      if (sales ? dto.relatedBillId : dto.relatedInvoiceId) {
        throw new DomainException('VALIDATION_FAILED', sales ? 'A sales credit note can only relate to an invoice' : 'A supplier credit note can only relate to a bill');
      }

      // Net per line to the penny; VAT only from the line's tax code (rate in force on the issue
      // date) via the shared calculateVat. Lines without a code carry no VAT and block posting.
      const prepared = await Promise.all(
        dto.lines.map(async (l, i) => {
          const net = this.money.round(l.netAmount, 2);
          if (net.lessThanOrEqualTo(0)) throw new DomainException('VALIDATION_FAILED', `Line ${i + 1}: net amount must be positive`);
          const code = l.taxCodeId ? await this.taxCodes.resolve(l.taxCodeId, issueDate) : null;
          if (code && sales && INPUT_ONLY_TREATMENTS.has(code.treatment)) {
            throw new DomainException('VALIDATION_FAILED', `Line ${i + 1}: tax code ${code.code} can only be used on purchases`);
          }
          const account = await tx.account.findFirst({ where: { id: l.accountId, organizationId, isActive: true }, select: { id: true } });
          if (!account) throw new DomainException('ACCOUNT_NOT_FOUND', `Line ${i + 1}: account not found in this organisation`);
          return { l, net, code };
        }),
      );
      const vat = calculateVat(this.money, {
        lines: prepared.map((p) => ({ amount: p.net, rate: p.code?.rate ?? 0, treatment: p.code?.treatment ?? 'OUTSIDE_SCOPE' })),
        amountMode: 'NET',
        rounding: 'LINE',
      });
      const linesData = prepared.map((p, i) => ({
        lineNumber: i + 1,
        accountId: p.l.accountId,
        description: p.l.description,
        quantity: p.l.quantity !== undefined ? this.money.round(p.l.quantity, 4) : new Prisma.Decimal(1),
        unitPrice: p.l.unitPrice !== undefined ? this.money.round(p.l.unitPrice, 4) : vat.lines[i].net,
        netAmount: vat.lines[i].net,
        taxCodeId: p.code?.id ?? null,
        taxRate: p.code?.rate ?? new Prisma.Decimal(0),
        taxAmount: vat.lines[i].vat,
        lineTotal: vat.lines[i].gross,
      }));
      const subtotalDec = vat.totalNet;
      const taxTotalDec = vat.totalVat;
      const totalAmountDec = vat.totalGross;

      // A credit note against a document can't credit more than is left of it.
      const relatedId = sales ? dto.relatedInvoiceId : dto.relatedBillId;
      if (relatedId) {
        const original = sales
          ? await tx.invoice.findFirst({ where: { id: relatedId, organizationId }, select: { contactId: true, totalAmount: true, status: true } })
          : await tx.bill.findFirst({ where: { id: relatedId, organizationId }, select: { contactId: true, totalAmount: true, status: true } });
        if (!original) throw new DomainException('NOT_FOUND', `The ${sales ? 'invoice' : 'bill'} being credited was not found`);
        if (original.contactId !== contact.id) throw new DomainException('CONTACT_MISMATCH', `The ${sales ? 'invoice' : 'bill'} belongs to another contact`);
        if (original.status === 'DRAFT' || original.status === 'VOIDED') {
          throw new DomainException('VALIDATION_FAILED', `Only a posted ${sales ? 'invoice' : 'bill'} can be credited (status ${original.status})`);
        }
        const earlier = await tx.creditNote.aggregate({
          where: { organizationId, status: { not: CreditNoteStatus.VOIDED }, ...(sales ? { relatedInvoiceId: relatedId } : { relatedBillId: relatedId }) },
          _sum: { totalAmount: true },
        });
        const remaining = original.totalAmount.sub(earlier._sum.totalAmount ?? 0);
        if (totalAmountDec.greaterThan(remaining)) {
          throw new DomainException('OVER_CREDIT', `Credit of ${totalAmountDec.toFixed(2)} exceeds the ${remaining.toFixed(2)} not yet credited on that ${sales ? 'invoice' : 'bill'}`);
        }
      }

      // Generate sequence number
      const year = issueDate.getUTCFullYear();
      const prefix = dto.kind === CreditNoteKind.SALES_CREDIT_NOTE ? 'SCN' : 'PCN';
      const seqKey = `CREDIT_NOTE_${prefix}_${year}`;

      const seq = await tx.organizationSequence.upsert({
        where: { organizationId_sequenceKey: { organizationId, sequenceKey: seqKey } },
        create: { organizationId, sequenceKey: seqKey, currentValue: 1 },
        update: { currentValue: { increment: 1 } },
      });

      const creditNoteNumber = `${prefix}-${year}-${seq.currentValue.toString().padStart(6, '0')}`;

      const creditNote = await tx.creditNote.create({
        data: {
          organizationId,
          kind: dto.kind,
          contactId: contact.id,
          creditNoteNumber,
          reference: dto.reference ?? null,
          issueDate,
          currency,
          subtotal: subtotalDec,
          taxTotal: taxTotalDec,
          totalAmount: totalAmountDec,
          amountAllocated: new Prisma.Decimal('0'),
          status: CreditNoteStatus.DRAFT,
          relatedInvoiceId: dto.relatedInvoiceId ?? null,
          relatedBillId: dto.relatedBillId ?? null,
          notes: dto.notes ?? null,
          createdById: actor.userId!,
          lines: {
            // organizationId on lines comes from the composite (organizationId, creditNoteId) relation.
            create: linesData,
          },
        },
        include: creditNoteInclude,
      });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.CREDIT_NOTE_CREATED,
        entityType: 'credit_note',
        entityId: creditNote.id,
        newValues: {
          creditNoteNumber,
          kind: creditNote.kind,
          totalAmount: creditNote.totalAmount.toString(),
        },
      });

      return creditNote;
    });
  }

  async postCreditNote(
    organizationId: string,
    creditNoteId: string,
    orgContext: OrgContext,
    actor: Actor,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const creditNote = await tx.creditNote.findFirst({
        where: { id: creditNoteId, organizationId },
        include: {
          contact: true,
          lines: { include: { taxCode: true } },
        },
      });

      if (!creditNote) {
        throw new DomainException('CREDIT_NOTE_NOT_FOUND', 'Credit note not found in this organisation');
      }

      if (creditNote.status === CreditNoteStatus.POSTED) {
        throw new DomainException('CREDIT_NOTE_ALREADY_POSTED', 'Credit note is already posted to General Ledger');
      }
      if (creditNote.status === CreditNoteStatus.VOIDED) {
        throw new DomainException('CREDIT_NOTE_ALREADY_VOIDED', 'Cannot post a voided credit note');
      }

      const isSales = creditNote.kind === CreditNoteKind.SALES_CREDIT_NOTE;

      // Identify control accounts
      let controlAccount = null;

      if (isSales) {
        // Trade Debtors
        if (creditNote.contact.receivableAccountId) {
          controlAccount = await tx.account.findFirst({
            where: { id: creditNote.contact.receivableAccountId, organizationId, isActive: true },
          });
        }
        if (!controlAccount) {
          controlAccount = await tx.account.findFirst({
            where: {
              organizationId,
              isActive: true,
              OR: [{ code: '1100' }, { accountSubtype: AccountSubtype.ACCOUNTS_RECEIVABLE }],
            },
          });
        }
      } else {
        // Trade Creditors
        if (creditNote.contact.payableAccountId) {
          controlAccount = await tx.account.findFirst({
            where: { id: creditNote.contact.payableAccountId, organizationId, isActive: true },
          });
        }
        if (!controlAccount) {
          controlAccount = await tx.account.findFirst({
            where: {
              organizationId,
              isActive: true,
              OR: [{ code: '2000' }, { accountSubtype: AccountSubtype.ACCOUNTS_PAYABLE }],
            },
          });
        }
      }

      if (!controlAccount) {
        throw new DomainException(
          'ACCOUNT_NOT_FOUND',
          isSales
            ? 'Accounts Receivable account (1100) not found in Chart of Accounts'
            : 'Accounts Payable account (2000) not found in Chart of Accounts',
        );
      }

      // Missing tax codes block posting – never assume a default rate.
      const uncoded = creditNote.lines.filter((l) => !l.taxCodeId || !l.taxCode).map((l) => l.lineNumber);
      if (uncoded.length > 0) {
        throw new DomainException('TAX_CODE_REQUIRED', `Every line needs a tax code before posting (lines ${uncoded.join(', ')})`, { lineNumbers: uncoded });
      }
      const vatAccount = await tx.account.findFirst({
        where: { organizationId, isActive: true, accountSubtype: AccountSubtype.TAX_PAYABLE },
        orderBy: { code: 'asc' },
      });
      const label = `Credit Note ${creditNote.creditNoteNumber} - ${creditNote.contact.name}`.slice(0, 255);
      const journalLines = buildCreditNoteJournalLines(this.money, {
        sales: isSales,
        lines: creditNote.lines.map((l) => ({
          accountId: l.accountId,
          description: (l.description || label).slice(0, 255),
          net: l.netAmount,
          vat: l.taxAmount,
          taxCodeId: l.taxCodeId!,
          treatment: l.taxCode!.treatment,
          rate: l.taxRate,
        })),
        vatAccountId: vatAccount?.id ?? null,
        controlAccountId: controlAccount.id,
        contactId: creditNote.contactId,
        label,
      });

      // Allocate journal number
      const year = creditNote.issueDate.getUTCFullYear();
      const journalNumber = await this.journalsService.allocateJournalNumber(
        tx,
        organizationId,
        year,
      );

      const currency = creditNote.currency;

      const draftJournal = await tx.journalEntry.create({
        data: {
          organizationId,
          journalNumber,
          journalType: JournalType.CREDIT_NOTE,
          journalDate: creditNote.issueDate,
          postingDate: creditNote.issueDate,
          description: `Credit Note ${creditNote.creditNoteNumber} - ${creditNote.contact.name}`,
          reference: creditNote.reference ?? creditNote.creditNoteNumber,
          sourceType: JournalSourceType.CREDIT_NOTE,
          currency,
          status: JournalStatus.DRAFT,
          createdById: actor.userId!,
          lines: {
            create: journalLines.map((l, idx) => ({
              lineNumber: idx + 1,
              accountId: l.accountId,
              description: l.description,
              debit: l.debit,
              credit: l.credit,
              currency,
              contactId: l.contactId ?? null,
              ...(l.taxCodeId ? { taxCodeId: l.taxCodeId, taxDirection: l.taxDirection, taxNetAmount: l.taxNetAmount, taxAmount: l.taxAmount } : {}),
            })),
          },
        },
      });

      const validation = await this.validator.validateJournal(
        draftJournal.id,
        orgContext,
        tx,
      );
      if (!validation.isValid) {
        throw new DomainException(
          'POSTING_VALIDATION_FAILED',
          `Credit note journal validation failed: ${validation.errors.join('; ')}`,
        );
      }

      await tx.journalEntry.update({
        where: { id: draftJournal.id },
        data: {
          status: JournalStatus.VALIDATED,
          periodId: validation.periodId,
          validatedById: actor.userId,
          validatedAt: new Date(),
          updatedById: actor.userId,
        },
      });

      await this.posting.postJournal(
        organizationId,
        draftJournal.id,
        orgContext,
        actor,
        tx,
      );

      const updatedCreditNote = await tx.creditNote.update({
        where: { id: creditNote.id },
        data: {
          status: CreditNoteStatus.POSTED,
          journalEntryId: draftJournal.id,
          postedById: actor.userId,
          postedAt: new Date(),
          updatedById: actor.userId,
        },
        include: creditNoteInclude,
      });

      await tx.journalEntry.update({
        where: { id: draftJournal.id },
        data: { sourceId: creditNote.id },
      });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.CREDIT_NOTE_POSTED,
        entityType: 'credit_note',
        entityId: creditNote.id,
        newValues: {
          creditNoteNumber: creditNote.creditNoteNumber,
          journalEntryId: draftJournal.id,
        },
      });

      return updatedCreditNote;
    });
  }

  async allocateCreditNote(
    organizationId: string,
    creditNoteId: string,
    dto: AllocateCreditNoteDto,
    actor: Actor,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await lockRows(tx, 'credit_notes', organizationId, [creditNoteId]);
      const creditNote = await tx.creditNote.findFirst({
        where: { id: creditNoteId, organizationId },
      });

      if (!creditNote) {
        throw new DomainException('CREDIT_NOTE_NOT_FOUND', 'Credit note not found in this organisation');
      }

      if (creditNote.status !== CreditNoteStatus.POSTED) {
        throw new DomainException(
          'CREDIT_NOTE_INVALID_STATE',
          'Only POSTED credit notes can be allocated to open invoices or bills',
        );
      }

      assertAllocationTargets(creditNoteTarget(creditNote.kind), dto.allocations, creditNote.kind === CreditNoteKind.SALES_CREDIT_NOTE ? 'sales credit note' : 'supplier credit note');
      await lockRows(tx, 'invoices', organizationId, dto.allocations.flatMap((a) => (a.invoiceId ? [a.invoiceId] : [])));
      await lockRows(tx, 'bills', organizationId, dto.allocations.flatMap((a) => (a.billId ? [a.billId] : [])));

      let currentAllocated = creditNote.amountAllocated;
      const totalAmount = creditNote.totalAmount;

      for (const item of dto.allocations) {
        const itemAmountDec = allocationAmount(item.amount);
        const unallocatedBalance = totalAmount.sub(currentAllocated);

        if (itemAmountDec.greaterThan(unallocatedBalance)) {
          throw new DomainException(
            'OVER_ALLOCATION',
            `Cannot allocate ${itemAmountDec.toString()} exceeding credit note available balance of ${unallocatedBalance.toString()}`,
          );
        }

        if (item.invoiceId) {
          const invoice = await tx.invoice.findFirst({
            where: { id: item.invoiceId, organizationId },
          });
          if (!invoice) {
            throw new DomainException('INVOICE_NOT_FOUND', `Invoice ${item.invoiceId} not found`);
          }
          if (invoice.contactId !== creditNote.contactId) {
            throw new DomainException('CONTACT_MISMATCH', 'Invoice customer does not match credit note customer');
          }
          if (invoice.status !== InvoiceStatus.POSTED) {
            throw new DomainException('INVOICE_NOT_POSTED', 'Cannot allocate to an invoice that is not POSTED');
          }

          const outstanding = invoice.totalAmount.sub(invoice.amountPaid);
          if (itemAmountDec.greaterThan(outstanding)) {
            throw new DomainException(
              'OVER_ALLOCATION',
              `Allocation of ${itemAmountDec.toString()} exceeds invoice outstanding balance of ${outstanding.toString()}`,
            );
          }

          await tx.paymentAllocation.create({
            data: {
              organizationId,
              sourceType: AllocationSourceType.CREDIT_NOTE,
              creditNoteId: creditNote.id,
              targetType: AllocationTargetType.INVOICE,
              invoiceId: invoice.id,
              amount: itemAmountDec,
              allocationDate: new Date(),
            },
          });

          await tx.invoice.update({
            where: { id: invoice.id },
            data: { amountPaid: invoice.amountPaid.add(itemAmountDec) },
          });

          currentAllocated = currentAllocated.add(itemAmountDec);
        } else if (item.billId) {
          const bill = await tx.bill.findFirst({
            where: { id: item.billId, organizationId },
          });
          if (!bill) {
            throw new DomainException('BILL_NOT_FOUND', `Bill ${item.billId} not found`);
          }
          if (bill.contactId !== creditNote.contactId) {
            throw new DomainException('CONTACT_MISMATCH', 'Bill supplier does not match credit note supplier');
          }
          if (bill.status !== BillStatus.POSTED) {
            throw new DomainException('BILL_NOT_POSTED', 'Cannot allocate to a bill that is not POSTED');
          }

          const outstanding = bill.totalAmount.sub(bill.amountPaid);
          if (itemAmountDec.greaterThan(outstanding)) {
            throw new DomainException(
              'OVER_ALLOCATION',
              `Allocation of ${itemAmountDec.toString()} exceeds bill outstanding balance of ${outstanding.toString()}`,
            );
          }

          await tx.paymentAllocation.create({
            data: {
              organizationId,
              sourceType: AllocationSourceType.CREDIT_NOTE,
              creditNoteId: creditNote.id,
              targetType: AllocationTargetType.BILL,
              billId: bill.id,
              amount: itemAmountDec,
              allocationDate: new Date(),
            },
          });

          await tx.bill.update({
            where: { id: bill.id },
            data: { amountPaid: bill.amountPaid.add(itemAmountDec) },
          });

          currentAllocated = currentAllocated.add(itemAmountDec);
        } else {
          throw new DomainException('INVALID_ALLOCATION', 'Each allocation must specify either invoiceId or billId');
        }
      }

      await tx.creditNote.update({
        where: { id: creditNote.id },
        data: { amountAllocated: currentAllocated },
      });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.PAYMENT_ALLOCATED,
        entityType: 'credit_note_allocation',
        entityId: creditNote.id,
        newValues: {
          allocations: dto.allocations,
        },
      });

      return this.getCreditNote(organizationId, creditNote.id);
    });
  }

  async voidCreditNote(
    organizationId: string,
    creditNoteId: string,
    dto: VoidCreditNoteDto,
    orgContext: OrgContext,
    actor: Actor,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await lockRows(tx, 'credit_notes', organizationId, [creditNoteId]);
      const creditNote = await tx.creditNote.findFirst({
        where: { id: creditNoteId, organizationId },
        include: {
          allocations: { where: { isReversed: false } },
        },
      });

      if (!creditNote) {
        throw new DomainException('CREDIT_NOTE_NOT_FOUND', 'Credit note not found in this organisation');
      }

      if (creditNote.status === CreditNoteStatus.VOIDED) {
        throw new DomainException('CREDIT_NOTE_ALREADY_VOIDED', 'Credit note is already voided');
      }

      // Revert allocations
      for (const allocation of creditNote.allocations) {
        if (allocation.targetType === AllocationTargetType.INVOICE && allocation.invoiceId) {
          const inv = await tx.invoice.findUnique({ where: { id: allocation.invoiceId } });
          if (inv) {
            const newAmountPaid = Prisma.Decimal.max(
              new Prisma.Decimal('0'),
              inv.amountPaid.sub(allocation.amount),
            );
            await tx.invoice.update({
              where: { id: inv.id },
              data: { amountPaid: newAmountPaid },
            });
          }
        } else if (allocation.targetType === AllocationTargetType.BILL && allocation.billId) {
          const b = await tx.bill.findUnique({ where: { id: allocation.billId } });
          if (b) {
            const newAmountPaid = Prisma.Decimal.max(
              new Prisma.Decimal('0'),
              b.amountPaid.sub(allocation.amount),
            );
            await tx.bill.update({
              where: { id: b.id },
              data: { amountPaid: newAmountPaid },
            });
          }
        }

        await tx.paymentAllocation.update({
          where: { id: allocation.id },
          data: { isReversed: true },
        });
      }

      // If posted, reverse journal
      if (creditNote.status === CreditNoteStatus.POSTED && creditNote.journalEntryId) {
        await this.reversal.reverseJournal(
          organizationId,
          creditNote.journalEntryId,
          { reason: dto.reason },
          orgContext,
          actor,
          tx,
        );
      }

      const updatedCreditNote = await tx.creditNote.update({
        where: { id: creditNote.id },
        data: {
          status: CreditNoteStatus.VOIDED,
          voidedById: actor.userId,
          voidedAt: new Date(),
          voidReason: dto.reason,
          amountAllocated: new Prisma.Decimal('0'),
        },
        include: creditNoteInclude,
      });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.CREDIT_NOTE_VOIDED,
        entityType: 'credit_note',
        entityId: creditNote.id,
        newValues: {
          voidReason: dto.reason,
          voidedAt: updatedCreditNote.voidedAt?.toISOString(),
        },
      });

      return updatedCreditNote;
    });
  }
}
