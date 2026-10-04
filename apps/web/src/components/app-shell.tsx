'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../context/auth-context';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, activeOrg, activeRole, userOrgs, switchOrg, logout, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F9FC' }}>
        <div style={{ color: '#6B7280', fontSize: '0.9rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#146EF5' }}></span>
          Loading LedgerPro workspace...
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
    : 'LP';

  const userInitials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || 'U';

  interface NavItem {
    label: string;
    href: string;
    icon: string;
    comingSoon?: boolean;
  }

  interface NavSection {
    title: string;
    items: NavItem[];
  }

  const navSections: NavSection[] = [
    {
      title: 'Overview',
      items: [
        { label: 'Dashboard', href: '/', icon: '📊' },
      ],
    },
    ...(user?.isSuperAdmin ? [{
      title: 'Platform Control',
      items: [
        { label: 'Admin Portal', href: '/admin', icon: '⚡' },
      ],
    }] : []),
    {
      title: 'Sales & Contacts',
      items: [
        { label: 'Invoices', href: '/sales/invoices', icon: '🧾' },
        { label: 'Contacts', href: '/sales/contacts', icon: '👥' },
      ],
    },
    {
      title: 'Operations',
      items: [
        { label: 'Banking', href: '/banking', icon: '🏦', comingSoon: true },
        { label: 'Purchases', href: '/purchases', icon: '🛒', comingSoon: true },
      ],
    },
    {
      title: 'Accounting',
      items: [
        { label: 'Chart of Accounts', href: '/accounting/chart-of-accounts', icon: '📋' },
        { label: 'Journals', href: '/accounting/journals', icon: '📑' },
        { label: 'General Ledger', href: '/accounting/general-ledger', icon: '📖' },
        { label: 'Financial Years', href: '/accounting/financial-years', icon: '📅' },
        { label: 'Periods', href: '/accounting/periods', icon: '⏱️' },
      ],
    },
    {
      title: 'Reporting',
      items: [
        { label: 'Trial Balance', href: '/reports/trial-balance', icon: '⚖️' },
      ],
    },
    {
      title: 'Settings',
      items: [
        { label: 'Organisation', href: '/settings/organization', icon: '🏢' },
        { label: 'Users', href: '/settings/users', icon: '👥' },
        { label: 'Roles & Permissions', href: '/settings/roles', icon: '🛡️' },
        { label: 'Audit Logs', href: '/settings/audit-logs', icon: '📜' },
        { label: 'Accounting Integrity', href: '/settings/accounting-integrity', icon: '🔍' },
      ],
    },
  ];

  return (
    <div className="app-container">
      {/* Left Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <Link href="/" className="brand-badge">
            <div className="brand-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="4" />
                <path d="M7 8h10" />
                <path d="M7 12h6" />
                <path d="M7 16h8" />
              </svg>
            </div>
            <div className="brand-text">
              Ledger<span>Pro</span>
            </div>
          </Link>
          <span style={{ fontSize: '0.65rem', color: '#9CA3AF', fontWeight: 600, backgroundColor: '#F3F4F6', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
            v0.1
          </span>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {navSections.map((section) => (
            <div key={section.title} style={{ marginBottom: '1.1rem' }}>
              <div className="nav-section-title">{section.title}</div>
              {section.items.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                if (item.comingSoon) {
                  return (
                    <div key={item.label} className="nav-link disabled" title="Feature coming in later phase">
                      <div className="nav-link-content">
                        <span style={{ fontSize: '0.9rem', opacity: 0.6 }}>{item.icon}</span>
                        <span>{item.label}</span>
                      </div>
                      <span className="sidebar-badge-soon">Soon</span>
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-link ${isActive ? 'active' : ''}`}
                  >
                    <div className="nav-link-content">
                      <span style={{ fontSize: '0.9rem' }}>{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer: Active Organisation */}
        <div className="sidebar-footer">
          <div style={{ position: 'relative' }}>
            <div
              className="org-profile-card"
              onClick={() => setShowOrgDropdown(!showOrgDropdown)}
            >
              <div className="org-avatar">{orgInitials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#172033', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {activeOrg?.name ?? 'Select Org'}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span>{activeOrg?.baseCurrency ?? 'GBP'}</span>
                  <span>•</span>
                  <span style={{ color: '#146EF5' }}>Switch &rarr;</span>
                </div>
              </div>
            </div>

            {showOrgDropdown && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  right: 0,
                  marginBottom: '0.5rem',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '6px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                  border: '1px solid #E6EAF0',
                  padding: '0.4rem',
                  zIndex: 40,
                }}
              >
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6B7280', padding: '0.35rem 0.5rem', textTransform: 'uppercase' }}>
                  My Organisations
                </div>
                {userOrgs.map((m) => (
                  <div
                    key={m.organization.id}
                    onClick={() => {
                      switchOrg(m.organization.id);
                      setShowOrgDropdown(false);
                    }}
                    style={{
                      padding: '0.45rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: m.organization.id === activeOrg?.id ? '#EFF6FF' : 'transparent',
                      color: m.organization.id === activeOrg?.id ? '#146EF5' : '#172033',
                      fontWeight: m.organization.id === activeOrg?.id ? 600 : 400,
                    }}
                  >
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.organization.name}</span>
                    <span style={{ fontSize: '0.7rem', color: '#6B7280' }}>{m.organization.baseCurrency}</span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid #E6EAF0', marginTop: '0.3rem', paddingTop: '0.3rem' }}>
                  <Link
                    href="/organizations/new"
                    style={{
                      display: 'block',
                      padding: '0.4rem 0.5rem',
                      fontSize: '0.775rem',
                      color: '#146EF5',
                      textDecoration: 'none',
                      fontWeight: 500,
                    }}
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

      {/* Main Content */}
      <div className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-search-wrap">
            <span className="topbar-search-icon">🔍</span>
            <input
              type="text"
              className="topbar-search-input"
              placeholder="Search accounts, journals, reports... (⌘K)"
            />
          </div>

          <div className="topbar-actions">
            {user.isSuperAdmin && (
              <Link
                href="/admin"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  backgroundColor: '#FEF3C7',
                  color: '#92400E',
                  border: '1px solid #FCD34D',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                  letterSpacing: '0.02em',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  cursor: 'pointer',
                }}
                title="Open Platform Super Admin Portal"
              >
                <span>⚡</span>
                <span>Super Admin</span>
              </Link>
            )}

            {/* Quick Currency Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', backgroundColor: '#F8FAFC', border: '1px solid #E6EAF0', padding: '0.25rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', color: '#4B5563' }}>
              <span style={{ color: '#16A56A' }}>●</span>
              <span>Ledger Base:</span>
              <strong style={{ color: '#172033' }}>{activeOrg?.baseCurrency ?? 'GBP'}</strong>
            </div>

            {/* Notification Bell */}
            <button
              style={{
                background: 'none',
                border: '1px solid #E6EAF0',
                borderRadius: '6px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#6B7280',
              }}
              title="No unread notifications"
            >
              🔔
            </button>

            {/* User Profile */}
            <div style={{ position: 'relative' }}>
              <div
                className="topbar-user"
                style={{ cursor: 'pointer', padding: '0.2rem 0.4rem', borderRadius: '6px' }}
                onClick={() => setShowUserDropdown(!showUserDropdown)}
              >
                <div className="user-avatar-circle">{userInitials}</div>
                <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                  <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#172033', lineHeight: 1.2 }}>
                    {user.firstName} {user.lastName}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#6B7280' }}>
                    {activeRole?.name ?? 'Member'}
                  </span>
                </div>
                <span style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>▾</span>
              </div>

              {showUserDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '0.5rem',
                    width: '180px',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '6px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                    border: '1px solid #E6EAF0',
                    padding: '0.4rem',
                    zIndex: 50,
                  }}
                >
                  <div style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #E6EAF0', fontSize: '0.75rem' }}>
                    <div style={{ fontWeight: 600, color: '#172033' }}>{user.firstName} {user.lastName}</div>
                    <div style={{ color: '#6B7280', fontSize: '0.7rem', textOverflow: 'ellipsis', overflow: 'hidden' }}>{user.email}</div>
                  </div>
                  <Link
                    href="/settings/users"
                    style={{ display: 'block', padding: '0.45rem 0.5rem', fontSize: '0.8rem', color: '#172033', textDecoration: 'none' }}
                    onClick={() => setShowUserDropdown(false)}
                  >
                    User Profile
                  </Link>
                  <Link
                    href="/settings/organization"
                    style={{ display: 'block', padding: '0.45rem 0.5rem', fontSize: '0.8rem', color: '#172033', textDecoration: 'none' }}
                    onClick={() => setShowUserDropdown(false)}
                  >
                    Organisation Settings
                  </Link>
                  {user.isSuperAdmin && (
                    <Link
                      href="/admin"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.45rem 0.5rem',
                        fontSize: '0.8rem',
                        color: '#92400E',
                        backgroundColor: '#FEF3C7',
                        borderRadius: '4px',
                        textDecoration: 'none',
                        fontWeight: 600,
                        marginTop: '0.2rem',
                      }}
                      onClick={() => setShowUserDropdown(false)}
                    >
                      <span>⚡</span>
                      <span>Super Admin</span>
                    </Link>
                  )}
                  <div style={{ borderTop: '1px solid #E6EAF0', marginTop: '0.3rem', paddingTop: '0.3rem' }}>
                    <button
                      onClick={() => logout().then(() => router.push('/login'))}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        background: 'none',
                        border: 'none',
                        padding: '0.45rem 0.5rem',
                        fontSize: '0.8rem',
                        color: '#DC3F45',
                        cursor: 'pointer',
                        fontWeight: 500,
                      }}
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="page-body">{children}</main>
      </div>
    </div>
  );
}
