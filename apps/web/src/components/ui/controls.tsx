'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { StatusBadge, type StatusTone } from './page';
import { statusLabel, type RecordKind } from '@/lib/status';

/** Status pill for any record type, using the shared vocabulary. */
export function RecordStatus({ kind, status }: { kind: RecordKind; status: string }) {
  const s = statusLabel(kind, status);
  return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>;
}

export interface TabDef<T extends string> {
  value: T;
  label: string;
  count?: number;
  /** Highlight the count (e.g. overdue). */
  alert?: boolean;
}

/** Status tabs with counts — the first thing on every list page. */
export function StatusTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: TabDef<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="bl-tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={value === t.value}
          className={`bl-tab ${value === t.value ? 'is-on' : ''}`}
          onClick={() => onChange(t.value)}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={`bl-tab-count ${t.alert && t.count > 0 ? 'is-alert' : ''}`}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Summary tile: label, big figure, one line of context. Clickable when `href` or `onClick` is given. */
export function StatTile({
  label,
  value,
  sub,
  tone,
  href,
  onClick,
  active,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: 'danger' | 'warning' | 'success';
  href?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const subColor =
    tone === 'danger'
      ? 'var(--danger)'
      : tone === 'warning'
        ? 'var(--warning-text)'
        : tone === 'success'
          ? 'var(--success-text)'
          : 'var(--text-muted)';
  const body = (
    <>
      <span className="bl-tile-label">{label}</span>
      <span
        className="bl-tile-value bl-money"
        style={tone === 'danger' ? { color: 'var(--danger)' } : undefined}
      >
        {value}
      </span>
      {sub && (
        <span className="bl-tile-sub" style={{ color: subColor, fontWeight: tone ? 600 : 400 }}>
          {sub}
        </span>
      )}
    </>
  );
  const cls = `bl-tile ${tone === 'danger' ? 'is-danger' : ''} ${active ? 'is-active' : ''}`;
  if (href)
    return (
      <Link href={href} className={cls}>
        {body}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" className={cls} onClick={onClick} aria-pressed={active}>
        {body}
      </button>
    );
  return <div className={cls}>{body}</div>;
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Plain-language consequence, e.g. ledger impact. */
  children?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}

/**
 * In-app confirmation for irreversible actions (post, void, lock).
 * Replaces browser confirm(): it explains the consequence and keeps the safe choice first.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'primary',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  // Keep the latest onCancel without re-running the open/close effect on every render.
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    setError(null);
    setBusy(false);
    requestAnimationFrame(() => cancelRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancelRef.current?.();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      restoreRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t work. Nothing was changed.');
      setBusy(false);
    }
  };

  return (
    <div className="bl-dialog-backdrop" onMouseDown={onCancel}>
      <div
        className="bl-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="bl-dialog-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="bl-dialog-title" className="bl-dialog-title">
          {title}
        </h2>
        {children && <div className="bl-dialog-body">{children}</div>}
        {error && (
          <div className="bl-callout bl-callout--danger" role="alert">
            {error}
          </div>
        )}
        <div className="bl-actions" style={{ justifyContent: 'flex-end' }}>
          <button
            ref={cancelRef}
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={tone === 'danger' ? 'btn btn-danger-solid' : 'btn btn-primary'}
            onClick={run}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Transient success/failure message with optional dismiss. */
export function Notice({
  tone,
  children,
  onDismiss,
}: {
  tone: 'success' | 'danger' | 'info';
  children: React.ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <div
      className={`bl-callout bl-callout--${tone}`}
      role={tone === 'danger' ? 'alert' : 'status'}
      style={{ alignItems: 'center' }}
    >
      <div style={{ flex: 1 }}>{children}</div>
      {onDismiss && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </div>
  );
}

/** Search box used on list pages. */
export function SearchField({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <label className="bl-search">
      <span className="sr-only">{label}</span>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

export type { StatusTone };
