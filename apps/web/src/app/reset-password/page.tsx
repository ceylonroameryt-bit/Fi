'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiRequest } from '../../lib/api';
import { friendlyAuthError } from '../../lib/auth-messages';
import { passwordAcceptable } from '../../lib/password-policy';
import {
  AuthAlert,
  AuthBackLink,
  AuthHeading,
  AuthLayout,
  AuthStatusMark,
  PasswordField,
} from '../../components/auth/auth-ui';

function ResetPasswordForm() {
  const token = useSearchParams()?.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkDead, setLinkDead] = useState(!token);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const pwOk = passwordAcceptable(password);
  const matches = confirm.length > 0 && confirm === password;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (!pwOk || !matches) return;
    setSubmitting(true);
    try {
      await apiRequest('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) });
      setDone(true);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'AUTH_TOKEN_INVALID' || code === 'AUTH_INVALID_TOKEN') setLinkDead(true);
      else setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <>
        <AuthStatusMark tone="success" />
        <div className="bl-auth-center" style={{ display: 'flex', flexDirection: 'column' }}>
          <AuthHeading title="Password changed">
            You’ve been signed out of other devices to keep your account safe.
          </AuthHeading>
        </div>
        <Link href="/login" className="btn btn-primary bl-auth-submit">
          Sign in
        </Link>
      </>
    );
  }

  if (linkDead) {
    return (
      <>
        <AuthStatusMark tone="danger" />
        <div className="bl-auth-center" style={{ display: 'flex', flexDirection: 'column' }}>
          <AuthHeading title="This link has expired">
            Reset links only work for a short time and only once. Get a fresh one — it takes a second.
          </AuthHeading>
        </div>
        <Link href="/forgot-password" className="btn btn-primary bl-auth-submit">
          Send a new link
        </Link>
        <AuthBackLink />
      </>
    );
  }

  return (
    <>
      <AuthHeading title="Choose a new password">Make it something you don’t use anywhere else.</AuthHeading>
      {error && <AuthAlert tone="danger">{error}</AuthAlert>}
      <form onSubmit={submit} noValidate>
        <PasswordField
          label="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          showRules
          autoFocus
          error={touched && !pwOk ? 'Your password needs everything in the list below' : null}
        />
        <PasswordField
          label="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          hint={matches ? '✓ Matches' : undefined}
          error={touched && !matches ? 'The two passwords don’t match' : null}
        />
        <button type="submit" className="btn btn-primary bl-auth-submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save and continue'}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthLayout>
      <Suspense fallback={<span className="bl-skeleton" style={{ height: 120 }} />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthLayout>
  );
}
