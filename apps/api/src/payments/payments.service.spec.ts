import { Test, TestingModule } from '@nestjs/testing';
import {
  AccountSubtype,
  AllocationTargetType,
  InvoiceStatus,
  JournalSourceType,
  JournalStatus,
  JournalType,
  PaymentKind,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../database/prisma.service';
import { JournalsService } from '../journals/journals.service';
import { JournalValidationService } from '../accounting-engine/journal-validation.service';
import { JournalPostingService } from '../accounting-engine/journal-posting.service';
import { JournalReversalService } from '../accounting-engine/journal-reversal.service';
import { MoneyService } from '../accounting-engine/money.service';
import { AuditService } from '../audit/audit.service';
import { DomainException } from '../common/errors/domain.exception';
import type { Actor, OrgContext } from '../common/types/request-context.types';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: any;
  let journalsService: any;
  let validator: any;
  let posting: any;
  let reversal: any;

  const mockOrg: OrgContext = {
    organizationId: 'org-1',
    memberId: 'mem-1',
    roleId: 'role-1',
    roleName: 'Administrator',
    systemRoleKey: 'ADMINISTRATOR',
    permissions: new Set(['payment.create', 'payment.view', 'payment.void', 'payment.allocate']),
    baseCurrency: 'GBP',
  };

  const mockActor: Actor = {
    userId: 'user-1',
    sessionId: 'sess-1',
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    requestId: 'req-1',
  };

  const mockContact = {
    id: 'contact-1',
    organizationId: 'org-1',
    name: 'Client Alpha',
    type: 'CUSTOMER',
    receivableAccountId: 'acc-ar-1',
    payableAccountId: 'acc-ap-1',
  };

  const mockBankAccount = {
    id: 'acc-bank-1',
    organizationId: 'org-1',
    code: '1200',
    name: 'Current Bank Account',
    accountSubtype: AccountSubtype.BANK,
    isActive: true,
  };

  const mockArAccount = {
    id: 'acc-ar-1',
    organizationId: 'org-1',
    code: '1100',
    name: 'Trade Debtors',
    accountSubtype: AccountSubtype.ACCOUNTS_RECEIVABLE,
    isActive: true,
  };

  const mockApAccount = {
    id: 'acc-ap-1',
    organizationId: 'org-1',
    code: '2000',
    name: 'Trade Creditors',
    accountSubtype: AccountSubtype.ACCOUNTS_PAYABLE,
    isActive: true,
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn((cb) => cb(prisma)),
      contact: {
        findFirst: jest.fn().mockResolvedValue(mockContact),
      },
      account: {
        findFirst: jest.fn().mockImplementation(({ where }: any) => {
          if (where?.id === 'acc-bank-1' || where?.code === '1200' || where?.OR?.some((o: any) => o.code === '1200')) {
            return Promise.resolve(mockBankAccount);
          }
          if (where?.id === 'acc-ar-1' || where?.code === '1100' || where?.OR?.some((o: any) => o.code === '1100')) {
            return Promise.resolve(mockArAccount);
          }
          if (where?.id === 'acc-ap-1' || where?.code === '2000' || where?.OR?.some((o: any) => o.code === '2000')) {
            return Promise.resolve(mockApAccount);
          }
          return Promise.resolve(null);
        }),
      },
      journalEntry: {
        create: jest.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({ id: 'j-1', ...data }),
        ),
        update: jest.fn().mockResolvedValue({ id: 'j-1' }),
      },
      payment: {
        create: jest.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({
            id: 'pay-1',
            ...data,
            amount: new Prisma.Decimal(data.amount.toString()),
            amountAllocated: new Prisma.Decimal('0'),
          }),
        ),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({ id: 'pay-1', ...data }),
        ),
      },
      paymentAllocation: {
        create: jest.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({ id: 'alloc-1', ...data }),
        ),
        update: jest.fn().mockResolvedValue({ id: 'alloc-1' }),
        findFirst: jest.fn(),
      },
      invoice: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'inv-1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      bill: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'bill-1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    journalsService = {
      allocateJournalNumber: jest.fn().mockResolvedValue('CR-2026-000001'),
    };

    validator = {
      validateJournal: jest.fn().mockResolvedValue({ isValid: true, errors: [], periodId: 'period-1' }),
    };

    posting = {
      postJournal: jest.fn().mockResolvedValue({ id: 'j-1', status: JournalStatus.POSTED }),
    };

    reversal = {
      reverseJournal: jest.fn().mockResolvedValue({ id: 'rev-j-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: JournalsService, useValue: journalsService },
        { provide: JournalValidationService, useValue: validator },
        { provide: JournalPostingService, useValue: posting },
        { provide: JournalReversalService, useValue: reversal },
        MoneyService,
        {
          provide: AuditService,
          useValue: { record: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  describe('createPayment', () => {
    it('creates customer receipt with Dr Bank and Cr Accounts Receivable', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        id: 'pay-1',
        kind: PaymentKind.CUSTOMER_RECEIPT,
        amount: new Prisma.Decimal('500.00'),
        amountAllocated: new Prisma.Decimal('0'),
        status: PaymentStatus.POSTED,
      });

      const result = await service.createPayment(
        'org-1',
        {
          kind: PaymentKind.CUSTOMER_RECEIPT,
          contactId: 'contact-1',
          paymentDate: '2026-10-18',
          amount: 500,
          reference: 'BACS-001',
        },
        mockOrg,
        mockActor,
      );

      expect(prisma.journalEntry.create).toHaveBeenCalled();
      const journalCall = prisma.journalEntry.create.mock.calls[0][0];
      expect(journalCall.data.journalType).toBe(JournalType.CASH_RECEIPT);
      expect(journalCall.data.sourceType).toBe(JournalSourceType.PAYMENT);

      const lines = journalCall.data.lines.create;
      expect(lines).toHaveLength(2);
      // Dr Bank
      expect(lines[0].accountId).toBe('acc-bank-1');
      expect(new Prisma.Decimal(lines[0].debit).toFixed(2)).toBe('500.00');
      expect(new Prisma.Decimal(lines[0].credit).toFixed(2)).toBe('0.00');
      // Cr AR with contactId
      expect(lines[1].accountId).toBe('acc-ar-1');
      expect(new Prisma.Decimal(lines[1].debit).toFixed(2)).toBe('0.00');
      expect(new Prisma.Decimal(lines[1].credit).toFixed(2)).toBe('500.00');
      expect(lines[1].contactId).toBe('contact-1');

      expect(posting.postJournal).toHaveBeenCalled();
      expect(prisma.payment.create).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('creates supplier payment with Dr Accounts Payable and Cr Bank', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        id: 'pay-2',
        kind: PaymentKind.SUPPLIER_PAYMENT,
        amount: new Prisma.Decimal('350.00'),
        status: PaymentStatus.POSTED,
      });

      await service.createPayment(
        'org-1',
        {
          kind: PaymentKind.SUPPLIER_PAYMENT,
          contactId: 'contact-1',
          paymentDate: '2026-10-18',
          amount: 350,
          reference: 'FASTER-PAY-99',
        },
        mockOrg,
        mockActor,
      );

      const journalCall = prisma.journalEntry.create.mock.calls[0][0];
      expect(journalCall.data.journalType).toBe(JournalType.CASH_PAYMENT);

      const lines = journalCall.data.lines.create;
      expect(lines).toHaveLength(2);
      // Dr AP with contactId
      expect(lines[0].accountId).toBe('acc-ap-1');
      expect(new Prisma.Decimal(lines[0].debit).toFixed(2)).toBe('350.00');
      expect(new Prisma.Decimal(lines[0].credit).toFixed(2)).toBe('0.00');
      expect(lines[0].contactId).toBe('contact-1');
      // Cr Bank
      expect(lines[1].accountId).toBe('acc-bank-1');
      expect(new Prisma.Decimal(lines[1].debit).toFixed(2)).toBe('0.00');
      expect(new Prisma.Decimal(lines[1].credit).toFixed(2)).toBe('350.00');
    });

    it('rejects payment with zero or negative amount', async () => {
      await expect(
        service.createPayment(
          'org-1',
          {
            kind: PaymentKind.CUSTOMER_RECEIPT,
            contactId: 'contact-1',
            paymentDate: '2026-10-18',
            amount: 0,
          },
          mockOrg,
          mockActor,
        ),
      ).rejects.toThrow(DomainException);
    });

    it('allocates customer receipt to invoice on creation', async () => {
      const mockInvoice = {
        id: 'inv-1',
        organizationId: 'org-1',
        contactId: 'contact-1',
        status: InvoiceStatus.POSTED,
        totalAmount: new Prisma.Decimal('500.00'),
        amountPaid: new Prisma.Decimal('0'),
      };
      prisma.invoice.findFirst.mockResolvedValue(mockInvoice);
      prisma.payment.findUniqueOrThrow.mockResolvedValue({
        id: 'pay-1',
        amount: new Prisma.Decimal('500.00'),
        amountAllocated: new Prisma.Decimal('0'),
        contactId: 'contact-1',
      });
      prisma.payment.findUnique.mockResolvedValue({
        id: 'pay-1',
        amount: new Prisma.Decimal('500.00'),
        amountAllocated: new Prisma.Decimal('500.00'),
      });

      await service.createPayment(
        'org-1',
        {
          kind: PaymentKind.CUSTOMER_RECEIPT,
          contactId: 'contact-1',
          paymentDate: '2026-10-18',
          amount: 500,
          allocations: [{ invoiceId: 'inv-1', amount: 500 }],
        },
        mockOrg,
        mockActor,
      );

      expect(prisma.paymentAllocation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          paymentId: 'pay-1',
          targetType: AllocationTargetType.INVOICE,
          invoiceId: 'inv-1',
          amount: new Prisma.Decimal('500.0000'),
        }),
      });

      expect(prisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { amountPaid: new Prisma.Decimal('500.0000') },
      });
    });
  });

  describe('allocatePayment validation', () => {
    it('prevents allocating more than available unallocated payment amount', async () => {
      prisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        organizationId: 'org-1',
        status: PaymentStatus.POSTED,
      });
      prisma.payment.findUniqueOrThrow.mockResolvedValue({
        id: 'pay-1',
        amount: new Prisma.Decimal('100.00'),
        amountAllocated: new Prisma.Decimal('80.00'),
        contactId: 'contact-1',
      });

      await expect(
        service.allocatePayment(
          'org-1',
          'pay-1',
          {
            allocations: [{ invoiceId: 'inv-1', amount: 50 }],
          },
          mockActor,
        ),
      ).rejects.toThrow(/exceeding available unallocated payment balance/);
    });

    it('prevents allocating to invoice of a different contact', async () => {
      prisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        organizationId: 'org-1',
        status: PaymentStatus.POSTED,
      });
      prisma.payment.findUniqueOrThrow.mockResolvedValue({
        id: 'pay-1',
        amount: new Prisma.Decimal('100.00'),
        amountAllocated: new Prisma.Decimal('0'),
        contactId: 'contact-1',
      });
      prisma.invoice.findFirst.mockResolvedValue({
        id: 'inv-2',
        organizationId: 'org-1',
        contactId: 'contact-DIFFERENT',
        status: InvoiceStatus.POSTED,
        totalAmount: new Prisma.Decimal('100.00'),
        amountPaid: new Prisma.Decimal('0'),
      });

      await expect(
        service.allocatePayment(
          'org-1',
          'pay-1',
          {
            allocations: [{ invoiceId: 'inv-2', amount: 50 }],
          },
          mockActor,
        ),
      ).rejects.toThrow(/Invoice customer does not match payment contact/);
    });
  });

  describe('voidPayment', () => {
    it('voids payment, reverses journal and unwinds allocations', async () => {
      prisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        organizationId: 'org-1',
        status: PaymentStatus.POSTED,
        journalEntryId: 'j-1',
        allocations: [
          {
            id: 'alloc-1',
            targetType: AllocationTargetType.INVOICE,
            invoiceId: 'inv-1',
            amount: new Prisma.Decimal('200.00'),
            isReversed: false,
          },
        ],
      });
      prisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        amountPaid: new Prisma.Decimal('200.00'),
      });
      prisma.payment.update.mockResolvedValue({
        id: 'pay-1',
        status: PaymentStatus.VOIDED,
        voidedAt: new Date(),
      });

      const res = await service.voidPayment(
        'org-1',
        'pay-1',
        { reason: 'Customer cheque bounced' },
        mockOrg,
        mockActor,
      );

      // Reverses allocation
      expect(prisma.paymentAllocation.update).toHaveBeenCalledWith({
        where: { id: 'alloc-1' },
        data: { isReversed: true },
      });
      // Reverts invoice amountPaid
      expect(prisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { amountPaid: new Prisma.Decimal('0') },
      });
      // Reverses journal
      expect(reversal.reverseJournal).toHaveBeenCalledWith(
        'org-1',
        'j-1',
        { reason: 'Customer cheque bounced' },
        mockOrg,
        mockActor,
        prisma,
      );
      expect(res.status).toBe(PaymentStatus.VOIDED);
    });
  });
});
