'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiRequest, ApiError } from '../../lib/api';
import { useAuth } from '../../context/auth-context';

export default function RegisterPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await apiRequest<{ user: any }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, firstName, lastName }),
      });

      await login(res.user);
      router.push('/organizations/new');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Registration failed. Please check your information.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', padding: '1.5rem' }}>
      <div style={{ width: '100%', maxWidth: '440px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '2rem', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '8px', background: 'linear-gradient(135deg, #146EF5 0%, #16A56A 100%)', color: '#fff', marginBottom: '0.75rem', boxShadow: '0 2px 8px rgba(20, 110, 245, 0.25)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <path d="M8 10h8" />
              <path d="M8 14h5" />
            </svg>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#172033' }}>
            Ledger<span style={{ color: '#146EF5' }}>Pro</span>
          </div>
          <p style={{ color: '#6B7280', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Create your account to start managing books
          </p>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="firstName">First name</label>
              <input
                id="firstName"
                type="text"
                required
                className="form-input"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Alice"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="lastName">Last name</label>
              <input
                id="lastName"
                type="text"
                required
                className="form-input"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Smith"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              required
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alice@example.com"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 10 characters with numbers"
            />
            <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem', display: 'block' }}>
              Must be at least 10 characters and contain letters and numbers.
            </span>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.8rem', color: '#64748b' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
