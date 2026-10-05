'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { apiRequest, ApiError } from '../../lib/api';
import { WarpLedgerLogo } from '../../components/warp-ledger-logo';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      setSuccess(true);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Unable to request password reset. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', padding: '1.5rem' }}>
      <div style={{ width: '100%', maxWidth: '420px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '2rem', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <WarpLedgerLogo variant="stacked" size="md" showTagline />
          <p style={{ color: '#6B7280', fontSize: '0.8rem', marginTop: '0.65rem' }}>
            Reset your Warp Ledger account password
          </p>
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{error}</div>}

        {success ? (
          <div>
            <div className="alert alert-success" style={{ marginBottom: '1.25rem' }}>
              If an account exists for <strong>{email}</strong>, a password reset link has been dispatched.
            </div>
            <p style={{ fontSize: '0.85rem', color: '#6B7280', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              Please check your inbox and follow the instructions to set a new password. Reset links expire after 1 hour.
            </p>
            <Link href="/login" className="btn btn-primary" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
              Return to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                required
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                autoFocus
              />
              <span style={{ fontSize: '0.725rem', color: '#6B7280', marginTop: '0.25rem', display: 'block' }}>
                Enter the email associated with your Warp Ledger account.
              </span>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginBottom: '1rem' }}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Sending Instructions...' : 'Send Reset Instructions'}
            </button>

            <div style={{ textAlign: 'center' }}>
              <Link href="/login" style={{ fontSize: '0.8rem', color: '#2563eb', textDecoration: 'none' }}>
                Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
