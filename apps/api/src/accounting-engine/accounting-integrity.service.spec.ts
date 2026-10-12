import { Test, TestingModule } from '@nestjs/testing';
import { AccountingIntegrityService } from './accounting-integrity.service';
import { MoneyService } from './money.service';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('AccountingIntegrityService (Phase 13)', () => {
  let service: AccountingIntegrityService;
  let prisma: any;
  let audit: any;

  beforeEach(async () => {
    prisma = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      journalEntry: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      journalLine: {
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { debit: null, credit: null } }),
      },
      accountingPeriod: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    audit = {
      record: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountingIntegrityService,
        MoneyService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<AccountingIntegrityService>(AccountingIntegrityService);
  });

  it('passes all 7 accounting controls when system state is intact', async () => {
    const summary = await service.runIntegrityChecks('org-123');

    expect(summary.allPassed).toBe(true);
    expect(summary.totalChecks).toBe(7);
    expect(summary.passedChecks).toBe(7);
    expect(summary.failedChecks).toBe(0);
  });

  it('detects unbalanced posted journal entry', async () => {
    prisma.journalEntry.findMany.mockResolvedValueOnce([
      {
        id: 'j-corrupted',
        journalNumber: 'JE-2026-999999',
        lines: [
          { debit: 1000, credit: 0 },
          { debit: 0, credit: 900 },
        ],
      },
    ]);

    const result = await service.checkPostedJournalBalance('org-123');

    expect(result.passed).toBe(false);
    const details = result.details as Array<{ diff: string }>;
    expect(details[0].diff).toBe('100.0000');
  });

  it('detects cross-tenant account leakage', async () => {
    prisma.journalLine.findMany.mockResolvedValueOnce([
      { id: 'line-bad', journalEntryId: 'j-1', accountId: 'acc-other-org' },
    ]);

    const result = await service.checkCrossTenantReferences('org-123');

    expect(result.passed).toBe(false);
    expect(result.message).toContain('cross-tenant');
  });

  it('detects duplicate journal numbers and serializes numeric counts cleanly', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([
      { journal_number: 'JE-2026-000001', count: 2n },
    ]);

    const result = await service.checkDuplicateJournalNumbers('org-123');

    expect(result.passed).toBe(false);
    expect(result.message).toContain('JE-2026-000001');
    const details = result.details as Array<{ journal_number: string; count: number }>;
    expect(details[0].count).toBe(2);
    expect(typeof details[0].count).toBe('number');
  });

  it('ignores periods without lockedAt when checking locked period violations', async () => {
    prisma.accountingPeriod.findMany.mockResolvedValueOnce([
      {
        id: 'p-1',
        name: 'April 2026',
        startDate: new Date('2026-04-01'),
        endDate: new Date('2026-04-30'),
        lockedAt: null,
      },
    ]);

    const result = await service.checkLockedPeriodViolations('org-123');

    expect(result.passed).toBe(true);
    expect(prisma.journalEntry.findMany).not.toHaveBeenCalled();
  });
});
