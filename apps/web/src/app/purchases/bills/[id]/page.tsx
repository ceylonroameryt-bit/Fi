'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { ApiError, apiFetchBlob, apiRequest } from '@/lib/api';

interface BillLine {
  id: string;
  lineNumber: number;
  description: string;
  quantity: string | null;
  unitPrice: string | null;
  netAmount: string;
  taxAmount: string;
  lineTotal: string;
  account: { code: string; name: string };
  taxCode: { code: string; name: string } | null;
}

interface Bill {
  id: string;
  billNumber: string;
  supplierInvoiceNumber: string;
  issueDate: string;
  dueDate: string;
  status: 'DRAFT' | 'APPROVED' | 'POSTED' | 'VOIDED';
  subtotal: string;
  taxTotal: string;
  totalAmount: string;
  contact: { id: string; name: string; paymentTermsDays: number };
  lines: BillLine[];
  journalEntry: { id: string; journalNumber: string } | null;
  sourceDocument: { id: string; fileName: string } | null;
  warnings: string[];
  voidReason: string | null;
}

const STATUS_BADGE: Record<Bill['status'], string> = { DRAFT: 'badge-draft', APPROVED: 'badge-validated', POSTED: 'badge-posted', VOIDED: 'badge-reversed' };

const money = (v: string) => `£${Number(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function BillDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { activeOrg } = useAuth();
  const [bill, setBill] = useState<Bill | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [duplicateReason, setDuplicateReason] = useState('');
  const [needsDuplicateReason, setNeedsDuplicateReason] = useState(false);
  const [voidReason, setVoidReason] = useState('');

  const load = useCallback(async () => {
    if (!activeOrg || !id) return;
    try {
      setBill(await apiRequest<Bill>(`/bills/${id}`));
    } catch (e: any) {
      setError(e.message || 'Failed to load the bill');
    }
  }, [activeOrg, id]);

  useEffect(() => {
    load();
  }, [load]);

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/bills/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify(duplicateReason.trim() ? { duplicateOverrideReason: duplicateReason.trim() } : {}),
      });
      await load();
    } catch (e: any) {
      if (e instanceof ApiError && e.code === 'BILL_DUPLICATE') setNeedsDuplicateReason(true);
      setError(e.message || 'Approval failed');
    } finally {
      setBusy(false);
    }
  }

  async function voidBill() {
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/bills/${id}/void`, { method: 'POST', body: JSON.stringify({ reason: voidReason.trim() || undefined }) });
      await load();
    } catch (e: any) {
      setError(e.message || 'Void failed');
    } finally {
      setBusy(false);
    }
  }

  async function openAttachment() {
    try {
      const blob = await apiFetchBlob(`/bills/${id}/attachment`);
      window.open(URL.createObjectURL(blob), '_blank', 'noopener');
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (!bill) return <AppShell>{error ? <div className="alert alert-danger">{error}</div> : <p>Loading…</p>}</AppShell>;

  return (
    <AppShell>
      <Link href="/purchases/bills" style={{ fontSize: '0.85rem' }}>
        ← Supplier bills
      </Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', margin: '0.25rem 0 1rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0 }}>
            {bill.billNumber} <span className={`badge ${STATUS_BADGE[bill.status]}`} style={{ verticalAlign: 'middle' }}>{bill.status}</span>
          </h1>
          <p style={{ margin: '0.25rem 0 0', color: '#64748B' }}>
            {bill.contact.name} · invoice {bill.supplierInvoiceNumber} · dated {bill.issueDate.slice(0, 10)} · due {bill.dueDate.slice(0, 10)}
          </p>
        </div>
        {bill.sourceDocument && (
          <button className="btn btn-secondary" onClick={openAttachment}>
            View {bill.sourceDocument.fileName}
          </button>
        )}
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {bill.warnings.map((w) => (
        <div key={w} className="alert alert-warning">
          {w}
        </div>
      ))}

      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '1rem' }}>
        <table className="table" style={{ margin: 0 }}>
          <thead>
            <tr>
              <th>#</th>
              <th>Description</th>
              <th>Account</th>
              <th>VAT code</th>
              <th style={{ textAlign: 'right' }}>Qty</th>
              <th style={{ textAlign: 'right' }}>Net</th>
              <th style={{ textAlign: 'right' }}>VAT</th>
              <th style={{ textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {bill.lines.map((l) => (
              <tr key={l.id}>
                <td>{l.lineNumber}</td>
                <td>{l.description}</td>
                <td>
                  {l.account.code} {l.account.name}
                </td>
                <td>{l.taxCode ? l.taxCode.name : <span style={{ color: '#B91C1C' }}>Missing – required to approve</span>}</td>
                <td style={{ textAlign: 'right' }}>{l.quantity ? Number(l.quantity) : '—'}</td>
                <td style={{ textAlign: 'right' }}>{money(l.netAmount)}</td>
                <td style={{ textAlign: 'right' }}>{money(l.taxAmount)}</td>
                <td style={{ textAlign: 'right' }}>{money(l.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} style={{ textAlign: 'right' }}>Totals</td>
              <td style={{ textAlign: 'right' }}>{money(bill.subtotal)}</td>
              <td style={{ textAlign: 'right' }}>{money(bill.taxTotal)}</td>
              <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(bill.totalAmount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {bill.status === 'DRAFT' && (
        <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 560 }}>
          <strong>Approve and post</strong>
          <span style={{ fontSize: '0.85rem', color: '#64748B' }}>Posts Dr expense / Dr input VAT / Cr creditors to the ledger.</span>
          {(needsDuplicateReason || bill.warnings.length > 0) && (
            <input
              className="form-input"
              placeholder="Reason to post despite the possible duplicate"
              value={duplicateReason}
              onChange={(e) => setDuplicateReason(e.target.value)}
            />
          )}
          <button className="btn btn-primary" disabled={busy} onClick={approve}>
            Approve and post
          </button>
        </div>
      )}

      {bill.status === 'POSTED' && (
        <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 560 }}>
          <span>
            Posted as journal <strong>{bill.journalEntry?.journalNumber}</strong>. Posted bills cannot be edited; void to reverse.
          </span>
          <input className="form-input" placeholder="Reason for voiding" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
          <button className="btn btn-danger" disabled={busy} onClick={voidBill}>
            Void (reverse journal)
          </button>
        </div>
      )}
      {bill.status === 'VOIDED' && <div className="alert alert-info">Voided: {bill.voidReason}</div>}
    </AppShell>
  );
}
