'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiRequest, ApiError } from '../../lib/api';
import { useAuth } from '../../context/auth-context';
import { BlyntLogo, BlyntMark } from '../../components/blynt-logo';
import {
  TrendingUp,
  ShieldCheck,
  Receipt,
  Rocket,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await apiRequest<{ user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      await login(res.user);
      router.push('/');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Login failed. Please check your credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Password1234!');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        backgroundColor: '#F6FAFD',
      }}
    >
      {/* LEFT SIDE: Deep Navy Marketing & Brand Experience */}
      <div
        className="login-brand-panel"
        style={{
          flex: '1 1 50%',
          backgroundColor: '#041F46',
          backgroundImage:
            'radial-gradient(circle at 80% 20%, rgba(16, 184, 167, 0.15) 0%, transparent 50%), radial-gradient(circle at 10% 80%, rgba(8, 43, 92, 0.6) 0%, transparent 60%)',
          color: '#FFFFFF',
          padding: '4rem 4.5rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
        }}
      >
        {/* Top Header */}
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
            BUSINESS FINANCE, SIMPLIFIED
          </div>

          <h1
            style={{
              fontSize: '2.75rem',
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: '-0.035em',
              color: '#FFFFFF',
              marginBottom: '1.25rem',
            }}
          >
            Clarity in{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #10B8A7 0%, #18D3BE 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Every Number
            </span>
          </h1>

          <p
            style={{
              fontSize: '1.05rem',
              lineHeight: 1.6,
              color: '#94A3B8',
              maxWidth: '520px',
              marginBottom: '3.5rem',
            }}
          >
            Blynt helps modern businesses stay financially in control with
            simple, powerful and intelligent double-entry accounting.
          </p>

          {/* Value Sections */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '1.5rem',
              maxWidth: '560px',
            }}
          >
            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '14px',
                padding: '1.25rem',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(16, 184, 167, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#18D3BE',
                  marginBottom: '0.85rem',
                }}
              >
                <TrendingUp size={20} />
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                Real-time Insights
              </div>
              <div style={{ fontSize: '0.8rem', color: '#94A3B8', lineHeight: 1.45 }}>
                Understand your business cashflow and margins at a glance.
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '14px',
                padding: '1.25rem',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(37, 99, 235, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#60A5FA',
                  marginBottom: '0.85rem',
                }}
              >
                <ShieldCheck size={20} />
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                Secure & Reliable
              </div>
              <div style={{ fontSize: '0.8rem', color: '#94A3B8', lineHeight: 1.45 }}>
                Your financial ledger is immutable, audited, and tenant-isolated.
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '14px',
                padding: '1.25rem',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#34D399',
                  marginBottom: '0.85rem',
                }}
              >
                <Receipt size={20} />
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                Simple Accounting
              </div>
              <div style={{ fontSize: '0.8rem', color: '#94A3B8', lineHeight: 1.45 }}>
                Invoices, journals, and trial balance reports — all unified.
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '14px',
                padding: '1.25rem',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FBBF24',
                  marginBottom: '0.85rem',
                }}
              >
                <Rocket size={20} />
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                Built for Growth
              </div>
              <div style={{ fontSize: '0.8rem', color: '#94A3B8', lineHeight: 1.45 }}>
                Engineered for UK SMEs, advisors, and scaling enterprises.
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Tag */}
        <div style={{ paddingTop: '2.5rem', color: '#64748B', fontSize: '0.8rem' }}>
          &copy; {new Date().getFullYear()} Blynt Technologies Ltd. Built for UK finance excellence.
        </div>
      </div>

      {/* RIGHT SIDE: Large Clean Authentication Card */}
      <div
        style={{
          flex: '1 1 50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2.5rem 2rem',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '440px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '18px',
            padding: '2.75rem 2.5rem',
            boxShadow: '0 8px 30px rgba(8, 43, 92, 0.06)',
          }}
        >
          {/* Mobile brand header */}
          <div className="mobile-brand-display" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <BlyntLogo variant="stacked" size="md" showTagline />
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <h2
              style={{
                fontSize: '1.65rem',
                fontWeight: 800,
                color: '#082B5C',
                letterSpacing: '-0.025em',
                marginBottom: '0.4rem',
              }}
            >
              Welcome back
            </h2>
            <p style={{ color: '#64748B', fontSize: '0.875rem' }}>
              Sign in to your Blynt accounting workspace
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
            <div className="form-group" style={{ marginBottom: '1.2rem' }}>
              <label
                className="form-label"
                htmlFor="email"
                style={{
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  color: '#0B1F3A',
                  marginBottom: '0.35rem',
                  display: 'block',
                }}
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                className="form-input"
                style={{
                  height: '42px',
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  padding: '0 0.85rem',
                  fontSize: '0.875rem',
                  width: '100%',
                }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                autoComplete="email"
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.35rem',
                }}
              >
                <label
                  className="form-label"
                  htmlFor="password"
                  style={{
                    fontSize: '0.825rem',
                    fontWeight: 600,
                    color: '#0B1F3A',
                    margin: 0,
                  }}
                >
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  style={{
                    fontSize: '0.8rem',
                    color: '#10B8A7',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                required
                className="form-input"
                style={{
                  height: '42px',
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  padding: '0 0.85rem',
                  fontSize: '0.875rem',
                  width: '100%',
                }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="current-password"
              />
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '1.5rem',
              }}
            >
              <input
                id="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{
                  width: '16px',
                  height: '16px',
                  accentColor: '#082B5C',
                  cursor: 'pointer',
                }}
              />
              <label
                htmlFor="rememberMe"
                style={{
                  fontSize: '0.825rem',
                  color: '#64748B',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                Remember me on this device
              </label>
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
              {isSubmitting ? 'Signing in...' : 'Sign in'}
              {!isSubmitting && <ArrowRight size={17} />}
            </button>
          </form>

          {/* Quick Demo Switcher */}
          <div
            style={{
              marginTop: '1.75rem',
              paddingTop: '1.25rem',
              borderTop: '1px solid #E2E8F0',
            }}
          >
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#64748B',
                marginBottom: '0.65rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Quick Test Credentials:
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ borderRadius: '8px', fontSize: '0.775rem' }}
                onClick={() => fillDemo('owner@democonsulting.com')}
              >
                Owner
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ borderRadius: '8px', fontSize: '0.775rem' }}
                onClick={() => fillDemo('accountant@democonsulting.com')}
              >
                Accountant
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ borderRadius: '8px', fontSize: '0.775rem' }}
                onClick={() => fillDemo('viewer@democonsulting.com')}
              >
                Viewer
              </button>
            </div>
          </div>

          <div
            style={{
              textAlign: 'center',
              marginTop: '1.75rem',
              fontSize: '0.85rem',
              color: '#64748B',
            }}
          >
            Don&apos;t have an account?{' '}
            <Link
              href="/register"
              style={{
                color: '#082B5C',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
