'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';

interface Bill {
  id: string;
  billNumber: string;
  supplierInvoiceNumber: string;
  issueDate: string;
  dueDate: string;
  status: 'DRAFT' | 'APPROVED' | 'POSTED' | 'VOIDED';
  totalAmount: string;
  currency: string;
  sourceDocumentId: string | null;
  contact: { id: string; name: string };
}

const STATUSES = ['ALL', 'DRAFT', 'POSTED', 'VOIDED'] as const;
const badge: Record<Bill['status'], string> = { DRAFT: 'badge-draft', APPROVED: 'badge-validated', POSTED: 'badge-posted', VOIDED: 'badge-reversed' };

export default function BillsPage() {
  const { activeOrg } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeOrg) return;
    try {
      setLoading(true);
      setError(null);
      setBills(await apiRequest<Bill[]>(`/bills${status === 'ALL' ? '' : `?status=${status}`}`));
    } catch (e: any) {
      setError(e.message || 'Failed to load supplier bills');
    } finally {
      setLoading(false);
    }
  }, [activeOrg, status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AppShell>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0 }}>Supplier bills</h1>
          <p style={{ margin: '0.25rem 0 0', color: '#64748B' }}>Drafts are posted to the ledger only when approved.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link href="/purchases/review" className="btn btn-secondary">
            Review queue
          </Link>
          <select className="form-input" style={{ width: 'auto' }} value={status} onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === 'ALL' ? 'All statuses' : s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Bill</th>
                <th>Supplier</th>
                <th>Supplier invoice</th>
                <th>Date</th>
                <th>Due</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem' }}>Loading…</td>
                </tr>
              ) : bills.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem', color: '#64748B' }}>No bills yet.</td>
                </tr>
              ) : (
                bills.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <Link href={`/purchases/bills/${b.id}`}>{b.billNumber}</Link>
                      {b.sourceDocumentId && <span title="Created from an uploaded document" style={{ marginLeft: 6, fontSize: '0.75rem', color: '#7C3AED' }}>AI</span>}
                    </td>
                    <td>{b.contact.name}</td>
                    <td>{b.supplierInvoiceNumber}</td>
                    <td>{b.issueDate.slice(0, 10)}</td>
                    <td>{b.dueDate.slice(0, 10)}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>£{Number(b.totalAmount).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                    <td>
                      <span className={`badge ${badge[b.status]}`}>{b.status}</span>
                    </td>
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
