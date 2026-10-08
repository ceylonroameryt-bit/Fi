'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../context/auth-context';
import { BlyntLogo } from './blynt-logo';
import {
  LayoutDashboard,
  Users,
  FileText,
  CreditCard,
  Receipt,
  Truck,
  FileCheck,
  ArrowRightLeft,
  Landmark,
  CheckCheck,
  ListTree,
  BookOpenCheck,
  BookOpen,
  Scale,
  Sparkles,
  CalendarRange,
  CalendarClock,
  TrendingUp,
  Activity,
  Clock,
  History,
  FileSpreadsheet,
  Building2,
  Percent,
  Settings,
  Layers,
  ShieldCheck,
  ScrollText,
  Search,
  Bell,
  Menu,
  X,
  ChevronDown,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Info,
  Shield,
  LogOut,
  SlidersHorizontal,
} from 'lucide-react';

interface SearchResultItem {
  title: string;
  category: string;
  href: string;
  badge?: string;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, activeOrg, activeRole, userOrgs, switchOrg, logout, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const orgDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const notifDropdownRef = useRef<HTMLDivElement>(null);
  const currencyDropdownRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchFocused(false);
      }
      if (orgDropdownRef.current && !orgDropdownRef.current.contains(event.target as Node)) {
        setShowOrgDropdown(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (currencyDropdownRef.current && !currencyDropdownRef.current.contains(event.target as Node)) {
        setShowCurrencyDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile nav on route change
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F4F7FC',
        }}
      >
        <div
          style={{
            color: '#0C182F',
            fontSize: '0.9rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: '#FF705B',
            }}
          ></span>
          Loading Blynt workspace...
        </div>
      </div>
    );
  }

  if (!user) {
    if (typeof window !== 'undefined') router.push('/login');
    return null;
  }

  const userInitials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || 'JD';
  const userName = user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'John Doe';
  const roleTitle = activeRole?.name ?? 'Administrator';

  interface NavItem {
    label: string;
    href: string;
    icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  }

  interface NavSection {
    title?: string;
    items: NavItem[];
  }

  // Exact navigation categories and items from the official Blynt design reference
  const navSections: NavSection[] = [
    {
      items: [{ label: 'Dashboard', href: '/', icon: LayoutDashboard }],
    },
    {
      title: 'SALES',
      items: [
        { label: 'Customers', href: '/sales/contacts', icon: Users },
        { label: 'Invoices', href: '/sales/invoices', icon: FileText },
        { label: 'Payments', href: '/sales/payments', icon: CreditCard },
        { label: 'Credit Notes', href: '/sales/credit-notes', icon: Receipt },
      ],
    },
    {
      title: 'PURCHASES',
      items: [
        { label: 'Suppliers', href: '/purchases/suppliers', icon: Truck },
        { label: 'Bills', href: '/purchases/bills', icon: FileCheck },
        { label: 'Expenses', href: '/purchases/expenses', icon: CreditCard },
        { label: 'Supplier Payments', href: '/purchases/payments', icon: ArrowRightLeft },
      ],
    },
    {
      title: 'BANKING',
      items: [
        { label: 'Bank Accounts', href: '/banking/accounts', icon: Landmark },
        { label: 'Transactions', href: '/banking/transactions', icon: ArrowRightLeft },
        { label: 'Reconciliation', href: '/banking/reconciliation', icon: CheckCheck },
      ],
    },
    {
      title: 'ACCOUNTING',
      items: [
        { label: 'Document Intelligence', href: '/accounting/documents', icon: Sparkles },
        { label: 'Chart of Accounts', href: '/accounting/chart-of-accounts', icon: ListTree },
        { label: 'Journals', href: '/accounting/journals', icon: BookOpenCheck },
        { label: 'General Ledger', href: '/accounting/general-ledger', icon: BookOpen },
        { label: 'Trial Balance', href: '/reports/trial-balance', icon: Scale },
        { label: 'Financial Years', href: '/accounting/financial-years', icon: CalendarRange },
        { label: 'Accounting Periods', href: '/accounting/periods', icon: CalendarClock },
      ],
    },
    {
      title: 'REPORTS',
      items: [
        { label: 'Profit & Loss', href: '/reports/profit-and-loss', icon: TrendingUp },
        { label: 'Balance Sheet', href: '/reports/balance-sheet', icon: Scale },
        { label: 'Cash Flow', href: '/reports/cash-flow', icon: Activity },
        { label: 'AR Ageing', href: '/reports/ar-ageing', icon: Clock },
        { label: 'AP Ageing', href: '/reports/ap-ageing', icon: History },
        { label: 'VAT Reports', href: '/reports/vat', icon: FileSpreadsheet },
      ],
    },
    {
      title: 'SETTINGS',
      items: [
        { label: 'Organisation', href: '/settings/organization', icon: Building2 },
        { label: 'Users', href: '/settings/users', icon: Users },
        { label: 'Taxes', href: '/settings/taxes', icon: Percent },
        { label: 'Invoice Settings', href: '/settings/invoice-settings', icon: Settings },
        { label: 'Integrations', href: '/settings/integrations', icon: Layers },
        { label: 'Security', href: '/settings/security', icon: ShieldCheck },
        { label: 'Audit Log', href: '/settings/audit-logs', icon: ScrollText },
      ],
    },
  ];

  // Quick search directory
  const searchCatalog: SearchResultItem[] = [
    { title: 'Dashboard', category: 'Overview', href: '/' },
    { title: 'Invoices', category: 'Sales', href: '/sales/invoices' },
    { title: 'Customers', category: 'Sales', href: '/sales/contacts' },
    { title: 'Chart of Accounts', category: 'Accounting', href: '/accounting/chart-of-accounts' },
    {
      title: 'New Manual Journal',
      category: 'Accounting',
      href: '/accounting/journals/new',
      badge: 'Action',
    },
    { title: 'Trial Balance', category: 'Reports', href: '/reports/trial-balance' },
    { title: 'Financial Years', category: 'Accounting', href: '/accounting/financial-years' },
    { title: 'Accounting Periods', category: 'Accounting', href: '/accounting/periods' },
    { title: 'Audit Logs', category: 'Settings', href: '/settings/audit-logs' },
  ];

  const searchResults = searchQuery.trim()
    ? searchCatalog.filter(
        (item) =>
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.category.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : searchCatalog.slice(0, 5);

  return (
    <div className="app-container">
      {/* Mobile Drawer Overlay */}
      {mobileNavOpen && (
        <div className="mobile-drawer-overlay" onClick={() => setMobileNavOpen(false)} aria-hidden="true" />
      )}

      {/* Left Sidebar (Dark Navy matching design) */}
      <aside className={`sidebar ${mobileNavOpen ? 'mobile-open' : ''}`}>
        {/* Brand Header */}
        <div className="sidebar-header">
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
            <BlyntLogo size="sm" theme="dark" />
          </Link>

          {/* Close button for mobile */}
          <button
            className="mobile-close-btn"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Sections */}
        <nav className="sidebar-nav">
          {navSections.map((section, sIdx) => (
            <div key={section.title || `section-${sIdx}`} className="nav-group">
              {section.title && <div className="nav-section-title">{section.title}</div>}
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                const Icon = item.icon;

                return (
                  <Link key={item.label} href={item.href} className={`nav-link ${isActive ? 'active' : ''}`}>
                    <div className="nav-link-content">
                      <Icon size={16} className="nav-link-icon" />
                      <span>{item.label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="main-content">
        {/* Topbar matching official screenshot */}
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
            {/* Mobile menu trigger */}
            <button
              className="mobile-hamburger-btn"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu size={20} />
            </button>

            {/* Global Search Bar with ⌘ K shortcut badge */}
            <div className="topbar-search-wrap" ref={searchRef}>
              <Search size={15} className="topbar-search-icon" />
              <input
                type="text"
                className="topbar-search-input"
                placeholder="Search invoices, contacts, accounts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                style={{ paddingRight: '2.5rem' }}
              />
              <span
                style={{
                  position: 'absolute',
                  right: '0.65rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: '#94A3B8',
                  backgroundColor: '#F1F5F9',
                  padding: '0.15rem 0.35rem',
                  borderRadius: '4px',
                  pointerEvents: 'none',
                }}
              >
                ⌘ K
              </span>

              {/* Quick Search Popover */}
              {searchFocused && (
                <div className="search-results-popover">
                  <div className="search-results-header">
                    <span>{searchQuery ? 'Matching Resources' : 'Quick Navigation'}</span>
                    <span style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>Esc to close</span>
                  </div>
                  <div className="search-results-list">
                    {searchResults.length === 0 ? (
                      <div
                        style={{ padding: '1rem', textAlign: 'center', color: '#6B7280', fontSize: '0.8rem' }}
                      >
                        No results found for &ldquo;{searchQuery}&rdquo;
                      </div>
                    ) : (
                      searchResults.map((res, idx) => (
                        <Link
                          key={idx}
                          href={res.href}
                          className="search-result-row"
                          onClick={() => {
                            setSearchFocused(false);
                            setSearchQuery('');
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '0.825rem', fontWeight: 600, color: '#172033' }}>
                              {res.title}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#6B7280' }}>{res.category}</div>
                          </div>
                          {res.badge ? (
                            <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>
                              {res.badge}
                            </span>
                          ) : (
                            <ArrowRight size={13} style={{ color: '#9CA3AF' }} />
                          )}
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Topbar Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            {/* Super Admin indicator if privileged */}
            {user.isSuperAdmin && (
              <Link href="/admin" className="super-admin-pill" title="Platform Super Admin Portal">
                <Shield size={12} />
                <span>Super Admin</span>
              </Link>
            )}

            {/* Organisation Selector Pill */}
            <div style={{ position: 'relative' }} ref={orgDropdownRef}>
              <button
                className="topbar-org-pill"
                onClick={() => setShowOrgDropdown(!showOrgDropdown)}
                aria-label="Select organization"
              >
                <Landmark size={15} style={{ color: '#1E293B' }} />
                <span>{activeOrg?.name ?? 'Console Dot Dream'}</span>
                <ChevronDown size={14} style={{ color: '#94A3B8' }} />
              </button>

              {showOrgDropdown && (
                <div
                  className="org-dropdown-menu"
                  style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem', width: '240px' }}
                >
                  <div className="org-dropdown-header">Your Organisations</div>
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {userOrgs.map((m) => (
                      <div
                        key={m.organization.id}
                        onClick={() => {
                          switchOrg(m.organization.id);
                          setShowOrgDropdown(false);
                        }}
                        className={`org-dropdown-item ${m.organization.id === activeOrg?.id ? 'active' : ''}`}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                          <span className="org-item-avatar">
                            {m.organization.name.slice(0, 2).toUpperCase()}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                color: '#172033',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {m.organization.name}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#6B7280' }}>
                              {m.role?.name ?? 'Member'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="org-dropdown-footer">
                    <Link
                      href="/organizations/new"
                      className="org-create-link"
                      onClick={() => setShowOrgDropdown(false)}
                    >
                      + Create New Organisation
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Currency Selector Pill */}
            <div style={{ position: 'relative' }} ref={currencyDropdownRef}>
              <button
                className="topbar-currency-pill"
                onClick={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
                title="Active currency"
              >
                <span>🇬🇧</span>
                <span>{activeOrg?.baseCurrency ?? 'GBP'}</span>
                <ChevronDown size={13} style={{ color: '#94A3B8' }} />
              </button>
            </div>

            {/* Notifications Bell with Red Badge Count */}
            <div style={{ position: 'relative' }} ref={notifDropdownRef}>
              <button
                className="topbar-bell-btn"
                onClick={() => setShowNotifications(!showNotifications)}
                aria-label="View notifications"
                title="Financial alerts"
              >
                <Bell size={16} />
                <span className="bell-badge-count">3</span>
              </button>

              {showNotifications && (
                <div className="notifications-dropdown" style={{ right: 0 }}>
                  <div className="notif-header">
                    <span>Financial Alerts</span>
                    <span style={{ fontSize: '0.7rem', color: '#10B981', fontWeight: 600 }}>Active</span>
                  </div>
                  <div className="notif-list">
                    <div className="notif-item">
                      <div className="notif-icon red">
                        <AlertTriangle size={14} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="notif-title">3 invoices are overdue</div>
                        <div className="notif-time">Total value £4,320.00</div>
                      </div>
                    </div>
                    <div className="notif-item">
                      <div className="notif-icon amber">
                        <Clock size={14} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="notif-title">2 bills due within 7 days</div>
                        <div className="notif-time">Total value £760.00</div>
                      </div>
                    </div>
                    <div className="notif-item">
                      <div className="notif-icon blue">
                        <Info size={14} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="notif-title">VAT return due in 14 days</div>
                        <div className="notif-time">Period ends 31 Dec 2024</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Card */}
            <div style={{ position: 'relative' }} ref={userDropdownRef}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  cursor: 'pointer',
                  padding: '0.25rem',
                }}
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                role="button"
                tabIndex={0}
              >
                <div className="user-avatar-navy">{userInitials}</div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#0F172A', lineHeight: 1.2 }}>
                    {userName}
                  </span>
                  <span style={{ fontSize: '0.725rem', color: '#64748B' }}>{roleTitle}</span>
                </div>
              </div>

              {showUserDropdown && (
                <div className="user-dropdown-menu" style={{ right: 0 }}>
                  <div className="user-dropdown-meta">
                    <div style={{ fontWeight: 600, color: '#172033', fontSize: '0.85rem' }}>{userName}</div>
                    <div
                      style={{
                        color: '#6B7280',
                        fontSize: '0.75rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {user.email}
                    </div>
                    <div style={{ marginTop: '0.35rem' }}>
                      <span className="badge badge-owner" style={{ fontSize: '0.65rem' }}>
                        {roleTitle}
                      </span>
                    </div>
                  </div>

                  <Link
                    href="/settings/users"
                    className="user-dropdown-link"
                    onClick={() => setShowUserDropdown(false)}
                  >
                    <Users size={14} />
                    <span>User Management</span>
                  </Link>
                  <Link
                    href="/settings/organization"
                    className="user-dropdown-link"
                    onClick={() => setShowUserDropdown(false)}
                  >
                    <Building2 size={14} />
                    <span>Organisation Settings</span>
                  </Link>
                  <Link
                    href="/settings/roles"
                    className="user-dropdown-link"
                    onClick={() => setShowUserDropdown(false)}
                  >
                    <SlidersHorizontal size={14} />
                    <span>Roles & Permissions</span>
                  </Link>

                  <div className="user-dropdown-divider">
                    <button
                      onClick={() => logout().then(() => router.push('/login'))}
                      className="user-logout-btn"
                    >
                      <LogOut size={14} />
                      <span>Sign out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content Body */}
        {children}
      </div>
    </div>
  );
}
