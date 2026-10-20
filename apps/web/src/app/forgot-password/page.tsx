'use client';

import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { friendlyAuthError } from '../../lib/auth-messages';
import {
  AuthAlert,
  AuthBackLink,
  AuthField,
  AuthHeading,
  AuthLayout,
  AuthStatusMark,
} from '../../components/auth/auth-ui';

const RESEND_SECONDS = 45;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      setSent(true);
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout>
        <AuthStatusMark tone="info" />
        <div className="bl-auth-center" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <AuthHeading title="Check your inbox">
            If there’s an account for <strong>{email.trim()}</strong>, a reset link is on its way. It works
            for a limited time.
          </AuthHeading>
        </div>
        {error && <AuthAlert tone="danger">{error}</AuthAlert>}
        <button
          type="button"
          className="btn btn-secondary bl-auth-submit"
          onClick={() => send()}
          disabled={cooldown > 0 || submitting}
        >
          {cooldown > 0
            ? `Resend in 0:${String(cooldown).padStart(2, '0')}`
            : submitting
              ? 'Sending…'
              : 'Resend the link'}
        </button>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)', textAlign: 'center' }}>
          Not there? Check spam, or{' '}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ border: 0, padding: '0 4px', minHeight: 0, textDecoration: 'underline' }}
            onClick={() => {
              setSent(false);
              setError(null);
            }}
          >
            try another email
          </button>
          .
        </p>
        <AuthBackLink />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthBackLink />
      <AuthHeading title="Reset your password">
        Enter the email you sign in with and we’ll send you a link to choose a new password.
      </AuthHeading>
      {error && <AuthAlert tone="danger">{error}</AuthAlert>}
      <form onSubmit={send}>
        <AuthField
          label="Work email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="name@company.com"
          autoFocus
        />
        <button
          type="submit"
          className="btn btn-primary bl-auth-submit"
          disabled={submitting || !/\S+@\S+\.\S+/.test(email)}
        >
          {submitting ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
    </AuthLayout>
  );
}
