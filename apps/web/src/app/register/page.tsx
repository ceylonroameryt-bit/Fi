'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiRequest, ApiError } from '../../lib/api';
import { useAuth } from '../../context/auth-context';
import { BlyntLogo } from '../../components/blynt-logo';
import {
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
  TrendingUp,
  Building,
} from 'lucide-react';

export default function RegisterPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 10) {
      setError('Password must be at least 10 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

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
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        backgroundColor: '#F6FAFD',
      }}
    >
      {/* LEFT SIDE: Brand & Value Area */}
      <div
        className="login-brand-panel"
        style={{
          flex: '1 1 45%',
          backgroundColor: '#041F46',
          backgroundImage:
            'radial-gradient(circle at 80% 20%, rgba(16, 184, 167, 0.15) 0%, transparent 50%), radial-gradient(circle at 10% 80%, rgba(8, 43, 92, 0.6) 0%, transparent 60%)',
          color: '#FFFFFF',
          padding: '4rem 4.5rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ marginBottom: '3.5rem' }}>
            <BlyntLogo theme="dark" size="lg" />
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: 'rgba(16, 184, 167, 0.12)',
              border: '1px solid rgba(16, 184, 167, 0.3)',
              borderRadius: '999px',
              padding: '0.35rem 0.95rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#18D3BE',
              marginBottom: '1.5rem',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#18D3BE',
              }}
            />
            GET STARTED IN MINUTES
          </div>

          <h1
            style={{
              fontSize: '2.5rem',
              fontWeight: 800,
              lineHeight: 1.2,
              letterSpacing: '-0.03em',
              color: '#FFFFFF',
              marginBottom: '1.25rem',
            }}
          >
            Take Control of Your{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #10B8A7 0%, #18D3BE 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Business Finance
            </span>
          </h1>

          <p
            style={{
              fontSize: '1rem',
              lineHeight: 1.6,
              color: '#94A3B8',
              maxWidth: '480px',
              marginBottom: '3rem',
            }}
          >
            Join modern UK businesses using Blynt for clear, accurate, and
            effortless double-entry bookkeeping.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '480px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(16, 184, 167, 0.18)',
                  color: '#18D3BE',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '2px',
                }}
              >
                <CheckCircle2 size={16} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.925rem' }}>
                  Compliant Double-Entry Ledger
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                  Rock-solid general ledger with automated balance controls.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(16, 184, 167, 0.18)',
                  color: '#18D3BE',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '2px',
                }}
              >
                <CheckCircle2 size={16} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.925rem' }}>
                  Multi-Organisation Support
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                  Manage multiple companies and clients with isolated workspaces.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(16, 184, 167, 0.18)',
                  color: '#18D3BE',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '2px',
                }}
              >
                <CheckCircle2 size={16} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.925rem' }}>
                  Instant Sales Invoicing & Reporting
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                  Generate professional invoices, track AR, and review trial balances.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ paddingTop: '2rem', color: '#64748B', fontSize: '0.8rem' }}>
          &copy; {new Date().getFullYear()} Blynt Technologies Ltd. Privacy and security first.
        </div>
      </div>

      {/* RIGHT SIDE: Clean Registration Card */}
      <div
        style={{
          flex: '1 1 55%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2.5rem 2rem',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '480px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '18px',
            padding: '2.5rem 2.25rem',
            boxShadow: '0 8px 30px rgba(8, 43, 92, 0.06)',
          }}
        >
          <div className="mobile-brand-display" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <BlyntLogo variant="stacked" size="md" showTagline />
          </div>

          <div style={{ marginBottom: '1.75rem' }}>
            <h2
              style={{
                fontSize: '1.55rem',
                fontWeight: 800,
                color: '#082B5C',
                letterSpacing: '-0.025em',
                marginBottom: '0.35rem',
              }}
            >
              Create your Blynt account
            </h2>
            <p style={{ color: '#64748B', fontSize: '0.85rem' }}>
              Start managing your books with clarity in every number
            </p>
          </div>

          {error && (
            <div
              className="alert alert-danger"
              style={{
                marginBottom: '1.25rem',
                fontSize: '0.825rem',
                borderRadius: '8px',
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div className="form-group">
                <label
                  className="form-label"
                  htmlFor="firstName"
                  style={{ fontSize: '0.825rem', fontWeight: 600, color: '#0B1F3A', marginBottom: '0.35rem', display: 'block' }}
                >
                  First name
                </label>
                <input
                  id="firstName"
                  type="text"
                  required
                  className="form-input"
                  style={{ height: '40px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 0.85rem', fontSize: '0.875rem', width: '100%' }}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Alice"
                />
              </div>

              <div className="form-group">
                <label
                  className="form-label"
                  htmlFor="lastName"
                  style={{ fontSize: '0.825rem', fontWeight: 600, color: '#0B1F3A', marginBottom: '0.35rem', display: 'block' }}
                >
                  Last name
                </label>
                <input
                  id="lastName"
                  type="text"
                  required
                  className="form-input"
                  style={{ height: '40px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 0.85rem', fontSize: '0.875rem', width: '100%' }}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Smith"
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label
                className="form-label"
                htmlFor="email"
                style={{ fontSize: '0.825rem', fontWeight: 600, color: '#0B1F3A', marginBottom: '0.35rem', display: 'block' }}
              >
                Work email address
              </label>
              <input
                id="email"
                type="email"
                required
                className="form-input"
                style={{ height: '40px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 0.85rem', fontSize: '0.875rem', width: '100%' }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alice@company.co.uk"
                autoComplete="email"
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label
                className="form-label"
                htmlFor="password"
                style={{ fontSize: '0.825rem', fontWeight: 600, color: '#0B1F3A', marginBottom: '0.35rem', display: 'block' }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                className="form-input"
                style={{ height: '40px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 0.85rem', fontSize: '0.875rem', width: '100%' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 10 characters"
                autoComplete="new-password"
              />
              <span style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '0.3rem', display: 'block' }}>
                Must be at least 10 characters and contain letters and numbers.
              </span>
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label
                className="form-label"
                htmlFor="confirmPassword"
                style={{ fontSize: '0.825rem', fontWeight: 600, color: '#0B1F3A', marginBottom: '0.35rem', display: 'block' }}
              >
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                className="form-input"
                style={{ height: '40px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 0.85rem', fontSize: '0.875rem', width: '100%' }}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{
                width: '100%',
                height: '44px',
                borderRadius: '10px',
                fontSize: '0.925rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
              }}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating account...' : 'Create Blynt account'}
              {!isSubmitting && <ArrowRight size={17} />}
            </button>
          </form>

          <div
            style={{
              textAlign: 'center',
              marginTop: '1.5rem',
              fontSize: '0.85rem',
              color: '#64748B',
            }}
          >
            Already have an account?{' '}
            <Link
              href="/login"
              style={{
                color: '#082B5C',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
