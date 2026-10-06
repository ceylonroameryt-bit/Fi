'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../context/auth-context';
import { BlyntLogo } from './blynt-logo';
import {
  LayoutDashboard,
  Landmark,
  ReceiptText,
  ShoppingCart,
  ListTree,
  BookOpenCheck,
  CalendarRange,
  CalendarClock,
  BarChart3,
  Building2,
  Users,
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
  Scale,
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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const orgDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const notifDropdownRef = useRef<HTMLDivElement>(null);

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
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F6FAFD' }}>
        <div style={{ color: '#082B5C', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10B8A7' }}></span>
          Loading Blynt workspace...
        </div>
      </div>
    );
  }

  if (!user) {
    if (typeof window !== 'undefined') router.push('/login');
    return null;
  }

  const orgInitials = activeOrg?.name
    ? activeOrg.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'BY';

  const userInitials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || 'U';

  interface NavItem {
    label: string;
    href: string;
    icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
    comingSoon?: boolean;
  }

  interface NavSection {
    title?: string;
    items: NavItem[];
  }

  const navSections: NavSection[] = [
    {
      title: 'Home',
      items: [
        { label: 'Dashboard', href: '/', icon: LayoutDashboard },
      ],
    },
    {
      title: 'Sales',
      items: [
        { label: 'Contacts', href: '/sales/contacts', icon: Users },
        { label: 'Invoices', href: '/sales/invoices', icon: ReceiptText },
      ],
    },
    {
      title: 'Accounting',
      items: [
        { label: 'Chart of Accounts', href: '/accounting/chart-of-accounts', icon: ListTree },
        { label: 'Journals', href: '/accounting/journals', icon: BookOpenCheck },
        { label: 'General Ledger', href: '/accounting/general-ledger', icon: BookOpenCheck },
        { label: 'Trial Balance', href: '/reports/trial-balance', icon: Scale },
        { label: 'Financial Years', href: '/accounting/financial-years', icon: CalendarRange },
        { label: 'Periods', href: '/accounting/periods', icon: CalendarClock },
      ],
    },
    {
      title: 'Reports',
      items: [
        { label: 'Trial Balance', href: '/reports/trial-balance', icon: Scale },
      ],
    },
    {
      title: 'Settings',
      items: [
        { label: 'Organisation', href: '/settings/organization', icon: Building2 },
        { label: 'Users', href: '/settings/users', icon: Users },
        { label: 'Roles & Permissions', href: '/settings/roles', icon: ShieldCheck },
        { label: 'Audit Logs', href: '/settings/audit-logs', icon: ScrollText },
        { label: 'Accounting Integrity', href: '/settings/accounting-integrity', icon: CheckCircle2 },
      ],
    },
  ];

  // Quick search directory
  const searchCatalog: SearchResultItem[] = [
    { title: 'Dashboard', category: 'Overview', href: '/' },
    { title: 'Chart of Accounts', category: 'Accounting', href: '/accounting/chart-of-accounts' },
    { title: 'New Manual Journal', category: 'Accounting', href: '/accounting/journals/new', badge: 'Action' },
    { title: 'Journals History', category: 'Accounting', href: '/accounting/journals' },
    { title: 'Financial Years', category: 'Accounting', href: '/accounting/financial-years' },
    { title: 'Accounting Periods', category: 'Accounting', href: '/accounting/periods' },
    { title: 'Organisation Settings', category: 'Settings', href: '/settings/organization' },
    { title: 'Team Users & Access', category: 'Settings', href: '/settings/users' },
    { title: 'Roles & Permissions Matrix', category: 'Settings', href: '/settings/roles' },
    { title: 'System Audit Logs', category: 'Settings', href: '/settings/audit-logs' },
    { title: '1000 – Cash', category: 'Account (Asset)', href: '/accounting/chart-of-accounts?q=1000' },
    { title: '1010 – Main Bank Account', category: 'Account (Asset)', href: '/accounting/chart-of-accounts?q=1010' },
    { title: '1100 – Accounts Receivable', category: 'Account (Asset)', href: '/accounting/chart-of-accounts?q=1100' },
    { title: '2000 – Accounts Payable', category: 'Account (Liability)', href: '/accounting/chart-of-accounts?q=2000' },
    { title: '3000 – Owner Capital', category: 'Account (Equity)', href: '/accounting/chart-of-accounts?q=3000' },
    { title: '4000 – Sales Revenue', category: 'Account (Revenue)', href: '/accounting/chart-of-accounts?q=4000' },
  ];

  const searchResults = searchQuery.trim()
    ? searchCatalog.filter(
        (item) =>
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : searchCatalog.slice(0, 6);

  return (
    <div className="app-container">
      {/* Mobile Drawer Overlay */}
      {mobileNavOpen && (
        <div
          className="mobile-drawer-overlay"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Left Sidebar */}
      <aside className={`sidebar ${mobileNavOpen ? 'mobile-open' : ''}`}>
        {/* Brand Header */}
        <div className="sidebar-header">
          <Link href="/" style={{ textDecoration: 'none' }}>
            <BlyntLogo size="sm" />
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
                  pathname === item.href ||
                  (item.href !== '/' && !item.comingSoon && pathname.startsWith(item.href));
                const Icon = item.icon;

                if (item.comingSoon) {
                  return (
                    <div
                      key={item.label}
                      className="nav-link disabled"
                      title="Coming later in next release"
                    >
                      <div className="nav-link-content">
                        <Icon size={16} className="nav-link-icon" />
                        <span>{item.label}</span>
                      </div>
                      <span className="sidebar-badge-soon">Later</span>
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-link ${isActive ? 'active' : ''}`}
                    onClick={() => setMobileNavOpen(false)}
                  >
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

        {/* Sidebar Footer: Current Organisation */}
        <div className="sidebar-footer" ref={orgDropdownRef}>
          <div style={{ position: 'relative' }}>
            <div
              className="org-profile-card"
              onClick={() => setShowOrgDropdown(!showOrgDropdown)}
              role="button"
              tabIndex={0}
            >
              <div className="org-avatar">{orgInitials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="org-name-text">
                  {activeOrg?.name ?? 'Alpha Consulting Ltd'}
                </div>
                <div className="org-switch-hint">
                  <span>{activeOrg?.baseCurrency ?? 'GBP'}</span>
                  <span>•</span>
                  <span className="switch-label">Switch org &rarr;</span>
                </div>
              </div>
            </div>

            {/* Organisation Switcher Popover */}
            {showOrgDropdown && (
              <div className="org-dropdown-menu">
                <div className="org-dropdown-header">
                  Switch Organisation
                </div>
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
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#172033', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {m.organization.name}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#6B7280' }}>
                            {m.role?.name ?? 'Member'}
                          </div>
                        </div>
                      </div>
                      <span className="badge badge-active" style={{ fontSize: '0.65rem' }}>
                        {m.organization.baseCurrency || 'GBP'}
                      </span>
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
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
            {/* Mobile menu trigger button */}
            <button
              className="mobile-hamburger-btn"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu size={20} />
            </button>

            {/* Global Search Bar (occupies centre-left area) */}
            <div className="topbar-search-wrap" ref={searchRef}>
              <Search size={15} className="topbar-search-icon" />
              <input
                type="text"
                className="topbar-search-input"
                placeholder="Search accounts, journals, reports..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
              />

              {/* Interactive Quick Search Results Dropdown */}
              {searchFocused && (
                <div className="search-results-popover">
                  <div className="search-results-header">
                    <span>{searchQuery ? 'Matching Resources' : 'Quick Navigation'}</span>
                    <span style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>Esc to close</span>
                  </div>
                  <div className="search-results-list">
                    {searchResults.length === 0 ? (
                      <div style={{ padding: '1rem', textAlign: 'center', color: '#6B7280', fontSize: '0.8rem' }}>
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
                            <div style={{ fontSize: '0.7rem', color: '#6B7280' }}>
                              {res.category}
                            </div>
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

          {/* Right Topbar Actions */}
          <div className="topbar-actions">
            {/* Super Admin indicator if privileged */}
            {user.isSuperAdmin && (
              <Link href="/admin" className="super-admin-pill" title="Platform Super Admin Portal">
                <Shield size={12} />
                <span>Super Admin</span>
              </Link>
            )}

            {/* Quick Financial Currency Badge */}
            <div className="topbar-currency-badge">
              <span className="status-dot-green"></span>
              <span style={{ color: '#6B7280' }}>Base:</span>
              <strong style={{ color: '#172033' }}>{activeOrg?.baseCurrency ?? 'GBP'}</strong>
            </div>

            {/* Notifications Bell */}
            <div style={{ position: 'relative' }} ref={notifDropdownRef}>
              <button
                className="topbar-icon-btn"
                onClick={() => setShowNotifications(!showNotifications)}
                aria-label="View notifications"
                title="System notifications"
              >
                <Bell size={16} />
                <span className="notification-indicator"></span>
              </button>

              {showNotifications && (
                <div className="notifications-dropdown">
                  <div className="notif-header">
                    <span>Notifications</span>
                    <span style={{ fontSize: '0.7rem', color: '#16A56A', fontWeight: 600 }}>Operational</span>
                  </div>
                  <div className="notif-list">
                    <div className="notif-item">
                      <div className="notif-icon green">
                        <CheckCircle2 size={14} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="notif-title">Period 01 (Apr 2026) is OPEN</div>
                        <div className="notif-time">Accounting integrity: Double-entry balanced</div>
                      </div>
                    </div>
                    <div className="notif-item">
                      <div className="notif-icon amber">
                        <AlertTriangle size={14} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="notif-title">Review Draft Journals</div>
                        <div className="notif-time">2 manual journals awaiting validation</div>
                      </div>
                    </div>
                    <div className="notif-item">
                      <div className="notif-icon blue">
                        <Info size={14} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="notif-title">System Audit Log Active</div>
                        <div className="notif-time">All actions cryptographically logged</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Current User Profile Dropdown */}
            <div style={{ position: 'relative' }} ref={userDropdownRef}>
              <div
                className="topbar-user-card"
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                role="button"
                tabIndex={0}
              >
                <div className="user-avatar-circle">{userInitials}</div>
                <div className="user-info-text">
                  <span className="user-name">
                    {user.firstName} {user.lastName}
                  </span>
                  <span className="user-role-label">
                    {activeRole?.name ?? 'Owner'}
                  </span>
                </div>
                <ChevronDown size={14} style={{ color: '#9CA3AF' }} />
              </div>

              {showUserDropdown && (
                <div className="user-dropdown-menu">
                  <div className="user-dropdown-meta">
                    <div style={{ fontWeight: 600, color: '#172033', fontSize: '0.85rem' }}>
                      {user.firstName} {user.lastName}
                    </div>
                    <div style={{ color: '#6B7280', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {user.email}
                    </div>
                    <div style={{ marginTop: '0.35rem' }}>
                      <span className="badge badge-owner" style={{ fontSize: '0.65rem' }}>
                        {activeRole?.name ?? 'Owner'}
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

        {/* Main Page Content */}
        <main className="page-body">{children}</main>
      </div>
    </div>
  );
}
