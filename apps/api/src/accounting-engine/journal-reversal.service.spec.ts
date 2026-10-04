import { Test, TestingModule } from '@nestjs/testing';
import { JournalStatus, PeriodStatus } from '@prisma/client';
import { JournalReversalService } from './journal-reversal.service';
import { MoneyService } from './money.service';
import { FinancialYearsService } from '../financial-years/financial-years.service';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { Actor, OrgContext } from '../common/types/request-context.types';

describe('JournalReversalService (Phase 10)', () => {
  let service: JournalReversalService;
  let prisma: any;
  let fyService: any;
  let audit: any;

  const mockOrgContext: OrgContext = {
    organizationId: 'org-123',
    memberId: 'mem-123',
    roleId: 'role-123',
    roleName: 'Accountant',
    systemRoleKey: 'ACCOUNTANT',
    permissions: new Set(['journal.view', 'journal.post', 'journal.reverse']),
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
        create: jest.fn(),
        update: jest.fn(),
      },
      organizationSequence: {
        upsert: jest.fn().mockResolvedValue({ currentValue: 2 }),
      },
      transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
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
        JournalReversalService,
        MoneyService,
        { provide: PrismaService, useValue: prisma },
        { provide: FinancialYearsService, useValue: fyService },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<JournalReversalService>(JournalReversalService);
  });

  it('reverses a posted journal successfully with opposite debit/credit lines', async () => {
    prisma.journalEntry.findFirst.mockResolvedValue({
      id: 'journal-orig',
      organizationId: 'org-123',
      journalNumber: 'JE-2026-000001',
      status: JournalStatus.POSTED,
      currency: 'GBP',
      journalType: 'GENERAL',
      postingDate: new Date('2026-04-01'),
      lines: [
        { lineNumber: 1, accountId: 'acc-bank', description: 'Bank', debit: 1000, credit: 0, account: { id: 'acc-bank', code: '1010', name: 'Bank', isActive: true } },
        { lineNumber: 2, accountId: 'acc-capital', description: 'Capital', debit: 0, credit: 1000, account: { id: 'acc-capital', code: '3010', name: 'Capital', isActive: true } },
      ],
    });

    prisma.journalEntry.create.mockResolvedValue({
      id: 'journal-rev',
      journalNumber: 'JE-2026-000002',
      status: JournalStatus.POSTED,
      reversalOfJournalId: 'journal-orig',
      postingDate: new Date('2026-04-10'),
    });

    prisma.journalEntry.update.mockResolvedValue({
      id: 'journal-orig',
      journalNumber: 'JE-2026-000001',
      status: JournalStatus.REVERSED,
      reversedByJournalId: 'journal-rev',
    });

    const result = await service.reverseJournal(
      'org-123',
      'journal-orig',
      { reversalDate: '2026-04-10', reason: 'Error correction' },
      mockOrgContext,
      mockActor,
    );

    expect(result.originalJournal.status).toBe(JournalStatus.REVERSED);
    expect(result.originalJournal.reversedByJournalId).toBe('journal-rev');
    expect(result.reversalJournal.status).toBe(JournalStatus.POSTED);
    expect(result.reversalJournal.reversalOfJournalId).toBe('journal-orig');

    // Check that create was called with inverted lines: line 1 has credit=1000, line 2 has debit=1000
    const createCall = prisma.journalEntry.create.mock.calls[0][0];
    expect(createCall.data.lines.create[0].credit).toBe(1000);
    expect(createCall.data.lines.create[0].debit).toBe(0);
    expect(createCall.data.lines.create[1].debit).toBe(1000);
    expect(createCall.data.lines.create[1].credit).toBe(0);

    expect(audit.record).toHaveBeenCalledTimes(2);
  });

  it('rejects reversal if user lacks journal.reverse permission', async () => {
    const unprivilegedContext: OrgContext = {
      ...mockOrgContext,
      permissions: new Set(['journal.view']),
    };

    await expect(
      service.reverseJournal('org-123', 'journal-orig', {}, unprivilegedContext, mockActor),
    ).rejects.toThrow('Missing required permission: journal.reverse');
  });

  it('rejects reversal if journal is not POSTED', async () => {
    prisma.journalEntry.findFirst.mockResolvedValue({
      id: 'journal-orig',
      organizationId: 'org-123',
      journalNumber: 'JE-2026-000001',
      status: JournalStatus.VALIDATED,
      lines: [
        { lineNumber: 1, accountId: 'acc-1', debit: 100, credit: 0, account: { isActive: true } },
        { lineNumber: 2, accountId: 'acc-2', debit: 0, credit: 100, account: { isActive: true } },
      ],
    });

    await expect(
      service.reverseJournal('org-123', 'journal-orig', {}, mockOrgContext, mockActor),
    ).rejects.toThrow('Only POSTED journals can be reversed');
  });

  it('rejects duplicate reversal if journal was already reversed', async () => {
    prisma.journalEntry.findFirst.mockResolvedValue({
      id: 'journal-orig',
      organizationId: 'org-123',
      journalNumber: 'JE-2026-000001',
      status: JournalStatus.POSTED,
      reversedByJournalId: 'journal-existing-reversal',
      lines: [
        { lineNumber: 1, accountId: 'acc-1', debit: 100, credit: 0, account: { isActive: true } },
        { lineNumber: 2, accountId: 'acc-2', debit: 0, credit: 100, account: { isActive: true } },
      ],
    });

    await expect(
      service.reverseJournal('org-123', 'journal-orig', {}, mockOrgContext, mockActor),
    ).rejects.toThrow('has already been reversed');
  });
});
