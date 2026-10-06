'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiRequest, ApiError } from '../../lib/api';
import { BlyntLogo } from '../../components/blynt-logo';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Password reset token is missing. Please use the link provided in your email.');
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
      await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setSuccess(true);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Password reset failed. The token may be expired or already used.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token && !success) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
          Invalid or missing reset token. Please request a new password reset.
        </div>
        <Link href="/forgot-password" className="btn btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
          Request New Link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div>
        <div className="alert alert-success" style={{ marginBottom: '1.25rem' }}>
          Your password has been reset successfully.
        </div>
        <p style={{ fontSize: '0.85rem', color: '#64748B', lineHeight: 1.5, marginBottom: '1.5rem' }}>
          You can now sign in to your Blynt account using your new credentials.
        </p>
        <Link href="/login" className="btn btn-primary" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
          Sign In Now
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{error}</div>}

      <div className="form-group" style={{ marginBottom: '1rem' }}>
        <label className="form-label" htmlFor="password">New Password</label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          className="form-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••••••"
          autoFocus
        />
        <span style={{ fontSize: '0.725rem', color: '#6B7280', marginTop: '0.25rem', display: 'block' }}>
          Must be at least 8 characters long with uppercase, lowercase, numbers, or symbols.
        </span>
      </div>

      <div className="form-group" style={{ marginBottom: '1.25rem' }}>
        <label className="form-label" htmlFor="confirmPassword">Confirm New Password</label>
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
        {isSubmitting ? 'Updating Password...' : 'Reset Password'}
      </button>

      <div style={{ textAlign: 'center' }}>
        <Link href="/login" style={{ fontSize: '0.8rem', color: '#2563eb', textDecoration: 'none' }}>
          Back to Sign In
        </Link>
      </div>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F6FAFD', padding: '1.5rem' }}>
      <div style={{ width: '100%', maxWidth: '420px', backgroundColor: '#fff', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '2.25rem 2rem', boxShadow: '0 8px 30px rgba(8, 43, 92, 0.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <BlyntLogo variant="stacked" size="md" showTagline />
          <p style={{ color: '#64748B', fontSize: '0.85rem', marginTop: '0.65rem' }}>
            Choose a new, secure password for your Blynt account
          </p>
        </div>

        <Suspense fallback={<div style={{ textAlign: 'center', color: '#64748B' }}>Loading...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
