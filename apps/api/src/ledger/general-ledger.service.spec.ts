import { Test, TestingModule } from '@nestjs/testing';
import { AccountType, JournalStatus } from '@prisma/client';
import { GeneralLedgerService } from './general-ledger.service';
import { MoneyService } from '../accounting-engine/money.service';
import { PrismaService } from '../database/prisma.service';

describe('GeneralLedgerService (Phase 11)', () => {
  let service: GeneralLedgerService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      journalLine: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      account: {
        findFirst: jest.fn(),
      },
      accountingPeriod: {
        findFirst: jest.fn(),
      },
      financialYear: {
        findFirst: jest.fn(),
      },
      organization: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeneralLedgerService,
        MoneyService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<GeneralLedgerService>(GeneralLedgerService);
  });

  it('queries only POSTED and REVERSED journals, strictly excluding DRAFT and VALIDATED', async () => {
    prisma.journalLine.findMany.mockResolvedValue([]);
    prisma.journalLine.count.mockResolvedValue(0);

    await service.getGeneralLedger('org-123', {});

    const query = prisma.journalLine.findMany.mock.calls[0][0];
    expect(query.where.journalEntry.status).toEqual({
      in: [JournalStatus.POSTED, JournalStatus.REVERSED],
    });
  });

  it('calculates running balance for a debit-normal account (Bank)', async () => {
    prisma.account.findFirst.mockResolvedValue({
      id: 'acc-bank',
      code: '1010',
      name: 'Main Bank Account',
      accountType: AccountType.ASSET,
    });

    // Journal 1: Bank DR £10,000
    // Journal 2: Bank CR £2,000
    prisma.journalLine.findMany.mockResolvedValue([
      {
        id: 'line-1',
        debit: 10000,
        credit: 0,
        description: 'Capital injected',
        journalEntry: {
          id: 'j-1',
          journalNumber: 'JE-2026-000001',
          journalType: 'GENERAL',
          sourceType: 'MANUAL',
          status: JournalStatus.POSTED,
          journalDate: new Date('2026-04-01'),
          postingDate: new Date('2026-04-01'),
          reference: 'CAP-01',
        },
      },
      {
        id: 'line-2',
        debit: 0,
        credit: 2000,
        description: 'Rent payment',
        journalEntry: {
          id: 'j-2',
          journalNumber: 'JE-2026-000002',
          journalType: 'GENERAL',
          sourceType: 'MANUAL',
          status: JournalStatus.POSTED,
          journalDate: new Date('2026-04-05'),
          postingDate: new Date('2026-04-05'),
          reference: 'RENT-01',
        },
      },
    ]);

    const result = await service.getAccountLedger('org-123', 'acc-bank', {});

    expect(result.account.code).toBe('1010');
    expect(result.account.normalBalance).toBe('DEBIT');
    expect(result.totalDebits).toBe('10000.00');
    expect(result.totalCredits).toBe('2000.00');
    expect(result.closingBalance).toBe('8000.00');

    expect(result.transactions[0].runningBalance).toBe('10000.00');
    expect(result.transactions[1].runningBalance).toBe('8000.00');
  });

  it('calculates running balance for a credit-normal account (Owner Capital)', async () => {
    prisma.account.findFirst.mockResolvedValue({
      id: 'acc-cap',
      code: '3010',
      name: 'Owner Capital',
      accountType: AccountType.EQUITY,
    });

    prisma.journalLine.findMany.mockResolvedValue([
      {
        id: 'line-1',
        debit: 0,
        credit: 25000,
        description: 'Initial capital',
        journalEntry: {
          id: 'j-1',
          journalNumber: 'JE-2026-000001',
          journalType: 'GENERAL',
          sourceType: 'MANUAL',
          status: JournalStatus.POSTED,
          journalDate: new Date('2026-04-01'),
          postingDate: new Date('2026-04-01'),
          reference: 'CAP',
        },
      },
    ]);

    const result = await service.getAccountLedger('org-123', 'acc-cap', {});

    expect(result.account.normalBalance).toBe('CREDIT');
    expect(result.closingBalance).toBe('25000.00');
    expect(result.transactions[0].runningBalance).toBe('25000.00');
  });

  it('exports formatted CSV document', async () => {
    prisma.organization.findUnique.mockResolvedValue({
      name: 'Alpha Ltd',
      baseCurrency: 'GBP',
    });

    prisma.journalLine.findMany.mockResolvedValue([]);
    prisma.journalLine.count.mockResolvedValue(0);

    const csv = await service.exportLedgerCsv('org-123', {});

    expect(csv).toContain('"Organisation","Alpha Ltd"');
    expect(csv).toContain('"Report","General Ledger"');
    expect(csv).toContain('"Currency","GBP"');
  });
});
