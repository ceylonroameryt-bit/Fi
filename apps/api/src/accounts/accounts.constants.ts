import { AccountSubtype, AccountType, NormalBalance } from '@prisma/client';

export interface AccountTemplateDef {
  code: string;
  name: string;
  type: AccountType;
  subtype: AccountSubtype;
  normalBalance: NormalBalance;
  reportGroup: string;
  description: string;
  allowManualPosting: boolean;
  isControlAccount?: boolean;
}

export const DEFAULT_CHART_OF_ACCOUNTS: AccountTemplateDef[] = [
  // 1000–1999 Assets (Normal balance: DEBIT)
  { code: '1000', name: 'Cash', type: AccountType.ASSET, subtype: AccountSubtype.CASH, normalBalance: NormalBalance.DEBIT, reportGroup: 'Current Assets', description: 'Physical cash on hand', allowManualPosting: true },
  { code: '1010', name: 'Main Bank Account', type: AccountType.ASSET, subtype: AccountSubtype.BANK, normalBalance: NormalBalance.DEBIT, reportGroup: 'Current Assets', description: 'Operating checking account', allowManualPosting: true },
  { code: '1020', name: 'Savings Account', type: AccountType.ASSET, subtype: AccountSubtype.BANK, normalBalance: NormalBalance.DEBIT, reportGroup: 'Current Assets', description: 'Reserve savings account', allowManualPosting: true },
  { code: '1030', name: 'Petty Cash', type: AccountType.ASSET, subtype: AccountSubtype.CASH, normalBalance: NormalBalance.DEBIT, reportGroup: 'Current Assets', description: 'Office petty cash float', allowManualPosting: true },
  { code: '1100', name: 'Accounts Receivable', type: AccountType.ASSET, subtype: AccountSubtype.ACCOUNTS_RECEIVABLE, normalBalance: NormalBalance.DEBIT, reportGroup: 'Current Assets', description: 'Amounts due from customers', allowManualPosting: true, isControlAccount: true },
  { code: '1200', name: 'Inventory', type: AccountType.ASSET, subtype: AccountSubtype.INVENTORY, normalBalance: NormalBalance.DEBIT, reportGroup: 'Current Assets', description: 'Finished goods for resale', allowManualPosting: true },
  { code: '1300', name: 'Prepayments', type: AccountType.ASSET, subtype: AccountSubtype.CURRENT_ASSET, normalBalance: NormalBalance.DEBIT, reportGroup: 'Current Assets', description: 'Expenses paid in advance', allowManualPosting: true },
  { code: '1500', name: 'Equipment', type: AccountType.ASSET, subtype: AccountSubtype.FIXED_ASSET, normalBalance: NormalBalance.DEBIT, reportGroup: 'Fixed Assets', description: 'Operating machinery and equipment', allowManualPosting: true },
  { code: '1510', name: 'Computer Equipment', type: AccountType.ASSET, subtype: AccountSubtype.FIXED_ASSET, normalBalance: NormalBalance.DEBIT, reportGroup: 'Fixed Assets', description: 'Laptops, servers, workstations', allowManualPosting: true },
  { code: '1520', name: 'Furniture', type: AccountType.ASSET, subtype: AccountSubtype.FIXED_ASSET, normalBalance: NormalBalance.DEBIT, reportGroup: 'Fixed Assets', description: 'Desks, chairs, office fitout', allowManualPosting: true },
  { code: '1600', name: 'Vehicles', type: AccountType.ASSET, subtype: AccountSubtype.FIXED_ASSET, normalBalance: NormalBalance.DEBIT, reportGroup: 'Fixed Assets', description: 'Company vehicles', allowManualPosting: true },
  { code: '1700', name: 'Accumulated Depreciation', type: AccountType.ASSET, subtype: AccountSubtype.ACCUMULATED_DEPRECIATION, normalBalance: NormalBalance.DEBIT, reportGroup: 'Fixed Assets', description: 'Cumulative contra-asset depreciation', allowManualPosting: true },

  // 2000–2999 Liabilities (Normal balance: CREDIT)
  { code: '2000', name: 'Accounts Payable', type: AccountType.LIABILITY, subtype: AccountSubtype.ACCOUNTS_PAYABLE, normalBalance: NormalBalance.CREDIT, reportGroup: 'Current Liabilities', description: 'Amounts owed to suppliers', allowManualPosting: true, isControlAccount: true },
  { code: '2100', name: 'Tax Payable', type: AccountType.LIABILITY, subtype: AccountSubtype.TAX_PAYABLE, normalBalance: NormalBalance.CREDIT, reportGroup: 'Current Liabilities', description: 'VAT / sales tax liability', allowManualPosting: true },
  { code: '2200', name: 'Payroll Liabilities', type: AccountType.LIABILITY, subtype: AccountSubtype.CURRENT_LIABILITY, normalBalance: NormalBalance.CREDIT, reportGroup: 'Current Liabilities', description: 'PAYE and National Insurance / social security', allowManualPosting: true },
  { code: '2300', name: 'Credit Card', type: AccountType.LIABILITY, subtype: AccountSubtype.CURRENT_LIABILITY, normalBalance: NormalBalance.CREDIT, reportGroup: 'Current Liabilities', description: 'Corporate credit cards', allowManualPosting: true },
  { code: '2400', name: 'Short-Term Loan', type: AccountType.LIABILITY, subtype: AccountSubtype.CURRENT_LIABILITY, normalBalance: NormalBalance.CREDIT, reportGroup: 'Current Liabilities', description: 'Loans due within 12 months', allowManualPosting: true },
  { code: '2500', name: 'Long-Term Loan', type: AccountType.LIABILITY, subtype: AccountSubtype.LONG_TERM_LIABILITY, normalBalance: NormalBalance.CREDIT, reportGroup: 'Non-Current Liabilities', description: 'Bank loans due after 12 months', allowManualPosting: true },
  { code: '2600', name: 'Accrued Expenses', type: AccountType.LIABILITY, subtype: AccountSubtype.CURRENT_LIABILITY, normalBalance: NormalBalance.CREDIT, reportGroup: 'Current Liabilities', description: 'Incurred expenses not yet billed', allowManualPosting: true },

  // 3000–3999 Equity (Normal balance: CREDIT)
  { code: '3000', name: 'Owner Capital', type: AccountType.EQUITY, subtype: AccountSubtype.OWNER_EQUITY, normalBalance: NormalBalance.CREDIT, reportGroup: 'Equity', description: 'Capital contributed by owner', allowManualPosting: true },
  { code: '3100', name: 'Owner Drawings', type: AccountType.EQUITY, subtype: AccountSubtype.OWNER_EQUITY, normalBalance: NormalBalance.CREDIT, reportGroup: 'Equity', description: 'Funds withdrawn by owner (contra equity)', allowManualPosting: true },
  { code: '3200', name: 'Share Capital', type: AccountType.EQUITY, subtype: AccountSubtype.OWNER_EQUITY, normalBalance: NormalBalance.CREDIT, reportGroup: 'Equity', description: 'Nominal share capital', allowManualPosting: true },
  { code: '3300', name: 'Retained Earnings', type: AccountType.EQUITY, subtype: AccountSubtype.RETAINED_EARNINGS, normalBalance: NormalBalance.CREDIT, reportGroup: 'Equity', description: 'Cumulative profits retained', allowManualPosting: false, isControlAccount: true },
  { code: '3400', name: 'Current Year Earnings', type: AccountType.EQUITY, subtype: AccountSubtype.RETAINED_EARNINGS, normalBalance: NormalBalance.CREDIT, reportGroup: 'Equity', description: 'Current period net profit / loss', allowManualPosting: false, isControlAccount: true },

  // 4000–4999 Revenue (Normal balance: CREDIT)
  { code: '4000', name: 'Sales Revenue', type: AccountType.REVENUE, subtype: AccountSubtype.SALES, normalBalance: NormalBalance.CREDIT, reportGroup: 'Operating Revenue', description: 'Sale of products', allowManualPosting: true },
  { code: '4100', name: 'Service Revenue', type: AccountType.REVENUE, subtype: AccountSubtype.SERVICE_REVENUE, normalBalance: NormalBalance.CREDIT, reportGroup: 'Operating Revenue', description: 'Client fee income', allowManualPosting: true },
  { code: '4200', name: 'Consulting Revenue', type: AccountType.REVENUE, subtype: AccountSubtype.SERVICE_REVENUE, normalBalance: NormalBalance.CREDIT, reportGroup: 'Operating Revenue', description: 'Consulting services rendered', allowManualPosting: true },
  { code: '4300', name: 'Subscription Revenue', type: AccountType.REVENUE, subtype: AccountSubtype.SERVICE_REVENUE, normalBalance: NormalBalance.CREDIT, reportGroup: 'Operating Revenue', description: 'Recurring software / retainer subscriptions', allowManualPosting: true },
  { code: '4400', name: 'Other Revenue', type: AccountType.REVENUE, subtype: AccountSubtype.OTHER_INCOME, normalBalance: NormalBalance.CREDIT, reportGroup: 'Other Revenue', description: 'Interest, miscellaneous earnings', allowManualPosting: true },

  // 5000–5999 Cost of Sales (Normal balance: DEBIT)
  { code: '5000', name: 'Cost of Goods Sold', type: AccountType.EXPENSE, subtype: AccountSubtype.COST_OF_SALES, normalBalance: NormalBalance.DEBIT, reportGroup: 'Cost of Sales', description: 'Direct inventory cost sold', allowManualPosting: true },
  { code: '5100', name: 'Direct Labour', type: AccountType.EXPENSE, subtype: AccountSubtype.COST_OF_SALES, normalBalance: NormalBalance.DEBIT, reportGroup: 'Cost of Sales', description: 'Direct project / billable staff labour', allowManualPosting: true },
  { code: '5200', name: 'Materials', type: AccountType.EXPENSE, subtype: AccountSubtype.COST_OF_SALES, normalBalance: NormalBalance.DEBIT, reportGroup: 'Cost of Sales', description: 'Raw materials consumed', allowManualPosting: true },
  { code: '5300', name: 'Direct Costs', type: AccountType.EXPENSE, subtype: AccountSubtype.COST_OF_SALES, normalBalance: NormalBalance.DEBIT, reportGroup: 'Cost of Sales', description: 'Subcontractors and direct production expenses', allowManualPosting: true },

  // 6000–6999 Operating Expenses (Normal balance: DEBIT)
  { code: '6000', name: 'Rent', type: AccountType.EXPENSE, subtype: AccountSubtype.OPERATING_EXPENSE, normalBalance: NormalBalance.DEBIT, reportGroup: 'Operating Expenses', description: 'Office premises rent', allowManualPosting: true },
  { code: '6010', name: 'Electricity', type: AccountType.EXPENSE, subtype: AccountSubtype.OPERATING_EXPENSE, normalBalance: NormalBalance.DEBIT, reportGroup: 'Operating Expenses', description: 'Utilities - power', allowManualPosting: true },
  { code: '6020', name: 'Water', type: AccountType.EXPENSE, subtype: AccountSubtype.OPERATING_EXPENSE, normalBalance: NormalBalance.DEBIT, reportGroup: 'Operating Expenses', description: 'Utilities - water', allowManualPosting: true },
  { code: '6030', name: 'Internet', type: AccountType.EXPENSE, subtype: AccountSubtype.OPERATING_EXPENSE, normalBalance: NormalBalance.DEBIT, reportGroup: 'Operating Expenses', description: 'Telecommunications & broadband', allowManualPosting: true },
  { code: '6100', name: 'Salaries', type: AccountType.EXPENSE, subtype: AccountSubtype.OPERATING_EXPENSE, normalBalance: NormalBalance.DEBIT, reportGroup: 'Operating Expenses', description: 'Administrative staff payroll', allowManualPosting: true },
  { code: '6200', name: 'Advertising', type: AccountType.EXPENSE, subtype: AccountSubtype.OPERATING_EXPENSE, normalBalance: NormalBalance.DEBIT, reportGroup: 'Operating Expenses', description: 'Marketing, ads, campaigns', allowManualPosting: true },
  { code: '6300', name: 'Software', type: AccountType.EXPENSE, subtype: AccountSubtype.OPERATING_EXPENSE, normalBalance: NormalBalance.DEBIT, reportGroup: 'Operating Expenses', description: 'SaaS tools, licences, cloud hosting', allowManualPosting: true },
  { code: '6400', name: 'Insurance', type: AccountType.EXPENSE, subtype: AccountSubtype.OPERATING_EXPENSE, normalBalance: NormalBalance.DEBIT, reportGroup: 'Operating Expenses', description: 'Professional indemnity and public liability', allowManualPosting: true },
  { code: '6500', name: 'Travel', type: AccountType.EXPENSE, subtype: AccountSubtype.OPERATING_EXPENSE, normalBalance: NormalBalance.DEBIT, reportGroup: 'Operating Expenses', description: 'Business travel and accommodation', allowManualPosting: true },
  { code: '6600', name: 'Professional Fees', type: AccountType.EXPENSE, subtype: AccountSubtype.OPERATING_EXPENSE, normalBalance: NormalBalance.DEBIT, reportGroup: 'Operating Expenses', description: 'Legal, tax and accounting services', allowManualPosting: true },
  { code: '6700', name: 'Office Supplies', type: AccountType.EXPENSE, subtype: AccountSubtype.OPERATING_EXPENSE, normalBalance: NormalBalance.DEBIT, reportGroup: 'Operating Expenses', description: 'Stationery and consumable supplies', allowManualPosting: true },
  { code: '6800', name: 'Bank Fees', type: AccountType.EXPENSE, subtype: AccountSubtype.OPERATING_EXPENSE, normalBalance: NormalBalance.DEBIT, reportGroup: 'Operating Expenses', description: 'Account maintenance and transfer fees', allowManualPosting: true },
  { code: '6900', name: 'Depreciation', type: AccountType.EXPENSE, subtype: AccountSubtype.OPERATING_EXPENSE, normalBalance: NormalBalance.DEBIT, reportGroup: 'Operating Expenses', description: 'Periodic depreciation charge', allowManualPosting: true },
];

export function getExpectedNormalBalance(type: AccountType): NormalBalance {
  switch (type) {
    case AccountType.ASSET:
    case AccountType.EXPENSE:
      return NormalBalance.DEBIT;
    case AccountType.LIABILITY:
    case AccountType.EQUITY:
    case AccountType.REVENUE:
      return NormalBalance.CREDIT;
  }
}
