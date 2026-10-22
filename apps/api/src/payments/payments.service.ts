import { Injectable } from '@nestjs/common';
import {
  AccountSubtype,
  AllocationSourceType,
  AllocationTargetType,
  BillStatus,
  ContactStatus,
  ContactType,
  InvoiceStatus,
  JournalSourceType,
  JournalStatus,
  JournalType,
  PaymentKind,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService, Tx } from '../database/prisma.service';
import { JournalsService } from '../journals/journals.service';
import { JournalValidationService } from '../accounting-engine/journal-validation.service';
import { JournalPostingService } from '../accounting-engine/journal-posting.service';
import { JournalReversalService } from '../accounting-engine/journal-reversal.service';
import { MoneyService } from '../accounting-engine/money.service';
import { AuditService } from '../audit/audit.service';
import { AuditEvents } from '../audit/audit-events';
import { DomainException } from '../common/errors/domain.exception';
import type { Actor, OrgContext } from '../common/types/request-context.types';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { AllocatePaymentDto } from './dto/allocate-payment.dto';
import { PaymentFilterQueryDto } from './dto/payment-query.dto';
import { VoidPaymentDto } from './dto/void-payment.dto';
import { allocationAmount, assertAllocationTargets, lockRows, paymentTarget } from './allocation-rules';

const paymentInclude = {
  contact: {
    select: {
      id: true,
      name: true,
      type: true,
      email: true,
      companyName: true,
    },
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
    include: {
      payment: false,
    },
    orderBy: { createdAt: 'desc' as const },
  },
} as const;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journalsService: JournalsService,
    private readonly validator: JournalValidationService,
    private readonly posting: JournalPostingService,
    private readonly reversal: JournalReversalService,
    private readonly money: MoneyService,
    private readonly audit: AuditService,
  ) {}

  async listPayments(organizationId: string, query: PaymentFilterQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Prisma.PaymentWhereInput = {
      organizationId,
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.contactId ? { contactId: query.contactId } : {}),
      ...(query.startDate || query.endDate
        ? {
            paymentDate: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: paymentInclude,
        orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getPayment(organizationId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, organizationId },
      include: {
        ...paymentInclude,
        allocations: {
          include: {
            creditNote: {
              select: {
                id: true,
                creditNoteNumber: true,
                totalAmount: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!payment) {
      throw new DomainException('PAYMENT_NOT_FOUND', 'Payment not found in this organisation');
    }

    // Attach enriched invoice/bill info for allocations
    const invoiceIds = payment.allocations
      .map((a) => a.invoiceId)
      .filter((id): id is string => Boolean(id));
    const billIds = payment.allocations
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

    const enrichedAllocations = payment.allocations.map((a) => ({
      ...a,
      invoice: a.invoiceId ? invoiceMap.get(a.invoiceId) ?? null : null,
      bill: a.billId ? billMap.get(a.billId) ?? null : null,
    }));

    return {
      ...payment,
      allocations: enrichedAllocations,
    };
  }

  async createPayment(
    organizationId: string,
    dto: CreatePaymentDto,
    orgContext: OrgContext,
    actor: Actor,
  ) {
    const paymentDate = new Date(dto.paymentDate);
    if (isNaN(paymentDate.getTime())) {
      throw new DomainException('INVALID_DATE', 'Invalid payment date format');
    }

    const paymentAmount = this.money.toDecimal(dto.amount);
    if (paymentAmount.lessThanOrEqualTo(0) || paymentAmount.decimalPlaces() > 2) {
      throw new DomainException('INVALID_AMOUNT', 'Payment amount must be greater than zero, in pounds and pence');
    }
    const currency = dto.currency ?? orgContext.baseCurrency;
    if (currency !== orgContext.baseCurrency) {
      throw new DomainException('UNSUPPORTED_CURRENCY', `Only ${orgContext.baseCurrency} payments are supported`);
    }
    if (dto.allocations && dto.allocations.length > 0) {
      assertAllocationTargets(paymentTarget(dto.kind), dto.allocations, dto.kind.toLowerCase().replace('_', ' '));
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Verify contact exists and belongs to organisation
      const contact = await tx.contact.findFirst({
        where: { id: dto.contactId, organizationId },
      });
      if (!contact) {
        throw new DomainException('CONTACT_NOT_FOUND', 'Contact not found in this organisation');
      }
      if (contact.status === ContactStatus.ARCHIVED) {
        throw new DomainException('CONTACT_ARCHIVED', 'Cannot record a payment for an archived contact');
      }
      const customerSide = dto.kind === PaymentKind.CUSTOMER_RECEIPT || dto.kind === PaymentKind.CUSTOMER_REFUND;
      if (customerSide ? contact.type === ContactType.SUPPLIER : contact.type === ContactType.CUSTOMER) {
        throw new DomainException('CONTACT_TYPE_MISMATCH', customerSide ? 'This payment needs a customer' : 'This payment needs a supplier');
      }

      // 2. Identify Bank nominal account
      let bankAccount = null;
      if (dto.bankAccountNominalId) {
        bankAccount = await tx.account.findFirst({
          where: {
            id: dto.bankAccountNominalId,
            organizationId,
            isActive: true,
            accountSubtype: { in: [AccountSubtype.BANK, AccountSubtype.CASH] },
          },
        });
        if (!bankAccount) {
          throw new DomainException('BANK_ACCOUNT_NOT_FOUND', 'The chosen account is not an active bank or cash account of this organisation');
        }
      }
      if (!bankAccount) {
        bankAccount = await tx.account.findFirst({
          where: {
            organizationId,
            isActive: true,
            accountSubtype: { in: [AccountSubtype.BANK, AccountSubtype.CASH] },
          },
          orderBy: [{ accountSubtype: 'asc' }, { code: 'asc' }],
        });
      }
      if (!bankAccount) {
        throw new DomainException(
          'BANK_ACCOUNT_NOT_FOUND',
          'Bank or cash nominal account (1200) not found in organisation Chart of Accounts',
        );
      }

      // 3. Identify AR or AP account
      let controlAccount = null;
      const isCustomerSide =
        dto.kind === PaymentKind.CUSTOMER_RECEIPT || dto.kind === PaymentKind.CUSTOMER_REFUND;

      if (isCustomerSide) {
        if (contact.receivableAccountId) {
          controlAccount = await tx.account.findFirst({
            where: { id: contact.receivableAccountId, organizationId, isActive: true },
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
        if (!controlAccount) {
          throw new DomainException(
            'ACCOUNT_NOT_FOUND',
            'Accounts Receivable nominal account (1100) not found in Chart of Accounts',
          );
        }
      } else {
        // Supplier side: SUPPLIER_PAYMENT or SUPPLIER_REFUND
        if (contact.payableAccountId) {
          controlAccount = await tx.account.findFirst({
            where: { id: contact.payableAccountId, organizationId, isActive: true },
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
        if (!controlAccount) {
          throw new DomainException(
            'ACCOUNT_NOT_FOUND',
            'Accounts Payable nominal account (2000) not found in Chart of Accounts',
          );
        }
      }

      // 4. Construct double-entry journal lines
      const journalLines: Array<{
        accountId: string;
        description: string;
        debit: Prisma.Decimal;
        credit: Prisma.Decimal;
        contactId?: string | null;
      }> = [];

      const amountDec = new Prisma.Decimal(paymentAmount.toFixed(4));
      const zeroDec = new Prisma.Decimal('0');

      if (dto.kind === PaymentKind.CUSTOMER_RECEIPT) {
        // Dr Bank, Cr AR (with contactId)
        journalLines.push({
          accountId: bankAccount.id,
          description: dto.reference
            ? `Customer Receipt - ${dto.reference}`
            : `Customer Receipt - ${contact.name}`,
          debit: amountDec,
          credit: zeroDec,
        });
        journalLines.push({
          accountId: controlAccount.id,
          description: `Customer Receipt - ${contact.name}`,
          debit: zeroDec,
          credit: amountDec,
          contactId: contact.id,
        });
      } else if (dto.kind === PaymentKind.SUPPLIER_PAYMENT) {
        // Dr AP (with contactId), Cr Bank
        journalLines.push({
          accountId: controlAccount.id,
          description: `Supplier Payment - ${contact.name}`,
          debit: amountDec,
          credit: zeroDec,
          contactId: contact.id,
        });
        journalLines.push({
          accountId: bankAccount.id,
          description: dto.reference
            ? `Supplier Payment - ${dto.reference}`
            : `Supplier Payment - ${contact.name}`,
          debit: zeroDec,
          credit: amountDec,
        });
      } else if (dto.kind === PaymentKind.CUSTOMER_REFUND) {
        // Dr AR (with contactId), Cr Bank
        journalLines.push({
          accountId: controlAccount.id,
          description: `Customer Refund - ${contact.name}`,
          debit: amountDec,
          credit: zeroDec,
          contactId: contact.id,
        });
        journalLines.push({
          accountId: bankAccount.id,
          description: `Customer Refund - ${contact.name}`,
          debit: zeroDec,
          credit: amountDec,
        });
      } else if (dto.kind === PaymentKind.SUPPLIER_REFUND) {
        // Dr Bank, Cr AP (with contactId)
        journalLines.push({
          accountId: bankAccount.id,
          description: `Supplier Refund - ${contact.name}`,
          debit: amountDec,
          credit: zeroDec,
        });
        journalLines.push({
          accountId: controlAccount.id,
          description: `Supplier Refund - ${contact.name}`,
          debit: zeroDec,
          credit: amountDec,
          contactId: contact.id,
        });
      }

      // 5. Allocate journal number & post
      const year = paymentDate.getUTCFullYear();
      const journalNumber = await this.journalsService.allocateJournalNumber(
        tx,
        organizationId,
        year,
      );

      let journalType: JournalType = JournalType.CASH_RECEIPT;
      if (dto.kind === PaymentKind.SUPPLIER_PAYMENT) {
        journalType = JournalType.CASH_PAYMENT;
      } else if (
        dto.kind === PaymentKind.CUSTOMER_REFUND ||
        dto.kind === PaymentKind.SUPPLIER_REFUND
      ) {
        journalType = JournalType.REFUND;
      }

      const draftJournal = await tx.journalEntry.create({
        data: {
          organizationId,
          journalNumber,
          journalType,
          journalDate: paymentDate,
          postingDate: paymentDate,
          description:
            dto.notes ??
            `${dto.kind.replace('_', ' ')} - ${contact.name}${dto.reference ? ` (${dto.reference})` : ''}`,
          reference: dto.reference,
          sourceType: JournalSourceType.PAYMENT,
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

      // Validate journal
      const validation = await this.validator.validateJournal(
        draftJournal.id,
        orgContext,
        tx,
      );
      if (!validation.isValid) {
        throw new DomainException(
          'POSTING_VALIDATION_FAILED',
          `Payment journal validation failed: ${validation.errors.join('; ')}`,
        );
      }

      // Mark validated
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

      // Post journal to General Ledger
      await this.posting.postJournal(
        organizationId,
        draftJournal.id,
        orgContext,
        actor,
        tx,
      );

      // 6. Create Payment record
      const payment = await tx.payment.create({
        data: {
          organizationId,
          kind: dto.kind,
          contactId: contact.id,
          bankAccountNominalId: bankAccount.id,
          paymentDate,
          amount: amountDec,
          currency,
          reference: dto.reference ?? null,
          notes: dto.notes ?? null,
          status: PaymentStatus.POSTED,
          journalEntryId: draftJournal.id,
          amountAllocated: new Prisma.Decimal('0'),
          createdById: actor.userId!,
        },
      });

      // Link payment to journal sourceId
      await tx.journalEntry.update({
        where: { id: draftJournal.id },
        data: { sourceId: payment.id },
      });

      // 7. If initial allocations requested, execute them
      if (dto.allocations && dto.allocations.length > 0) {
        await this.executeAllocations(tx, organizationId, payment.id, dto.allocations, paymentDate);
      }

      // Audit log
      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.PAYMENT_CREATED,
        entityType: 'payment',
        entityId: payment.id,
        newValues: {
          id: payment.id,
          kind: payment.kind,
          contactId: payment.contactId,
          amount: payment.amount.toString(),
          paymentDate: payment.paymentDate.toISOString(),
          journalEntryId: draftJournal.id,
        },
      });

      return tx.payment.findUnique({
        where: { id: payment.id },
        include: paymentInclude,
      });
    });
  }

  async voidPayment(
    organizationId: string,
    paymentId: string,
    dto: VoidPaymentDto,
    orgContext: OrgContext,
    actor: Actor,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await lockRows(tx, 'payments', organizationId, [paymentId]);
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, organizationId },
        include: {
          allocations: {
            where: { isReversed: false },
          },
        },
      });

      if (!payment) {
        throw new DomainException('PAYMENT_NOT_FOUND', 'Payment not found in this organisation');
      }
      await lockRows(tx, 'invoices', organizationId, payment.allocations.flatMap((a) => (a.invoiceId ? [a.invoiceId] : [])));
      await lockRows(tx, 'bills', organizationId, payment.allocations.flatMap((a) => (a.billId ? [a.billId] : [])));

      if (payment.status === PaymentStatus.VOIDED) {
        throw new DomainException('PAYMENT_ALREADY_VOIDED', 'Payment is already voided');
      }

      // 1. Reverse all active allocations
      for (const allocation of payment.allocations) {
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

      // 2. Reverse journal entry
      if (payment.journalEntryId) {
        await this.reversal.reverseJournal(
          organizationId,
          payment.journalEntryId,
          { reason: dto.reason },
          orgContext,
          actor,
          tx,
        );
      }

      // 3. Mark payment as VOIDED
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.VOIDED,
          voidedById: actor.userId,
          voidedAt: new Date(),
          voidReason: dto.reason,
          amountAllocated: new Prisma.Decimal('0'),
        },
        include: paymentInclude,
      });

      // Audit log
      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.PAYMENT_VOIDED,
        entityType: 'payment',
        entityId: payment.id,
        newValues: {
          id: payment.id,
          voidReason: dto.reason,
          voidedAt: updatedPayment.voidedAt?.toISOString(),
        },
      });

      return updatedPayment;
    });
  }

  async allocatePayment(
    organizationId: string,
    paymentId: string,
    dto: AllocatePaymentDto,
    actor: Actor,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await lockRows(tx, 'payments', organizationId, [paymentId]);
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, organizationId },
      });

      if (!payment) {
        throw new DomainException('PAYMENT_NOT_FOUND', 'Payment not found in this organisation');
      }
      assertAllocationTargets(paymentTarget(payment.kind), dto.allocations, payment.kind.toLowerCase().replace('_', ' '));

      if (payment.status !== PaymentStatus.POSTED) {
        throw new DomainException(
          'PAYMENT_INVALID_STATE',
          'Only POSTED payments can be allocated to invoices or bills',
        );
      }

      await this.executeAllocations(tx, organizationId, payment.id, dto.allocations, new Date());

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.PAYMENT_ALLOCATED,
        entityType: 'payment',
        entityId: payment.id,
        newValues: {
          allocations: dto.allocations,
        },
      });

      return this.getPayment(organizationId, payment.id);
    });
  }

  async reverseAllocation(
    organizationId: string,
    paymentId: string,
    allocationId: string,
    actor: Actor,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await lockRows(tx, 'payments', organizationId, [paymentId]);
      const allocation = await tx.paymentAllocation.findFirst({
        where: { id: allocationId, paymentId, organizationId },
      });
      if (allocation?.invoiceId) await lockRows(tx, 'invoices', organizationId, [allocation.invoiceId]);
      if (allocation?.billId) await lockRows(tx, 'bills', organizationId, [allocation.billId]);

      if (!allocation) {
        throw new DomainException('ALLOCATION_NOT_FOUND', 'Allocation record not found');
      }

      if (allocation.isReversed) {
        throw new DomainException('ALLOCATION_ALREADY_REVERSED', 'Allocation is already reversed');
      }

      // 1. Revert invoice/bill amountPaid
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

      // 2. Decrement payment amountAllocated
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      const newAmountAllocated = Prisma.Decimal.max(
        new Prisma.Decimal('0'),
        payment.amountAllocated.sub(allocation.amount),
      );
      await tx.payment.update({
        where: { id: paymentId },
        data: { amountAllocated: newAmountAllocated },
      });

      // 3. Mark allocation reversed
      await tx.paymentAllocation.update({
        where: { id: allocationId },
        data: { isReversed: true },
      });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.PAYMENT_ALLOCATION_REVERSED,
        entityType: 'payment_allocation',
        entityId: allocationId,
        newValues: {
          allocationId,
          paymentId,
          amount: allocation.amount.toString(),
        },
      });

      return { success: true };
    });
  }

  private async executeAllocations(
    tx: Tx,
    organizationId: string,
    paymentId: string,
    allocations: Array<{ invoiceId?: string; billId?: string; amount: number }>,
    allocationDate: Date,
  ) {
    await lockRows(tx, 'payments', organizationId, [paymentId]);
    await lockRows(tx, 'invoices', organizationId, allocations.flatMap((a) => (a.invoiceId ? [a.invoiceId] : [])));
    await lockRows(tx, 'bills', organizationId, allocations.flatMap((a) => (a.billId ? [a.billId] : [])));
    const payment = await tx.payment.findUniqueOrThrow({
      where: { id: paymentId },
    });

    let currentAllocated = payment.amountAllocated;
    const paymentAmount = payment.amount;

    for (const item of allocations) {
      const itemAmountDec = allocationAmount(item.amount);
      const unallocatedBalance = paymentAmount.sub(currentAllocated);

      if (itemAmountDec.greaterThan(unallocatedBalance)) {
        throw new DomainException(
          'OVER_ALLOCATION',
          `Cannot allocate ${itemAmountDec.toString()} exceeding available unallocated payment balance of ${unallocatedBalance.toString()}`,
        );
      }

      if (item.invoiceId) {
        const invoice = await tx.invoice.findFirst({
          where: { id: item.invoiceId, organizationId },
        });
        if (!invoice) {
          throw new DomainException('INVOICE_NOT_FOUND', `Invoice ${item.invoiceId} not found`);
        }
        if (invoice.contactId !== payment.contactId) {
          throw new DomainException(
            'CONTACT_MISMATCH',
            `Invoice customer does not match payment contact`,
          );
        }
        if (invoice.status !== InvoiceStatus.POSTED) {
          throw new DomainException(
            'INVOICE_NOT_POSTED',
            `Cannot allocate to invoice in ${invoice.status} status; only POSTED invoices accept payment`,
          );
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
            sourceType: AllocationSourceType.PAYMENT,
            paymentId: payment.id,
            targetType: AllocationTargetType.INVOICE,
            invoiceId: invoice.id,
            amount: itemAmountDec,
            allocationDate,
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
        if (bill.contactId !== payment.contactId) {
          throw new DomainException(
            'CONTACT_MISMATCH',
            `Bill supplier does not match payment contact`,
          );
        }
        if (bill.status !== BillStatus.POSTED) {
          throw new DomainException(
            'BILL_NOT_POSTED',
            `Cannot allocate to bill in ${bill.status} status; only POSTED bills accept payment`,
          );
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
            sourceType: AllocationSourceType.PAYMENT,
            paymentId: payment.id,
            targetType: AllocationTargetType.BILL,
            billId: bill.id,
            amount: itemAmountDec,
            allocationDate,
          },
        });

        await tx.bill.update({
          where: { id: bill.id },
          data: { amountPaid: bill.amountPaid.add(itemAmountDec) },
        });

        currentAllocated = currentAllocated.add(itemAmountDec);
      } else {
        throw new DomainException(
          'INVALID_ALLOCATION',
          'Each allocation must specify either invoiceId or billId',
        );
      }
    }

    await tx.payment.update({
      where: { id: payment.id },
      data: { amountAllocated: currentAllocated },
    });
  }
}
