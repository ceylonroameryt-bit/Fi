import { AccountingSafetyService } from './accounting-safety.service';
import { MoneyService } from '../../accounting-engine/money.service';
import { BadRequestException } from '@nestjs/common';
import { ProposedAccountingIntent } from '../document-intelligence/accounting-classification.service';

describe('AccountingSafetyService (Guardrails)', () => {
  let safety: AccountingSafetyService;
  let money: MoneyService;

  const mockDb = {
    account: {
      findMany: jest.fn(),
    },
    contact: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(() => {
    money = new MoneyService();
    safety = new AccountingSafetyService(mockDb as any, money);
    jest.clearAllMocks();
  });

  it('passes when debits equal credits and accounts are active and valid', async () => {
    const intent: ProposedAccountingIntent = {
      direction: 'PURCHASE',
      lines: [
        {
          accountId: 'acc-1',
          accountCode: '1200',
          accountName: 'Fuel Inventory',
          debit: '12000.00',
          credit: '0.00',
          description: 'Diesel',
          category: 'FUEL_INVENTORY',
        },
        {
          accountId: 'acc-2',
          accountCode: '2200',
          accountName: 'Input VAT',
          debit: '2400.00',
          credit: '0.00',
          description: 'Input VAT',
          category: 'INPUT_VAT',
        },
        {
          accountId: 'acc-3',
          accountCode: '2100',
          accountName: 'Accounts Payable',
          debit: '0.00',
          credit: '14400.00',
          description: 'Payable',
          category: 'ACCOUNTS_PAYABLE',
        },
      ],
      totalDebit: '14400.00',
      totalCredit: '14400.00',
      isBalanced: true,
    };

    mockDb.account.findMany.mockResolvedValue([
      { id: 'acc-1', code: '1200', name: 'Fuel Inventory', isActive: true },
      { id: 'acc-2', code: '2200', name: 'Input VAT', isActive: true },
      { id: 'acc-3', code: '2100', name: 'Accounts Payable', isActive: true },
    ]);

    mockDb.contact.findFirst.mockResolvedValue({
      id: 'sup-1',
      name: 'ABC Fuel Ltd',
      status: 'ACTIVE',
    });

    await expect(safety.validateAccountingSafety('org-1', intent, 'sup-1')).resolves.not.toThrow();
  });

  it('throws BadRequestException when debits do NOT equal credits', async () => {
    const unbalancedIntent: ProposedAccountingIntent = {
      direction: 'PURCHASE',
      lines: [
        {
          accountId: 'acc-1',
          accountCode: '1200',
          accountName: 'Fuel Inventory',
          debit: '12000.00',
          credit: '0.00',
          description: 'Diesel',
          category: 'FUEL_INVENTORY',
        },
        {
          accountId: 'acc-3',
          accountCode: '2100',
          accountName: 'Accounts Payable',
          debit: '0.00',
          credit: '11000.00', // Unbalanced!
          description: 'Payable',
          category: 'ACCOUNTS_PAYABLE',
        },
      ],
      totalDebit: '12000.00',
      totalCredit: '11000.00',
      isBalanced: false,
    };

    await expect(safety.validateAccountingSafety('org-1', unbalancedIntent)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws BadRequestException if negative debit or credit amount is provided', async () => {
    const negativeIntent: ProposedAccountingIntent = {
      direction: 'PURCHASE',
      lines: [
        {
          accountId: 'acc-1',
          accountCode: '1200',
          accountName: 'Fuel Inventory',
          debit: '-100.00',
          credit: '0.00',
          description: 'Diesel',
          category: 'FUEL_INVENTORY',
        },
      ],
      totalDebit: '-100.00',
      totalCredit: '0.00',
      isBalanced: false,
    };

    await expect(safety.validateAccountingSafety('org-1', negativeIntent)).rejects.toThrow(
      'Negative debit or credit amounts are strictly prohibited',
    );
  });

  it('throws BadRequestException if referenced contact is ARCHIVED', async () => {
    const intent: ProposedAccountingIntent = {
      direction: 'PURCHASE',
      lines: [
        {
          accountId: 'acc-1',
          accountCode: '1200',
          accountName: 'Fuel Inventory',
          debit: '100.00',
          credit: '0.00',
          description: 'Diesel',
          category: 'FUEL_INVENTORY',
        },
        {
          accountId: 'acc-3',
          accountCode: '2100',
          accountName: 'Accounts Payable',
          debit: '0.00',
          credit: '100.00',
          description: 'Payable',
          category: 'ACCOUNTS_PAYABLE',
        },
      ],
      totalDebit: '100.00',
      totalCredit: '100.00',
      isBalanced: true,
    };

    mockDb.account.findMany.mockResolvedValue([
      { id: 'acc-1', code: '1200', name: 'Fuel Inventory', isActive: true },
      { id: 'acc-3', code: '2100', name: 'Accounts Payable', isActive: true },
    ]);

    mockDb.contact.findFirst.mockResolvedValue({
      id: 'sup-archived',
      name: 'Old Supplier',
      status: 'ARCHIVED',
    });

    await expect(safety.validateAccountingSafety('org-1', intent, 'sup-archived')).rejects.toThrow(
      'archived',
    );
  });
});
