'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiRequest, ApiError } from '../../lib/api';
import { BlyntLogo } from '../../components/blynt-logo';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleVerify = async (tok: string) => {
    if (!tok) {
      setStatus('error');
      setErrorMessage('Verification token is missing from the link.');
      return;
    }

    setStatus('verifying');
    setErrorMessage(null);

    try {
      await apiRequest('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token: tok }),
      });
      setStatus('success');
    } catch (err: any) {
      setStatus('error');
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Email verification failed. The token may be invalid or already used.');
      }
    }
  };

  useEffect(() => {
    if (token) {
      handleVerify(token);
    } else {
      setStatus('error');
      setErrorMessage('Verification token is missing. Please check the link in your email.');
    }
  }, [token]);

  if (status === 'verifying') {
    return (
      <div style={{ textAlign: 'center', padding: '1rem 0' }}>
        <p style={{ color: '#4B5563', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          Verifying your email address...
        </p>
        <span style={{ fontSize: '0.8rem', color: '#6B7280' }}>Please wait a moment.</span>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div>
        <div className="alert alert-success" style={{ marginBottom: '1.25rem' }}>
          Your email address has been verified successfully.
        </div>
        <p style={{ fontSize: '0.85rem', color: '#6B7280', lineHeight: 1.5, marginBottom: '1.5rem' }}>
          Your account is now fully verified and active.
        </p>
        <Link href="/login" className="btn btn-primary" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
          Continue to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
        {errorMessage || 'Unable to verify email address.'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {token && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleVerify(token)}
            style={{ width: '100%' }}
          >
            Retry Verification
          </button>
        )}
        <Link href="/login" style={{ fontSize: '0.8rem', color: '#2563eb', textAlign: 'center', textDecoration: 'none' }}>
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F6FAFD', padding: '1.5rem' }}>
      <div style={{ width: '100%', maxWidth: '420px', backgroundColor: '#fff', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '2.25rem 2rem', boxShadow: '0 8px 30px rgba(8, 43, 92, 0.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <BlyntLogo variant="stacked" size="md" showTagline />
          <p style={{ color: '#64748B', fontSize: '0.85rem', marginTop: '0.65rem' }}>
            Email verification confirmation
          </p>
        </div>

        <Suspense fallback={<div style={{ textAlign: 'center', color: '#64748B' }}>Loading...</div>}>
          <VerifyEmailContent />
        </Suspense>
      </div>
    </div>
  );
}
