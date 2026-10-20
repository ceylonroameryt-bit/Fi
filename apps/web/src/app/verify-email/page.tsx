'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiRequest } from '../../lib/api';
import { friendlyAuthError } from '../../lib/auth-messages';
import { AuthBackLink, AuthHeading, AuthLayout, AuthStatusMark } from '../../components/auth/auth-ui';

function VerifyEmailContent() {
  const token = useSearchParams()?.get('token') ?? '';
  const router = useRouter();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>(token ? 'verifying' : 'error');
  const [message, setMessage] = useState<string | null>(
    token ? null : 'This link is missing its code. Open the link from your email again.',
  );
  const ran = useRef(false);

  useEffect(() => {
    // Tokens are single-use: never send twice (React strict mode double-runs effects in dev).
    if (!token || ran.current) return;
    ran.current = true;
    apiRequest('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) })
      .then(() => {
        setStatus('success');
        setTimeout(() => router.push('/'), 2500);
      })
      .catch((err) => {
        setStatus('error');
        setMessage(friendlyAuthError(err, 'We couldn’t confirm that link. It may have been used already.'));
      });
  }, [token, router]);

  if (status === 'verifying') {
    return (
      <div
        className="bl-auth-center"
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        aria-busy="true"
      >
        <AuthStatusMark tone="info" />
        <AuthHeading title="Confirming your email…">This only takes a moment.</AuthHeading>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <>
        <AuthStatusMark tone="success" />
        <div className="bl-auth-center" style={{ display: 'flex', flexDirection: 'column' }} role="status">
          <AuthHeading title="Email confirmed">Taking you to your books…</AuthHeading>
        </div>
        <Link href="/" className="btn btn-primary bl-auth-submit">
          Continue now
        </Link>
      </>
    );
  }

  return (
    <>
      <AuthStatusMark tone="danger" />
      <div className="bl-auth-center" style={{ display: 'flex', flexDirection: 'column' }} role="alert">
        <AuthHeading title="We couldn’t confirm that link">{message}</AuthHeading>
      </div>
      <Link href="/login" className="btn btn-primary bl-auth-submit">
        Sign in to send a new one
      </Link>
      <AuthBackLink />
    </>
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthLayout>
      <Suspense fallback={<span className="bl-skeleton" style={{ height: 120 }} />}>
        <VerifyEmailContent />
      </Suspense>
    </AuthLayout>
  );
}
