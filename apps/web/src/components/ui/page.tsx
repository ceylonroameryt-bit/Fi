import React from 'react';
import Link from 'next/link';

/**
 * Shared page building blocks (design system v2).
 * One page header shape everywhere: breadcrumb → title → one-line purpose → actions on the right.
 */

export function Page({ children }: { children: React.ReactNode }) {
  return <div className="bl-page">{children}</div>;
}

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** [{ label, href }] — the last crumb is the current hub and needs no href. */
  breadcrumb?: { label: string; href?: string }[];
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, breadcrumb, actions }: PageHeaderProps) {
  return (
    <div className="bl-page-header">
      <div>
        {breadcrumb && breadcrumb.length > 0 && (
          <nav aria-label="Breadcrumb" className="bl-breadcrumb">
            {breadcrumb.map((c, i) => (
              <React.Fragment key={c.label}>
                {i > 0 && <span aria-hidden="true"> › </span>}
                {c.href ? <Link href={c.href}>{c.label}</Link> : <span>{c.label}</span>}
              </React.Fragment>
            ))}
          </nav>
        )}
        <h1 className="bl-page-title">{title}</h1>
        {description && <p className="bl-page-desc">{description}</p>}
      </div>
      {actions && <div className="bl-actions">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  actions,
  children,
  style,
}: {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <section className="bl-panel" style={style}>
      {(title || actions) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          {title && <h2 className="bl-panel-title">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export type StatusTone = 'neutral' | 'info' | 'strong' | 'warning' | 'danger' | 'success' | 'ai';

const TONE_SYMBOL: Record<StatusTone, string> = {
  neutral: '○',
  info: '◐',
  strong: '●',
  warning: '◷',
  danger: '!',
  success: '✓',
  ai: '✦',
};

/** Status pill: always colour + symbol + word, so it reads without colour vision. */
export function StatusBadge({
  tone,
  children,
  symbol,
}: {
  tone: StatusTone;
  children: React.ReactNode;
  symbol?: string;
}) {
  return (
    <span className={`bl-status bl-status--${tone}`}>
      <span aria-hidden="true">{symbol ?? TONE_SYMBOL[tone]}</span>
      {children}
    </span>
  );
}

export function Callout({
  tone = 'info',
  title,
  children,
  role,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  title?: React.ReactNode;
  children?: React.ReactNode;
  role?: 'alert' | 'status';
}) {
  return (
    <div className={`bl-callout bl-callout--${tone}`} role={role}>
      <div>
        {title && <strong>{title} </strong>}
        {children}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  /** Why it's empty and what to do — one or two sentences. */
  children?: React.ReactNode;
  action?: React.ReactNode;
}

/** Empty state: says why it's empty and offers exactly one way forward. */
export function EmptyState({ icon, title, children, action }: EmptyStateProps) {
  return (
    <div className="bl-empty">
      {icon && (
        <span className="bl-empty-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

/** Loading placeholder rows in the final layout (skeletons feel faster than spinners). */
export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="bl-skeleton" style={{ height: 16, width: `${92 - ((i * 7) % 20)}%` }} />
      ))}
    </div>
  );
}

export { formatMoney } from '@/lib/money-format';
