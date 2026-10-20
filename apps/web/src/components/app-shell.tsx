'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Building2, LogOut, Menu, Search, Shield, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { useAuth } from '../context/auth-context';
import { apiRequest } from '../lib/api';
import { buildSearchIndex, defaultNavMode, toSystemRoleKey, type NavMode } from '../lib/navigation';
import { CompanySwitcherDropdown } from './organization/company-switcher-dropdown';
import { GlobalAiAssistantModal } from './ai/global-ai-assistant-modal';
import { Sidebar } from './shell/sidebar';
import { CommandPalette } from './shell/command-palette';
import { DialogHost } from './ui/dialog-host';

const EDITOR_ROLES = new Set(['OWNER', 'ADMINISTRATOR', 'ACCOUNTANT', 'BOOKKEEPER']);

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

function readMode(key: string): NavMode | null {
  try {
    const v = localStorage.getItem(key);
    return v === 'pro' || v === 'simple' ? v : null;
  } catch {
    return null;
  }
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, activeOrg, activeRole, logout, isLoading } = useAuth();
  const pathname = usePathname() ?? '/';
  const router = useRouter();

  const role = toSystemRoleKey(activeRole?.systemKey);
  const modeKey = user ? `blynt_nav_mode_${user.id}` : '';

  const [mode, setMode] = useState<NavMode>('simple');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [inboxCount, setInboxCount] = useState<number | null>(null);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  // View mode: remembered per person on this device, otherwise based on role.
  useEffect(() => {
    if (!user) return;
    setMode(readMode(modeKey) ?? defaultNavMode(role));
  }, [user, modeKey, role]);

  const changeMode = useCallback(
    (next: NavMode) => {
      setMode(next);
      try {
        localStorage.setItem(modeKey, next);
      } catch {
        /* storage unavailable — keep in memory only */
      }
    },
    [modeKey],
  );

  // AI drafts waiting — drives the Inbox badge and the bell. Real data only.
  useEffect(() => {
    let cancelled = false;
    setInboxCount(null);
    if (!activeOrg || !activeRole?.systemKey || !EDITOR_ROLES.has(activeRole.systemKey)) return;
    apiRequest<unknown[]>('/ai/review-queue')
      .then((items) => {
        if (!cancelled) setInboxCount(Array.isArray(items) ? items.length : null);
      })
      .catch(() => {
        if (!cancelled) setInboxCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeOrg, activeRole?.systemKey, pathname]);

  // Close transient UI on navigation.
  useEffect(() => {
    setDrawerOpen(false);
    setCreateMenuOpen(false);
    setUserMenuOpen(false);
    setBellOpen(false);
  }, [pathname]);

  // Outside click for topbar popovers.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // Global shortcuts: ⌘K / Ctrl+K or "/" search, "N" create, Esc closes drawer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (e.key === '/') {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (e.key.toLowerCase() === 'n' && !paletteOpen && !aiOpen) {
        e.preventDefault();
        setDrawerOpen(true);
        setCreateMenuOpen(true);
      } else if (e.key === 'Escape') {
        setDrawerOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [paletteOpen, aiOpen]);

  const searchIndex = useMemo(() => {
    const idx = buildSearchIndex(role);
    if (user?.isSuperAdmin) {
      idx.push({
        title: 'Platform admin',
        group: 'Pages',
        context: 'Super admin',
        href: '/admin',
        keywords: ['admin'],
      });
    }
    return idx;
  }, [role, user?.isSuperAdmin]);

  if (isLoading) {
    return (
      <div className="bl-app" style={{ alignItems: 'center', justifyContent: 'center' }} aria-busy="true">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontWeight: 600,
            color: 'var(--text-main)',
          }}
        >
          <span
            style={{ width: 10, height: 10, borderRadius: 99, background: 'var(--action)' }}
            aria-hidden="true"
          />
          Loading your books…
        </div>
      </div>
    );
  }

  if (!user) {
    if (typeof window !== 'undefined') router.push('/login');
    return null;
  }

  const initials =
    `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || user.email[0].toUpperCase();
  const displayName = user.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : user.email;
  const roleName = activeRole?.name ?? 'Member';
  const isAdmin = role === 'OWNER' || role === 'ADMINISTRATOR';

  return (
    <div className="bl-app">
      <a href="#main-content" className="bl-skip-link">
        Skip to content
      </a>

      <div
        className={`bl-overlay ${drawerOpen ? 'is-open' : ''}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />

      <Sidebar
        pathname={pathname}
        role={role}
        mode={mode}
        onModeChange={changeMode}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        inboxCount={inboxCount}
        createMenuOpen={createMenuOpen}
        onCreateMenuOpenChange={setCreateMenuOpen}
      />

      <div className="bl-main">
        <header className="bl-topbar">
          <button
            type="button"
            className="bl-icon-btn bl-menu-btn"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            aria-controls="bl-sidebar"
            aria-expanded={drawerOpen}
          >
            <Menu size={20} />
          </button>

          <button
            type="button"
            className="bl-search-trigger"
            onClick={() => setPaletteOpen(true)}
            aria-haspopup="dialog"
          >
            <Search size={18} aria-hidden="true" />
            <span>Search or jump to…</span>
            <span className="bl-kbd" aria-hidden="true">
              ⌘K
            </span>
          </button>

          <div className="bl-topbar-spacer" />

          {user.isSuperAdmin && (
            <Link href="/admin" className="bl-admin-pill" title="Platform admin — affects every customer">
              <Shield size={13} aria-hidden="true" />
              Platform admin
            </Link>
          )}

          <button type="button" className="bl-ask-btn" onClick={() => setAiOpen(true)}>
            <Sparkles size={16} aria-hidden="true" />
            <span className="bl-ask-label">Ask Blynt</span>
          </button>

          <CompanySwitcherDropdown />

          <div style={{ position: 'relative' }} ref={bellRef}>
            <button
              type="button"
              className="bl-icon-btn"
              onClick={() => setBellOpen((o) => !o)}
              aria-expanded={bellOpen}
              aria-label={inboxCount ? `Notifications, ${inboxCount} waiting` : 'Notifications'}
            >
              <Bell size={20} />
              {!!inboxCount && <span className="bl-dot" aria-hidden="true" />}
            </button>
            {bellOpen && (
              <div className="bl-popover" role="dialog" aria-label="Notifications">
                <div className="bl-popover-head">Notifications</div>
                {inboxCount ? (
                  <Link href="/purchases/review" className="bl-popover-item">
                    <Sparkles size={16} aria-hidden="true" style={{ color: 'var(--action-text)' }} />
                    <span>
                      <strong>{inboxCount}</strong> AI {inboxCount === 1 ? 'draft is' : 'drafts are'} ready to
                      review
                    </span>
                  </Link>
                ) : (
                  <p style={{ margin: 0, padding: '8px 10px 12px', fontSize: 13.5, color: 'var(--ink-2)' }}>
                    You’re all caught up.
                  </p>
                )}
              </div>
            )}
          </div>

          <div style={{ position: 'relative' }} ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen((o) => !o)}
              aria-expanded={userMenuOpen}
              aria-haspopup="menu"
              aria-label={`Account menu for ${displayName}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: 'none',
                border: 0,
                padding: 4,
                borderRadius: 10,
                cursor: 'pointer',
                font: 'inherit',
              }}
            >
              <span className="bl-avatar" aria-hidden="true">
                {initials}
              </span>
              <span
                className="bl-user-meta"
                style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}
              >
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-main)' }}>
                  {displayName}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{roleName}</span>
              </span>
            </button>
            {userMenuOpen && (
              <div className="bl-popover" role="menu" style={{ width: 260 }}>
                <div style={{ padding: '8px 10px' }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{displayName}</div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: 'var(--text-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {user.email}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 4 }}>
                    {roleName} · {activeOrg?.name}
                  </div>
                </div>
                <div className="bl-popover-sep" />
                <Link href="/settings/security" className="bl-popover-item" role="menuitem">
                  <ShieldCheck size={16} aria-hidden="true" /> Security &amp; sessions
                </Link>
                {isAdmin && (
                  <>
                    <Link href="/settings/organization" className="bl-popover-item" role="menuitem">
                      <Building2 size={16} aria-hidden="true" /> Organisation settings
                    </Link>
                    <Link href="/settings/users" className="bl-popover-item" role="menuitem">
                      <Users size={16} aria-hidden="true" /> Users &amp; invites
                    </Link>
                  </>
                )}
                <div className="bl-popover-sep" />
                <button
                  type="button"
                  className="bl-popover-item"
                  role="menuitem"
                  onClick={() => logout().then(() => router.push('/login'))}
                  style={{ color: 'var(--danger)' }}
                >
                  <LogOut size={16} aria-hidden="true" /> Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', outline: 'none' }}
        >
          {children}
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        index={searchIndex}
        onAsk={role && role !== 'VIEWER' ? () => setAiOpen(true) : undefined}
      />
      <GlobalAiAssistantModal isOpen={aiOpen} onClose={() => setAiOpen(false)} />
      <DialogHost />
    </div>
  );
}
