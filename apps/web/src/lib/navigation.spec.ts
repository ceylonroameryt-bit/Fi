import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  NAV_HUBS,
  QUICK_ACTIONS,
  PERSONAL_LINKS,
  visibleHubs,
  defaultNavMode,
  isActivePath,
  hubForPath,
  buildSearchIndex,
  searchEntries,
  toSystemRoleKey,
} from './navigation';

const APP_DIR = fileURLToPath(new URL('../app', import.meta.url));

function pageExists(href: string): boolean {
  const route = href === '/' ? '' : href.replace(/^\//, '');
  return existsSync(join(APP_DIR, route, 'page.tsx'));
}

const allHrefs = [
  ...NAV_HUBS.flatMap((h) => [h.href, ...(h.items ?? []).map((i) => i.href)]).filter((x): x is string => !!x),
  ...QUICK_ACTIONS.map((a) => a.href),
  ...PERSONAL_LINKS.map((l) => l.href),
];

describe('navigation model', () => {
  it('every menu, ⌘K and quick-action link points to a page that exists (no dead links)', () => {
    const missing = [...new Set(allHrefs)].filter((href) => !pageExists(href));
    expect(missing).toEqual([]);
  });

  it('never lists the same page twice in the sidebar', () => {
    const sidebar = NAV_HUBS.flatMap((h) => (h.items ?? []).map((i) => i.href));
    expect(new Set(sidebar).size).toBe(sidebar.length);
  });

  it('keeps the sidebar to at most 8 top-level hubs', () => {
    expect(NAV_HUBS.length).toBeLessThanOrEqual(8);
  });

  it('hides accountant tools in Simple view and shows them in Pro view', () => {
    expect(visibleHubs('OWNER', 'simple').map((h) => h.id)).not.toContain('books');
    expect(visibleHubs('OWNER', 'pro').map((h) => h.id)).toContain('books');
  });

  it('only shows Settings to owners and administrators', () => {
    expect(visibleHubs('OWNER', 'pro').map((h) => h.id)).toContain('settings');
    expect(visibleHubs('ADMINISTRATOR', 'pro').map((h) => h.id)).toContain('settings');
    for (const role of ['ACCOUNTANT', 'BOOKKEEPER', 'VIEWER'] as const) {
      expect(visibleHubs(role, 'pro').map((h) => h.id)).not.toContain('settings');
    }
  });

  it('gives viewers a read-only menu: no Inbox, no Books, no create actions', () => {
    const ids = visibleHubs('VIEWER', 'pro').map((h) => h.id);
    expect(ids).not.toContain('inbox');
    expect(ids).not.toContain('books');
    expect(buildSearchIndex('VIEWER').filter((e) => e.group === 'Actions')).toEqual([]);
  });

  it('shows every hub for unknown custom roles (the API still enforces permissions)', () => {
    expect(visibleHubs(null, 'pro')).toHaveLength(NAV_HUBS.length);
  });

  it('defaults accounting roles to Pro and owners to Simple', () => {
    expect(defaultNavMode('ACCOUNTANT')).toBe('pro');
    expect(defaultNavMode('BOOKKEEPER')).toBe('pro');
    expect(defaultNavMode('OWNER')).toBe('simple');
    expect(defaultNavMode(null)).toBe('simple');
  });

  it('maps role system keys safely', () => {
    expect(toSystemRoleKey('ACCOUNTANT')).toBe('ACCOUNTANT');
    expect(toSystemRoleKey('CUSTOM')).toBeNull();
    expect(toSystemRoleKey(null)).toBeNull();
  });
});

describe('active link matching', () => {
  it('matches a page and its children, but Home only exactly', () => {
    expect(isActivePath('/sales/invoices/123', '/sales/invoices')).toBe(true);
    expect(isActivePath('/sales/invoices-old', '/sales/invoices')).toBe(false);
    expect(isActivePath('/sales/invoices', '/')).toBe(false);
    expect(isActivePath('/', '/')).toBe(true);
  });

  it('finds the hub that owns a page so it can be expanded', () => {
    expect(hubForPath('/sales/invoices/new')?.id).toBe('moneyIn');
    expect(hubForPath('/reports/trial-balance')?.id).toBe('books');
    expect(hubForPath('/reports/vat')?.id).toBe('reports');
    expect(hubForPath('/')?.id).toBe('home');
  });
});

describe('⌘K search', () => {
  const index = buildSearchIndex('ACCOUNTANT');

  it('includes Pro-only pages even for people in Simple view', () => {
    expect(buildSearchIndex('OWNER').some((e) => e.href === '/accounting/journals')).toBe(true);
  });

  it('finds pages by title, by keyword and by plain-language synonyms', () => {
    expect(
      searchEntries(index, 'invoice')
        .slice(0, 2)
        .map((e) => e.title),
    ).toEqual(['Invoices', 'New invoice']);
    expect(searchEntries(index, 'p&l').map((e) => e.href)).toContain('/reports/profit-and-loss');
    expect(searchEntries(index, 'hmrc').map((e) => e.href)).toContain('/reports/vat');
    expect(searchEntries(index, 'aged debtors').map((e) => e.href)).toContain('/reports/ar-ageing');
  });

  it('returns nothing for nonsense and a capped list for an empty query', () => {
    expect(searchEntries(index, 'zzzzqqq')).toEqual([]);
    expect(searchEntries(index, '', 5)).toHaveLength(5);
  });
});
