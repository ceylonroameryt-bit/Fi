'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';
import { Callout, Page, PageHeader, Panel, SkeletonRows, StatusBadge } from '@/components/ui/page';
import { describeDevice } from '@/lib/device';

interface Me {
  id: string;
  email: string;
  mfaEnabled?: boolean;
  lastLoginAt?: string | null;
}

interface SessionRow {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
}

type MfaStep = 'idle' | 'setup' | 'codes' | 'disable';

function relativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

export default function SecurityPage() {
  const { activeOrg, logout } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [step, setStep] = useState<MfaStep>('idle');
  const [secret, setSecret] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, s] = await Promise.all([
        apiRequest<Me>('/auth/me'),
        apiRequest<SessionRow[]>('/auth/sessions'),
      ]);
      setMe(m);
      setSessions(Array.isArray(s) ? s : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your security settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const beginSetup = async () => {
    setBusy(true);
    setMfaError(null);
    try {
      setSecret(
        await apiRequest<{ secret: string; otpauthUrl: string }>('/auth/mfa/setup', { method: 'POST' }),
      );
      setCode('');
      setStep('setup');
    } catch (e) {
      setMfaError(e instanceof Error ? e.message : 'Could not start set-up');
    } finally {
      setBusy(false);
    }
  };

  const confirmSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMfaError(null);
    try {
      const res = await apiRequest<{ recoveryCodes: string[] }>('/auth/mfa/enable', {
        method: 'POST',
        body: JSON.stringify({ code: code.trim() }),
      });
      setRecoveryCodes(res.recoveryCodes ?? []);
      setSecret(null);
      setStep('codes');
      setMe((m) => (m ? { ...m, mfaEnabled: true } : m));
    } catch (err) {
      setMfaError(
        err instanceof Error
          ? `${err.message}. Check the time on your phone is set automatically, then try the newest code.`
          : 'That code did not work',
      );
    } finally {
      setBusy(false);
    }
  };

  const disable = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMfaError(null);
    try {
      await apiRequest('/auth/mfa/disable', { method: 'POST', body: JSON.stringify({ code: code.trim() }) });
      setMe((m) => (m ? { ...m, mfaEnabled: false } : m));
      setStep('idle');
      setCode('');
      setNotice('Two-step verification is off. We recommend turning it back on for financial data.');
    } catch (err) {
      setMfaError(err instanceof Error ? err.message : 'That code did not work');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string, isNewest: boolean) => {
    try {
      await apiRequest(`/auth/sessions/${id}/revoke`, { method: 'POST' });
      if (isNewest) {
        // Most likely this device — leave cleanly.
        await logout();
        return;
      }
      setSessions((s) => s.filter((x) => x.id !== id));
      setNotice('Signed out of that device.');
    } catch (e) {
      setNotice(
        e instanceof Error ? `Couldn't sign out that device: ${e.message}` : 'Could not sign out that device',
      );
    }
  };

  const revokeOthers = async () => {
    try {
      const res = await apiRequest<{ revoked?: number }>('/auth/sessions/revoke-all', { method: 'POST' });
      setNotice(`Signed out of ${res.revoked ?? 'all'} other ${res.revoked === 1 ? 'device' : 'devices'}.`);
      await load();
    } catch (e) {
      setNotice(
        e instanceof Error
          ? `Couldn't sign out other devices: ${e.message}`
          : 'Could not sign out other devices',
      );
    }
  };

  const groupedSecret = secret?.secret.replace(/(.{4})/g, '$1 ').trim();

  return (
    <AppShell>
      <Page>
        <PageHeader
          title="Security"
          breadcrumb={[{ label: 'You' }, { label: 'Security' }]}
          description={`Protect your access to ${activeOrg?.name ?? 'your books'}. These settings are personal to you.`}
        />

        {notice && (
          <Callout tone="info" role="status">
            {notice}{' '}
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setNotice(null)}>
              Dismiss
            </button>
          </Callout>
        )}

        {loading ? (
          <Panel>
            <SkeletonRows rows={5} />
          </Panel>
        ) : error ? (
          <Callout tone="danger" role="alert" title="We couldn't load your security settings.">
            {error}.{' '}
            <button type="button" className="btn btn-secondary btn-sm" onClick={load}>
              Try again
            </button>
          </Callout>
        ) : (
          <>
            <Panel
              title="Two-step verification"
              actions={
                me?.mfaEnabled ? (
                  <StatusBadge tone="success">On</StatusBadge>
                ) : (
                  <StatusBadge tone="warning">Off</StatusBadge>
                )
              }
            >
              {step === 'idle' && (
                <>
                  <p style={{ margin: 0, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                    {me?.mfaEnabled
                      ? 'You enter a code from your authenticator app when you sign in on a new device.'
                      : 'Add a code from an authenticator app (Google Authenticator, 1Password, Authy…) when you sign in. It stops someone with your password from getting into your books.'}
                  </p>
                  <div className="bl-actions">
                    {me?.mfaEnabled ? (
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => {
                          setStep('disable');
                          setCode('');
                          setMfaError(null);
                        }}
                      >
                        Turn off
                      </button>
                    ) : (
                      <button type="button" className="btn btn-primary" onClick={beginSetup} disabled={busy}>
                        {busy ? 'Starting…' : 'Set up two-step verification'}
                      </button>
                    )}
                  </div>
                </>
              )}

              {step === 'setup' && secret && (
                <form
                  onSubmit={confirmSetup}
                  style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 520 }}
                >
                  <ol
                    style={{
                      margin: 0,
                      paddingLeft: 20,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      lineHeight: 1.5,
                    }}
                  >
                    <li>
                      In your authenticator app, add an account and choose <strong>enter a setup key</strong>.
                      <div
                        className="bl-money"
                        style={{
                          marginTop: 6,
                          fontSize: 16,
                          letterSpacing: 1,
                          background: 'var(--bg-soft)',
                          padding: '10px 12px',
                          borderRadius: 10,
                          wordBreak: 'break-all',
                        }}
                      >
                        {groupedSecret}
                      </div>
                      <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                        On your phone? <a href={secret.otpauthUrl}>Open in authenticator app</a>
                      </span>
                    </li>
                    <li>Type the 6-digit code it shows.</li>
                  </ol>
                  <label className="bl-field" style={{ maxWidth: 200 }}>
                    <span>Code</span>
                    <input
                      className="bl-input bl-money"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="123456"
                      style={{ fontSize: 18, letterSpacing: 4 }}
                    />
                  </label>
                  {mfaError && (
                    <Callout tone="danger" role="alert">
                      {mfaError}
                    </Callout>
                  )}
                  <div className="bl-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setStep('idle')}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={busy || code.length !== 6}>
                      {busy ? 'Checking…' : 'Turn on'}
                    </button>
                  </div>
                </form>
              )}

              {step === 'codes' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Callout tone="success" title="Two-step verification is on.">
                    Save these recovery codes somewhere safe. Each works once if you lose your phone. We won’t
                    show them again.
                  </Callout>
                  <div
                    className="bl-money"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                      gap: 8,
                      background: 'var(--bg-soft)',
                      padding: 14,
                      borderRadius: 12,
                    }}
                  >
                    {recoveryCodes.map((c) => (
                      <span key={c}>{c}</span>
                    ))}
                  </div>
                  <div className="bl-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        navigator.clipboard?.writeText(recoveryCodes.join('\n')).then(
                          () => setNotice('Recovery codes copied.'),
                          () => setNotice('Copy failed — select the codes and copy them manually.'),
                        );
                      }}
                    >
                      Copy codes
                    </button>
                    <button type="button" className="btn btn-primary" onClick={() => setStep('idle')}>
                      I’ve saved them
                    </button>
                  </div>
                </div>
              )}

              {step === 'disable' && (
                <form
                  onSubmit={disable}
                  style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 480 }}
                >
                  <p style={{ margin: 0, lineHeight: 1.5 }}>
                    Enter a current code from your authenticator app, or a recovery code, to turn two-step
                    verification off.
                  </p>
                  <label className="bl-field" style={{ maxWidth: 240 }}>
                    <span>Code</span>
                    <input
                      className="bl-input bl-money"
                      value={code}
                      onChange={(e) => setCode(e.target.value.slice(0, 32))}
                      autoComplete="one-time-code"
                    />
                  </label>
                  {mfaError && (
                    <Callout tone="danger" role="alert">
                      {mfaError}
                    </Callout>
                  )}
                  <div className="bl-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setStep('idle')}>
                      Keep it on
                    </button>
                    <button type="submit" className="btn btn-danger" disabled={busy || !code.trim()}>
                      Turn off
                    </button>
                  </div>
                </form>
              )}

              {step === 'idle' && mfaError && (
                <Callout tone="danger" role="alert">
                  {mfaError}
                </Callout>
              )}
            </Panel>

            <Panel
              title="Where you're signed in"
              actions={
                sessions.length > 1 ? (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={revokeOthers}>
                    Sign out of all other devices
                  </button>
                ) : undefined
              }
            >
              {sessions.length === 0 ? (
                <p style={{ margin: 0, color: 'var(--ink-2)' }}>No active sessions found.</p>
              ) : (
                <div className="bl-table-wrap">
                  <table className="bl-table">
                    <thead>
                      <tr>
                        <th>Device</th>
                        <th>IP address</th>
                        <th>Last active</th>
                        <th>Signed in</th>
                        <th aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((s, i) => (
                        <tr key={s.id}>
                          <td>
                            <strong>{describeDevice(s.userAgent)}</strong>
                            {i === 0 && (
                              <span style={{ marginLeft: 8 }}>
                                <StatusBadge tone="info">Most recent</StatusBadge>
                              </span>
                            )}
                          </td>
                          <td className="bl-money">{s.ipAddress ?? '—'}</td>
                          <td>{relativeTime(s.lastUsedAt)}</td>
                          <td>
                            {new Date(s.createdAt).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => revoke(s.id, i === 0)}
                            >
                              {i === 0 ? 'Sign out here' : 'Sign out'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)' }}>
                Don’t recognise a device? Sign it out and change your password.
              </p>
            </Panel>
          </>
        )}
      </Page>
    </AppShell>
  );
}
