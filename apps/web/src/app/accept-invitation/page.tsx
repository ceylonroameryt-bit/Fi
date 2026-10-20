'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiRequest } from '../../lib/api';
import { useAuth, type User } from '../../context/auth-context';
import { friendlyAuthError } from '../../lib/auth-messages';
import { passwordAcceptable } from '../../lib/password-policy';
import {
  AuthAlert,
  AuthBackLink,
  AuthField,
  AuthHeading,
  AuthLayout,
  AuthStatusMark,
  PasswordField,
} from '../../components/auth/auth-ui';

const ROLE_SUMMARY = [
  { role: 'Owner / Administrator', can: 'everything, including users and settings' },
  { role: 'Accountant', can: 'post, validate and lock periods' },
  { role: 'Bookkeeper', can: 'create invoices, bills and draft journals' },
  { role: 'Viewer', can: 'read reports and records only' },
];

function AcceptInvitationForm() {
  const token = useSearchParams()?.get('token') ?? '';
  const router = useRouter();
  const { login } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkDead, setLinkDead] = useState(!token);
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
      const res = await apiRequest<{ user: User }>('/auth/accept-invitation', {
        method: 'POST',
        body: JSON.stringify({
          token,
          password,
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
        }),
      });
      await login(res.user);
      router.push('/');
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'AUTH_TOKEN_INVALID' || code === 'AUTH_INVALID_TOKEN') setLinkDead(true);
      else setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (linkDead) {
    return (
      <>
        <AuthStatusMark tone="danger" />
        <div className="bl-auth-center" style={{ display: 'flex', flexDirection: 'column' }}>
          <AuthHeading title="This invitation can’t be used">
            It may have expired or already been accepted. Ask the person who invited you to send a new one —
            or sign in if you’ve already joined.
          </AuthHeading>
        </div>
        <Link href="/login" className="btn btn-primary bl-auth-submit">
          Sign in
        </Link>
      </>
    );
  }

  return (
    <>
      <AuthHeading title="You’ve been invited to Blynt">
        Set a password to join your team’s books.
      </AuthHeading>
      <details className="bl-auth-invite" style={{ display: 'block' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>What can each role do?</summary>
        <ul
          style={{
            margin: '10px 0 0',
            paddingLeft: 18,
            fontSize: 13.5,
            lineHeight: 1.6,
            color: 'var(--ink-2)',
          }}
        >
          {ROLE_SUMMARY.map((r) => (
            <li key={r.role}>
              <strong style={{ color: 'var(--text-main)' }}>{r.role}</strong> — {r.can}
            </li>
          ))}
        </ul>
      </details>
      {error && <AuthAlert tone="danger">{error}</AuthAlert>}
      <form onSubmit={submit} noValidate>
        <div className="bl-auth-split">
          <AuthField
            label="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
            maxLength={100}
            autoFocus
          />
          <AuthField
            label="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
            maxLength={100}
          />
        </div>
        <PasswordField
          label="Choose a password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          showRules
          error={touched && !pwOk ? 'Your password needs everything in the list below' : null}
        />
        <PasswordField
          label="Confirm password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          hint={matches ? '✓ Matches' : undefined}
          error={touched && !matches ? 'The two passwords don’t match' : null}
        />
        <button type="submit" className="btn btn-primary bl-auth-submit" disabled={submitting}>
          {submitting ? 'Joining…' : 'Accept and join'}
        </button>
      </form>
      <AuthBackLink>Already have an account? Sign in</AuthBackLink>
    </>
  );
}

export default function AcceptInvitationPage() {
  return (
    <AuthLayout wide>
      <Suspense fallback={<span className="bl-skeleton" style={{ height: 160 }} />}>
        <AcceptInvitationForm />
      </Suspense>
    </AuthLayout>
  );
}
