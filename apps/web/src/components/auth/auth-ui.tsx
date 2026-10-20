'use client';

import React, { useId, useState } from 'react';
import Link from 'next/link';
import { BlyntLogo } from '@/components/blynt-logo';
import { passwordRules, passwordStrength, STRENGTH_LABEL } from '@/lib/password-policy';

/**
 * Shared shell for sign-in, sign-up and recovery screens.
 * One centred card, one job per screen, one primary button. The brand panel
 * (hidden on small screens) carries reassurance, not features to read.
 */
export function AuthLayout({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="bl-auth">
      <aside className="bl-auth-brand" aria-hidden="true">
        <BlyntLogo theme="dark" size="lg" />
        <div className="bl-auth-pitch">
          <p className="bl-auth-eyebrow">Business finance, simplified</p>
          <h1 className="bl-auth-headline">
            Clarity in <span>every number.</span>
          </h1>
          <ul className="bl-auth-points">
            <li>
              <span>✓</span>Bank lines, bills and receipts filed for you — you just confirm
            </li>
            <li>
              <span>✓</span>AI drafts, never posts. A person approves every entry
            </li>
            <li>
              <span>✓</span>Posted records are locked and audited, built for UK VAT
            </li>
          </ul>
        </div>
        <p className="bl-auth-foot">© {new Date().getFullYear()} Blynt Technologies Ltd</p>
      </aside>
      <main className="bl-auth-main">
        <div className={`bl-auth-card ${wide ? 'is-wide' : ''}`}>
          <div className="bl-auth-mobile-logo">
            <BlyntLogo size="md" />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

export function AuthHeading({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="bl-auth-heading">
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </div>
  );
}

export function AuthFooter({ children }: { children: React.ReactNode }) {
  return <p className="bl-auth-footer">{children}</p>;
}

export function AuthAlert({
  tone,
  title,
  children,
}: {
  tone: 'danger' | 'info' | 'success' | 'warning';
  title?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`bl-callout bl-callout--${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <div>
        {title && <strong>{title} </strong>}
        {children}
      </div>
    </div>
  );
}

/** Big round status mark for success/failure screens. */
export function AuthStatusMark({ tone }: { tone: 'success' | 'danger' | 'info' }) {
  const map = {
    success: { bg: 'var(--success-bg)', fg: 'var(--success-text)', sym: '✓' },
    danger: { bg: 'var(--danger-bg)', fg: 'var(--danger)', sym: '!' },
    info: { bg: 'var(--info-bg)', fg: 'var(--primary)', sym: '✉' },
  }[tone];
  return (
    <span className="bl-auth-mark" aria-hidden="true" style={{ background: map.bg, color: map.fg }}>
      {map.sym}
    </span>
  );
}

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: React.ReactNode;
  error?: string | null;
  /** Shown at the right of the label row (e.g. "Forgot?"). */
  labelAction?: React.ReactNode;
}

export function AuthField({ label, hint, error, labelAction, id, className, ...input }: FieldProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  const hintId = `${fieldId}-hint`;
  return (
    <div className="bl-auth-field">
      <div className="bl-auth-label-row">
        <label htmlFor={fieldId}>{label}</label>
        {labelAction}
      </div>
      <input
        {...input}
        id={fieldId}
        className={`bl-auth-input ${error ? 'has-error' : ''} ${className ?? ''}`.trim()}
        aria-invalid={!!error || undefined}
        aria-describedby={hint || error ? hintId : undefined}
      />
      {(error || hint) && (
        <span id={hintId} className={error ? 'bl-auth-error' : 'bl-auth-hint'}>
          {error ?? hint}
        </span>
      )}
    </div>
  );
}

interface PasswordFieldProps extends Omit<FieldProps, 'type'> {
  /** Show the live rule checklist and strength meter (for new passwords). */
  showRules?: boolean;
  email?: string;
}

export function PasswordField({
  showRules,
  email,
  value,
  label,
  hint,
  error,
  labelAction,
  id: idProp,
  ...input
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const auto = useId();
  const id = idProp ?? auto;
  const pwd = String(value ?? '');
  const rules = passwordRules(pwd, email);
  const strength = passwordStrength(pwd, email);
  const describedBy = [error ? `${id}-err` : '', hint ? `${id}-hint` : '', showRules ? `${id}-rules` : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className="bl-auth-field">
      <div className="bl-auth-label-row">
        <label htmlFor={id}>{label}</label>
        {labelAction}
      </div>
      <div className="bl-auth-pw">
        <input
          {...input}
          id={id}
          value={value}
          type={visible ? 'text' : 'password'}
          className={`bl-auth-input ${error ? 'has-error' : ''}`}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy || undefined}
        />
        <button
          type="button"
          className="bl-auth-pw-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      {hint && !error && (
        <span id={`${id}-hint`} className="bl-auth-hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-err`} className="bl-auth-error">
          {error}
        </span>
      )}
      {showRules && (
        <div id={`${id}-rules`} aria-live="polite">
          <div className="bl-auth-meter" aria-hidden="true">
            {[1, 2, 3, 4].map((n) => (
              <span key={n} className={strength >= n ? `is-on s${strength}` : ''} />
            ))}
          </div>
          <ul className="bl-auth-rules">
            {strength > 0 && <li className="bl-auth-strength">{STRENGTH_LABEL[strength]}</li>}
            {rules.map((r) => (
              <li key={r.id} className={r.met ? 'is-met' : ''}>
                <span aria-hidden="true">{r.met ? '✓' : '○'}</span> {r.label}
                <span className="sr-only">{r.met ? ' — done' : ' — needed'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function AuthBackLink({
  href = '/login',
  children = 'Back to sign in',
}: {
  href?: string;
  children?: React.ReactNode;
}) {
  return (
    <Link href={href} className="bl-auth-back">
      ← {children}
    </Link>
  );
}
