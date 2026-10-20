'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';

type Scheme = 'STANDARD' | 'CASH_ACCOUNTING' | 'FLAT_RATE' | 'ANNUAL_ACCOUNTING' | 'NOT_REGISTERED';

interface SchemePeriod {
  scheme: Scheme;
  startDate: string | null;
  flatRatePercent: string | null;
  limitedCostTrader: boolean;
}

const LABELS: Record<Scheme, string> = {
  STANDARD: 'Standard (invoice basis)',
  CASH_ACCOUNTING: 'Cash accounting',
  FLAT_RATE: 'Flat Rate Scheme',
  ANNUAL_ACCOUNTING: 'Annual accounting',
  NOT_REGISTERED: 'Not VAT-registered',
};

const HELP: Record<Scheme, string> = {
  STANDARD: 'VAT is due on invoices by their date.',
  CASH_ACCOUNTING: 'VAT is due when payments are received and made. Returns become available once payments are recorded.',
  FLAT_RATE: 'You pay HMRC a fixed percentage of your VAT-inclusive turnover and reclaim VAT only on capital assets of £2,000 or more.',
  ANNUAL_ACCOUNTING: 'One return a year; VAT is worked out on the invoice basis.',
  NOT_REGISTERED: 'No VAT is charged or reclaimed: only "Outside the scope of VAT" can be used on invoices and bills.',
};

export default function TaxSettingsPage() {
  const { activeOrg } = useAuth();
  const [current, setCurrent] = useState<SchemePeriod | null>(null);
  const [history, setHistory] = useState<SchemePeriod[]>([]);
  const [form, setForm] = useState({ scheme: 'STANDARD' as Scheme, startDate: '', flatRatePercent: '', limitedCostTrader: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!activeOrg) return;
    try {
      const res = await apiRequest<{ current: SchemePeriod; history: SchemePeriod[] }>(`/organizations/${activeOrg.id}/vat-scheme`);
      setCurrent(res.current);
      setHistory(res.history);
    } catch (e: any) {
      setError(e.message || 'Failed to load the VAT scheme');
    }
  }, [activeOrg]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!activeOrg) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const flat = form.scheme === 'FLAT_RATE';
      await apiRequest(`/organizations/${activeOrg.id}/vat-scheme`, {
        method: 'PUT',
        body: JSON.stringify({
          scheme: form.scheme,
          startDate: form.startDate,
          ...(flat ? { flatRatePercent: Number(form.flatRatePercent), limitedCostTrader: form.limitedCostTrader } : {}),
        }),
      });
      setSaved(true);
      await load();
    } catch (e: any) {
      setError(e.message || 'Failed to save the VAT scheme');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="bl-legacy">
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ margin: 0 }}>Taxes</h1>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)' }}>Your VAT scheme decides how VAT returns are worked out. Changes apply from a date and never alter earlier returns.</p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {saved && <div className="alert alert-success">VAT scheme saved.</div>}

      <div className="card" style={{ padding: '1rem', marginBottom: '1rem', maxWidth: 640 }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Current scheme</div>
        {current ? (
          <div style={{ marginTop: 4 }}>
            <strong>{LABELS[current.scheme]}</strong>
            {current.flatRatePercent && ` at ${current.flatRatePercent}%${current.limitedCostTrader ? ' (limited cost trader)' : ''}`}
            {current.startDate ? <span style={{ color: 'var(--text-muted)' }}> since {current.startDate}</span> : <span style={{ color: 'var(--text-muted)' }}> (default: no scheme recorded)</span>}
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{HELP[current.scheme]}</p>
          </div>
        ) : (
          <p>Loading…</p>
        )}
      </div>

      <form className="card" onSubmit={save} style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 640, marginBottom: '1rem' }}>
        <strong>Change scheme</strong>
        <label className="form-label">
          Scheme
          <select className="form-input" value={form.scheme} onChange={(e) => setForm({ ...form, scheme: e.target.value as Scheme })}>
            {(Object.keys(LABELS) as Scheme[]).map((s) => (
              <option key={s} value={s}>
                {LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{HELP[form.scheme]}</span>
        <label className="form-label">
          Applies from
          <input className="form-input" type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        </label>
        {form.scheme === 'FLAT_RATE' && (
          <>
            <label className="form-label">
              Flat rate % for your business sector (from HMRC&apos;s list)
              <input
                className="form-input"
                type="number"
                step="0.01"
                min="0.01"
                max="16.5"
                required
                value={form.flatRatePercent}
                onChange={(e) => setForm({ ...form, flatRatePercent: e.target.value })}
              />
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.9rem' }}>
              <input type="checkbox" checked={form.limitedCostTrader} onChange={(e) => setForm({ ...form, limitedCostTrader: e.target.checked, flatRatePercent: e.target.checked ? '16.5' : form.flatRatePercent })} />
              Limited cost trader (16.5%)
            </label>
          </>
        )}
        <div>
          <button className="btn btn-primary" disabled={busy || !form.startDate}>
            Save
          </button>
        </div>
      </form>

      <div className="card" style={{ padding: 0, overflow: 'hidden', maxWidth: 640 }}>
        <table className="table" style={{ margin: 0 }}>
          <thead>
            <tr>
              <th>From</th>
              <th>Scheme</th>
              <th style={{ textAlign: 'right' }}>Flat rate</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>
                  No scheme recorded: treated as standard.
                </td>
              </tr>
            ) : (
              history.map((h) => (
                <tr key={h.startDate}>
                  <td>{h.startDate}</td>
                  <td>{LABELS[h.scheme]}</td>
                  <td style={{ textAlign: 'right' }}>{h.flatRatePercent ? `${h.flatRatePercent}%` : '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      </div>
    </AppShell>
  );
}
