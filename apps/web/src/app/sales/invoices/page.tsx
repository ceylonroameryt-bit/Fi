'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';

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
  status: 'DRAFT' | 'APPROVED' | 'POSTED' | 'PAID' | 'PARTIALLY_PAID' | 'VOIDED';
  contact: {
    id: string;
    name: string;
    companyName?: string | null;
  };
  journalEntry?: {
    id: string;
    journalNumber: string;
    status: string;
  } | null;
}

export default function InvoicesPage() {
  const { activeOrg, hasPermission } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'POSTED' | 'VOIDED'>('ALL');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canCreate = hasPermission('invoice.create');
  const canPost = hasPermission('invoice.post');

  const loadInvoices = useCallback(async () => {
    if (!activeOrg) return;
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (search) params.append('search', search);

      const res = await apiRequest<{ items: InvoiceListItem[]; total: number }>(`/invoices?${params.toString()}`);
      setInvoices(res.items || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load sales invoices');
    } finally {
      setLoading(false);
    }
  }, [activeOrg, statusFilter, search]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const handleQuickPost = async (id: string, invNum: string) => {
    if (!confirm(`Post invoice ${invNum} to the General Ledger? This will generate double-entry ledger postings.`)) return;

    try {
      await apiRequest(`/invoices/${id}/post`, { method: 'POST' });
      await loadInvoices();
    } catch (err: any) {
      alert(err.message || 'Failed to post invoice');
    }
  };

  // Compute metrics
  const totalInvoiced = invoices
    .filter((i) => i.status !== 'VOIDED')
    .reduce((acc, curr) => acc + Number(curr.totalAmount || 0), 0);

  const postedAmount = invoices
    .filter((i) => i.status === 'POSTED')
    .reduce((acc, curr) => acc + Number(curr.totalAmount || 0), 0);

  const draftCount = invoices.filter((i) => i.status === 'DRAFT').length;

  return (
    <AppShell>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>Sales Invoices</h1>
          <p style={{ color: '#64748B', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Authoritative sales invoicing engine automatically integrated into the General Ledger.
          </p>
        </div>
        {canCreate && (
          <Link href="/sales/invoices/new" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>+</span> New Invoice
          </Link>
        )}
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Invoiced</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0F172A', marginTop: '0.25rem' }}>
            £{totalInvoiced.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.25rem' }}>Across all active sales</div>
        </div>
        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Posted to Ledger</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2563EB', marginTop: '0.25rem' }}>
            £{postedAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.25rem' }}>Authoritative accounts receivable</div>
        </div>
        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Draft Invoices</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#D97706', marginTop: '0.25rem' }}>
            {draftCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.25rem' }}>Awaiting posting approval</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {(['ALL', 'DRAFT', 'POSTED', 'VOIDED'] as const).map((status) => (
              <button
                key={status}
                className={`btn btn-sm ${statusFilter === status ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setStatusFilter(status)}
              >
                {status === 'ALL' ? 'All Statuses' : status.charAt(0) + status.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <div style={{ width: '280px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search invoice #, customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ fontSize: '0.85rem' }}
            />
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* Invoices Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Customer</th>
                <th>Issue Date</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Ledger Journal</th>
                <th style={{ textAlign: 'right' }}>Total Amount</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#64748B' }}>
                    Loading invoices...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: '#64748B' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>No sales invoices found</div>
                    <div style={{ fontSize: '0.85rem' }}>Create a sales invoice to bill customers and record sales revenue.</div>
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <Link href={`/sales/invoices/${inv.id}`} style={{ fontWeight: 600, color: '#2563EB', textDecoration: 'none' }}>
                        {inv.invoiceNumber}
                      </Link>
                      {inv.reference && <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Ref: {inv.reference}</div>}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, color: '#0F172A' }}>{inv.contact.name}</div>
                      {inv.contact.companyName && <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{inv.contact.companyName}</div>}
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{inv.issueDate.slice(0, 10)}</td>
                    <td style={{ fontSize: '0.85rem' }}>{inv.dueDate.slice(0, 10)}</td>
                    <td>
                      <span
                        className={`badge ${
                          inv.status === 'POSTED'
                            ? 'badge-success'
                            : inv.status === 'DRAFT'
                            ? 'badge-warning'
                            : inv.status === 'VOIDED'
                            ? 'badge-danger'
                            : 'badge-neutral'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td>
                      {inv.journalEntry ? (
                        <Link
                          href={`/accounting/journals/${inv.journalEntry.id}`}
                          className="badge badge-primary"
                          style={{ textDecoration: 'none' }}
                          title="View posted double-entry journal"
                        >
                          📖 {inv.journalEntry.journalNumber}
                        </Link>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Not posted</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#0F172A' }}>
                      £{Number(inv.totalAmount).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <Link href={`/sales/invoices/${inv.id}`} className="btn btn-secondary btn-sm">
                          View
                        </Link>
                        {inv.status === 'DRAFT' && canPost && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleQuickPost(inv.id, inv.invoiceNumber)}
                          >
                            Post
                          </button>
                        )}
                      </div>
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
