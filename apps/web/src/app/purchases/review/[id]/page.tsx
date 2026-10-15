'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { ApiError, apiRequest } from '@/lib/api';
import { DocumentViewer, HighlightBox, StatusBadge, ViewerPage } from '@/components/review/document-viewer';

type Status = 'verified' | 'inconsistent' | 'missing';

interface ReviewField {
  path: string;
  label: string;
  value: string | null;
  status: Status;
  findings: string[];
  source: string | null;
  boxes: HighlightBox[];
}

interface ReviewLine {
  lineNumber: number;
  description: string;
  quantity: string | null;
  unitPrice: string | null;
  netAmount: string | null;
  vatAmount: string | null;
  accountId: string | null;
  accountSource: string;
  taxCodeId: string | null;
  taxSource: string;
  codingReason: string | null;
  status: { net: { status: Status; findings: string[] }; vat: { status: Status; findings: string[] } };
  source: string | null;
  boxes: HighlightBox[];
}

interface Review {
  document: {
    id: string;
    fileName: string;
    mimeType: string;
    status: string;
    direction: 'PURCHASE' | 'SALE' | 'UNKNOWN';
    directionReason: string | null;
    confidenceScore: number | null;
    extractedText: string | null;
    bill: { id: string; billNumber: string; status: string } | null;
  };
  suggestionId: string | null;
  counterparty: {
    entity: { id: string; name: string } | null;
    match: { matchType: string; reason: string; candidates?: Array<{ id: string; name: string; score: number }> } | null;
    proposedContact: { type: string; name: string; vatNumber?: string } | null;
  };
  fields: ReviewField[];
  lines: ReviewLine[];
  validation: { consistent: boolean; findings: Array<{ rule: string; fields: string[]; message: string }> } | null;
  missing: string[];
  pages: ViewerPage[];
}

interface Option {
  id: string;
  code?: string;
  name: string;
  accountType?: string;
  isControlAccount?: boolean;
  accountSubtype?: string;
  type?: string;
  rate?: string;
}

interface LineForm {
  lineNumber: number;
  description: string;
  quantity: string;
  unitPrice: string;
  netAmount: string;
  vatAmount: string;
  accountId: string;
  taxCodeId: string;
}

/** Settlement and control accounts are never coded on a document line (same rule as the API). */
const NON_POSTABLE_SUBTYPES = new Set(['BANK', 'CASH', 'ACCOUNTS_RECEIVABLE', 'ACCOUNTS_PAYABLE', 'TAX_PAYABLE']);

const EDITABLE = ['invoiceNumber', 'invoiceDate', 'dueDate', 'currency', 'issuer.vatNumber', 'recipient.vatNumber', 'subtotal', 'vatTotal', 'total'];

export default function ReviewDocumentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { activeOrg } = useAuth();
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [direction, setDirection] = useState<'PURCHASE' | 'SALE'>('PURCHASE');
  const [contactId, setContactId] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [lines, setLines] = useState<LineForm[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [blocked, setBlocked] = useState<Array<{ field: string; findings: string[] }>>([]);
  const [rejectReason, setRejectReason] = useState('');
  const [focus, setFocus] = useState<{ boxes: HighlightBox[]; text: string | null }>({ boxes: [], text: null });

  const [contacts, setContacts] = useState<Option[]>([]);
  const [accounts, setAccounts] = useState<Option[]>([]);
  const [taxCodes, setTaxCodes] = useState<Option[]>([]);

  const load = useCallback(async () => {
    if (!activeOrg || !id) return;
    try {
      const r = await apiRequest<Review>(`/ai/documents/${id}/review`);
      setReview(r);
      const v = Object.fromEntries(r.fields.map((f) => [f.path, f.value ?? '']));
      setValues(v);
      setDirection(r.document.direction === 'SALE' ? 'SALE' : 'PURCHASE');
      setContactId(r.counterparty.entity?.id ?? '');
      setLines(
        r.lines.map((l) => ({
          lineNumber: l.lineNumber,
          description: l.description,
          quantity: l.quantity ?? '',
          unitPrice: l.unitPrice ?? '',
          netAmount: l.netAmount ?? '',
          vatAmount: l.vatAmount ?? '',
          accountId: l.accountId ?? '',
          taxCodeId: l.taxCodeId ?? '',
        })),
      );
      const [cs, accs, codes] = await Promise.all([
        apiRequest<{ items: Option[] } | Option[]>('/contacts?pageSize=100&status=ACTIVE'),
        apiRequest<Option[]>('/accounts'),
        apiRequest<Option[]>(`/tax-codes${v.invoiceDate ? `?date=${v.invoiceDate}` : ''}`),
      ]);
      const list = Array.isArray(cs) ? cs : (cs?.items ?? []);
      // Always offer the matched contact, even if it is beyond the first page.
      const matched = r.counterparty.entity;
      setContacts(matched && !list.some((c) => c.id === matched.id) ? [...list, { id: matched.id, name: matched.name }] : list);
      setAccounts(Array.isArray(accs) ? accs : []);
      setTaxCodes(Array.isArray(codes) ? codes : []);
    } catch (e: any) {
      setError(e.message || 'Failed to load the document');
    }
  }, [activeOrg, id]);

  useEffect(() => {
    load();
  }, [load]);

  const postable = useMemo(
    () =>
      accounts.filter(
        (a) =>
          !a.isControlAccount &&
          !NON_POSTABLE_SUBTYPES.has(a.accountSubtype ?? '') &&
          (direction === 'PURCHASE' ? a.accountType === 'EXPENSE' || a.accountType === 'ASSET' : a.accountType === 'REVENUE'),
      ),
    [accounts, direction],
  );
  const counterparties = contacts.filter((c) => (direction === 'PURCHASE' ? c.type !== 'CUSTOMER' : c.type !== 'SUPPLIER'));
  const fieldByPath = (path: string) => review?.fields.find((f) => f.path === path);
  const findingsFor = (path: string) => blocked.find((b) => b.field === path)?.findings ?? fieldByPath(path)?.findings ?? [];
  const needsOverride = (path: string) => blocked.some((b) => b.field === path) || fieldByPath(path)?.status === 'inconsistent';

  const updateLine = (i: number, patch: Partial<LineForm>) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));

  async function approve() {
    if (!review) return;
    setBusy(true);
    setError(null);
    const opt = (v: string) => (v.trim() === '' ? undefined : v.trim());
    const body = {
      direction,
      contactId,
      invoiceNumber: values.invoiceNumber,
      invoiceDate: values.invoiceDate,
      dueDate: opt(values.dueDate),
      currency: values.currency,
      issuerVatNumber: opt(values['issuer.vatNumber']),
      recipientVatNumber: opt(values['recipient.vatNumber']),
      subtotal: opt(values.subtotal),
      vatTotal: opt(values.vatTotal),
      total: opt(values.total),
      lines: lines.map((l) => ({
        lineNumber: l.lineNumber,
        description: l.description,
        quantity: opt(l.quantity),
        unitPrice: opt(l.unitPrice),
        netAmount: opt(l.netAmount),
        vatAmount: opt(l.vatAmount),
        accountId: l.accountId,
        taxCodeId: l.taxCodeId,
      })),
      overrides: Object.entries(overrides)
        .filter(([, reason]) => reason.trim())
        .map(([field, reason]) => ({ field, reason: reason.trim() })),
    };
    try {
      const res = await apiRequest<{ billId?: string; invoiceId?: string }>(`/ai/documents/${id}/review/approve`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      router.push(res.billId ? `/purchases/bills/${res.billId}` : `/sales/invoices/${res.invoiceId}`);
    } catch (e: any) {
      if (e instanceof ApiError && e.code === 'AI_REVIEW_INCONSISTENT') {
        setBlocked((e.details?.fields as Array<{ field: string; findings: string[] }>) ?? []);
        setError('Some values do not agree with each other. Correct them, or give a reason to accept each one as printed.');
      } else {
        setError(e.message || 'Approval failed');
      }
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!rejectReason.trim()) {
      setError('Give a reason for rejecting.');
      return;
    }
    setBusy(true);
    try {
      await apiRequest(`/ai/documents/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason: rejectReason.trim() }) });
      router.push('/purchases/review');
    } catch (e: any) {
      setError(e.message || 'Reject failed');
      setBusy(false);
    }
  }

  async function acceptProposedContact() {
    setBusy(true);
    try {
      await apiRequest(`/ai/documents/${id}/proposed-contact`, { method: 'POST', body: JSON.stringify({}) });
      setNotice('Contact created. The document is being re-analysed; this page will refresh.');
      setTimeout(() => {
        setNotice(null);
        load();
      }, 2500);
    } catch (e: any) {
      setError(e.message || 'Could not create the contact');
    } finally {
      setBusy(false);
    }
  }

  if (!review) {
    return (
      <AppShell>
        {error ? <div className="alert alert-danger">{error}</div> : <p>Loading…</p>}
      </AppShell>
    );
  }

  const canApprove = review.document.status === 'AWAITING_REVIEW';
  const overrideList = Array.from(new Set([...blocked.map((b) => b.field), ...review.fields.filter((f) => f.status === 'inconsistent').map((f) => f.path)]));

  return (
    <AppShell>
      <div style={{ marginBottom: '1rem' }}>
        <Link href="/purchases/review" style={{ fontSize: '0.85rem' }}>
          ← Review queue
        </Link>
        <h1 style={{ margin: '0.25rem 0 0' }}>Review {review.document.fileName}</h1>
        <p style={{ margin: '0.25rem 0 0', color: '#64748B', fontSize: '0.9rem' }}>
          {review.document.directionReason}
          {review.document.confidenceScore !== null && <> · confidence {Math.round(review.document.confidenceScore * 100)}% (orders the queue only)</>}
        </p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {notice && <div className="alert alert-info">{notice}</div>}
      {!canApprove && <div className="alert alert-warning">This document is {review.document.status.toLowerCase().replace('_', ' ')}; it can no longer be approved here.</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1.25rem', alignItems: 'start' }}>
        <div className="card" style={{ padding: '1rem', position: 'sticky', top: '1rem', maxHeight: 'calc(100vh - 2rem)', overflow: 'auto' }}>
          <DocumentViewer
            documentId={review.document.id}
            fileName={review.document.fileName}
            mimeType={review.document.mimeType}
            pages={review.pages}
            extractedText={review.document.extractedText}
            highlight={focus.boxes}
            highlightText={focus.text}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card" style={{ padding: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>Document</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <label>
                <span className="form-label">Type</span>
                <select className="form-input" value={direction} onChange={(e) => setDirection(e.target.value as 'PURCHASE' | 'SALE')}>
                  <option value="PURCHASE">Supplier bill (purchase)</option>
                  <option value="SALE">Our sales invoice</option>
                </select>
              </label>
              <label>
                <span className="form-label">{direction === 'PURCHASE' ? 'Supplier' : 'Customer'}</span>
                <select className="form-input" value={contactId} onChange={(e) => setContactId(e.target.value)}>
                  <option value="">Choose…</option>
                  {counterparties.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {!review.counterparty.entity && review.counterparty.proposedContact && (
              <div className="alert alert-info" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
                Not in your contacts: <strong>{review.counterparty.proposedContact.name}</strong>
                {review.counterparty.proposedContact.vatNumber && <> ({review.counterparty.proposedContact.vatNumber})</>}.{' '}
                <button className="btn btn-secondary btn-sm" disabled={busy || !canApprove} onClick={acceptProposedContact}>
                  Create this contact
                </button>
              </div>
            )}
            {review.counterparty.match?.candidates && review.counterparty.match.candidates.length > 0 && !review.counterparty.entity && (
              <p style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: 0 }}>
                Similar contacts: {review.counterparty.match.candidates.map((c) => `${c.name} (${Math.round(c.score * 100)}%)`).join(', ')}
              </p>
            )}
          </div>

          <div className="card" style={{ padding: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>Extracted fields</h3>
            {review.fields
              .filter((f) => EDITABLE.includes(f.path) || f.path.endsWith('.name'))
              .map((f) => (
                <div key={f.path} style={{ marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="form-label" style={{ margin: 0 }}>
                      {f.label}
                    </span>
                    <StatusBadge status={blocked.some((b) => b.field === f.path) ? 'inconsistent' : f.status} />
                  </div>
                  <input
                    className="form-input"
                    value={values[f.path] ?? ''}
                    disabled={!EDITABLE.includes(f.path)}
                    onFocus={() => setFocus({ boxes: f.boxes, text: f.source ?? f.value })}
                    onChange={(e) => setValues((v) => ({ ...v, [f.path]: e.target.value }))}
                  />
                  {f.source && <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Read from: “{f.source}”</div>}
                  {findingsFor(f.path).map((m, i) => (
                    <div key={i} style={{ fontSize: '0.75rem', color: '#B91C1C' }}>
                      {m}
                    </div>
                  ))}
                </div>
              ))}
          </div>

          <div className="card" style={{ padding: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>Lines</h3>
            {lines.map((l, i) => {
              const meta = review.lines[i];
              return (
                <div key={l.lineNumber} style={{ borderTop: i ? '1px solid #E2E8F0' : 'none', paddingTop: i ? '0.75rem' : 0, marginBottom: '0.75rem' }}>
                  <input
                    className="form-input"
                    value={l.description}
                    onFocus={() => setFocus({ boxes: meta?.boxes ?? [], text: meta?.source ?? l.description })}
                    onChange={(e) => updateLine(i, { description: e.target.value })}
                    aria-label={`Line ${l.lineNumber} description`}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginTop: '0.4rem' }}>
                    {(['quantity', 'unitPrice', 'netAmount', 'vatAmount'] as const).map((k) => (
                      <label key={k} style={{ fontSize: '0.75rem' }}>
                        {{ quantity: 'Qty', unitPrice: 'Unit price', netAmount: 'Net', vatAmount: 'VAT (printed)' }[k]}
                        <input
                          className="form-input"
                          value={l[k]}
                          inputMode="decimal"
                          onFocus={() => setFocus({ boxes: meta?.boxes ?? [], text: meta?.source ?? l.description })}
                          onChange={(e) => updateLine(i, { [k]: e.target.value })}
                        />
                      </label>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.4rem' }}>
                    <select className="form-input" value={l.accountId} onChange={(e) => updateLine(i, { accountId: e.target.value })} aria-label={`Line ${l.lineNumber} account`}>
                      <option value="">Account…</option>
                      {postable.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} {a.name}
                        </option>
                      ))}
                    </select>
                    <select className="form-input" value={l.taxCodeId} onChange={(e) => updateLine(i, { taxCodeId: e.target.value })} aria-label={`Line ${l.lineNumber} tax code`}>
                      <option value="">VAT code…</option>
                      {taxCodes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({Math.round(Number(t.rate) * 100)}%)
                        </option>
                      ))}
                    </select>
                  </div>
                  {meta?.codingReason && (
                    <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.25rem' }}>
                      Suggestion ({meta.accountSource.toLowerCase()} / {meta.taxSource.toLowerCase()}): {meta.codingReason}
                    </div>
                  )}
                  {[...(meta?.status.net.findings ?? []), ...(meta?.status.vat.findings ?? [])].map((m, k) => (
                    <div key={k} style={{ fontSize: '0.75rem', color: '#B91C1C' }}>
                      {m}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {overrideList.length > 0 && (
            <div className="card" style={{ padding: '1rem', borderColor: '#FCA5A5' }}>
              <h3 style={{ marginTop: 0 }}>Values that need attention</h3>
              <p style={{ fontSize: '0.85rem', color: '#64748B' }}>
                Correct the value above, or say why it is right as printed. Reasons are recorded with the approval.
              </p>
              {overrideList.map((path) => (
                <label key={path} style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                  <strong>{fieldByPath(path)?.label ?? path}</strong>: {findingsFor(path).join(' ')}
                  <input
                    className="form-input"
                    placeholder="Reason to accept as printed (optional if you corrected it)"
                    value={overrides[path] ?? ''}
                    onChange={(e) => setOverrides((o) => ({ ...o, [path]: e.target.value }))}
                    disabled={!needsOverride(path)}
                  />
                </label>
              ))}
            </div>
          )}

          <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button className="btn btn-primary" disabled={busy || !canApprove || !contactId} onClick={approve}>
              {direction === 'PURCHASE' ? 'Approve as draft bill' : 'Approve as draft sales invoice'}
            </button>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B' }}>
              Creates a draft only. {direction === 'PURCHASE' ? 'The bill is posted when someone approves it on the bill page.' : 'The invoice is posted from the invoice page.'}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input className="form-input" placeholder="Reason for rejecting" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
              <button className="btn btn-danger" disabled={busy || !canApprove} onClick={reject}>
                Reject
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
