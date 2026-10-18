import { Test, TestingModule } from '@nestjs/testing';
import { BankTransactionStatus, Prisma } from '@prisma/client';
import { BankAiCategorisationService } from './bank-ai-categorisation.service';
import { PrismaService } from '../database/prisma.service';
import { BankReconciliationService } from './bank-reconciliation.service';
import { AuditService } from '../audit/audit.service';
import { DomainException } from '../common/errors/domain.exception';
import type { Actor, OrgContext } from '../common/types/request-context.types';

describe('BankAiCategorisationService', () => {
  let service: BankAiCategorisationService;
  let prisma: any;
  let reconciliation: any;
  let audit: any;

  const mockOrg: OrgContext = {
    organizationId: 'org-1',
    memberId: 'mem-1',
    roleId: 'role-1',
    roleName: 'Administrator',
    systemRoleKey: 'ADMINISTRATOR',
    permissions: new Set(['bank_reconciliation.manage']),
    baseCurrency: 'GBP',
  };

  const mockActor: Actor = {
    userId: 'user-1',
    sessionId: 'sess-1',
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    requestId: 'req-1',
  };

  const mockAccounts = [
    { id: 'acc-67200', code: '67200', name: 'Repairs & Maintenance', accountType: 'EXPENSE' },
    { id: 'acc-60400', code: '60400', name: 'Staff Welfare & Subsistence', accountType: 'EXPENSE' },
    { id: 'acc-75000', code: '75000', name: 'Software & IT Subscriptions', accountType: 'EXPENSE' },
    { id: 'acc-40000', code: '40000', name: 'Sales Revenue', accountType: 'REVENUE' },
  ];

  const mockContacts = [
    { id: 'cont-screwfix', name: 'Screwfix Direct', payableAccountId: 'acc-67200', receivableAccountId: null },
    { id: 'cont-tesco', name: 'Tesco Stores', payableAccountId: 'acc-60400', receivableAccountId: null },
  ];

  beforeEach(async () => {
    prisma = {
      bankStatementLine: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      account: {
        findMany: jest.fn().mockResolvedValue(mockAccounts),
      },
      contact: {
        findMany: jest.fn().mockResolvedValue(mockContacts),
      },
    };

    reconciliation = {
      quickCreateAndReconcile: jest.fn().mockResolvedValue({
        line: { id: 'line-1', status: BankTransactionStatus.MATCHED },
        journalNumber: 'JRN-2026-0010',
      }),
    };

    audit = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BankAiCategorisationService,
        { provide: PrismaService, useValue: prisma },
        { provide: BankReconciliationService, useValue: reconciliation },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<BankAiCategorisationService>(BankAiCategorisationService);
  });

  describe('autoCategoriseLines', () => {
    it('automatically categorises transactions matching merchant patterns', async () => {
      const pendingLines = [
        {
          id: 'line-1',
          description: 'SCREWFIX BRIGHTON 1243',
          payee: 'Screwfix',
          amount: new Prisma.Decimal('-45.50'),
          status: BankTransactionStatus.UNMATCHED,
        },
        {
          id: 'line-2',
          description: 'GITHUB ENTERPRISE MONTHLY',
          payee: 'GitHub',
          amount: new Prisma.Decimal('-21.00'),
          status: BankTransactionStatus.UNMATCHED,
        },
      ];

      // First call returns pending lines, second call in Promise.all returns historical matches
      prisma.bankStatementLine.findMany
        .mockResolvedValueOnce(pendingLines)
        .mockResolvedValueOnce([]); // no historical matches

      prisma.bankStatementLine.update.mockResolvedValue({});

      const res = await service.autoCategoriseLines('org-1');
      expect(res.processedCount).toBe(2);
      expect(res.categorisedCount).toBe(2);

      // Verify line 1 categorised as Repairs & Maintenance
      expect(prisma.bankStatementLine.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'line-1' },
          data: expect.objectContaining({
            suggestedAccountId: 'acc-67200',
            status: BankTransactionStatus.CATEGORISED,
          }),
        }),
      );

      // Verify line 2 categorised as Software & IT
      expect(prisma.bankStatementLine.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'line-2' },
          data: expect.objectContaining({
            suggestedAccountId: 'acc-75000',
            status: BankTransactionStatus.CATEGORISED,
          }),
        }),
      );
    });

    it('learns and applies categorisation from previous reconciled transactions', async () => {
      const pendingLines = [
        {
          id: 'line-custom',
          description: 'ACME SUPPLIES REORDER',
          payee: 'Acme',
          amount: new Prisma.Decimal('-120.00'),
          status: BankTransactionStatus.UNMATCHED,
        },
      ];

      const historicalMatches = [
        {
          description: 'ACME SUPPLIES REORDER',
          payee: 'Acme',
          suggestedAccountId: 'acc-67200',
          suggestedContactId: 'cont-screwfix',
        },
      ];

      prisma.bankStatementLine.findMany
        .mockResolvedValueOnce(pendingLines)
        .mockResolvedValueOnce(historicalMatches);

      prisma.bankStatementLine.update.mockResolvedValue({});

      const res = await service.autoCategoriseLines('org-1');
      expect(res.categorisedCount).toBe(1);

      expect(prisma.bankStatementLine.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'line-custom' },
          data: expect.objectContaining({
            suggestedAccountId: 'acc-67200',
            suggestedContactId: 'cont-screwfix',
            matchConfidence: new Prisma.Decimal('0.95'),
          }),
        }),
      );
    });
  });

  describe('updateLineCategorisation', () => {
    it('updates contact and nominal account inline', async () => {
      prisma.bankStatementLine.findFirst.mockResolvedValue({
        id: 'line-1',
        organizationId: 'org-1',
        description: 'Tesco store',
        status: BankTransactionStatus.UNMATCHED,
      });

      prisma.bankStatementLine.update.mockResolvedValue({
        id: 'line-1',
        suggestedContactId: 'cont-tesco',
        suggestedAccountId: 'acc-60400',
        status: BankTransactionStatus.CATEGORISED,
      });

      const updated = await service.updateLineCategorisation('org-1', 'line-1', {
        contactId: 'cont-tesco',
        accountId: 'acc-60400',
      });

      expect(updated.status).toBe(BankTransactionStatus.CATEGORISED);
      expect(prisma.bankStatementLine.update).toHaveBeenCalledWith({
        where: { id: 'line-1' },
        data: expect.objectContaining({
          suggestedContactId: 'cont-tesco',
          suggestedAccountId: 'acc-60400',
          status: BankTransactionStatus.CATEGORISED,
        }),
      });
    });
  });

  describe('confirmLine', () => {
    it('creates and posts journal to reconcile the transaction', async () => {
      prisma.bankStatementLine.findFirst.mockResolvedValue({
        id: 'line-1',
        organizationId: 'org-1',
        description: 'Monthly Software',
        suggestedAccountId: 'acc-75000',
        suggestedContactId: null,
      });

      const res = await service.confirmLine('org-1', 'line-1', {}, mockOrg, mockActor);

      expect(reconciliation.quickCreateAndReconcile).toHaveBeenCalledWith(
        'org-1',
        'line-1',
        {
          accountId: 'acc-75000',
          contactId: undefined,
          description: 'Monthly Software',
        },
        mockOrg,
        mockActor,
      );
      expect(res.journalNumber).toBe('JRN-2026-0010');
    });

    it('throws error when no account is assigned', async () => {
      prisma.bankStatementLine.findFirst.mockResolvedValue({
        id: 'line-no-acc',
        organizationId: 'org-1',
        suggestedAccountId: null,
      });

      await expect(
        service.confirmLine('org-1', 'line-no-acc', {}, mockOrg, mockActor),
      ).rejects.toThrow(DomainException);
    });
  });

  describe('batchConfirm', () => {
    it('confirms multiple lines in batch', async () => {
      prisma.bankStatementLine.findFirst
        .mockResolvedValueOnce({
          id: 'line-1',
          suggestedAccountId: 'acc-67200',
        })
        .mockResolvedValueOnce({
          id: 'line-2',
          suggestedAccountId: 'acc-60400',
        });

      const result = await service.batchConfirm('org-1', { lineIds: ['line-1', 'line-2'] }, mockOrg, mockActor);
      expect(result.confirmedCount).toBe(2);
      expect(result.failedCount).toBe(0);
    });
  });
});
