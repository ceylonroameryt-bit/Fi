import { SystemRoleKey } from '@prisma/client';

export interface SystemPermissionDef {
  code: string;
  description: string;
  category: string;
}

export const SYSTEM_PERMISSIONS: SystemPermissionDef[] = [
  // Organization
  { code: 'organization.view', description: 'View organisation settings and details', category: 'Organization' },
  { code: 'organization.edit', description: 'Modify organisation settings', category: 'Organization' },
  { code: 'organization.archive', description: 'Archive organisation', category: 'Organization' },

  // Users & Members
  { code: 'users.view', description: 'View organisation members and invitations', category: 'Users' },
  { code: 'users.manage', description: 'Invite, update, and remove members', category: 'Users' },

  // Roles
  { code: 'roles.view', description: 'View custom and system roles', category: 'Roles' },
  { code: 'roles.manage', description: 'Create and update custom roles', category: 'Roles' },

  // Chart of accounts
  { code: 'account.view', description: 'View chart of accounts', category: 'Accounts' },
  { code: 'account.create', description: 'Create new ledger accounts', category: 'Accounts' },
  { code: 'account.edit', description: 'Edit existing ledger accounts', category: 'Accounts' },
  { code: 'account.archive', description: 'Archive and restore ledger accounts', category: 'Accounts' },

  // Financial years
  { code: 'financial_year.view', description: 'View financial years', category: 'Financial Years' },
  { code: 'financial_year.create', description: 'Create financial years and periods', category: 'Financial Years' },
  { code: 'financial_year.edit', description: 'Edit financial year details', category: 'Financial Years' },

  // Accounting periods
  { code: 'period.view', description: 'View accounting periods and lock status', category: 'Periods' },
  { code: 'period.create', description: 'Generate periods for financial years', category: 'Periods' },
  { code: 'period.lock', description: 'Lock periods (soft or hard lock)', category: 'Periods' },
  { code: 'period.unlock', description: 'Unlock accounting periods', category: 'Periods' },

  // Journals
  { code: 'journal.view', description: 'View journals and journal lines', category: 'Journals' },
  { code: 'journal.create', description: 'Create draft manual journals', category: 'Journals' },
  { code: 'journal.edit_draft', description: 'Edit draft manual journals', category: 'Journals' },
  { code: 'journal.delete_draft', description: 'Delete draft manual journals', category: 'Journals' },
  { code: 'journal.validate', description: 'Run validation engine on manual journals', category: 'Journals' },

  // Accounting & Reporting
  { code: 'journal.post', description: 'Post validated journals to general ledger', category: 'Journals' },
  { code: 'journal.reverse', description: 'Reverse posted journals', category: 'Journals' },
  { code: 'ledger.view', description: 'View general ledger entries', category: 'Reporting' },
  { code: 'ledger.export', description: 'Export general ledger data', category: 'Reporting' },
  { code: 'trial_balance.view', description: 'View trial balance', category: 'Reporting' },
  { code: 'trial_balance.export', description: 'Export trial balance data', category: 'Reporting' },
  { code: 'vat_return.view', description: 'View VAT return and drill-down', category: 'Reporting' },
  { code: 'accounting_integrity.view', description: 'View system-wide accounting integrity diagnostics', category: 'Controls' },

  // Contacts
  { code: 'contact.view', description: 'View customers and suppliers', category: 'Contacts' },
  { code: 'contact.create', description: 'Create customers and suppliers', category: 'Contacts' },
  { code: 'contact.edit', description: 'Edit customers and suppliers', category: 'Contacts' },
  { code: 'contact.archive', description: 'Archive and restore contacts', category: 'Contacts' },

  // Invoicing
  { code: 'invoice.view', description: 'View sales invoices', category: 'Invoicing' },
  { code: 'invoice.create', description: 'Create draft sales invoices', category: 'Invoicing' },
  { code: 'invoice.edit_draft', description: 'Edit draft sales invoices', category: 'Invoicing' },
  { code: 'invoice.delete_draft', description: 'Delete draft sales invoices', category: 'Invoicing' },
  { code: 'invoice.post', description: 'Approve and post sales invoices to General Ledger', category: 'Invoicing' },
  { code: 'invoice.void', description: 'Void posted sales invoices and reverse ledger journals', category: 'Invoicing' },

  // Supplier bills
  { code: 'bill.view', description: 'View supplier bills', category: 'Purchases' },
  { code: 'bill.create', description: 'Create draft supplier bills', category: 'Purchases' },
  { code: 'bill.edit_draft', description: 'Edit draft supplier bills', category: 'Purchases' },
  { code: 'bill.delete_draft', description: 'Delete draft supplier bills', category: 'Purchases' },
  { code: 'bill.approve', description: 'Approve and post supplier bills to the General Ledger', category: 'Purchases' },
  { code: 'bill.void', description: 'Void posted supplier bills by reversing their journals', category: 'Purchases' },

  // Payments & Receipts
  { code: 'payment.view', description: 'View customer receipts and supplier payments', category: 'Payments' },
  { code: 'payment.create', description: 'Create and post customer receipts and supplier payments', category: 'Payments' },
  { code: 'payment.void', description: 'Void payments and reverse ledger journals', category: 'Payments' },
  { code: 'payment.allocate', description: 'Allocate payments to invoices and bills', category: 'Payments' },

  // Credit Notes
  { code: 'credit_note.view', description: 'View credit notes', category: 'Credit Notes' },
  { code: 'credit_note.create', description: 'Create draft credit notes', category: 'Credit Notes' },
  { code: 'credit_note.edit_draft', description: 'Edit draft credit notes', category: 'Credit Notes' },
  { code: 'credit_note.delete_draft', description: 'Delete draft credit notes', category: 'Credit Notes' },
  { code: 'credit_note.post', description: 'Post credit notes to General Ledger', category: 'Credit Notes' },
  { code: 'credit_note.void', description: 'Void credit notes and reverse ledger journals', category: 'Credit Notes' },

  // Banking
  { code: 'bank_account.view', description: 'View bank accounts and statements', category: 'Banking' },
  { code: 'bank_account.manage', description: 'Create and update bank accounts', category: 'Banking' },
  { code: 'bank_statement.import', description: 'Import bank statements (CSV/OFX/QIF)', category: 'Banking' },
  { code: 'bank_statement.view', description: 'View imported bank transactions', category: 'Banking' },
  { code: 'bank_reconciliation.manage', description: 'Reconcile bank statement lines to ledger', category: 'Banking' },
  { code: 'bank_rules.manage', description: 'Create and apply automated bank rules', category: 'Banking' },

  // Audit
  { code: 'audit.view', description: 'View audit logs', category: 'Audit' },

  // AI
  { code: 'ai.manage', description: 'Turn AI features on/off and edit the business profile', category: 'AI' },
  { code: 'ai.usage.view', description: 'View AI usage and cost', category: 'AI' },
  { code: 'ai_draft.approve', description: 'Approve or reject AI-prepared drafts', category: 'AI' },
];

export const SYSTEM_ROLE_PERMISSIONS: Record<SystemRoleKey, string[]> = {
  OWNER: SYSTEM_PERMISSIONS.map((p) => p.code),
  ADMINISTRATOR: SYSTEM_PERMISSIONS.map((p) => p.code).filter(
    (code) => code !== 'organization.archive',
  ),
  ACCOUNTANT: [
    'organization.view',
    'users.view',
    'roles.view',
    'account.view',
    'account.create',
    'account.edit',
    'account.archive',
    'financial_year.view',
    'financial_year.create',
    'financial_year.edit',
    'period.view',
    'period.create',
    'period.lock',
    'period.unlock',
    'journal.view',
    'journal.create',
    'journal.edit_draft',
    'journal.delete_draft',
    'journal.validate',
    'journal.post',
    'journal.reverse',
    'contact.view',
    'contact.create',
    'contact.edit',
    'contact.archive',
    'invoice.view',
    'invoice.create',
    'invoice.edit_draft',
    'invoice.delete_draft',
    'invoice.post',
    'invoice.void',
    'bill.view',
    'bill.create',
    'bill.edit_draft',
    'bill.delete_draft',
    'bill.approve',
    'bill.void',
    'payment.view',
    'payment.create',
    'payment.void',
    'payment.allocate',
    'credit_note.view',
    'credit_note.create',
    'credit_note.edit_draft',
    'credit_note.delete_draft',
    'credit_note.post',
    'credit_note.void',
    'bank_account.view',
    'bank_account.manage',
    'bank_statement.import',
    'bank_statement.view',
    'bank_reconciliation.manage',
    'bank_rules.manage',
    'ledger.view',
    'ledger.export',
    'trial_balance.view',
    'trial_balance.export',
    'vat_return.view',
    'ai.usage.view',
    'ai_draft.approve',
    'accounting_integrity.view',
    'audit.view',
  ],
  BOOKKEEPER: [
    'organization.view',
    'account.view',
    'financial_year.view',
    'period.view',
    'journal.view',
    'journal.create',
    'journal.edit_draft',
    'journal.delete_draft',
    'journal.validate',
    'contact.view',
    'contact.create',
    'contact.edit',
    'invoice.view',
    'invoice.create',
    'invoice.edit_draft',
    'bill.view',
    'bill.create',
    'bill.edit_draft',
    'payment.view',
    'payment.create',
    'payment.allocate',
    'credit_note.view',
    'bank_account.view',
    'bank_statement.view',
    'bank_statement.import',
    'ledger.view',
    'ledger.export',
    'trial_balance.view',
    'trial_balance.export',
  ],
  VIEWER: [
    'organization.view',
    'account.view',
    'financial_year.view',
    'period.view',
    'journal.view',
    'contact.view',
    'invoice.view',
    'bill.view',
    'payment.view',
    'credit_note.view',
    'bank_account.view',
    'bank_statement.view',
    'ledger.view',
    'trial_balance.view',
  ],
};
