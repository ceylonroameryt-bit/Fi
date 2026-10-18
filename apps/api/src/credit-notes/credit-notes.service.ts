import { Injectable } from '@nestjs/common';
import {
  AccountSubtype,
  AllocationSourceType,
  AllocationTargetType,
  BillStatus,
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

      // Calculate totals
      let subtotalDec = new Prisma.Decimal('0');
      let taxTotalDec = new Prisma.Decimal('0');

      const linesData = dto.lines.map((l, idx) => {
        const net = this.money.toDecimal(l.netAmount);
        const taxRate = this.money.toDecimal(l.taxRate ?? 0);
        const taxAmount = l.taxAmount !== undefined
          ? this.money.toDecimal(l.taxAmount)
          : this.money.round(net.mul(taxRate), 2);
        const lineTotal = net.add(taxAmount);

        subtotalDec = subtotalDec.add(net);
        taxTotalDec = taxTotalDec.add(taxAmount);

        return {
          lineNumber: idx + 1,
          accountId: l.accountId,
          description: l.description,
          quantity: l.quantity ? new Prisma.Decimal(l.quantity.toString()) : new Prisma.Decimal('1'),
          unitPrice: l.unitPrice ? new Prisma.Decimal(l.unitPrice.toString()) : net,
          netAmount: new Prisma.Decimal(net.toFixed(4)),
          taxCodeId: l.taxCodeId ?? null,
          taxRate: new Prisma.Decimal(taxRate.toFixed(4)),
          taxAmount: new Prisma.Decimal(taxAmount.toFixed(4)),
          lineTotal: new Prisma.Decimal(lineTotal.toFixed(4)),
        };
      });

      const totalAmountDec = subtotalDec.add(taxTotalDec);

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
          currency: dto.currency ?? orgContext.baseCurrency ?? 'GBP',
          subtotal: new Prisma.Decimal(subtotalDec.toFixed(4)),
          taxTotal: new Prisma.Decimal(taxTotalDec.toFixed(4)),
          totalAmount: new Prisma.Decimal(totalAmountDec.toFixed(4)),
          amountAllocated: new Prisma.Decimal('0'),
          status: CreditNoteStatus.DRAFT,
          relatedInvoiceId: dto.relatedInvoiceId ?? null,
          relatedBillId: dto.relatedBillId ?? null,
          notes: dto.notes ?? null,
          createdById: actor.userId!,
          lines: {
            create: linesData.map((ld) => ({
              organizationId,
              ...ld,
            })),
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
      let taxAccount = null;

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

      // Tax account if taxTotal > 0
      const taxTotalDec = new Prisma.Decimal(creditNote.taxTotal.toString());
      if (taxTotalDec.greaterThan(0)) {
        taxAccount = await tx.account.findFirst({
          where: {
            organizationId,
            isActive: true,
            OR: [{ code: '2100' }, { accountSubtype: AccountSubtype.TAX_PAYABLE }],
          },
        });
        if (!taxAccount) {
          throw new DomainException(
            'ACCOUNT_NOT_FOUND',
            'Tax control account (2100) not found in Chart of Accounts',
          );
        }
      }

      // Construct Double-Entry Journal Lines
      const journalLines: Array<{
        accountId: string;
        description: string;
        debit: Prisma.Decimal;
        credit: Prisma.Decimal;
        contactId?: string | null;
      }> = [];

      const zeroDec = new Prisma.Decimal('0');
      const grossTotalDec = new Prisma.Decimal(creditNote.totalAmount.toString());

      if (isSales) {
        // Sales Credit Note:
        // Dr Revenue accounts (net amounts)
        for (const line of creditNote.lines) {
          journalLines.push({
            accountId: line.accountId,
            description: line.description || `Sales Credit: ${creditNote.creditNoteNumber}`,
            debit: new Prisma.Decimal(line.netAmount.toString()),
            credit: zeroDec,
          });
        }
        // Dr Output VAT
        if (taxTotalDec.greaterThan(0) && taxAccount) {
          journalLines.push({
            accountId: taxAccount.id,
            description: `VAT adjustment on Credit Note ${creditNote.creditNoteNumber}`,
            debit: taxTotalDec,
            credit: zeroDec,
          });
        }
        // Cr Debtors Control (gross) with customer tagged
        journalLines.push({
          accountId: controlAccount.id,
          description: `Credit Note ${creditNote.creditNoteNumber} - ${creditNote.contact.name}`,
          debit: zeroDec,
          credit: grossTotalDec,
          contactId: creditNote.contactId,
        });
      } else {
        // Supplier Credit Note:
        // Dr Creditors Control (gross) with supplier tagged
        journalLines.push({
          accountId: controlAccount.id,
          description: `Credit Note ${creditNote.creditNoteNumber} - ${creditNote.contact.name}`,
          debit: grossTotalDec,
          credit: zeroDec,
          contactId: creditNote.contactId,
        });
        // Cr Expense accounts (net amounts)
        for (const line of creditNote.lines) {
          journalLines.push({
            accountId: line.accountId,
            description: line.description || `Supplier Credit: ${creditNote.creditNoteNumber}`,
            debit: zeroDec,
            credit: new Prisma.Decimal(line.netAmount.toString()),
          });
        }
        // Cr Input VAT
        if (taxTotalDec.greaterThan(0) && taxAccount) {
          journalLines.push({
            accountId: taxAccount.id,
            description: `VAT adjustment on Supplier Credit ${creditNote.creditNoteNumber}`,
            debit: zeroDec,
            credit: taxTotalDec,
          });
        }
      }

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

      let currentAllocated = creditNote.amountAllocated;
      const totalAmount = creditNote.totalAmount;

      for (const item of dto.allocations) {
        const itemAmount = this.money.toDecimal(item.amount);
        if (itemAmount.lessThanOrEqualTo(0)) {
          throw new DomainException('INVALID_AMOUNT', 'Allocation amount must be greater than zero');
        }

        const itemAmountDec = new Prisma.Decimal(itemAmount.toFixed(4));
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
