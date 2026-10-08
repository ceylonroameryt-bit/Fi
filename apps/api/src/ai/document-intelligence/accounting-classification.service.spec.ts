import { AccountingClassificationService } from './accounting-classification.service';
import { MoneyService } from '../../accounting-engine/money.service';
import { Account, AccountSubtype, Contact } from '@prisma/client';
import { ClassifiedLineResult } from './line-classification.service';
import { ResolvedTaxInfo } from './tax-classification.service';
import { SemanticCategory } from '../ai.constants';

describe('AccountingClassificationService (Deterministic Double-Entry Mapping)', () => {
  let service: AccountingClassificationService;
  let money: MoneyService;

  const mockAccounts: Account[] = [
    {
      id: 'acc-inv-1200',
      organizationId: 'org-1',
      code: '1200',
      name: 'Fuel Inventory',
      accountType: 'ASSET',
      accountSubtype: AccountSubtype.INVENTORY,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Account,
    {
      id: 'acc-sales-4000',
      organizationId: 'org-1',
      code: '4000',
      name: 'Fuel Sales Revenue',
      accountType: 'REVENUE',
      accountSubtype: AccountSubtype.SALES,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Account,
    {
      id: 'acc-vat-2200',
      organizationId: 'org-1',
      code: '2200',
      name: 'VAT Control Account',
      accountType: 'LIABILITY',
      accountSubtype: AccountSubtype.TAX_PAYABLE,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Account,
    {
      id: 'acc-ap-2100',
      organizationId: 'org-1',
      code: '2100',
      name: 'Accounts Payable',
      accountType: 'LIABILITY',
      accountSubtype: AccountSubtype.ACCOUNTS_PAYABLE,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Account,
    {
      id: 'acc-ar-1100',
      organizationId: 'org-1',
      code: '1100',
      name: 'Accounts Receivable',
      accountType: 'ASSET',
      accountSubtype: AccountSubtype.ACCOUNTS_RECEIVABLE,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Account,
  ];

  const mockDb = {
    account: {
      findMany: jest.fn().mockResolvedValue(mockAccounts),
    },
  };

  const mockTaxInfo: ResolvedTaxInfo = {
    taxCode: 'VAT_STANDARD_20',
    rate: '0.20',
    isRecoverable: true,
    taxAccountId: 'acc-vat-2200',
  };

  beforeEach(() => {
    money = new MoneyService();
    service = new AccountingClassificationService(mockDb as any, money);
    jest.clearAllMocks();
    mockDb.account.findMany.mockResolvedValue(mockAccounts);
  });

  describe('Scenario A: Fuel Purchase (ABC Fuel Ltd -> Blynt)', () => {
    it('generates Dr Fuel Inventory, Dr Input VAT, Cr Accounts Payable', async () => {
      const lines: ClassifiedLineResult[] = [
        {
          lineNumber: 1,
          description: '10,000 litres Diesel',
          quantity: '10000',
          unit: 'litre',
          unitPrice: '1.20',
          netAmount: '12000.00',
          taxAmount: '2400.00',
          totalAmount: '14400.00',
          productType: 'INVENTORY',
          productClassification: 'FUEL_DIESEL',
          taxClassification: 'VAT_STANDARD',
          accountingCategory: SemanticCategory.FUEL_INVENTORY,
          confidence: 0.98,
        },
      ];

      const contact: Contact = {
        id: 'sup-0092',
        name: 'ABC Fuel Ltd',
      } as Contact;

      const intent = await service.buildAccountingIntent('org-1', 'PURCHASE', lines, mockTaxInfo, contact);

      expect(intent.direction).toBe('PURCHASE');
      expect(intent.isBalanced).toBe(true);
      expect(intent.totalDebit).toBe('14400.00');
      expect(intent.totalCredit).toBe('14400.00');

      // Verify line 1: Dr Fuel Inventory £12,000
      const invLine = intent.lines.find((l) => l.accountCode === '1200');
      expect(invLine).toBeDefined();
      expect(invLine?.debit).toBe('12000.00');
      expect(invLine?.credit).toBe('0.00');

      // Verify line 2: Dr Input VAT £2,400
      const vatLine = intent.lines.find((l) => l.accountCode === '2200');
      expect(vatLine).toBeDefined();
      expect(vatLine?.debit).toBe('2400.00');
      expect(vatLine?.credit).toBe('0.00');

      // Verify line 3: Cr Accounts Payable £14,400
      const apLine = intent.lines.find((l) => l.accountCode === '2100');
      expect(apLine).toBeDefined();
      expect(apLine?.debit).toBe('0.00');
      expect(apLine?.credit).toBe('14400.00');
    });
  });

  describe('Scenario B: Fuel Sale (Blynt -> XYZ Transport Ltd)', () => {
    it('generates Dr Accounts Receivable, Cr Fuel Sales, Cr Output VAT, and sets stock valuation guardrail notice', async () => {
      const lines: ClassifiedLineResult[] = [
        {
          lineNumber: 1,
          description: '2,000 litres Diesel',
          quantity: '2000',
          unit: 'litre',
          unitPrice: '1.20',
          netAmount: '2400.00',
          taxAmount: '480.00',
          totalAmount: '2880.00',
          productType: 'INVENTORY',
          productClassification: 'FUEL_DIESEL',
          taxClassification: 'VAT_STANDARD',
          accountingCategory: SemanticCategory.FUEL_SALE,
          confidence: 0.98,
        },
      ];

      const contact: Contact = {
        id: 'cus-0031',
        name: 'XYZ Transport Ltd',
      } as Contact;

      const intent = await service.buildAccountingIntent('org-1', 'SALE', lines, mockTaxInfo, contact);

      expect(intent.direction).toBe('SALE');
      expect(intent.isBalanced).toBe(true);
      expect(intent.totalDebit).toBe('2880.00');
      expect(intent.totalCredit).toBe('2880.00');

      // Dr Accounts Receivable £2,880
      const arLine = intent.lines.find((l) => l.accountCode === '1100');
      expect(arLine).toBeDefined();
      expect(arLine?.debit).toBe('2880.00');
      expect(arLine?.credit).toBe('0.00');

      // Cr Fuel Sales Revenue £2,400
      const salesLine = intent.lines.find((l) => l.accountCode === '4000');
      expect(salesLine).toBeDefined();
      expect(salesLine?.debit).toBe('0.00');
      expect(salesLine?.credit).toBe('2400.00');

      // Cr Output VAT £480
      const vatLine = intent.lines.find((l) => l.accountCode === '2200');
      expect(vatLine).toBeDefined();
      expect(vatLine?.debit).toBe('0.00');
      expect(vatLine?.credit).toBe('480.00');

      // COGS Rule: Check that deterministic notice is attached and LLM does NOT calculate COGS
      expect(intent.inventoryValuationNotice).toBeDefined();
      expect(intent.inventoryValuationNotice).toContain('stock valuation engine');
      expect(intent.inventoryValuationNotice).toContain('not estimated by LLM');
    });
  });
});
