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
});
