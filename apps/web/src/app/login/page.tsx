'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiRequest } from '../../lib/api';
import { useAuth, type User } from '../../context/auth-context';
import { friendlyAuthError } from '../../lib/auth-messages';
import {
  AuthAlert,
  AuthField,
  AuthFooter,
  AuthHeading,
  AuthLayout,
  PasswordField,
} from '../../components/auth/auth-ui';

/**
 * Demo logins are for local development and demos only. They are hidden in production
 * unless NEXT_PUBLIC_SHOW_DEMO_LOGINS=true is set explicitly.
 */
const SHOW_DEMO_LOGINS =
  process.env.NEXT_PUBLIC_SHOW_DEMO_LOGINS === 'true' ||
  (process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_SHOW_DEMO_LOGINS !== 'false');

const DEMO_ACCOUNTS = [
  { label: 'Owner', email: 'owner@democonsulting.com' },
  { label: 'Accountant', email: 'accountant@democonsulting.com' },
  { label: 'Viewer', email: 'viewer@democonsulting.com' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<'password' | 'mfa'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const finish = async (user: User) => {
    await login(user);
    router.push('/');
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiRequest<{ user: User; mfaRequired?: boolean }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (res.mfaRequired) {
        setPendingUser(res.user);
        setStep('mfa');
        setCode('');
      } else {
        await finish(res.user);
      }
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingUser) return;
    setError(null);
    setSubmitting(true);
    try {
      await apiRequest('/auth/mfa/verify', { method: 'POST', body: JSON.stringify({ code: code.trim() }) });
      await finish(pendingUser);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'mfa') {
    return (
      <AuthLayout>
        <AuthHeading title={useRecovery ? 'Enter a recovery code' : 'Enter your 6-digit code'}>
          {useRecovery ? (
            'Use one of the codes you saved when you turned on two-step verification. Each works once.'
          ) : (
            <>
              From your authenticator app for <strong>{email.trim()}</strong>.
            </>
          )}
        </AuthHeading>
        {error && <AuthAlert tone="danger">{error}</AuthAlert>}
        <form onSubmit={submitCode} noValidate>
          {useRecovery ? (
            <AuthField
              label="Recovery code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 32))}
              placeholder="XXXXX-XXXXX"
              autoComplete="one-time-code"
              autoFocus
            />
          ) : (
            <AuthField
              label="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="••••••"
              autoFocus
            />
          )}
          <button
            type="submit"
            className="btn btn-primary bl-auth-submit"
            disabled={submitting || (useRecovery ? code.trim().length < 6 : code.length !== 6)}
          >
            {submitting ? 'Checking…' : 'Verify and sign in'}
          </button>
        </form>
        <AuthFooter>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setUseRecovery((v) => !v);
              setCode('');
              setError(null);
            }}
          >
            {useRecovery ? 'Use my authenticator app' : 'Use a recovery code instead'}
          </button>
        </AuthFooter>
        <AuthFooter>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ border: 0 }}
            onClick={() => {
              setStep('password');
              setPendingUser(null);
              setError(null);
            }}
          >
            ← Use a different account
          </button>
        </AuthFooter>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthHeading title="Welcome back">Sign in to your Blynt books.</AuthHeading>
      {error && <AuthAlert tone="danger">{error}</AuthAlert>}
      <form onSubmit={submitPassword}>
        <AuthField
          label="Work email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@company.com"
          autoComplete="email"
          autoFocus
        />
        <PasswordField
          label="Password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          labelAction={<Link href="/forgot-password">Forgot password?</Link>}
        />
        <button
          type="submit"
          className="btn btn-primary bl-auth-submit"
          disabled={submitting || !email.trim() || !password}
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      {SHOW_DEMO_LOGINS && (
        <div className="bl-auth-demo">
          <span>DEMO ACCOUNTS</span>
          <div className="bl-actions">
            {DEMO_ACCOUNTS.map((d) => (
              <button
                key={d.email}
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setEmail(d.email);
                  setPassword('Password1234!');
                  setError(null);
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <AuthFooter>
        New to Blynt? <Link href="/register">Create an account</Link>
      </AuthFooter>
    </AuthLayout>
  );
}
