'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';
import { formatMoney } from '@/lib/money-format';
import { AiJournalDraftModal } from '@/components/accounting/ai-journal-draft-modal';
import { EmptyState, Page, PageHeader, Panel, SkeletonRows } from '@/components/ui/page';
import { Notice, RecordStatus, SearchField, StatusTabs } from '@/components/ui/controls';

interface JournalRow {
  id: string;
  journalNumber: string;
  journalDate: string;
  description: string;
  reference?: string | null;
  status: 'DRAFT' | 'VALIDATED' | 'POSTED' | 'REVERSED';
  sourceType?: string;
  reversalOfJournalId?: string | null;
  totalDebit: string;
  period?: { name: string; status: string } | null;
  createdBy?: { firstName?: string | null; lastName?: string | null; email?: string } | null;
}

type Tab = 'ALL' | 'DRAFT' | 'VALIDATED' | 'POSTED' | 'REVERSED';

/** Where an entry came from — the first question in any audit query. */
const SOURCE_LABEL: Record<string, string> = {
  MANUAL: 'Manual',
  INVOICE: 'Invoice',
  BILL: 'Bill',
  BANK_TRANSACTION: 'Bank',
  PAYMENT: 'Payment',
  CREDIT_NOTE: 'Credit note',
  PAYROLL: 'Payroll',
  SYSTEM: 'System',
};

function shortDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function personName(p: JournalRow['createdBy']): string {
  if (!p) return '—';
  const n = `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim();
  return n || p.email || '—';
}

export default function JournalsPage() {
  const { activeOrg, hasPermission } = useAuth();
  const canCreate = hasPermission('journal.create');
  const currency = activeOrg?.baseCurrency ?? 'GBP';

  const [journals, setJournals] = useState<JournalRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('ALL');
  const [source, setSource] = useState('ALL');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [showAi, setShowAi] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ pageSize: '200' });
      if (query) params.set('search', query);
      const data = await apiRequest<{ items: JournalRow[]; total: number } | JournalRow[]>(
        `/journals?${params}`,
      );
      const items = Array.isArray(data) ? data : (data.items ?? []);
      setJournals(items);
      setTotal(Array.isArray(data) ? items.length : (data.total ?? items.length));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load journals');
    } finally {
      setLoading(false);
    }
  }, [activeOrg, query]);

  useEffect(() => {
    load();
  }, [load]);

  const count = (s: Tab) => (s === 'ALL' ? journals.length : journals.filter((j) => j.status === s).length);
  const sources = useMemo(
    () => [...new Set(journals.map((j) => j.sourceType ?? 'MANUAL'))].sort(),
    [journals],
  );
  const rows = journals.filter(
    (j) => (tab === 'ALL' || j.status === tab) && (source === 'ALL' || (j.sourceType ?? 'MANUAL') === source),
  );

  return (
    <AppShell>
      <Page>
        <PageHeader
          title="Journals"
          breadcrumb={[{ label: 'Books' }, { label: 'Journals' }]}
          description="Every entry in your ledger. Invoices, bills and payments create journals automatically; manual journals are for adjustments like accruals."
          actions={
            canCreate && (
              <>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAi(true)}>
                  <Sparkles size={16} aria-hidden="true" /> Draft with AI
                </button>
                <Link href="/accounting/journals/new" className="btn btn-primary">
                  New journal
                </Link>
              </>
            )
          }
        />

        <Panel>
          <StatusTabs<Tab>
            label="Filter journals by status"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'ALL', label: 'All', count: count('ALL') },
              { value: 'DRAFT', label: 'Draft', count: count('DRAFT') },
              { value: 'VALIDATED', label: 'Validated', count: count('VALIDATED') },
              { value: 'POSTED', label: 'Posted', count: count('POSTED') },
              { value: 'REVERSED', label: 'Reversed', count: count('REVERSED') },
            ]}
          />
          <div className="bl-toolbar">
            <SearchField
              label="Search journals"
              value={search}
              onChange={setSearch}
              placeholder="Search number, description or reference…"
            />
            <label className="bl-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <span>Source</span>
              <select className="bl-select" value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="ALL">All sources</option>
                {sources.map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_LABEL[s] ?? s}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error ? (
            <Notice tone="danger">
              Couldn’t load journals: {error}.{' '}
              <button type="button" className="btn btn-secondary btn-sm" onClick={load}>
                Try again
              </button>
            </Notice>
          ) : loading ? (
            <SkeletonRows rows={8} />
          ) : journals.length === 0 && !query ? (
            <EmptyState
              title="No journals yet"
              action={
                canCreate ? (
                  <Link href="/accounting/journals/new" className="btn btn-primary">
                    Create a journal
                  </Link>
                ) : undefined
              }
            >
              Journals appear here as soon as you post an invoice, bill or payment.
            </EmptyState>
          ) : rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 12px', color: 'var(--ink-2)' }}>
              {query ? `No journals match “${query}”.` : 'Nothing in this view.'}
            </div>
          ) : (
            <div className="bl-table-wrap">
              <table className="bl-table">
                <thead>
                  <tr>
                    <th>Number</th>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Source</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((j) => (
                    <tr key={j.id}>
                      <td>
                        <Link href={`/accounting/journals/${j.id}`} className="bl-row-link bl-money">
                          {j.journalNumber}
                        </Link>
                      </td>
                      <td>
                        {shortDate(j.journalDate)}
                        {j.period && (
                          <span className="bl-sub">
                            {j.period.name}
                            {j.period.status !== 'OPEN' ? ' · locked' : ''}
                          </span>
                        )}
                      </td>
                      <td style={{ maxWidth: 360 }}>
                        {j.description}
                        {j.reference && <span className="bl-sub">Ref {j.reference}</span>}
                      </td>
                      <td>
                        {j.reversalOfJournalId
                          ? 'Reversal'
                          : (SOURCE_LABEL[j.sourceType ?? 'MANUAL'] ?? j.sourceType)}
                      </td>
                      <td>
                        <RecordStatus kind="journal" status={j.status} />
                      </td>
                      <td className="num">{formatMoney(j.totalDebit, { currency })}</td>
                      <td style={{ color: 'var(--ink-2)' }}>
                        {j.sourceType && j.sourceType !== 'MANUAL' ? 'System' : personName(j.createdBy)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && total > journals.length && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              Showing the latest {journals.length} of {total}. Search to find older entries.
            </p>
          )}
        </Panel>
      </Page>
      <AiJournalDraftModal isOpen={showAi} onClose={() => setShowAi(false)} />
    </AppShell>
  );
}
