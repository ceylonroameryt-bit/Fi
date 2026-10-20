'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';
import { addDecimals, isPositiveDecimal } from '@/lib/decimal';
import { formatMoney } from '@/lib/money-format';
import { amountOutstanding, daysLate, isOverdue } from '@/lib/status';
import { EmptyState, Page, PageHeader, Panel, SkeletonRows, StatusBadge } from '@/components/ui/page';
import { Notice, RecordStatus, SearchField, StatTile, StatusTabs } from '@/components/ui/controls';

interface Bill {
  id: string;
  billNumber: string;
  supplierInvoiceNumber: string;
  issueDate: string;
  dueDate: string;
  status: 'DRAFT' | 'APPROVED' | 'POSTED' | 'VOIDED';
  totalAmount: string;
  amountPaid?: string | null;
  currency: string;
  sourceDocumentId: string | null;
  contact: { id: string; name: string };
}

type Tab = 'ALL' | 'DRAFT' | 'TO_PAY' | 'OVERDUE' | 'PAID' | 'VOIDED';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shortDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** "in 3 days", "today", "5 days ago" — relative dates are read faster than calendar dates. */
function dueIn(dueIso: string, today: string): string {
  const late = daysLate(dueIso, today);
  if (late === 0) return 'today';
  if (late < 0) return `in ${-late} ${late === -1 ? 'day' : 'days'}`;
  return `${late} ${late === 1 ? 'day' : 'days'} ago`;
}

export default function BillsPage() {
  const { activeOrg, hasPermission } = useAuth();
  const canCreate = hasPermission('bill.create');
  const currency = activeOrg?.baseCurrency ?? 'GBP';
  const money = (v: string | null | undefined) => formatMoney(v, { currency });
  const today = useMemo(todayIso, []);

  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('ALL');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<Bill[] | { items: Bill[] }>('/bills');
      setBills(Array.isArray(res) ? res : (res.items ?? []));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load bills');
    } finally {
      setLoading(false);
    }
  }, [activeOrg]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bills;
    return bills.filter(
      (b) =>
        b.billNumber.toLowerCase().includes(q) ||
        b.supplierInvoiceNumber?.toLowerCase().includes(q) ||
        b.contact.name.toLowerCase().includes(q),
    );
  }, [bills, search]);

  const groups = useMemo(() => {
    const open = filtered.filter(
      (b) => (b.status === 'POSTED' || b.status === 'APPROVED') && isPositiveDecimal(amountOutstanding(b)),
    );
    return {
      drafts: filtered.filter((b) => b.status === 'DRAFT'),
      open,
      overdue: open.filter((b) => isOverdue(b, today)),
      paid: filtered.filter((b) => b.status === 'POSTED' && !isPositiveDecimal(amountOutstanding(b))),
      voided: filtered.filter((b) => b.status === 'VOIDED'),
    };
  }, [filtered, today]);

  const rows = useMemo(() => {
    const byDue = (list: Bill[]) => [...list].sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
    switch (tab) {
      case 'DRAFT':
        return groups.drafts;
      case 'TO_PAY':
        return byDue(groups.open);
      case 'OVERDUE':
        return byDue(groups.overdue);
      case 'PAID':
        return groups.paid;
      case 'VOIDED':
        return groups.voided;
      default:
        return filtered;
    }
  }, [tab, groups, filtered]);

  const dueSoon = groups.open.filter((b) => {
    const l = daysLate(b.dueDate, today);
    return l <= 0 && l >= -7;
  });
  const total = (list: Bill[], f: (b: Bill) => string) => addDecimals(...list.map(f));

  return (
    <AppShell>
      <Page>
        <PageHeader
          title="Bills"
          breadcrumb={[{ label: 'Money out' }, { label: 'Bills' }]}
          description="What you owe suppliers. Most bills arrive through your Inbox — the AI drafts them, a person approves."
          actions={
            <>
              <Link href="/accounting/documents" className="btn btn-secondary">
                Upload bills
              </Link>
              {canCreate && (
                <Link href="/purchases/review" className="btn btn-primary">
                  Review AI drafts
                </Link>
              )}
            </>
          }
        />

        <div className="bl-tiles">
          <StatTile
            label="Drafts to approve"
            value={String(groups.drafts.length)}
            sub={money(total(groups.drafts, (b) => b.totalAmount))}
            onClick={() => setTab('DRAFT')}
            active={tab === 'DRAFT'}
          />
          <StatTile
            label="Due in next 7 days"
            value={money(total(dueSoon, amountOutstanding))}
            sub={`${dueSoon.length} ${dueSoon.length === 1 ? 'bill' : 'bills'}`}
            onClick={() => setTab('TO_PAY')}
            active={tab === 'TO_PAY'}
          />
          <StatTile
            label="Overdue"
            value={money(total(groups.overdue, amountOutstanding))}
            sub={groups.overdue.length ? `! ${groups.overdue.length} past due` : 'Nothing past due'}
            tone={groups.overdue.length ? 'danger' : 'success'}
            onClick={() => setTab('OVERDUE')}
            active={tab === 'OVERDUE'}
          />
          <StatTile
            label="You owe in total"
            value={money(total(groups.open, amountOutstanding))}
            sub={`${groups.open.length} unpaid`}
          />
        </div>

        <Panel>
          <StatusTabs<Tab>
            label="Filter bills"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'ALL', label: 'All', count: filtered.length },
              { value: 'DRAFT', label: 'Draft', count: groups.drafts.length },
              { value: 'TO_PAY', label: 'To pay', count: groups.open.length },
              { value: 'OVERDUE', label: 'Overdue', count: groups.overdue.length, alert: true },
              { value: 'PAID', label: 'Paid', count: groups.paid.length },
              { value: 'VOIDED', label: 'Void', count: groups.voided.length },
            ]}
          />
          <div className="bl-toolbar">
            <SearchField
              label="Search bills"
              value={search}
              onChange={setSearch}
              placeholder="Search supplier, bill or invoice number…"
            />
          </div>

          {error ? (
            <Notice tone="danger">
              Couldn’t load bills: {error}.{' '}
              <button type="button" className="btn btn-secondary btn-sm" onClick={load}>
                Try again
              </button>
            </Notice>
          ) : loading ? (
            <SkeletonRows rows={8} />
          ) : bills.length === 0 ? (
            <EmptyState
              title="No bills yet"
              action={
                <Link href="/accounting/documents" className="btn btn-primary">
                  Upload a bill
                </Link>
              }
            >
              Upload a PDF or photo and Blynt drafts the bill for you to check — supplier, dates, lines and
              VAT.
            </EmptyState>
          ) : rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 12px', color: 'var(--ink-2)' }}>
              {search
                ? `No bills match “${search}”.`
                : tab === 'OVERDUE'
                  ? '✓ Nothing is past due.'
                  : 'Nothing in this tab.'}
            </div>
          ) : (
            <div className="bl-table-wrap">
              <table className="bl-table">
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Their invoice</th>
                    <th>Due</th>
                    <th>Source</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ textAlign: 'right' }}>To pay</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b) => {
                    const owed = amountOutstanding(b);
                    const late = isOverdue(b, today);
                    const openBill = isPositiveDecimal(owed);
                    return (
                      <tr key={b.id}>
                        <td>
                          <Link href={`/purchases/bills/${b.id}`} className="bl-row-link">
                            {b.contact.name}
                          </Link>
                          <span className="bl-sub bl-money">{b.billNumber}</span>
                        </td>
                        <td className="bl-money">{b.supplierInvoiceNumber || '—'}</td>
                        <td>
                          {shortDate(b.dueDate)}
                          {openBill && (
                            <span className={`bl-sub ${late ? 'bl-late' : ''}`}>
                              {late ? '! ' : ''}
                              {dueIn(b.dueDate, today)}
                            </span>
                          )}
                        </td>
                        <td>
                          {b.sourceDocumentId ? (
                            <StatusBadge tone="ai">AI draft</StatusBadge>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>Manual</span>
                          )}
                        </td>
                        <td>
                          {b.status === 'POSTED' && !openBill ? (
                            <StatusBadge tone="success">Paid</StatusBadge>
                          ) : (
                            <RecordStatus kind="bill" status={b.status} />
                          )}
                        </td>
                        <td className="num">{money(b.totalAmount)}</td>
                        <td
                          className="num"
                          style={late ? { color: 'var(--danger)', fontWeight: 600 } : undefined}
                        >
                          {openBill ? money(owed) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </Page>
    </AppShell>
  );
}
