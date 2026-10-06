'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiRequest, ApiError } from '../../lib/api';
import { useAuth } from '../../context/auth-context';
import { BlyntLogo } from '../../components/blynt-logo';

function AcceptInvitationForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const router = useRouter();
  const { login } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Invitation token is missing. Please click the link received in your invitation email.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await apiRequest<{ user: any }>('/auth/accept-invitation', {
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
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to accept invitation. The invitation link may have expired or already been accepted.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
          Invalid or missing invitation token. Please check the invitation email you received.
        </div>
        <Link href="/login" className="btn btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
          Go to Sign In
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" htmlFor="firstName">First name</label>
          <input
            id="firstName"
            type="text"
            className="form-input"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Jane"
            autoFocus
          />
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" htmlFor="lastName">Last name</label>
          <input
            id="lastName"
            type="text"
            className="form-input"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Smith"
          />
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: '1rem' }}>
        <label className="form-label" htmlFor="password">Set Account Password *</label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          className="form-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••••••"
        />
        <span style={{ fontSize: '0.725rem', color: '#6B7280', marginTop: '0.25rem', display: 'block' }}>
          Must be at least 8 characters long with uppercase, lowercase, numbers, or symbols.
        </span>
      </div>

      <div className="form-group" style={{ marginBottom: '1.25rem' }}>
        <label className="form-label" htmlFor="confirmPassword">Confirm Password *</label>
        <input
          id="confirmPassword"
          type="password"
          required
          minLength={8}
          className="form-input"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••••••"
        />
      </div>

      <button
        type="submit"
        className="btn btn-primary"
        style={{ width: '100%', marginBottom: '1rem' }}
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Accepting Invitation...' : 'Accept Invitation & Continue'}
      </button>

      <div style={{ textAlign: 'center' }}>
        <Link href="/login" style={{ fontSize: '0.8rem', color: '#2563eb', textDecoration: 'none' }}>
          Already have an active account? Sign In
        </Link>
      </div>
    </form>
  );
}

export default function AcceptInvitationPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F6FAFD', padding: '1.5rem' }}>
      <div style={{ width: '100%', maxWidth: '440px', backgroundColor: '#fff', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '2.25rem 2rem', boxShadow: '0 8px 30px rgba(8, 43, 92, 0.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <BlyntLogo variant="stacked" size="md" showTagline />
          <p style={{ color: '#64748B', fontSize: '0.85rem', marginTop: '0.65rem' }}>
            Complete your profile to accept the organisation invitation
          </p>
        </div>

        <Suspense fallback={<div style={{ textAlign: 'center', color: '#64748B' }}>Loading...</div>}>
          <AcceptInvitationForm />
        </Suspense>
      </div>
    </div>
  );
}
