import { Test, TestingModule } from '@nestjs/testing';
import { JournalStatus, PeriodStatus } from '@prisma/client';
import { JournalPostingService } from './journal-posting.service';
import { JournalValidationService } from './journal-validation.service';
import { FinancialYearsService } from '../financial-years/financial-years.service';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { Actor, OrgContext } from '../common/types/request-context.types';

describe('JournalPostingService (Phase 9)', () => {
  let service: JournalPostingService;
  let prisma: any;
  let validator: any;
  let fyService: any;
  let audit: any;

  const mockOrgContext: OrgContext = {
    organizationId: 'org-123',
    memberId: 'mem-123',
    roleId: 'role-123',
    roleName: 'Accountant',
    systemRoleKey: 'ACCOUNTANT',
    permissions: new Set(['journal.view', 'journal.validate', 'journal.post']),
    baseCurrency: 'GBP',
  };

  const mockActor: Actor = {
    userId: 'user-123',
    sessionId: 'session-123',
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    requestId: 'req-123',
  };

  beforeEach(async () => {
    prisma = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      journalEntry: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };

    validator = {
      validateJournal: jest.fn().mockResolvedValue({
        isValid: true,
        errors: [],
        issues: [],
        warnings: [],
        totalDebit: '25000.0000',
        totalCredit: '25000.0000',
        difference: '0.0000',
        periodId: 'period-123',
        periodName: 'April 2026',
      }),
    };

    fyService = {
      validatePostingDate: jest.fn().mockResolvedValue({
        isValid: true,
        period: { id: 'period-123', name: 'April 2026', status: PeriodStatus.OPEN },
      }),
    };

    audit = {
      record: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JournalPostingService,
        { provide: PrismaService, useValue: prisma },
        { provide: JournalValidationService, useValue: validator },
        { provide: FinancialYearsService, useValue: fyService },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<JournalPostingService>(JournalPostingService);
  });

  it('posts a validated journal successfully', async () => {
    prisma.journalEntry.findFirst.mockResolvedValue({
      id: 'journal-123',
      organizationId: 'org-123',
      journalNumber: 'JE-2026-000001',
      status: JournalStatus.VALIDATED,
      postingDate: new Date('2026-04-15'),
      lines: [
        { lineNumber: 1, accountId: 'acc-1', debit: 25000, credit: 0 },
        { lineNumber: 2, accountId: 'acc-2', debit: 0, credit: 25000 },
      ],
    });

    const postedDate = new Date();
    prisma.journalEntry.update.mockResolvedValue({
      id: 'journal-123',
      journalNumber: 'JE-2026-000001',
      status: JournalStatus.POSTED,
      postedAt: postedDate,
      postedById: 'user-123',
    });

    const result = await service.postJournal('org-123', 'journal-123', mockOrgContext, mockActor);

    expect(result.status).toBe(JournalStatus.POSTED);
    expect(result.journalNumber).toBe('JE-2026-000001');
    expect(result.totalDebit).toBe('25000.0000');
    expect(result.totalCredit).toBe('25000.0000');
    expect(result.difference).toBe('0.0000');
    expect(audit.record).toHaveBeenCalled();
  });

  it('rejects posting if user lacks journal.post permission', async () => {
    const unprivilegedOrgContext: OrgContext = {
      ...mockOrgContext,
      permissions: new Set(['journal.view']),
    };

    await expect(
      service.postJournal('org-123', 'journal-123', unprivilegedOrgContext, mockActor),
    ).rejects.toThrow('Missing required permission: journal.post');
  });

  it('rejects duplicate posting if journal is already POSTED', async () => {
    prisma.journalEntry.findFirst.mockResolvedValue({
      id: 'journal-123',
      organizationId: 'org-123',
      journalNumber: 'JE-2026-000001',
      status: JournalStatus.POSTED,
      postingDate: new Date('2026-04-15'),
      lines: [],
    });

    await expect(
      service.postJournal('org-123', 'journal-123', mockOrgContext, mockActor),
    ).rejects.toThrow('Journal entry has already been posted');
  });

  it('rejects posting if journal is in DRAFT status', async () => {
    prisma.journalEntry.findFirst.mockResolvedValue({
      id: 'journal-123',
      organizationId: 'org-123',
      journalNumber: 'JE-2026-000001',
      status: JournalStatus.DRAFT,
      postingDate: new Date('2026-04-15'),
      lines: [],
    });

    await expect(
      service.postJournal('org-123', 'journal-123', mockOrgContext, mockActor),
    ).rejects.toThrow('Journal entry must be VALIDATED before posting');
  });

  it('re-validates financial rules and rejects unbalanced journals', async () => {
    prisma.journalEntry.findFirst.mockResolvedValue({
      id: 'journal-123',
      organizationId: 'org-123',
      journalNumber: 'JE-2026-000001',
      status: JournalStatus.VALIDATED,
      postingDate: new Date('2026-04-15'),
      lines: [],
    });

    validator.validateJournal.mockResolvedValue({
      isValid: false,
      errors: ['Journal is unbalanced by £1,000.00'],
      issues: [],
    });

    await expect(
      service.postJournal('org-123', 'journal-123', mockOrgContext, mockActor),
    ).rejects.toThrow('Cannot post journal: Journal is unbalanced by £1,000.00');
  });

  it('rejects posting if accounting period is hard locked', async () => {
    prisma.journalEntry.findFirst.mockResolvedValue({
      id: 'journal-123',
      organizationId: 'org-123',
      journalNumber: 'JE-2026-000001',
      status: JournalStatus.VALIDATED,
      postingDate: new Date('2026-04-15'),
      lines: [],
    });

    fyService.validatePostingDate.mockResolvedValue({
      isValid: false,
      error: 'Accounting period April 2026 is hard locked',
      errorCode: 'PERIOD_HARD_LOCKED',
    });

    await expect(
      service.postJournal('org-123', 'journal-123', mockOrgContext, mockActor),
    ).rejects.toThrow('Accounting period April 2026 is hard locked');
  });
});
