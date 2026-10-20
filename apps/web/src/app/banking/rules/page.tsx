'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest, ApiError } from '@/lib/api';
import {
  Callout,
  EmptyState,
  Page,
  PageHeader,
  Panel,
  SkeletonRows,
  StatusBadge,
} from '@/components/ui/page';

type MatchField = 'DESCRIPTION' | 'PAYEE' | 'REFERENCE' | 'AMOUNT_EXACT' | 'AMOUNT_RANGE';
type MatchType = 'CONTAINS' | 'EQUALS' | 'STARTS_WITH' | 'REGEX';

interface BankRule {
  id: string;
  name: string;
  bankAccountId: string | null;
  isEnabled: boolean;
  matchField: MatchField;
  matchType: MatchType;
  matchValue: string;
  transactionDirection: string | null;
  suggestedAccountId: string | null;
  autoCategorise: boolean;
  timesApplied: number;
}

interface Account {
  id: string;
  code: string;
  name: string;
  isActive?: boolean;
  status?: string;
}

interface BankAccount {
  id: string;
  name: string;
}

const FIELD_LABEL: Record<MatchField, string> = {
  DESCRIPTION: 'description',
  PAYEE: 'payee',
  REFERENCE: 'reference',
  AMOUNT_EXACT: 'amount',
  AMOUNT_RANGE: 'amount',
};

const TYPE_LABEL: Record<MatchType, string> = {
  CONTAINS: 'contains',
  EQUALS: 'is exactly',
  STARTS_WITH: 'starts with',
  REGEX: 'matches pattern',
};

const EMPTY_FORM = {
  name: '',
  matchField: 'DESCRIPTION' as MatchField,
  matchType: 'CONTAINS' as MatchType,
  matchValue: '',
  direction: '' as '' | 'IN' | 'OUT',
  suggestedAccountId: '',
  bankAccountId: '',
};

export default function BankRulesPage() {
  const { activeOrg, hasPermission } = useAuth();
  const canManage = hasPermission('bank_rules.manage');

  const [rules, setRules] = useState<BankRule[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; forbidden: boolean } | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);
    setError(null);
    try {
      const [r, a, b] = await Promise.all([
        apiRequest<BankRule[]>('/bank-rules'),
        apiRequest<Account[] | { items: Account[] }>('/accounts').catch(() => [] as Account[]),
        apiRequest<BankAccount[]>('/bank-accounts').catch(() => [] as BankAccount[]),
      ]);
      setRules(Array.isArray(r) ? r : []);
      const list = Array.isArray(a) ? a : (a?.items ?? []);
      setAccounts(list.filter((x) => x.isActive !== false && x.status !== 'ARCHIVED'));
      setBankAccounts(Array.isArray(b) ? b : []);
    } catch (e) {
      setError({
        message: e instanceof Error ? e.message : 'Could not load bank rules',
        forbidden: e instanceof ApiError && e.status === 403,
      });
    } finally {
      setLoading(false);
    }
  }, [activeOrg]);

  useEffect(() => {
    load();
  }, [load]);

  const accountName = useMemo(() => {
    const map = new Map(accounts.map((a) => [a.id, `${a.code} · ${a.name}`]));
    return (id: string | null) => (id ? (map.get(id) ?? 'an account') : null);
  }, [accounts]);
  const bankName = (id: string | null) =>
    id ? (bankAccounts.find((b) => b.id === id)?.name ?? 'one account') : 'all bank accounts';

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.matchValue.trim()) {
      setFormError('Enter the text to look for, for example ADOBE.');
      return;
    }
    if (!form.suggestedAccountId) {
      setFormError('Choose the account these transactions should go to.');
      return;
    }
    setSaving(true);
    try {
      await apiRequest('/bank-rules', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim() || `${TYPE_LABEL[form.matchType]} ${form.matchValue.trim()}`.slice(0, 100),
          matchField: form.matchField,
          matchType: form.matchType,
          matchValue: form.matchValue.trim(),
          ...(form.direction ? { transactionDirection: form.direction } : {}),
          suggestedAccountId: form.suggestedAccountId,
          ...(form.bankAccountId ? { bankAccountId: form.bankAccountId } : {}),
        }),
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      setNotice(
        'Rule saved. It will suggest this account on matching bank lines — you still confirm each one.',
      );
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save the rule');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (rule: BankRule) => {
    setRules((rs) => rs.map((r) => (r.id === rule.id ? { ...r, isEnabled: !r.isEnabled } : r)));
    try {
      await apiRequest(`/bank-rules/${rule.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isEnabled: !rule.isEnabled }),
      });
    } catch (err) {
      setRules((rs) => rs.map((r) => (r.id === rule.id ? { ...r, isEnabled: rule.isEnabled } : r)));
      setNotice(
        err instanceof Error ? `Couldn't update “${rule.name}”: ${err.message}` : 'Could not update the rule',
      );
    }
  };

  const remove = async (rule: BankRule) => {
    try {
      await apiRequest(`/bank-rules/${rule.id}`, { method: 'DELETE' });
      setConfirmDeleteId(null);
      setRules((rs) => rs.filter((r) => r.id !== rule.id));
      setNotice(`Deleted “${rule.name}”. Transactions it already categorised are unchanged.`);
    } catch (err) {
      setNotice(err instanceof Error ? `Couldn't delete: ${err.message}` : 'Could not delete the rule');
    }
  };

  return (
    <AppShell>
      <Page>
        <PageHeader
          title="Bank rules"
          breadcrumb={[{ label: 'Bank' }, { label: 'Bank rules' }]}
          description="Teach Blynt how to file transactions you see every month. Rules suggest an account; you still confirm."
          actions={
            canManage && !showForm ? (
              <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
                New rule
              </button>
            ) : undefined
          }
        />

        {notice && (
          <Callout tone="success" role="status">
            {notice}{' '}
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setNotice(null)}>
              Dismiss
            </button>
          </Callout>
        )}

        {showForm && (
          <Panel title="New rule">
            <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div
                style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 10, fontSize: 15 }}
              >
                <strong style={{ paddingBottom: 10 }}>When</strong>
                <label className="bl-field">
                  <span>Field</span>
                  <select
                    className="bl-select"
                    value={form.matchField}
                    onChange={(e) => setForm({ ...form, matchField: e.target.value as MatchField })}
                  >
                    <option value="DESCRIPTION">Description</option>
                    <option value="PAYEE">Payee</option>
                    <option value="REFERENCE">Reference</option>
                  </select>
                </label>
                <label className="bl-field">
                  <span>Match</span>
                  <select
                    className="bl-select"
                    value={form.matchType}
                    onChange={(e) => setForm({ ...form, matchType: e.target.value as MatchType })}
                  >
                    <option value="CONTAINS">contains</option>
                    <option value="STARTS_WITH">starts with</option>
                    <option value="EQUALS">is exactly</option>
                  </select>
                </label>
                <label className="bl-field" style={{ flex: '1 1 200px' }}>
                  <span>Text</span>
                  <input
                    className="bl-input"
                    value={form.matchValue}
                    onChange={(e) => setForm({ ...form, matchValue: e.target.value })}
                    placeholder="e.g. ADOBE"
                    maxLength={200}
                  />
                </label>
                <label className="bl-field">
                  <span>Money</span>
                  <select
                    className="bl-select"
                    value={form.direction}
                    onChange={(e) => setForm({ ...form, direction: e.target.value as '' | 'IN' | 'OUT' })}
                  >
                    <option value="">in or out</option>
                    <option value="OUT">going out</option>
                    <option value="IN">coming in</option>
                  </select>
                </label>
              </div>
              <div
                style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 10, fontSize: 15 }}
              >
                <strong style={{ paddingBottom: 10 }}>Then suggest</strong>
                <label className="bl-field" style={{ flex: '1 1 260px' }}>
                  <span>Account</span>
                  <select
                    className="bl-select"
                    value={form.suggestedAccountId}
                    onChange={(e) => setForm({ ...form, suggestedAccountId: e.target.value })}
                  >
                    <option value="">Choose an account…</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} · {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="bl-field">
                  <span>On</span>
                  <select
                    className="bl-select"
                    value={form.bankAccountId}
                    onChange={(e) => setForm({ ...form, bankAccountId: e.target.value })}
                  >
                    <option value="">All bank accounts</option>
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="bl-field" style={{ maxWidth: 420 }}>
                <span>Rule name (optional)</span>
                <input
                  className="bl-input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Adobe subscription"
                  maxLength={100}
                />
              </label>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)' }}>
                No VAT code is set by the rule — you choose it when confirming, so nothing is guessed.
              </p>
              {formError && (
                <Callout tone="danger" role="alert">
                  {formError}
                </Callout>
              )}
              <div className="bl-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowForm(false);
                    setForm(EMPTY_FORM);
                    setFormError(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save rule'}
                </button>
              </div>
            </form>
          </Panel>
        )}

        {loading ? (
          <Panel>
            <SkeletonRows rows={4} />
          </Panel>
        ) : error ? (
          error.forbidden ? (
            <EmptyState title="You don't have access to bank rules">
              Owners, Administrators and Accountants manage rules. Ask one of them if you need a new rule.
            </EmptyState>
          ) : (
            <Callout tone="danger" role="alert" title="We couldn't load your rules.">
              {error.message}.{' '}
              <button type="button" className="btn btn-secondary btn-sm" onClick={load}>
                Try again
              </button>
            </Callout>
          )
        ) : rules.length === 0 && !showForm ? (
          <EmptyState
            title="No rules yet"
            action={
              canManage ? (
                <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
                  Create your first rule
                </button>
              ) : undefined
            }
          >
            If you see the same payee every month — software, rent, travel — a rule files it for you next
            time.
          </EmptyState>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {rules.map((rule) => {
              const amountRule = rule.matchField === 'AMOUNT_EXACT' || rule.matchField === 'AMOUNT_RANGE';
              return (
                <section
                  key={rule.id}
                  className="bl-panel"
                  style={{ gap: 8, opacity: rule.isEnabled ? 1 : 0.7 }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      flexWrap: 'wrap',
                      alignItems: 'center',
                    }}
                  >
                    <h2 className="bl-panel-title" style={{ fontSize: 15 }}>
                      {rule.name}
                    </h2>
                    <div className="bl-actions">
                      {rule.isEnabled ? (
                        <StatusBadge tone="success">On</StatusBadge>
                      ) : (
                        <StatusBadge tone="neutral">Paused</StatusBadge>
                      )}
                      {rule.autoCategorise && <StatusBadge tone="warning">Applies automatically</StatusBadge>}
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6 }}>
                    <strong>When</strong> {FIELD_LABEL[rule.matchField]}{' '}
                    {amountRule ? 'matches' : TYPE_LABEL[rule.matchType]}{' '}
                    <code className="bl-status bl-status--neutral" style={{ fontFamily: 'var(--font-mono)' }}>
                      {rule.matchValue}
                    </code>
                    {rule.transactionDirection === 'IN' && ' on money coming in'}
                    {rule.transactionDirection === 'OUT' && ' on money going out'} on{' '}
                    {bankName(rule.bankAccountId)}
                    <br />
                    <strong>Then</strong> suggest{' '}
                    {accountName(rule.suggestedAccountId) ?? 'a contact or tax code only'}
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      Used {rule.timesApplied} {rule.timesApplied === 1 ? 'time' : 'times'}
                    </span>
                    {canManage && (
                      <div className="bl-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => toggle(rule)}
                        >
                          {rule.isEnabled ? 'Pause' : 'Turn on'}
                        </button>
                        {confirmDeleteId === rule.id ? (
                          <>
                            <span style={{ fontSize: 13 }}>Delete this rule?</span>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setConfirmDeleteId(null)}
                            >
                              Keep
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => remove(rule)}
                            >
                              Delete
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => setConfirmDeleteId(rule.id)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </Page>
    </AppShell>
  );
}
