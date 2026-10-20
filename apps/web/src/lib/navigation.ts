/**
 * Single source of truth for Blynt's information architecture.
 *
 * The sidebar, the ⌘K command palette and the dead-link test all read from here,
 * so a page cannot appear in the menu without existing (see navigation.spec.ts).
 *
 * Labels say what happens to money ("Money in"); the accounting term sits
 * underneath ("Sales") so owners and accountants both find their way.
 */

export type SystemRoleKey = 'OWNER' | 'ADMINISTRATOR' | 'ACCOUNTANT' | 'BOOKKEEPER' | 'VIEWER';

/** Simple = business-owner view (no accountant tools). Pro = everything the role allows. */
export type NavMode = 'simple' | 'pro';

export type NavIconName =
  | 'home'
  | 'inbox'
  | 'moneyIn'
  | 'moneyOut'
  | 'bank'
  | 'reports'
  | 'books'
  | 'settings';

export interface NavItem {
  label: string;
  href: string;
  /** Extra words people might type into ⌘K to find this page. */
  keywords?: string[];
}

export interface NavHub {
  id: string;
  label: string;
  /** Accounting term shown under the plain-language label. */
  hint?: string;
  icon: NavIconName;
  /** Direct link (hubs without children). */
  href?: string;
  items?: NavItem[];
  /** Roles that see this hub. Omitted = everyone. Backend permissions still apply. */
  roles?: SystemRoleKey[];
  /** Only shown in Pro view. */
  proOnly?: boolean;
  /** Rendered in the sidebar footer instead of the main list. */
  footer?: boolean;
  /** Section heading rendered above this hub. */
  section?: string;
}

const EDITORS: SystemRoleKey[] = ['OWNER', 'ADMINISTRATOR', 'ACCOUNTANT', 'BOOKKEEPER'];
const ADMINS: SystemRoleKey[] = ['OWNER', 'ADMINISTRATOR'];

export const NAV_HUBS: NavHub[] = [
  { id: 'home', label: 'Home', icon: 'home', href: '/' },
  {
    id: 'inbox',
    label: 'Inbox',
    hint: 'AI drafts & documents',
    icon: 'inbox',
    roles: EDITORS,
    items: [
      {
        label: 'AI drafts to review',
        href: '/purchases/review',
        keywords: ['review queue', 'approve', 'ai'],
      },
      {
        label: 'Uploaded documents',
        href: '/accounting/documents',
        keywords: ['upload', 'receipt', 'document intelligence'],
      },
    ],
  },
  {
    id: 'moneyIn',
    label: 'Money in',
    hint: 'Sales',
    icon: 'moneyIn',
    section: 'YOUR MONEY',
    items: [
      { label: 'Invoices', href: '/sales/invoices', keywords: ['sales', 'bill customer'] },
      { label: 'Customers', href: '/sales/contacts', keywords: ['clients', 'contacts', 'debtors'] },
      { label: 'Payments received', href: '/sales/payments', keywords: ['receipts', 'paid'] },
      { label: 'Credit notes', href: '/sales/credit-notes', keywords: ['refund'] },
    ],
  },
  {
    id: 'moneyOut',
    label: 'Money out',
    hint: 'Purchases',
    icon: 'moneyOut',
    items: [
      { label: 'Bills', href: '/purchases/bills', keywords: ['purchases', 'invoices received', 'payables'] },
      { label: 'Expenses', href: '/purchases/expenses', keywords: ['receipts', 'mileage', 'claims'] },
      { label: 'Suppliers', href: '/purchases/suppliers', keywords: ['vendors', 'creditors', 'contacts'] },
      { label: 'Supplier payments', href: '/purchases/payments', keywords: ['pay run', 'pay bills'] },
    ],
  },
  {
    id: 'bank',
    label: 'Bank',
    hint: 'Cash & reconciliation',
    icon: 'bank',
    items: [
      { label: 'Transactions', href: '/banking/transactions', keywords: ['confirm', 'categorise', 'feed'] },
      {
        label: 'Reconcile',
        href: '/banking/reconciliation',
        keywords: ['reconciliation', 'match statement'],
      },
      { label: 'Bank accounts', href: '/banking/accounts', keywords: ['add bank'] },
      { label: 'Bank rules', href: '/banking/rules', keywords: ['automation', 'auto categorise'] },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    hint: 'How am I doing?',
    icon: 'reports',
    items: [
      { label: 'All reports', href: '/reports' },
      {
        label: 'Profit & loss',
        href: '/reports/profit-and-loss',
        keywords: ['p&l', 'income statement', 'profit'],
      },
      { label: 'Balance sheet', href: '/reports/balance-sheet', keywords: ['assets', 'liabilities'] },
      { label: 'Cash flow', href: '/reports/cash-flow', keywords: ['forecast', 'runway'] },
      { label: 'VAT returns', href: '/reports/vat', keywords: ['hmrc', 'mtd', 'tax'] },
      {
        label: 'Who owes you (AR)',
        href: '/reports/ar-ageing',
        keywords: ['aged debtors', 'receivables', 'ar ageing'],
      },
      {
        label: 'Who you owe (AP)',
        href: '/reports/ap-ageing',
        keywords: ['aged creditors', 'payables', 'ap ageing'],
      },
    ],
  },
  {
    id: 'books',
    label: 'Books',
    hint: 'Accountant tools',
    icon: 'books',
    section: 'ACCOUNTANT',
    proOnly: true,
    roles: EDITORS,
    items: [
      { label: 'Journals', href: '/accounting/journals', keywords: ['manual journal', 'je'] },
      { label: 'General ledger', href: '/accounting/general-ledger', keywords: ['gl', 'ledger'] },
      { label: 'Trial balance', href: '/reports/trial-balance', keywords: ['tb'] },
      {
        label: 'Chart of accounts',
        href: '/accounting/chart-of-accounts',
        keywords: ['nominal codes', 'coa'],
      },
      { label: 'Accounting periods', href: '/accounting/periods', keywords: ['lock', 'close', 'month end'] },
      { label: 'Financial years', href: '/accounting/financial-years', keywords: ['year end'] },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'settings',
    footer: true,
    roles: ADMINS,
    items: [
      { label: 'Organisation', href: '/settings/organization', keywords: ['company details', 'vat number'] },
      {
        label: 'Invoice settings',
        href: '/settings/invoice-settings',
        keywords: ['branding', 'logo', 'numbering'],
      },
      { label: 'Integrations', href: '/settings/integrations', keywords: ['connect', 'apps'] },
      { label: 'Users & invites', href: '/settings/users', keywords: ['team', 'invite'] },
      { label: 'Roles & permissions', href: '/settings/roles', keywords: ['access'] },
      { label: 'Taxes & VAT', href: '/settings/taxes', keywords: ['tax codes', 'vat scheme'] },
      { label: 'AI preferences', href: '/settings/ai', keywords: ['automation', 'business context'] },
      { label: 'Security', href: '/settings/security', keywords: ['mfa', '2fa', 'sessions', 'password'] },
      { label: 'Audit log', href: '/settings/audit-logs', keywords: ['history', 'activity'] },
      { label: 'Data integrity', href: '/settings/accounting-integrity', keywords: ['checks', 'health'] },
    ],
  },
];

/** Pages reachable from ⌘K and the user menu even when their hub is hidden. */
export const PERSONAL_LINKS: NavItem[] = [
  {
    label: 'Security & sessions',
    href: '/settings/security',
    keywords: ['mfa', 'password', 'sign out devices'],
  },
];

export interface QuickAction {
  label: string;
  href: string;
  keywords?: string[];
  roles?: SystemRoleKey[];
}

/** "Create new…" actions shown in the sidebar button and ⌘K. */
export const QUICK_ACTIONS: QuickAction[] = [
  {
    label: 'New invoice',
    href: '/sales/invoices/new',
    keywords: ['create invoice', 'bill customer'],
    roles: EDITORS,
  },
  {
    label: 'New manual journal',
    href: '/accounting/journals/new',
    keywords: ['create journal', 'accrual'],
    roles: EDITORS,
  },
  {
    label: 'Upload bills or receipts',
    href: '/accounting/documents',
    keywords: ['scan', 'upload'],
    roles: EDITORS,
  },
  { label: 'New customer', href: '/sales/contacts', keywords: ['add customer'], roles: EDITORS },
  {
    label: 'New supplier',
    href: '/purchases/suppliers',
    keywords: ['add supplier', 'vendor'],
    roles: EDITORS,
  },
  {
    label: 'Add bank account',
    href: '/banking/accounts',
    keywords: ['connect bank'],
    roles: ADMINS.concat(['ACCOUNTANT']),
  },
];

function roleAllowed(roles: SystemRoleKey[] | undefined, role: SystemRoleKey | null): boolean {
  if (!roles) return true;
  // Unknown/custom roles: show the hub; the API enforces real permissions.
  if (!role) return true;
  return roles.includes(role);
}

/** Hubs this person should see in the sidebar. */
export function visibleHubs(role: SystemRoleKey | null, mode: NavMode): NavHub[] {
  return NAV_HUBS.filter((hub) => roleAllowed(hub.roles, role) && (!hub.proOnly || mode === 'pro'));
}

export function visibleQuickActions(role: SystemRoleKey | null): QuickAction[] {
  return QUICK_ACTIONS.filter((a) => roleAllowed(a.roles, role));
}

/** Default view: accounting roles start in Pro, owners and viewers in Simple. */
export function defaultNavMode(role: SystemRoleKey | null): NavMode {
  return role === 'ACCOUNTANT' || role === 'ADMINISTRATOR' || role === 'BOOKKEEPER' ? 'pro' : 'simple';
}

export function toSystemRoleKey(value: string | null | undefined): SystemRoleKey | null {
  const keys: SystemRoleKey[] = ['OWNER', 'ADMINISTRATOR', 'ACCOUNTANT', 'BOOKKEEPER', 'VIEWER'];
  return value && (keys as string[]).includes(value) ? (value as SystemRoleKey) : null;
}

/** True when `pathname` is this link or a page beneath it. Home only matches exactly. */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The hub that owns the current page (used to auto-expand it). */
export function hubForPath(pathname: string, hubs: NavHub[] = NAV_HUBS): NavHub | undefined {
  let best: { hub: NavHub; length: number } | undefined;
  for (const hub of hubs) {
    const links = hub.href ? [hub.href] : (hub.items ?? []).map((i) => i.href);
    for (const href of links) {
      if (isActivePath(pathname, href) && (!best || href.length > best.length)) {
        best = { hub, length: href.length };
      }
    }
  }
  return best?.hub;
}

export interface SearchEntry {
  title: string;
  group: 'Actions' | 'Pages';
  /** Hub label, shown as breadcrumb context. */
  context: string;
  href: string;
  keywords: string[];
}

/** Everything ⌘K can jump to for this person. */
export function buildSearchIndex(role: SystemRoleKey | null): SearchEntry[] {
  const entries: SearchEntry[] = visibleQuickActions(role).map((a) => ({
    title: a.label,
    group: 'Actions',
    context: 'Create',
    href: a.href,
    keywords: a.keywords ?? [],
  }));
  // ⌘K searches every page the role may open, including Pro-only hubs in Simple view.
  for (const hub of visibleHubs(role, 'pro')) {
    if (hub.href) {
      entries.push({
        title: hub.label,
        group: 'Pages',
        context: hub.hint ?? '',
        href: hub.href,
        keywords: [],
      });
    }
    for (const item of hub.items ?? []) {
      entries.push({
        title: item.label,
        group: 'Pages',
        context: hub.label,
        href: item.href,
        keywords: item.keywords ?? [],
      });
    }
  }
  for (const link of PERSONAL_LINKS) {
    if (!entries.some((e) => e.href === link.href)) {
      entries.push({
        title: link.label,
        group: 'Pages',
        context: 'You',
        href: link.href,
        keywords: link.keywords ?? [],
      });
    }
  }
  return entries;
}

/** Ranks entries for a query: title prefix > title word > keyword > context. */
export function searchEntries(index: SearchEntry[], query: string, limit = 12): SearchEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return index.slice(0, limit);
  const scored: { entry: SearchEntry; score: number }[] = [];
  for (const entry of index) {
    const title = entry.title.toLowerCase();
    let score = 0;
    if (title.startsWith(q)) score = 100;
    else if (title.split(/[\s&()]+/).some((w) => w.startsWith(q))) score = 80;
    else if (title.includes(q)) score = 60;
    else if (entry.keywords.some((k) => k.toLowerCase().includes(q))) score = 40;
    else if (entry.context.toLowerCase().includes(q)) score = 20;
    if (score > 0) scored.push({ entry, score: score + (entry.group === 'Actions' ? 5 : 0) });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title))
    .slice(0, limit)
    .map((s) => s.entry);
}
