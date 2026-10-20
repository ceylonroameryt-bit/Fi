'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';
import { addDecimals } from '@/lib/decimal';
import { formatMoney } from '@/lib/money-format';
import { amountOutstanding, daysLate, isOverdue } from '@/lib/status';
import { AiInvoiceDraftModal } from '@/components/sales/ai-invoice-draft-modal';
import { EmptyState, Page, PageHeader, Panel, SkeletonRows } from '@/components/ui/page';
import {
  ConfirmDialog,
  Notice,
  RecordStatus,
  SearchField,
  StatTile,
  StatusTabs,
} from '@/components/ui/controls';

interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  reference?: string | null;
  issueDate: string;
  dueDate: string;
  currency: string;
  subtotal: string;
  taxTotal: string;
  totalAmount: string;
  amountPaid?: string | null;
  status: 'DRAFT' | 'APPROVED' | 'POSTED' | 'PAID' | 'PARTIALLY_PAID' | 'VOIDED';
  contact: { id: string; name: string; companyName?: string | null };
  journalEntry?: { id: string; journalNumber: string; status: string } | null;
}

type Tab = 'ALL' | 'DRAFT' | 'OPEN' | 'OVERDUE' | 'PAID' | 'VOIDED';
const PAGE_SIZE = 200;

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

const isOpen = (i: InvoiceListItem) =>
  i.status === 'POSTED' || i.status === 'PARTIALLY_PAID' || i.status === 'APPROVED';

export default function InvoicesPage() {
  const { activeOrg, hasPermission } = useAuth();
  const canCreate = hasPermission('invoice.create');
  const canPost = hasPermission('invoice.post');
  const currency = activeOrg?.baseCurrency ?? 'GBP';
  const money = (v: string | null | undefined) => formatMoney(v, { currency });
  const today = useMemo(todayIso, []);

  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('ALL');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [showAi, setShowAi] = useState(false);
  const [toPost, setToPost] = useState<InvoiceListItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Search waits for typing to pause so we don't query on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ pageSize: String(PAGE_SIZE) });
      if (query) params.set('search', query);
      const res = await apiRequest<{ items: InvoiceListItem[]; total: number }>(`/invoices?${params}`);
      setInvoices(res.items ?? []);
      setTotal(res.total ?? res.items?.length ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load invoices');
    } finally {
      setLoading(false);
    }
  }, [activeOrg, query]);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(() => {
    const drafts = invoices.filter((i) => i.status === 'DRAFT');
    const open = invoices.filter(isOpen);
    const overdue = open.filter((i) => isOverdue(i, today));
    const paid = invoices.filter((i) => i.status === 'PAID');
    const voided = invoices.filter((i) => i.status === 'VOIDED');
    return { drafts, open, overdue, paid, voided };
  }, [invoices, today]);

  const rows = useMemo(() => {
    switch (tab) {
      case 'DRAFT':
        return groups.drafts;
      case 'OPEN':
        return groups.open;
      case 'OVERDUE':
        return [...groups.overdue].sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
      case 'PAID':
        return groups.paid;
      case 'VOIDED':
        return groups.voided;
      default:
        return invoices;
    }
  }, [tab, groups, invoices]);

  const sum = (list: InvoiceListItem[], f: (i: InvoiceListItem) => string) => addDecimals(...list.map(f));
  const draftValue = sum(groups.drafts, (i) => i.totalAmount);
  const openValue = sum(groups.open, amountOutstanding);
  const overdueValue = sum(groups.overdue, amountOutstanding);
  const paidValue = sum(groups.paid, (i) => i.totalAmount);

  const post = async () => {
    if (!toPost) return;
    await apiRequest(`/invoices/${toPost.id}/post`, { method: 'POST' });
    setNotice(`${toPost.invoiceNumber} posted. It now counts in your sales and VAT.`);
    setToPost(null);
    await load();
  };

  return (
    <AppShell>
      <Page>
        <PageHeader
          title="Invoices"
          breadcrumb={[{ label: 'Money in' }, { label: 'Invoices' }]}
          description="Bill customers and see who has paid. Posting an invoice records the sale and VAT in your books."
          actions={
            canCreate && (
              <>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAi(true)}>
                  <Sparkles size={16} aria-hidden="true" /> Draft with AI
                </button>
                <Link href="/sales/invoices/new" className="btn btn-primary">
                  New invoice
                </Link>
              </>
            )
          }
        />

        {notice && (
          <Notice tone="success" onDismiss={() => setNotice(null)}>
            {notice}
          </Notice>
        )}

        <div className="bl-tiles">
          <StatTile
            label="Drafts"
            value={money(draftValue)}
            sub={`${groups.drafts.length} not sent yet`}
            onClick={() => setTab('DRAFT')}
            active={tab === 'DRAFT'}
          />
          <StatTile
            label="Awaiting payment"
            value={money(openValue)}
            sub={`${groups.open.length} open`}
            onClick={() => setTab('OPEN')}
            active={tab === 'OPEN'}
          />
          <StatTile
            label="Overdue"
            value={money(overdueValue)}
            sub={groups.overdue.length ? `! ${groups.overdue.length} late` : 'Nothing late'}
            tone={groups.overdue.length ? 'danger' : 'success'}
            onClick={() => setTab('OVERDUE')}
            active={tab === 'OVERDUE'}
          />
          <StatTile
            label="Paid"
            value={money(paidValue)}
            sub={`${groups.paid.length} invoices`}
            onClick={() => setTab('PAID')}
            active={tab === 'PAID'}
          />
        </div>

        <Panel>
          <StatusTabs<Tab>
            label="Filter invoices by status"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'ALL', label: 'All', count: invoices.length },
              { value: 'DRAFT', label: 'Draft', count: groups.drafts.length },
              { value: 'OPEN', label: 'Awaiting payment', count: groups.open.length },
              { value: 'OVERDUE', label: 'Overdue', count: groups.overdue.length, alert: true },
              { value: 'PAID', label: 'Paid', count: groups.paid.length },
              { value: 'VOIDED', label: 'Void', count: groups.voided.length },
            ]}
          />
          <div className="bl-toolbar">
            <SearchField
              label="Search invoices"
              value={search}
              onChange={setSearch}
              placeholder="Search number, reference or customer…"
            />
          </div>

          {error ? (
            <Notice tone="danger">
              Couldn’t load invoices: {error}.{' '}
              <button type="button" className="btn btn-secondary btn-sm" onClick={load}>
                Try again
              </button>
            </Notice>
          ) : loading ? (
            <SkeletonRows rows={8} />
          ) : invoices.length === 0 && !query ? (
            <EmptyState
              title="No invoices yet"
              action={
                canCreate ? (
                  <Link href="/sales/invoices/new" className="btn btn-primary">
                    Create your first invoice
                  </Link>
                ) : undefined
              }
            >
              Your first invoice takes about a minute. Or describe it in plain English with “Draft with AI”.
            </EmptyState>
          ) : rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 12px', color: 'var(--ink-2)' }}>
              {query ? (
                <>
                  No invoices match “{query}”.{' '}
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSearch('')}>
                    Clear search
                  </button>
                </>
              ) : tab === 'OVERDUE' ? (
                '✓ Nothing is overdue.'
              ) : (
                'Nothing in this tab.'
              )}
            </div>
          ) : (
            <div className="bl-table-wrap">
              <table className="bl-table">
                <thead>
                  <tr>
                    <th>Number</th>
                    <th>Customer</th>
                    <th>Issued</th>
                    <th>Due</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ textAlign: 'right' }}>Still owed</th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((inv) => {
                    const owed = amountOutstanding(inv);
                    const late = isOverdue(inv, today) ? daysLate(inv.dueDate, today) : 0;
                    return (
                      <tr key={inv.id}>
                        <td>
                          <Link href={`/sales/invoices/${inv.id}`} className="bl-row-link bl-money">
                            {inv.invoiceNumber}
                          </Link>
                          {inv.reference && <span className="bl-sub">Ref {inv.reference}</span>}
                        </td>
                        <td>
                          {inv.contact.name}
                          {inv.contact.companyName && inv.contact.companyName !== inv.contact.name && (
                            <span className="bl-sub">{inv.contact.companyName}</span>
                          )}
                        </td>
                        <td>{shortDate(inv.issueDate)}</td>
                        <td>
                          {shortDate(inv.dueDate)}
                          {late > 0 && (
                            <span className="bl-sub bl-late">
                              ! {late} {late === 1 ? 'day' : 'days'} late
                            </span>
                          )}
                        </td>
                        <td>
                          <RecordStatus kind="invoice" status={inv.status} />
                        </td>
                        <td className="num">{money(inv.totalAmount)}</td>
                        <td
                          className="num"
                          style={late > 0 ? { color: 'var(--danger)', fontWeight: 600 } : undefined}
                        >
                          {owed === '0.0000' ? '—' : money(owed)}
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {inv.status === 'DRAFT' && canPost ? (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => setToPost(inv)}
                            >
                              Post
                            </button>
                          ) : (
                            <Link href={`/sales/invoices/${inv.id}`} className="btn btn-secondary btn-sm">
                              Open
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!loading && total > invoices.length && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              Showing the latest {invoices.length} of {total}. Search to find older invoices.
            </p>
          )}
        </Panel>
      </Page>

      <AiInvoiceDraftModal isOpen={showAi} onClose={() => setShowAi(false)} />
      <ConfirmDialog
        open={!!toPost}
        title={`Post ${toPost?.invoiceNumber ?? 'invoice'}?`}
        confirmLabel="Post invoice"
        onCancel={() => setToPost(null)}
        onConfirm={post}
      >
        <p style={{ margin: 0 }}>
          This records the sale for <strong>{toPost?.contact.name}</strong> — {money(toPost?.totalAmount)}{' '}
          including VAT — in your books.
        </p>
        <p style={{ margin: 0 }}>
          Posted invoices can’t be edited. To correct one later, you’d void it or raise a credit note.
        </p>
      </ConfirmDialog>
    </AppShell>
  );
}
