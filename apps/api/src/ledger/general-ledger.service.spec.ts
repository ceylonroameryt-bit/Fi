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

  it('paginates and exports datasets larger than 10,000 rows without truncation', async () => {
    prisma.organization.findUnique.mockResolvedValue({
      name: 'Alpha Ltd',
      baseCurrency: 'GBP',
    });

    const totalRecords = 10005;
    prisma.journalLine.count.mockResolvedValue(totalRecords);

    // Mock findMany returning 1,000 records per batch
    const makeBatch = (count: number, startIndex: number) =>
      Array.from({ length: count }, (_, i) => ({
        id: `line-${startIndex + i}`,
        debit: 10,
        credit: 0,
        description: startIndex + i === 0 ? '=cmd|\' /C calc\'!A0' : `Entry ${startIndex + i}`,
        account: { id: 'acc-1', code: '1000', name: 'Sales', accountType: AccountType.REVENUE },
        journalEntry: {
          id: `j-${startIndex + i}`,
          journalNumber: `JE-${startIndex + i}`,
          journalType: 'SALES',
          sourceType: 'INVOICE',
          status: JournalStatus.POSTED,
          journalDate: new Date('2026-04-01'),
          postingDate: new Date('2026-04-01'),
          reference: 'INV-1',
        },
      }));

    let callCount = 0;
    prisma.journalLine.findMany.mockImplementation(() => {
      callCount++;
      if (callCount <= 10) {
        return Promise.resolve(makeBatch(1000, (callCount - 1) * 1000));
      } else if (callCount === 11) {
        return Promise.resolve(makeBatch(5, 10000));
      }
      return Promise.resolve([]);
    });

    const csv = await service.exportLedgerCsv('org-123', {});

    const lines = csv.split('\r\n');
    // Header lines: 4 metadata lines, 1 blank, 1 column header = 6 lines
    const dataLines = lines.slice(6).filter((l) => l.trim().length > 0);

    // Reconcile row count: exactly 10,005 data lines exported
    expect(dataLines).toHaveLength(totalRecords);

    // Verify formula neutralization on malicious description
    expect(dataLines[0]).toContain('"\'=cmd|\' /C calc\'!A0"');

    // Reconcile debit totals: each row has 10.00 debit, total = 100,050.00
    const totalExportedDebit = dataLines.reduce((acc, row) => {
      const parts = row.split(',');
      const debitStr = parts[7].replace(/"/g, '');
      return acc + parseFloat(debitStr);
    }, 0);
    expect(totalExportedDebit).toBe(totalRecords * 10);
  });
});
