import { Test, TestingModule } from '@nestjs/testing';
import { BankTransactionStatus, JournalStatus, Prisma } from '@prisma/client';
import { BankReconciliationService } from './bank-reconciliation.service';
import { PrismaService } from '../database/prisma.service';
import { JournalsService } from '../journals/journals.service';
import { JournalValidationService } from '../accounting-engine/journal-validation.service';
import { JournalPostingService } from '../accounting-engine/journal-posting.service';
import { AuditService } from '../audit/audit.service';
import { DomainException } from '../common/errors/domain.exception';
import type { Actor, OrgContext } from '../common/types/request-context.types';

describe('BankReconciliationService', () => {
  let service: BankReconciliationService;
  let prisma: any;
  let journals: any;
  let validator: any;
  let posting: any;
  let audit: any;

  const mockOrg: OrgContext = {
    organizationId: 'org-1',
    memberId: 'mem-1',
    roleId: 'role-1',
    roleName: 'Administrator',
    systemRoleKey: 'ADMINISTRATOR',
    permissions: new Set(['reconciliation.view', 'reconciliation.manage']),
    baseCurrency: 'GBP',
  };

  const mockActor: Actor = {
    userId: 'user-1',
    sessionId: 'sess-1',
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    requestId: 'req-1',
  };

  const mockStatementLine = {
    id: 'stmt-line-1',
    organizationId: 'org-1',
    bankAccountId: 'bank-1',
    transactionDate: new Date('2026-03-15T10:00:00Z'),
    description: 'Bank Fee March',
    amount: new Prisma.Decimal('-15.00'),
    currency: 'GBP',
    status: BankTransactionStatus.UNMATCHED,
    bankAccount: {
      id: 'bank-1',
      nominalAccountId: 'acc-1200',
    },
  };

  beforeEach(async () => {
    prisma = {
      bankStatementLine: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      payment: {
        findMany: jest.fn(),
      },
      journalLine: {
        findMany: jest.fn(),
      },
      account: {
        findFirst: jest.fn(),
      },
      journalEntry: {
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    };

    journals = {
      allocateJournalNumber: jest.fn().mockResolvedValue('JRN-2026-0005'),
    };

    validator = {
      validateJournal: jest.fn().mockResolvedValue({
        isValid: true,
        periodId: 'period-2026-03',
        errors: [],
      }),
    };

    posting = {
      postJournal: jest.fn().mockResolvedValue(undefined),
    };

    audit = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BankReconciliationService,
        { provide: PrismaService, useValue: prisma },
        { provide: JournalsService, useValue: journals },
        { provide: JournalValidationService, useValue: validator },
        { provide: JournalPostingService, useValue: posting },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<BankReconciliationService>(BankReconciliationService);
  });

  describe('getSuggestions', () => {
    it('returns matching payments and candidate journal entries within 7-day window', async () => {
      prisma.bankStatementLine.findFirst.mockResolvedValue(mockStatementLine);
      prisma.payment.findMany.mockResolvedValue([
        { id: 'pay-1', amount: new Prisma.Decimal('15.00'), paymentDate: new Date('2026-03-14') },
      ]);
      prisma.journalLine.findMany.mockResolvedValue([]);

      const result = await service.getSuggestions('org-1', 'stmt-line-1');
      expect(result.line.id).toBe('stmt-line-1');
      expect(result.candidatePayments.length).toBe(1);
      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
            status: 'POSTED',
          }),
        })
      );
    });

    it('throws BANK_TRANSACTION_NOT_FOUND if statement line does not exist', async () => {
      prisma.bankStatementLine.findFirst.mockResolvedValue(null);

      await expect(
        service.getSuggestions('org-1', 'invalid')
      ).rejects.toThrow(DomainException);
    });
  });

  describe('matchTransaction and unmatchTransaction', () => {
    it('matches line to payment and updates status to MATCHED', async () => {
      prisma.bankStatementLine.findFirst.mockResolvedValue(mockStatementLine);
      prisma.bankStatementLine.update.mockResolvedValue({
        ...mockStatementLine,
        status: BankTransactionStatus.MATCHED,
        matchedPaymentId: 'pay-1',
      });

      const updated = await service.matchTransaction(
        'org-1',
        'stmt-line-1',
        { matchedPaymentId: 'pay-1', notes: 'Matches direct debit' },
        mockActor
      );

      expect(updated.status).toBe(BankTransactionStatus.MATCHED);
      expect(prisma.bankStatementLine.update).toHaveBeenCalledWith({
        where: { id: 'stmt-line-1' },
        data: expect.objectContaining({
          status: BankTransactionStatus.MATCHED,
          matchedPaymentId: 'pay-1',
        }),
      });
      expect(audit.record).toHaveBeenCalled();
    });

    it('unmatches previously matched line', async () => {
      prisma.bankStatementLine.findFirst.mockResolvedValue({
        ...mockStatementLine,
        status: BankTransactionStatus.MATCHED,
        matchedPaymentId: 'pay-1',
      });
      prisma.bankStatementLine.update.mockResolvedValue({
        ...mockStatementLine,
        status: BankTransactionStatus.UNMATCHED,
        matchedPaymentId: null,
      });

      const unmeasured = await service.unmatchTransaction('org-1', 'stmt-line-1', mockActor);
      expect(unmeasured.status).toBe(BankTransactionStatus.UNMATCHED);
      expect(prisma.bankStatementLine.update).toHaveBeenCalledWith({
        where: { id: 'stmt-line-1' },
        data: expect.objectContaining({
          status: BankTransactionStatus.UNMATCHED,
          matchedPaymentId: null,
        }),
      });
    });
  });

  describe('quickCreateAndReconcile', () => {
    it('creates balanced journal (Dr Expense, Cr Bank for money out), posts, and reconciles', async () => {
      prisma.bankStatementLine.findFirst.mockResolvedValue(mockStatementLine);
      prisma.account.findFirst.mockResolvedValue({
        id: 'acc-7900',
        organizationId: 'org-1',
        name: 'Bank Charges',
        isActive: true,
      });

      prisma.journalEntry.create.mockResolvedValue({
        id: 'jrn-1',
        journalNumber: 'JRN-2026-0005',
        status: JournalStatus.DRAFT,
      });

      prisma.journalEntry.update.mockResolvedValue({
        id: 'jrn-1',
        status: JournalStatus.VALIDATED,
      });

      prisma.bankStatementLine.update.mockResolvedValue({
        ...mockStatementLine,
        status: BankTransactionStatus.MATCHED,
      });

      const res = await service.quickCreateAndReconcile(
        'org-1',
        'stmt-line-1',
        {
          accountId: 'acc-7900',
          description: 'Monthly Bank Account Maintenance Fee',
        },
        mockOrg,
        mockActor
      );

      expect(res.journalNumber).toBe('JRN-2026-0005');
      expect(validator.validateJournal).toHaveBeenCalledWith('jrn-1', mockOrg, prisma);
      expect(posting.postJournal).toHaveBeenCalledWith('org-1', 'jrn-1', mockOrg, mockActor, prisma);
      expect(prisma.bankStatementLine.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'stmt-line-1' },
          data: expect.objectContaining({ status: BankTransactionStatus.MATCHED }),
        })
      );
    });
  });
});
