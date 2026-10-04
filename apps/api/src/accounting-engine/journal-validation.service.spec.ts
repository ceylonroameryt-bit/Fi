import { Test, TestingModule } from '@nestjs/testing';
import { JournalStatus, PeriodStatus } from '@prisma/client';
import { JournalValidationService } from './journal-validation.service';
import { MoneyService } from './money.service';
import { FinancialYearsService } from '../financial-years/financial-years.service';
import { PrismaService } from '../database/prisma.service';
import type { OrgContext } from '../common/types/request-context.types';

describe('JournalValidationEngine (Phases 7 & 8)', () => {
  let service: JournalValidationService;
  let prisma: Partial<PrismaService>;
  let fyService: Partial<FinancialYearsService>;

  const mockOrgContext: OrgContext = {
    organizationId: 'org-123',
    memberId: 'mem-123',
    roleId: 'role-123',
    roleName: 'Accountant',
    systemRoleKey: 'ACCOUNTANT',
    permissions: new Set(['journal.validate', 'journal.create', 'journal.edit_draft']),
    baseCurrency: 'GBP',
  };

  beforeEach(async () => {
    prisma = {
      journalEntry: {
        findFirst: jest.fn(),
      } as any,
    };

    fyService = {
      validatePostingDate: jest.fn().mockResolvedValue({
        isValid: true,
        error: null,
        errorCode: null,
        period: { id: 'period-123', name: 'April 2026', status: PeriodStatus.OPEN },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JournalValidationService,
        MoneyService,
        { provide: PrismaService, useValue: prisma },
        { provide: FinancialYearsService, useValue: fyService },
      ],
    }).compile();

    service = module.get<JournalValidationService>(JournalValidationService);
  });

  it('validates a balanced double-entry manual journal successfully', async () => {
    (prisma.journalEntry!.findFirst as jest.Mock).mockResolvedValue({
      id: 'journal-1',
      organizationId: 'org-123',
      journalNumber: 'JE-2026-000001',
      description: 'Owner capital investment',
      currency: 'GBP',
      status: JournalStatus.DRAFT,
      postingDate: new Date('2026-04-01'),
      lines: [
        {
          lineNumber: 1,
          accountId: 'acc-1',
          debit: 10000,
          credit: 0,
          account: { id: 'acc-1', code: '1010', name: 'Bank', organizationId: 'org-123', isActive: true, allowManualPosting: true },
        },
        {
          lineNumber: 2,
          accountId: 'acc-2',
          debit: 0,
          credit: 10000,
          account: { id: 'acc-2', code: '3000', name: 'Capital', organizationId: 'org-123', isActive: true, allowManualPosting: true },
        },
      ],
    });

    const result = await service.validateJournal('journal-1', mockOrgContext);
    expect(result.isValid).toBe(true);
    expect(result.totalDebit).toBe('10000.0000');
    expect(result.totalCredit).toBe('10000.0000');
    expect(result.difference).toBe('0.0000');
    expect(result.periodName).toBe('April 2026');
  });

  it('rejects an unbalanced journal and calculates the exact difference', async () => {
    (prisma.journalEntry!.findFirst as jest.Mock).mockResolvedValue({
      id: 'journal-unbalanced',
      organizationId: 'org-123',
      description: 'Unbalanced entry',
      currency: 'GBP',
      status: JournalStatus.DRAFT,
      postingDate: new Date('2026-04-01'),
      lines: [
        {
          lineNumber: 1,
          accountId: 'acc-1',
          debit: 10000,
          credit: 0,
          account: { id: 'acc-1', code: '1010', name: 'Bank', organizationId: 'org-123', isActive: true, allowManualPosting: true },
        },
        {
          lineNumber: 2,
          accountId: 'acc-2',
          debit: 0,
          credit: 9500,
          account: { id: 'acc-2', code: '3000', name: 'Capital', organizationId: 'org-123', isActive: true, allowManualPosting: true },
        },
      ],
    });

    const result = await service.validateJournal('journal-unbalanced', mockOrgContext);
    expect(result.isValid).toBe(false);
    expect(result.totalDebit).toBe('10000.0000');
    expect(result.totalCredit).toBe('9500.0000');
    expect(result.difference).toBe('500.0000');
    expect(result.errors.some((e) => e.includes('unbalanced'))).toBe(true);
  });

  it('rejects journal using an archived account', async () => {
    (prisma.journalEntry!.findFirst as jest.Mock).mockResolvedValue({
      id: 'journal-archived',
      organizationId: 'org-123',
      description: 'Archived account entry',
      currency: 'GBP',
      status: JournalStatus.DRAFT,
      postingDate: new Date('2026-04-01'),
      lines: [
        {
          lineNumber: 1,
          accountId: 'acc-archived',
          debit: 100,
          credit: 0,
          account: { id: 'acc-archived', code: '6300', name: 'Software', organizationId: 'org-123', isActive: false, allowManualPosting: true },
        },
        {
          lineNumber: 2,
          accountId: 'acc-2',
          debit: 0,
          credit: 100,
          account: { id: 'acc-2', code: '1010', name: 'Bank', organizationId: 'org-123', isActive: true, allowManualPosting: true },
        },
      ],
    });

    const result = await service.validateJournal('journal-archived', mockOrgContext);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('archived'))).toBe(true);
  });

  it('rejects journal using an account with allow_manual_posting = false', async () => {
    (prisma.journalEntry!.findFirst as jest.Mock).mockResolvedValue({
      id: 'journal-control',
      organizationId: 'org-123',
      description: 'Control account test',
      currency: 'GBP',
      status: JournalStatus.DRAFT,
      postingDate: new Date('2026-04-01'),
      lines: [
        {
          lineNumber: 1,
          accountId: 'acc-re',
          debit: 100,
          credit: 0,
          account: { id: 'acc-re', code: '3300', name: 'Retained Earnings', organizationId: 'org-123', isActive: true, allowManualPosting: false },
        },
        {
          lineNumber: 2,
          accountId: 'acc-2',
          debit: 0,
          credit: 100,
          account: { id: 'acc-2', code: '1010', name: 'Bank', organizationId: 'org-123', isActive: true, allowManualPosting: true },
        },
      ],
    });

    const result = await service.validateJournal('journal-control', mockOrgContext);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('manual postings'))).toBe(true);
  });

  it('rejects journal using an account from another organisation (tenant isolation)', async () => {
    (prisma.journalEntry!.findFirst as jest.Mock).mockResolvedValue({
      id: 'journal-cross-org',
      organizationId: 'org-123',
      description: 'Cross tenant account',
      currency: 'GBP',
      status: JournalStatus.DRAFT,
      postingDate: new Date('2026-04-01'),
      lines: [
        {
          lineNumber: 1,
          accountId: 'acc-other-org',
          debit: 100,
          credit: 0,
          account: { id: 'acc-other-org', code: '1010', name: 'Other Bank', organizationId: 'org-999-other', isActive: true, allowManualPosting: true },
        },
        {
          lineNumber: 2,
          accountId: 'acc-2',
          debit: 0,
          credit: 100,
          account: { id: 'acc-2', code: '1010', name: 'Bank', organizationId: 'org-123', isActive: true, allowManualPosting: true },
        },
      ],
    });

    const result = await service.validateJournal('journal-cross-org', mockOrgContext);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('another organisation'))).toBe(true);
  });

  it('rejects journal when posting date belongs to a hard-locked period', async () => {
    (fyService.validatePostingDate as jest.Mock).mockResolvedValue({
      isValid: false,
      error: 'Accounting period "April 2026" is hard-locked.',
      errorCode: 'PERIOD_HARD_LOCKED',
      period: null,
    });

    (prisma.journalEntry!.findFirst as jest.Mock).mockResolvedValue({
      id: 'journal-locked',
      organizationId: 'org-123',
      description: 'Locked period test',
      currency: 'GBP',
      status: JournalStatus.DRAFT,
      postingDate: new Date('2026-04-01'),
      lines: [
        {
          lineNumber: 1,
          accountId: 'acc-1',
          debit: 100,
          credit: 0,
          account: { id: 'acc-1', code: '1010', name: 'Bank', organizationId: 'org-123', isActive: true, allowManualPosting: true },
        },
        {
          lineNumber: 2,
          accountId: 'acc-2',
          debit: 0,
          credit: 100,
          account: { id: 'acc-2', code: '3000', name: 'Capital', organizationId: 'org-123', isActive: true, allowManualPosting: true },
        },
      ],
    });

    const result = await service.validateJournal('journal-locked', mockOrgContext);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('hard-locked'))).toBe(true);
  });

  it('rejects validation when user lacks journal.validate permission', async () => {
    const viewerContext: OrgContext = {
      ...mockOrgContext,
      permissions: new Set(['journal.view']), // missing journal.validate
    };

    (prisma.journalEntry!.findFirst as jest.Mock).mockResolvedValue({
      id: 'journal-no-perm',
      organizationId: 'org-123',
      description: 'No perm test',
      currency: 'GBP',
      status: JournalStatus.DRAFT,
      postingDate: new Date('2026-04-01'),
      lines: [
        {
          lineNumber: 1,
          accountId: 'acc-1',
          debit: 100,
          credit: 0,
          account: { id: 'acc-1', code: '1010', name: 'Bank', organizationId: 'org-123', isActive: true, allowManualPosting: true },
        },
        {
          lineNumber: 2,
          accountId: 'acc-2',
          debit: 0,
          credit: 100,
          account: { id: 'acc-2', code: '3000', name: 'Capital', organizationId: 'org-123', isActive: true, allowManualPosting: true },
        },
      ],
    });

    const result = await service.validateJournal('journal-no-perm', viewerContext);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('journal.validate required'))).toBe(true);
  });
});
