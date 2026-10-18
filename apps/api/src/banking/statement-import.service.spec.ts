import { Test, TestingModule } from '@nestjs/testing';
import { BankTransactionStatus, Prisma } from '@prisma/client';
import { StatementImportService } from './statement-import.service';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BankRulesService } from './bank-rules.service';
import { DomainException } from '../common/errors/domain.exception';
import type { Actor } from '../common/types/request-context.types';

describe('StatementImportService', () => {
  let service: StatementImportService;
  let prisma: any;
  let audit: any;
  let bankRules: any;

  const mockActor: Actor = {
    userId: 'user-1',
    sessionId: 'sess-1',
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    requestId: 'req-1',
  };

  const mockBankAccount = {
    id: 'bank-1',
    organizationId: 'org-1',
    name: 'Barclays Operating',
    currency: 'GBP',
    nominalAccountId: 'acc-1200',
  };

  beforeEach(async () => {
    prisma = {
      bankAccount: {
        findFirst: jest.fn(),
      },
      bankStatementImport: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      bankStatementLine: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      bankRule: {
        update: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    };

    audit = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    bankRules = {
      getActiveRules: jest.fn().mockResolvedValue([]),
      matchLineAgainstRules: jest.fn().mockReturnValue({
        matchedRuleId: null,
        suggestedAccountId: null,
        suggestedTaxCodeId: null,
        suggestedContactId: null,
        autoCategorise: false,
        confidence: 0,
        explanation: 'No rule matched',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatementImportService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: BankRulesService, useValue: bankRules },
      ],
    }).compile();

    service = module.get<StatementImportService>(StatementImportService);
  });

  describe('importStatement', () => {
    const csvContent = 'Date,Description,Amount\n2026-03-15,Payment for Software,-45.00\n2026-03-16,Client Invoice Recv,1500.00';

    it('throws BANK_ACCOUNT_NOT_FOUND if bank account does not exist', async () => {
      prisma.bankAccount.findFirst.mockResolvedValue(null);

      await expect(
        service.importStatement('org-1', {
          bankAccountId: 'invalid',
          fileName: 'statement.csv',
          fileFormat: 'CSV',
          fileContent: csvContent,
        }, mockActor)
      ).rejects.toThrow(DomainException);
    });

    it('throws BANK_STATEMENT_DUPLICATE if file hash was previously imported', async () => {
      prisma.bankAccount.findFirst.mockResolvedValue(mockBankAccount);
      prisma.bankStatementImport.findFirst.mockResolvedValue({
        id: 'imp-prev',
        importedAt: new Date(),
        fileName: 'statement.csv',
      });

      await expect(
        service.importStatement('org-1', {
          bankAccountId: 'bank-1',
          fileName: 'statement.csv',
          fileFormat: 'CSV',
          fileContent: csvContent,
        }, mockActor)
      ).rejects.toThrow(DomainException);
    });

    it('successfully parses, deduplicates, and creates statement import and lines', async () => {
      prisma.bankAccount.findFirst.mockResolvedValue(mockBankAccount);
      prisma.bankStatementImport.findFirst.mockResolvedValue(null);
      prisma.bankStatementImport.create.mockResolvedValue({
        id: 'imp-1',
        fileName: 'statement.csv',
      });
      // First line not duplicate, second line is duplicate
      prisma.bankStatementLine.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'existing-line' });

      prisma.bankStatementLine.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'line-new-1', ...data })
      );

      const result = await service.importStatement(
        'org-1',
        {
          bankAccountId: 'bank-1',
          fileName: 'statement.csv',
          fileFormat: 'CSV',
          fileContent: csvContent,
        },
        mockActor
      );

      expect(result.linesImported).toBe(1);
      expect(result.linesSkippedDuplicates).toBe(1);
      expect(prisma.bankStatementImport.create).toHaveBeenCalled();
      expect(prisma.bankStatementLine.create).toHaveBeenCalledTimes(1);
      expect(audit.record).toHaveBeenCalled();
    });

    it('applies bank rules match and increments rule hit count', async () => {
      prisma.bankAccount.findFirst.mockResolvedValue(mockBankAccount);
      prisma.bankStatementImport.findFirst.mockResolvedValue(null);
      prisma.bankStatementImport.create.mockResolvedValue({ id: 'imp-2' });
      prisma.bankStatementLine.findFirst.mockResolvedValue(null);

      bankRules.matchLineAgainstRules.mockReturnValue({
        matchedRuleId: 'rule-adobe',
        suggestedAccountId: 'acc-software',
        suggestedTaxCodeId: 'tax-20',
        suggestedContactId: null,
        autoCategorise: true,
        confidence: 0.95,
        explanation: 'Matched Adobe subscription rule',
      });

      prisma.bankStatementLine.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'line-1', ...data })
      );

      const result = await service.importStatement(
        'org-1',
        {
          bankAccountId: 'bank-1',
          fileName: 'statement.csv',
          fileFormat: 'CSV',
          fileContent: 'Date,Description,Amount\n2026-03-15,Adobe Systems,-45.00',
        },
        mockActor
      );

      expect(result.linesImported).toBe(1);
      expect(prisma.bankRule.update).toHaveBeenCalledWith({
        where: { id: 'rule-adobe' },
        data: { timesApplied: { increment: 1 } },
      });
    });
  });

  describe('listStatementLines', () => {
    it('returns paginated statement lines', async () => {
      prisma.bankStatementLine.findMany.mockResolvedValue([
        { id: 'line-1', description: 'Test', amount: new Prisma.Decimal('100.00') },
      ]);
      prisma.bankStatementLine.count.mockResolvedValue(1);

      const res = await service.listStatementLines('org-1', 'bank-1', BankTransactionStatus.UNMATCHED, 1, 10);
      expect(res.items.length).toBe(1);
      expect(res.total).toBe(1);
      expect(res.totalPages).toBe(1);
    });
  });
});
