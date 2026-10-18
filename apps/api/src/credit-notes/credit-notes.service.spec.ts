import { Test, TestingModule } from '@nestjs/testing';
import {
  AccountSubtype,
  AllocationSourceType,
  AllocationTargetType,
  CreditNoteKind,
  CreditNoteStatus,
  InvoiceStatus,
  JournalSourceType,
  JournalStatus,
  JournalType,
  Prisma,
} from '@prisma/client';
import { CreditNotesService } from './credit-notes.service';
import { PrismaService } from '../database/prisma.service';
import { JournalsService } from '../journals/journals.service';
import { JournalValidationService } from '../accounting-engine/journal-validation.service';
import { JournalPostingService } from '../accounting-engine/journal-posting.service';
import { JournalReversalService } from '../accounting-engine/journal-reversal.service';
import { MoneyService } from '../accounting-engine/money.service';
import { AuditService } from '../audit/audit.service';
import { DomainException } from '../common/errors/domain.exception';
import type { Actor, OrgContext } from '../common/types/request-context.types';

describe('CreditNotesService', () => {
  let service: CreditNotesService;
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
    permissions: new Set(['credit_note.create', 'credit_note.view', 'credit_note.post', 'credit_note.void']),
    baseCurrency: 'GBP',
  };

  const mockActor: Actor = {
    userId: 'user-1',
    sessionId: 'sess-1',
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    requestId: 'req-1',
  };

  const mockCustomer = {
    id: 'cust-1',
    organizationId: 'org-1',
    name: 'Client Alpha',
    receivableAccountId: 'acc-ar-1',
    payableAccountId: null,
  };

  const mockSupplier = {
    id: 'sup-1',
    organizationId: 'org-1',
    name: 'Supplier Beta',
    receivableAccountId: null,
    payableAccountId: 'acc-ap-1',
  };

  const mockArAccount = {
    id: 'acc-ar-1',
    organizationId: 'org-1',
    code: '1100',
    accountSubtype: AccountSubtype.ACCOUNTS_RECEIVABLE,
    isActive: true,
  };

  const mockApAccount = {
    id: 'acc-ap-1',
    organizationId: 'org-1',
    code: '2000',
    accountSubtype: AccountSubtype.ACCOUNTS_PAYABLE,
    isActive: true,
  };

  const mockTaxAccount = {
    id: 'acc-tax-1',
    organizationId: 'org-1',
    code: '2100',
    accountSubtype: AccountSubtype.TAX_PAYABLE,
    isActive: true,
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn((cb) => cb(prisma)),
      contact: {
        findFirst: jest.fn().mockImplementation(({ where }: any) => {
          if (where?.id === 'cust-1') return Promise.resolve(mockCustomer);
          if (where?.id === 'sup-1') return Promise.resolve(mockSupplier);
          return Promise.resolve(null);
        }),
      },
      account: {
        findFirst: jest.fn().mockImplementation(({ where }: any) => {
          if (where?.id === 'acc-ar-1' || where?.code === '1100' || where?.OR?.some((o: any) => o.code === '1100')) {
            return Promise.resolve(mockArAccount);
          }
          if (where?.id === 'acc-ap-1' || where?.code === '2000' || where?.OR?.some((o: any) => o.code === '2000')) {
            return Promise.resolve(mockApAccount);
          }
          if (where?.id === 'acc-tax-1' || where?.code === '2100' || where?.OR?.some((o: any) => o.code === '2100')) {
            return Promise.resolve(mockTaxAccount);
          }
          return Promise.resolve(null);
        }),
      },
      organizationSequence: {
        upsert: jest.fn().mockResolvedValue({ currentValue: 1 }),
      },
      creditNote: {
        create: jest.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({
            id: 'cn-1',
            ...data,
            amountAllocated: new Prisma.Decimal('0'),
          }),
        ),
        findFirst: jest.fn(),
        update: jest.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({ id: 'cn-1', ...data }),
        ),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      journalEntry: {
        create: jest.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({ id: 'j-1', ...data }),
        ),
        update: jest.fn().mockResolvedValue({ id: 'j-1' }),
      },
      paymentAllocation: {
        create: jest.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({ id: 'alloc-1', ...data }),
        ),
        update: jest.fn().mockResolvedValue({ id: 'alloc-1' }),
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
      allocateJournalNumber: jest.fn().mockResolvedValue('CN-2026-000001'),
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
        CreditNotesService,
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

    service = module.get<CreditNotesService>(CreditNotesService);
  });

  describe('createCreditNote', () => {
    it('creates draft sales credit note with lines and totals', async () => {
      const result = await service.createCreditNote(
        'org-1',
        {
          kind: CreditNoteKind.SALES_CREDIT_NOTE,
          contactId: 'cust-1',
          issueDate: '2026-10-18',
          reference: 'RETURN-01',
          lines: [
            {
              accountId: 'acc-rev-1',
              description: 'Returned widget',
              quantity: 1,
              unitPrice: 100,
              netAmount: 100,
              taxRate: 0.20,
              taxAmount: 20,
            },
          ],
        },
        mockOrg,
        mockActor,
      );

      expect(prisma.creditNote.create).toHaveBeenCalled();
      const createData = prisma.creditNote.create.mock.calls[0][0].data;
      expect(createData.creditNoteNumber).toBe('SCN-2026-000001');
      expect(new Prisma.Decimal(createData.subtotal).toFixed(2)).toBe('100.00');
      expect(new Prisma.Decimal(createData.taxTotal).toFixed(2)).toBe('20.00');
      expect(new Prisma.Decimal(createData.totalAmount).toFixed(2)).toBe('120.00');
      expect(createData.status).toBe(CreditNoteStatus.DRAFT);
      expect(result).toBeDefined();
    });

    it('rejects credit note with no lines', async () => {
      await expect(
        service.createCreditNote(
          'org-1',
          {
            kind: CreditNoteKind.SALES_CREDIT_NOTE,
            contactId: 'cust-1',
            issueDate: '2026-10-18',
            lines: [],
          },
          mockOrg,
          mockActor,
        ),
      ).rejects.toThrow(DomainException);
    });
  });

  describe('postCreditNote', () => {
    it('posts sales credit note: Dr Revenue, Dr Output VAT, Cr Accounts Receivable (with customer tagged)', async () => {
      prisma.creditNote.findFirst.mockResolvedValue({
        id: 'cn-1',
        organizationId: 'org-1',
        kind: CreditNoteKind.SALES_CREDIT_NOTE,
        contactId: 'cust-1',
        creditNoteNumber: 'SCN-2026-000001',
        issueDate: new Date('2026-10-18'),
        currency: 'GBP',
        subtotal: new Prisma.Decimal('100.00'),
        taxTotal: new Prisma.Decimal('20.00'),
        totalAmount: new Prisma.Decimal('120.00'),
        status: CreditNoteStatus.DRAFT,
        contact: mockCustomer,
        lines: [
          {
            accountId: 'acc-rev-1',
            description: 'Returned widget',
            netAmount: new Prisma.Decimal('100.00'),
            taxAmount: new Prisma.Decimal('20.00'),
          },
        ],
      });

      await service.postCreditNote('org-1', 'cn-1', mockOrg, mockActor);

      expect(prisma.journalEntry.create).toHaveBeenCalled();
      const journalCall = prisma.journalEntry.create.mock.calls[0][0].data;
      expect(journalCall.journalType).toBe(JournalType.CREDIT_NOTE);
      expect(journalCall.sourceType).toBe(JournalSourceType.CREDIT_NOTE);

      const lines = journalCall.lines.create;
      expect(lines).toHaveLength(3);
      // Dr Revenue
      expect(lines[0].accountId).toBe('acc-rev-1');
      expect(new Prisma.Decimal(lines[0].debit).toFixed(2)).toBe('100.00');
      expect(new Prisma.Decimal(lines[0].credit).toFixed(2)).toBe('0.00');
      // Dr Output VAT
      expect(lines[1].accountId).toBe('acc-tax-1');
      expect(new Prisma.Decimal(lines[1].debit).toFixed(2)).toBe('20.00');
      expect(new Prisma.Decimal(lines[1].credit).toFixed(2)).toBe('0.00');
      // Cr AR with contactId
      expect(lines[2].accountId).toBe('acc-ar-1');
      expect(new Prisma.Decimal(lines[2].debit).toFixed(2)).toBe('0.00');
      expect(new Prisma.Decimal(lines[2].credit).toFixed(2)).toBe('120.00');
      expect(lines[2].contactId).toBe('cust-1');

      expect(posting.postJournal).toHaveBeenCalled();
    });

    it('posts supplier credit note: Dr Accounts Payable (with supplier tagged), Cr Expense, Cr Input VAT', async () => {
      prisma.creditNote.findFirst.mockResolvedValue({
        id: 'cn-2',
        organizationId: 'org-1',
        kind: CreditNoteKind.SUPPLIER_CREDIT_NOTE,
        contactId: 'sup-1',
        creditNoteNumber: 'PCN-2026-000001',
        issueDate: new Date('2026-10-18'),
        currency: 'GBP',
        subtotal: new Prisma.Decimal('200.00'),
        taxTotal: new Prisma.Decimal('40.00'),
        totalAmount: new Prisma.Decimal('240.00'),
        status: CreditNoteStatus.DRAFT,
        contact: mockSupplier,
        lines: [
          {
            accountId: 'acc-exp-1',
            description: 'Returned parts',
            netAmount: new Prisma.Decimal('200.00'),
            taxAmount: new Prisma.Decimal('40.00'),
          },
        ],
      });

      await service.postCreditNote('org-1', 'cn-2', mockOrg, mockActor);

      const journalCall = prisma.journalEntry.create.mock.calls[0][0].data;
      const lines = journalCall.lines.create;
      expect(lines).toHaveLength(3);
      // Dr AP with contactId
      expect(lines[0].accountId).toBe('acc-ap-1');
      expect(new Prisma.Decimal(lines[0].debit).toFixed(2)).toBe('240.00');
      expect(new Prisma.Decimal(lines[0].credit).toFixed(2)).toBe('0.00');
      expect(lines[0].contactId).toBe('sup-1');
      // Cr Expense
      expect(lines[1].accountId).toBe('acc-exp-1');
      expect(new Prisma.Decimal(lines[1].debit).toFixed(2)).toBe('0.00');
      expect(new Prisma.Decimal(lines[1].credit).toFixed(2)).toBe('200.00');
      // Cr Input VAT
      expect(lines[2].accountId).toBe('acc-tax-1');
      expect(new Prisma.Decimal(lines[2].debit).toFixed(2)).toBe('0.00');
      expect(new Prisma.Decimal(lines[2].credit).toFixed(2)).toBe('40.00');
    });
  });

  describe('allocateCreditNote', () => {
    it('allocates credit note to open invoice and updates invoice balance', async () => {
      prisma.creditNote.findFirst.mockResolvedValue({
        id: 'cn-1',
        organizationId: 'org-1',
        contactId: 'cust-1',
        totalAmount: new Prisma.Decimal('120.00'),
        amountAllocated: new Prisma.Decimal('0'),
        status: CreditNoteStatus.POSTED,
        allocations: [],
      });

      prisma.invoice.findFirst.mockResolvedValue({
        id: 'inv-1',
        organizationId: 'org-1',
        contactId: 'cust-1',
        status: InvoiceStatus.POSTED,
        totalAmount: new Prisma.Decimal('200.00'),
        amountPaid: new Prisma.Decimal('0'),
      });

      await service.allocateCreditNote(
        'org-1',
        'cn-1',
        {
          allocations: [{ invoiceId: 'inv-1', amount: 120 }],
        },
        mockActor,
      );

      expect(prisma.paymentAllocation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          creditNoteId: 'cn-1',
          sourceType: AllocationSourceType.CREDIT_NOTE,
          targetType: AllocationTargetType.INVOICE,
          invoiceId: 'inv-1',
          amount: new Prisma.Decimal('120.0000'),
        }),
      });

      expect(prisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { amountPaid: new Prisma.Decimal('120.0000') },
      });

      expect(prisma.creditNote.update).toHaveBeenCalledWith({
        where: { id: 'cn-1' },
        data: { amountAllocated: new Prisma.Decimal('120.0000') },
      });
    });

    it('rejects allocation exceeding credit note available balance', async () => {
      prisma.creditNote.findFirst.mockResolvedValue({
        id: 'cn-1',
        organizationId: 'org-1',
        contactId: 'cust-1',
        totalAmount: new Prisma.Decimal('100.00'),
        amountAllocated: new Prisma.Decimal('80.00'),
        status: CreditNoteStatus.POSTED,
      });

      await expect(
        service.allocateCreditNote(
          'org-1',
          'cn-1',
          {
            allocations: [{ invoiceId: 'inv-1', amount: 50 }],
          },
          mockActor,
        ),
      ).rejects.toThrow(/exceeding credit note available balance/);
    });
  });

  describe('voidCreditNote', () => {
    it('voids credit note, reverses journal and unwinds allocations', async () => {
      prisma.creditNote.findFirst.mockResolvedValue({
        id: 'cn-1',
        organizationId: 'org-1',
        status: CreditNoteStatus.POSTED,
        journalEntryId: 'j-1',
        allocations: [
          {
            id: 'alloc-1',
            targetType: AllocationTargetType.INVOICE,
            invoiceId: 'inv-1',
            amount: new Prisma.Decimal('120.00'),
            isReversed: false,
          },
        ],
      });
      prisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        amountPaid: new Prisma.Decimal('120.00'),
      });
      prisma.creditNote.update.mockResolvedValue({
        id: 'cn-1',
        status: CreditNoteStatus.VOIDED,
        voidedAt: new Date(),
      });

      const res = await service.voidCreditNote(
        'org-1',
        'cn-1',
        { reason: 'Customer invoice was amended' },
        mockOrg,
        mockActor,
      );

      // Reverses allocation
      expect(prisma.paymentAllocation.update).toHaveBeenCalledWith({
        where: { id: 'alloc-1' },
        data: { isReversed: true },
      });
      // Restores invoice balance
      expect(prisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { amountPaid: new Prisma.Decimal('0') },
      });
      // Reverses journal
      expect(reversal.reverseJournal).toHaveBeenCalledWith(
        'org-1',
        'j-1',
        { reason: 'Customer invoice was amended' },
        mockOrg,
        mockActor,
        prisma,
      );
      expect(res.status).toBe(CreditNoteStatus.VOIDED);
    });
  });
});
