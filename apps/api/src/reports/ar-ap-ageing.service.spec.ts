import { Test, TestingModule } from '@nestjs/testing';
import { BillStatus, InvoiceStatus, Prisma } from '@prisma/client';
import { ArApAgeingService } from './ar-ap-ageing.service';
import { PrismaService } from '../database/prisma.service';
import { DomainException } from '../common/errors/domain.exception';

describe('ArApAgeingService', () => {
  let service: ArApAgeingService;
  let prisma: any;

  const mockOrg = {
    id: 'org-1',
    name: 'Blynt Technologies Ltd',
    baseCurrency: 'GBP',
  };

  const mockCustomer = {
    id: 'cust-1',
    name: 'Acme Corp',
    companyName: 'Acme International Ltd',
  };

  const mockSupplier = {
    id: 'sup-1',
    name: 'AWS Cloud Services',
    companyName: 'Amazon Web Services UK',
  };

  beforeEach(async () => {
    prisma = {
      organization: {
        findUnique: jest.fn().mockResolvedValue(mockOrg),
      },
      invoice: {
        findMany: jest.fn(),
      },
      bill: {
        findMany: jest.fn(),
      },
      // Allocations as at the date: here, each document's amountPaid fixture.
      paymentAllocation: {
        groupBy: jest.fn().mockImplementation(async ({ by }: any) => {
          const key = by[0];
          const source = key === 'invoiceId' ? prisma.invoice.findMany : prisma.bill.findMany;
          const docs = (await source.mock.results[source.mock.results.length - 1]?.value) ?? [];
          return docs.map((d: any) => ({ [key]: d.id, _sum: { amount: d.amountPaid } }));
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArApAgeingService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ArApAgeingService>(ArApAgeingService);
  });

  describe('generateArAgeing', () => {
    it('throws ORGANIZATION_NOT_FOUND when organization does not exist', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);

      await expect(
        service.generateArAgeing('invalid', {})
      ).rejects.toThrow(DomainException);
    });

    it('correctly categorises invoices across ageing buckets and ignores fully paid invoices', async () => {
      const invoices = [
        // Current: due after asOf
        {
          id: 'inv-1',
          invoiceNumber: 'INV-001',
          issueDate: new Date('2026-03-15'),
          dueDate: new Date('2026-04-15'),
          totalAmount: new Prisma.Decimal('1000.00'),
          amountPaid: new Prisma.Decimal('0.00'),
          status: InvoiceStatus.POSTED,
          contactId: 'cust-1',
          contact: mockCustomer,
        },
        // 1-30 days overdue: due 2026-03-15 (16 days overdue)
        {
          id: 'inv-2',
          invoiceNumber: 'INV-002',
          issueDate: new Date('2026-02-15'),
          dueDate: new Date('2026-03-15'),
          totalAmount: new Prisma.Decimal('500.00'),
          amountPaid: new Prisma.Decimal('100.00'), // 400 due
          status: InvoiceStatus.PARTIALLY_PAID,
          contactId: 'cust-1',
          contact: mockCustomer,
        },
        // 31-60 days overdue: due 2026-02-10 (49 days overdue)
        {
          id: 'inv-3',
          invoiceNumber: 'INV-003',
          issueDate: new Date('2026-01-10'),
          dueDate: new Date('2026-02-10'),
          totalAmount: new Prisma.Decimal('300.00'),
          amountPaid: new Prisma.Decimal('0.00'),
          status: InvoiceStatus.POSTED,
          contactId: 'cust-1',
          contact: mockCustomer,
        },
        // Fully paid invoice: should be omitted
        {
          id: 'inv-paid',
          invoiceNumber: 'INV-PAID',
          issueDate: new Date('2026-01-01'),
          dueDate: new Date('2026-01-31'),
          totalAmount: new Prisma.Decimal('750.00'),
          amountPaid: new Prisma.Decimal('750.00'),
          status: InvoiceStatus.POSTED,
          contactId: 'cust-1',
          contact: mockCustomer,
        },
      ];

      prisma.invoice.findMany.mockResolvedValue(invoices);

      const report = await service.generateArAgeing('org-1', {
        asOfDate: '2026-03-31',
      });

      expect(report.reportType).toBe('AR_AGEING');
      expect(report.totalCount).toBe(3); // 3 unpaid invoices
      expect(report.groups.length).toBe(1);

      const group = report.groups[0];
      expect(group.contactName).toBe('Acme Corp');
      expect(group.totals.current).toBe('1000.00');
      expect(group.totals.days1To30).toBe('400.00');
      expect(group.totals.days31To60).toBe('300.00');
      expect(group.totals.days61To90).toBe('0.00');
      expect(group.totals.days90Plus).toBe('0.00');
      expect(group.totals.total).toBe('1700.00');

      expect(report.summaryTotals.total).toBe('1700.00');
    });
  });

  describe('generateApAgeing', () => {
    it('correctly aggregates bills into ageing buckets for suppliers', async () => {
      const bills = [
        // 90+ days overdue: due 2025-11-30 (> 120 days overdue)
        {
          id: 'bill-old',
          billNumber: 'BILL-999',
          issueDate: new Date('2025-10-31'),
          dueDate: new Date('2025-11-30'),
          totalAmount: new Prisma.Decimal('2500.00'),
          amountPaid: new Prisma.Decimal('0.00'),
          status: BillStatus.POSTED,
          contactId: 'sup-1',
          contact: mockSupplier,
        },
      ];

      prisma.bill.findMany.mockResolvedValue(bills);

      const report = await service.generateApAgeing('org-1', {
        asOfDate: '2026-03-31',
      });

      expect(report.reportType).toBe('AP_AGEING');
      expect(report.totalCount).toBe(1);
      expect(report.summaryTotals.days90Plus).toBe('2500.00');
      expect(report.summaryTotals.total).toBe('2500.00');
    });
  });

  describe('exportArAgeingCsv and exportApAgeingCsv', () => {
    it('generates valid CSV string with headers and totals', async () => {
      prisma.invoice.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          invoiceNumber: 'INV-001',
          issueDate: new Date('2026-03-15'),
          dueDate: new Date('2026-04-15'),
          totalAmount: new Prisma.Decimal('1000.00'),
          amountPaid: new Prisma.Decimal('0.00'),
          status: InvoiceStatus.POSTED,
          contactId: 'cust-1',
          contact: mockCustomer,
        },
      ]);

      const csv = await service.exportArAgeingCsv('org-1', { asOfDate: '2026-03-31' });
      expect(csv).toContain('Blynt Technologies Ltd - Aged Debtors (AR Ageing)');
      expect(csv).toContain('Acme Corp');
      expect(csv).toContain('INV-001');
      expect(csv).toContain('GRAND TOTAL');
    });
  });
});
