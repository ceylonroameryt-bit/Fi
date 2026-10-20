'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiRequest } from '../../lib/api';
import { useAuth, type User } from '../../context/auth-context';
import { friendlyAuthError } from '../../lib/auth-messages';
import { passwordAcceptable } from '../../lib/password-policy';
import {
  AuthAlert,
  AuthField,
  AuthFooter,
  AuthHeading,
  AuthLayout,
  PasswordField,
} from '../../components/auth/auth-ui';

/** Step 1 of sign-up: just the person. Company details come next, in onboarding. */
export default function RegisterPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pwOk = passwordAcceptable(password, email);
  const ready = firstName.trim() && lastName.trim() && /\S+@\S+\.\S+/.test(email) && pwOk;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (!ready) return;
    setSubmitting(true);
    try {
      const res = await apiRequest<{ user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        }),
      });
      await login(res.user);
      router.push('/organizations/new');
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout wide>
      <AuthHeading title="Start your books in minutes">
        Step 1 of 2 — about you. Next you’ll add your company.
      </AuthHeading>
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
            error={touched && !firstName.trim() ? 'Enter your first name' : null}
          />
          <AuthField
            label="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
            maxLength={100}
            error={touched && !lastName.trim() ? 'Enter your last name' : null}
          />
        </div>
        <AuthField
          label="Work email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="name@company.com"
          error={touched && !/\S+@\S+\.\S+/.test(email) ? 'Enter an email like name@company.com' : null}
        />
        <PasswordField
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          showRules
          email={email}
          error={touched && !pwOk ? 'Your password needs everything in the list below' : null}
        />
        <button type="submit" className="btn btn-primary bl-auth-submit" disabled={submitting}>
          {submitting ? 'Creating your account…' : 'Continue'}
        </button>
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center' }}>
          By continuing you agree to the Terms of Service and Privacy Policy.
        </p>
      </form>
      <AuthFooter>
        Already have an account? <Link href="/login">Sign in</Link>
      </AuthFooter>
    </AuthLayout>
  );
}
