import { Test, TestingModule } from '@nestjs/testing';
import { ContactType, Prisma } from '@prisma/client';
import { ContactSubledgerService } from './contact-subledger.service';
import { PrismaService } from '../database/prisma.service';
import { MoneyService } from '../accounting-engine/money.service';
import { DomainException } from '../common/errors/domain.exception';

describe('ContactSubledgerService', () => {
  let service: ContactSubledgerService;
  let prisma: {
    journalLine: {
      findMany: jest.Mock;
      count: jest.Mock;
    };
    contact: {
      findFirst: jest.Mock;
    };
  };

  const orgId = 'org-1111';
  const customerId = 'cust-2222';

  beforeEach(async () => {
    prisma = {
      journalLine: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      contact: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactSubledgerService,
        MoneyService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ContactSubledgerService>(ContactSubledgerService);
  });

  describe('getCustomerBalance', () => {
    it('calculates net AR debit balance correctly from posted journal lines', async () => {
      prisma.journalLine.findMany.mockResolvedValue([
        { debit: new Prisma.Decimal('1200.00'), credit: new Prisma.Decimal('0.00') },
        { debit: new Prisma.Decimal('0.00'), credit: new Prisma.Decimal('200.00') },
      ]);

      const balance = await service.getCustomerBalance(orgId, customerId);
      expect(balance).toBe('1000.00');
    });

    it('returns 0.00 when balanced / reversed', async () => {
      prisma.journalLine.findMany.mockResolvedValue([
        { debit: new Prisma.Decimal('1200.00'), credit: new Prisma.Decimal('0.00') },
        { debit: new Prisma.Decimal('0.00'), credit: new Prisma.Decimal('1200.00') },
      ]);

      const balance = await service.getCustomerBalance(orgId, customerId);
      expect(balance).toBe('0.00');
    });
  });

  describe('getSupplierBalance', () => {
    it('calculates net AP credit balance correctly from posted journal lines', async () => {
      prisma.journalLine.findMany.mockResolvedValue([
        { debit: new Prisma.Decimal('0.00'), credit: new Prisma.Decimal('500.00') },
        { debit: new Prisma.Decimal('100.00'), credit: new Prisma.Decimal('0.00') },
      ]);

      const balance = await service.getSupplierBalance(orgId, customerId);
      expect(balance).toBe('400.00');
    });

    it('returns 0.00 when no AP lines exist', async () => {
      prisma.journalLine.findMany.mockResolvedValue([]);

      const balance = await service.getSupplierBalance(orgId, customerId);
      expect(balance).toBe('0.00');
    });
  });

  describe('getCustomerStatement', () => {
    it('rejects if contact is SUPPLIER-only', async () => {
      prisma.contact.findFirst.mockResolvedValue({
        id: customerId,
        name: 'Supplier Only Ltd',
        type: ContactType.SUPPLIER,
        organization: { baseCurrency: 'GBP' },
      });

      await expect(
        service.getCustomerStatement(orgId, customerId, {}),
      ).rejects.toThrow(DomainException);
    });

    it('generates customer statement with opening, running, and closing balance', async () => {
      prisma.contact.findFirst.mockResolvedValue({
        id: customerId,
        name: 'Acme Client',
        type: ContactType.CUSTOMER,
        organization: { baseCurrency: 'GBP' },
      });

      // Opening balance query
      prisma.journalLine.findMany
        .mockResolvedValueOnce([
          { debit: new Prisma.Decimal('300.00'), credit: new Prisma.Decimal('0.00') },
        ])
        // Page lines query
        .mockResolvedValueOnce([
          {
            id: 'line-1',
            debit: new Prisma.Decimal('500.00'),
            credit: new Prisma.Decimal('0.00'),
            description: 'Invoice INV-100',
            journalEntry: {
              id: 'je-1',
              journalNumber: 'JE-100',
              journalDate: new Date('2026-04-10'),
              postingDate: new Date('2026-04-10'),
              reference: 'INV-100',
              sourceType: 'INVOICE',
              sourceId: 'inv-1',
              description: 'Invoice INV-100',
            },
          },
          {
            id: 'line-2',
            debit: new Prisma.Decimal('0.00'),
            credit: new Prisma.Decimal('200.00'),
            description: 'Credit payment',
            journalEntry: {
              id: 'je-2',
              journalNumber: 'JE-101',
              journalDate: new Date('2026-04-15'),
              postingDate: new Date('2026-04-15'),
              reference: 'PAY-100',
              sourceType: 'MANUAL',
              sourceId: null,
              description: 'Payment',
            },
          },
        ])
        // All period lines query (for closing balance)
        .mockResolvedValueOnce([
          { debit: new Prisma.Decimal('500.00'), credit: new Prisma.Decimal('0.00') },
          { debit: new Prisma.Decimal('0.00'), credit: new Prisma.Decimal('200.00') },
        ]);

      prisma.journalLine.count.mockResolvedValue(2);

      const statement = await service.getCustomerStatement(orgId, customerId, {
        from: '2026-04-01',
        to: '2026-04-30',
      });

      expect(statement.openingBalance).toBe('300.00');
      expect(statement.closingBalance).toBe('600.00'); // 300 + 500 - 200 = 600
      expect(statement.items).toHaveLength(2);
      expect(statement.items[0].runningBalance).toBe('800.00'); // 300 + 500
      expect(statement.items[1].runningBalance).toBe('600.00'); // 800 - 200
    });
  });
});
