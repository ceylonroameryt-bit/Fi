'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Plus, X } from 'lucide-react';
import { BlyntLogo } from '@/components/blynt-logo';
import {
  hubForPath,
  isActivePath,
  visibleHubs,
  visibleQuickActions,
  type NavHub,
  type NavMode,
  type SystemRoleKey,
} from '@/lib/navigation';
import { NavIcon } from './nav-icon';

interface SidebarProps {
  pathname: string;
  role: SystemRoleKey | null;
  mode: NavMode;
  onModeChange: (mode: NavMode) => void;
  /** Mobile drawer state. */
  open: boolean;
  onClose: () => void;
  /** AI drafts waiting for review (null = unknown). */
  inboxCount: number | null;
  /** Opened from the "N" keyboard shortcut. */
  createMenuOpen: boolean;
  onCreateMenuOpenChange: (open: boolean) => void;
}

export function Sidebar({
  pathname,
  role,
  mode,
  onModeChange,
  open,
  onClose,
  inboxCount,
  createMenuOpen,
  onCreateMenuOpenChange,
}: SidebarProps) {
  const hubs = visibleHubs(role, mode);
  const mainHubs = hubs.filter((h) => !h.footer);
  const footerHubs = hubs.filter((h) => h.footer);
  const quickActions = visibleQuickActions(role);
  const currentHub = hubForPath(pathname, hubs);

  // The hub owning the current page starts open; others remember what the person toggled.
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    currentHub ? { [currentHub.id]: true } : {},
  );
  useEffect(() => {
    if (currentHub) setExpanded((prev) => (prev[currentHub.id] ? prev : { ...prev, [currentHub.id]: true }));
  }, [currentHub]);

  const createMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!createMenuOpen) return;
    createMenuRef.current?.querySelector<HTMLAnchorElement>('a')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCreateMenuOpenChange(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [createMenuOpen, onCreateMenuOpenChange]);

  const renderHub = (hub: NavHub) => {
    const count = hub.id === 'inbox' && inboxCount ? inboxCount : null;

    if (hub.href) {
      const active = isActivePath(pathname, hub.href);
      return (
        <Link
          key={hub.id}
          href={hub.href}
          className={`bl-nav-btn ${active ? 'is-active' : ''}`}
          aria-current={active ? 'page' : undefined}
        >
          <NavIcon name={hub.icon} />
          <span className="bl-nav-label">{hub.label}</span>
        </Link>
      );
    }

    const isOpen = !!expanded[hub.id];
    const listId = `nav-${hub.id}`;
    return (
      <div key={hub.id}>
        {hub.section && <div className="bl-nav-section">{hub.section}</div>}
        <button
          type="button"
          className={`bl-nav-btn ${currentHub?.id === hub.id ? 'is-open-hub' : ''}`}
          aria-expanded={isOpen}
          aria-controls={listId}
          onClick={() => setExpanded((prev) => ({ ...prev, [hub.id]: !isOpen }))}
        >
          <NavIcon name={hub.icon} />
          <span className="bl-nav-label">
            <span>{hub.label}</span>
            {hub.hint && <span className="bl-nav-hint">{hub.hint}</span>}
          </span>
          {count ? (
            <span className="bl-nav-count" aria-label={`${count} waiting`}>
              {count}
            </span>
          ) : (
            <ChevronDown size={16} className="bl-nav-chevron" aria-hidden="true" />
          )}
        </button>
        {isOpen && (
          <div id={listId} className="bl-nav-sublist">
            {(hub.items ?? []).map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`bl-nav-sub ${active ? 'is-active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <nav id="bl-sidebar" className={`bl-sidebar ${open ? 'is-open' : ''}`} aria-label="Main">
      <div className="bl-sidebar-brand">
        <Link href="/" aria-label="Blynt home" style={{ display: 'flex', alignItems: 'center' }}>
          <BlyntLogo size="sm" theme="dark" />
        </Link>
        <button type="button" className="bl-sidebar-close" onClick={onClose} aria-label="Close menu">
          <X size={20} />
        </button>
      </div>

      {quickActions.length > 0 && (
        <div ref={createMenuRef}>
          <button
            type="button"
            className="bl-create-btn"
            aria-expanded={createMenuOpen}
            aria-controls="bl-create-menu"
            onClick={() => onCreateMenuOpenChange(!createMenuOpen)}
          >
            <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
            Create new
            <span className="bl-kbd" aria-hidden="true">
              N
            </span>
          </button>
          {createMenuOpen && (
            <div id="bl-create-menu" className="bl-create-menu" role="menu">
              {quickActions.map((a) => (
                <Link
                  key={a.label}
                  href={a.href}
                  role="menuitem"
                  onClick={() => onCreateMenuOpenChange(false)}
                >
                  {a.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {mainHubs.map(renderHub)}

      <div className="bl-sidebar-spacer" />

      {footerHubs.map(renderHub)}

      {role !== 'VIEWER' && (
        <button
          type="button"
          className="bl-mode-toggle"
          role="switch"
          aria-checked={mode === 'pro'}
          onClick={() => onModeChange(mode === 'pro' ? 'simple' : 'pro')}
          title="Show or hide journals, ledger, trial balance and period tools"
        >
          <span>Accountant tools</span>
          <span className={`bl-switch ${mode === 'pro' ? 'is-on' : ''}`} aria-hidden="true" />
        </button>
      )}
    </nav>
  );
}
