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

  // Audit
  { code: 'audit.view', description: 'View audit logs', category: 'Audit' },
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
    'ledger.view',
    'ledger.export',
    'trial_balance.view',
    'trial_balance.export',
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
    'ledger.view',
    'trial_balance.view',
  ],
};
