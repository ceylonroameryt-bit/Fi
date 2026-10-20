'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';
import { Callout, Page, PageHeader, Panel, SkeletonRows, StatusBadge } from '@/components/ui/page';

interface AiSettings {
  enabled: boolean;
  provider: string;
  model: string;
}

interface BusinessProfile {
  industry: string | null;
}

export default function AiPreferencesPage() {
  const { activeOrg, hasPermission } = useAuth();
  const canManage = hasPermission('ai.manage');

  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [industry, setIndustry] = useState('');
  const [savedIndustry, setSavedIndustry] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);
    setError(null);
    try {
      const [s, p] = await Promise.all([
        apiRequest<AiSettings>('/ai/settings'),
        apiRequest<BusinessProfile>('/ai/business-profile').catch(() => ({ industry: null })),
      ]);
      setSettings(s);
      setIndustry(p.industry ?? '');
      setSavedIndustry(p.industry ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load AI preferences');
    } finally {
      setLoading(false);
    }
  }, [activeOrg]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleEnabled = async () => {
    if (!settings) return;
    const next = !settings.enabled;
    setSaving(true);
    try {
      setSettings(
        await apiRequest<AiSettings>('/ai/settings', {
          method: 'PUT',
          body: JSON.stringify({ enabled: next }),
        }),
      );
      setNotice({
        tone: 'success',
        text: next
          ? 'AI drafting is on. Drafts will appear in your Inbox for approval.'
          : 'AI drafting is off. Everything else works as normal.',
      });
    } catch (e) {
      setNotice({ tone: 'danger', text: e instanceof Error ? e.message : 'Could not change the setting' });
    } finally {
      setSaving(false);
    }
  };

  const saveIndustry = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const p = await apiRequest<BusinessProfile>('/ai/business-profile', {
        method: 'PUT',
        body: JSON.stringify({ industry: industry.trim() }),
      });
      setSavedIndustry(p.industry ?? null);
      setNotice({ tone: 'success', text: 'Saved. Suggestions will take your industry into account.' });
    } catch (err) {
      setNotice({ tone: 'danger', text: err instanceof Error ? err.message : 'Could not save' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <Page>
        <PageHeader
          title="AI preferences"
          breadcrumb={[{ label: 'Settings', href: '/settings/organization' }, { label: 'AI preferences' }]}
          description="Control how Blynt's AI helps with bookkeeping in this company."
        />

        <Callout tone="info" title="How AI works in Blynt:">
          it reads documents and suggests drafts. It never posts anything — a person with permission approves
          every draft, and totals, VAT and balances are always calculated by Blynt, not the AI.
        </Callout>

        {notice && (
          <Callout tone={notice.tone} role={notice.tone === 'danger' ? 'alert' : 'status'}>
            {notice.text}{' '}
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setNotice(null)}>
              Dismiss
            </button>
          </Callout>
        )}

        {loading ? (
          <Panel>
            <SkeletonRows rows={4} />
          </Panel>
        ) : error ? (
          <Callout tone="danger" role="alert" title="We couldn't load AI preferences.">
            {error}.{' '}
            <button type="button" className="btn btn-secondary btn-sm" onClick={load}>
              Try again
            </button>
          </Callout>
        ) : settings ? (
          <>
            <Panel
              title="AI drafting"
              actions={
                settings.enabled ? (
                  <StatusBadge tone="success">On</StatusBadge>
                ) : (
                  <StatusBadge tone="neutral">Off</StatusBadge>
                )
              }
            >
              <p style={{ margin: 0, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                Reads uploaded bills and receipts, suggests accounts for bank lines, and drafts invoices and
                journals from plain English. Drafts wait in your <Link href="/purchases/review">Inbox</Link>.
              </p>
              {settings.provider === 'none' && (
                <Callout tone="warning">
                  No AI provider is configured on this server, so drafting is unavailable even when switched
                  on.
                </Callout>
              )}
              <div className="bl-actions">
                {canManage ? (
                  <button
                    type="button"
                    className={settings.enabled ? 'btn btn-secondary' : 'btn btn-primary'}
                    role="switch"
                    aria-checked={settings.enabled}
                    onClick={toggleEnabled}
                    disabled={saving}
                  >
                    {settings.enabled ? 'Turn off AI drafting' : 'Turn on AI drafting'}
                  </button>
                ) : (
                  <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                    Only Owners and Administrators can change this.
                  </span>
                )}
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Model: <span className="bl-money">{settings.model}</span>
                </span>
              </div>
            </Panel>

            <Panel title="About your business">
              <p style={{ margin: 0, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                Telling Blynt your industry helps it suggest the right accounts. It’s never guessed from your
                company name.
              </p>
              <form
                onSubmit={saveIndustry}
                style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}
              >
                <label className="bl-field" style={{ flex: '1 1 280px', maxWidth: 420 }}>
                  <span>Industry</span>
                  <input
                    className="bl-input"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder="e.g. Marketing consultancy"
                    maxLength={50}
                    disabled={!canManage}
                  />
                </label>
                {canManage && (
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saving || !industry.trim() || industry.trim() === (savedIndustry ?? '')}
                  >
                    Save
                  </button>
                )}
              </form>
            </Panel>
          </>
        ) : null}
      </Page>
    </AppShell>
  );
}
