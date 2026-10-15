import { AccountingClassificationService } from './accounting-classification.service';
import { MoneyService } from '../../accounting-engine/money.service';
import { Account, AccountSubtype, Contact } from '@prisma/client';
import { ClassifiedLineResult } from './line-classification.service';
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
          taxClassification: 'UK_SR',
          accountingCategory: SemanticCategory.FUEL_INVENTORY,
          confidence: 0.98,
        },
      ];

      const contact: Contact = {
        id: 'sup-0092',
        name: 'ABC Fuel Ltd',
      } as Contact;

      const intent = await service.buildAccountingIntent('org-1', 'PURCHASE', lines, contact);

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
          taxClassification: 'UK_SR',
          accountingCategory: SemanticCategory.FUEL_SALE,
          confidence: 0.98,
        },
      ];

      const contact: Contact = {
        id: 'cus-0031',
        name: 'XYZ Transport Ltd',
      } as Contact;

      const intent = await service.buildAccountingIntent('org-1', 'SALE', lines, contact);

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
      expect(intent.inventoryValuationNotice).toContain('not estimated by AI');
    });
  });

  describe('Stage 4 safety', () => {
    const line = (over: Partial<ClassifiedLineResult> = {}): ClassifiedLineResult => ({
      lineNumber: 1,
      description: 'Consultancy',
      quantity: null,
      unitPrice: null,
      netAmount: '100.00',
      taxAmount: '20.00',
      totalAmount: '120.00',
      productType: 'UNKNOWN',
      productClassification: SemanticCategory.GENERAL_EXPENSE,
      taxClassification: 'UK_SR',
      accountingCategory: SemanticCategory.GENERAL_EXPENSE,
      confidence: 0.5,
      ...over,
    });
    const supplier = { id: 'sup-1', name: 'ABC Ltd' } as Contact;

    it('BUG-13: an unrecognised line gets no account (was: first active account) and is flagged', async () => {
      const intent = await service.buildAccountingIntent('org-1', 'PURCHASE', [line()], supplier);
      expect(intent.lines[0].accountId).toBeNull();
      expect(intent.isComplete).toBe(false);
      expect(intent.missing).toContain('Line 1: account');
    });

    it('flags missing VAT, tax code, supplier and lines instead of filling them in', async () => {
      const intent = await service.buildAccountingIntent(
        'org-1',
        'PURCHASE',
        [line({ taxAmount: null, taxClassification: null, accountingCategory: SemanticCategory.FUEL_INVENTORY })],
        null,
      );
      expect(intent.missing).toEqual(expect.arrayContaining(['Line 1: VAT amount', 'Line 1: tax code', 'Supplier']));
      const empty = await service.buildAccountingIntent('org-1', 'PURCHASE', [], supplier);
      expect(empty.missing).toContain('No line items were found on the document');
    });

    it('calculates the control total from net + VAT, never from the document total', async () => {
      const intent = await service.buildAccountingIntent(
        'org-1',
        'PURCHASE',
        [line({ accountingCategory: SemanticCategory.FUEL_INVENTORY, totalAmount: '999.99' })],
        supplier,
      );
      expect(intent.lines.find((l) => l.accountCode === '2100')?.credit).toBe('120.00');
      expect(intent.isBalanced).toBe(true);
    });

    it('does not pick between several accounts of the same kind', async () => {
      mockDb.account.findMany.mockResolvedValue([...mockAccounts, { ...mockAccounts[0], id: 'acc-inv-1210', code: '1210' }]);
      const intent = await service.buildAccountingIntent(
        'org-1',
        'PURCHASE',
        [line({ accountingCategory: SemanticCategory.FUEL_INVENTORY })],
        supplier,
      );
      expect(intent.lines[0].accountId).toBeNull();
    });
  });
});
