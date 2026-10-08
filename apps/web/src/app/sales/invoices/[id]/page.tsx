'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';

interface InvoiceDetail {
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
  notes?: string | null;
  terms?: string | null;
  postedAt?: string | null;
  voidedAt?: string | null;
  voidReason?: string | null;
  contact: {
    id: string;
    name: string;
    companyName?: string | null;
    email?: string | null;
    phone?: string | null;
    addressLine1?: string | null;
    city?: string | null;
    postcode?: string | null;
    country: string;
    taxNumber?: string | null;
  };
  journalEntry?: {
    id: string;
    journalNumber: string;
    status: string;
    reversedByJournalId?: string | null;
    reversedByJournal?: { id: string; journalNumber: string } | null;
  } | null;
  lines: Array<{
    id: string;
    lineNumber: number;
    description: string;
    quantity: string | number;
    unitPrice: string | number;
    taxRate: string | number;
    taxAmount: string | number;
    lineTotal: string | number;
    account: {
      id: string;
      code: string;
      name: string;
    };
  }>;
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { activeOrg, hasPermission } = useAuth();
  const router = useRouter();

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const canPost = hasPermission('invoice.post');
  const canVoid = hasPermission('invoice.void');

  const loadInvoice = useCallback(async () => {
    if (!activeOrg || !id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await apiRequest<InvoiceDetail>(`/invoices/${id}`);
      setInvoice(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  }, [activeOrg, id]);

  useEffect(() => {
    loadInvoice();
  }, [loadInvoice]);

  const handlePost = async () => {
    if (!invoice) return;
    if (!confirm(`Post ${invoice.invoiceNumber} to the General Ledger? This creates immutable double-entry postings.`)) return;

    try {
      setActionLoading(true);
      await apiRequest(`/invoices/${invoice.id}/post`, { method: 'POST' });
      await loadInvoice();
    } catch (err: any) {
      alert(err.message || 'Failed to post invoice');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVoid = async () => {
    if (!invoice) return;
    const reason = prompt('Please enter the reason for voiding this invoice:');
    if (!reason) return;

    try {
      setActionLoading(true);
      await apiRequest(`/invoices/${invoice.id}/void`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      await loadInvoice();
    } catch (err: any) {
      alert(err.message || 'Failed to void invoice');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
          Loading invoice details...
        </div>
      </AppShell>
    );
  }

  if (error || !invoice) {
    return (
      <AppShell>
        <div style={{ maxWidth: '800px', margin: '2rem auto' }}>
          <div className="alert alert-danger">{error || 'Invoice not found'}</div>
          <Link href="/sales/invoices" className="btn btn-secondary">
            &larr; Back to Invoices
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div style={{ maxWidth: '880px', margin: '0 auto' }}>
        {/* Action Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Link href="/sales/invoices" style={{ color: '#64748B', textDecoration: 'none', fontSize: '0.85rem' }}>
              &larr; Invoices
            </Link>
            <span style={{ color: '#CBD5E1' }}>/</span>
            <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '0.9rem' }}>{invoice.invoiceNumber}</span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => window.print()}
            >
              🖨️ Print
            </button>

            {invoice.status === 'DRAFT' && canPost && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={actionLoading}
                onClick={handlePost}
              >
                {actionLoading ? 'Posting...' : 'Post to General Ledger'}
              </button>
            )}

            {invoice.status === 'POSTED' && canVoid && (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={actionLoading}
                onClick={handleVoid}
              >
                {actionLoading ? 'Voiding...' : 'Void Invoice'}
              </button>
            )}
          </div>
        </div>

        {/* Ledger Linked Status Banner */}
        {invoice.status === 'POSTED' && invoice.journalEntry && (
          <div
            style={{
              backgroundColor: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: '8px',
              padding: '0.85rem 1.25rem',
              marginBottom: '1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.25rem' }}>📖</span>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1E40AF' }}>
                  Posted Authoritative General Ledger Transaction
                </div>
                <div style={{ fontSize: '0.75rem', color: '#3B82F6' }}>
                  Debits Accounts Receivable (1100), credits Revenue & Tax accounts.
                </div>
              </div>
            </div>
            <Link
              href={`/accounting/journals/${invoice.journalEntry.id}`}
              className="btn btn-primary btn-sm"
              style={{ textDecoration: 'none' }}
            >
              View Journal Entry ({invoice.journalEntry.journalNumber}) &rarr;
            </Link>
          </div>
        )}

        {invoice.status === 'VOIDED' && (
          <div
            style={{
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '8px',
              padding: '0.85rem 1.25rem',
              marginBottom: '1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#991B1B' }}>
                Invoice Voided & Reversed
              </div>
              <div style={{ fontSize: '0.75rem', color: '#DC2626' }}>
                Reason: {invoice.voidReason || 'No reason provided'}
              </div>
            </div>
            {invoice.journalEntry?.reversedByJournal && (
              <Link
                href={`/accounting/journals/${invoice.journalEntry.reversedByJournal.id}`}
                className="btn btn-secondary btn-sm"
                style={{ textDecoration: 'none' }}
              >
                View Reversal Journal ({invoice.journalEntry.reversedByJournal.journalNumber})
              </Link>
            )}
          </div>
        )}

        {/* Printable Invoice Sheet */}
        <div
          className="card"
          style={{
            padding: '2.5rem',
            backgroundColor: '#fff',
            borderRadius: '8px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)',
            marginBottom: '2rem',
          }}
        >
          {/* Header Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0F172A', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
            <div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.03em' }}>
                {activeOrg?.name || 'Blynt'}
              </div>
              {activeOrg?.legalName && (
                <div style={{ fontSize: '0.85rem', color: '#64748B' }}>{activeOrg.legalName}</div>
              )}
              {activeOrg?.taxNumber && (
                <div style={{ fontSize: '0.8rem', color: '#64748B' }}>VAT: {activeOrg.taxNumber}</div>
              )}
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#2563EB', lineHeight: 1 }}>
                INVOICE
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0F172A', marginTop: '0.35rem' }}>
                {invoice.invoiceNumber}
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                <span
                  className={`badge ${
                    invoice.status === 'POSTED'
                      ? 'badge-success'
                      : invoice.status === 'DRAFT'
                      ? 'badge-warning'
                      : invoice.status === 'VOIDED'
                      ? 'badge-danger'
                      : 'badge-neutral'
                  }`}
                  style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}
                >
                  {invoice.status}
                </span>
              </div>
            </div>
          </div>

          {/* Addresses and Metadata */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                Billed To:
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0F172A' }}>
                {invoice.contact.name}
              </div>
              {invoice.contact.companyName && (
                <div style={{ fontSize: '0.9rem', color: '#334155' }}>{invoice.contact.companyName}</div>
              )}
              {invoice.contact.addressLine1 && (
                <div style={{ fontSize: '0.85rem', color: '#64748B' }}>{invoice.contact.addressLine1}</div>
              )}
              {[invoice.contact.city, invoice.contact.postcode, invoice.contact.country].filter(Boolean).length > 0 && (
                <div style={{ fontSize: '0.85rem', color: '#64748B' }}>
                  {[invoice.contact.city, invoice.contact.postcode, invoice.contact.country].filter(Boolean).join(', ')}
                </div>
              )}
              {invoice.contact.taxNumber && (
                <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '0.25rem' }}>
                  VAT ID: {invoice.contact.taxNumber}
                </div>
              )}
              {invoice.contact.email && (
                <div style={{ fontSize: '0.85rem', color: '#2563EB', marginTop: '0.25rem' }}>
                  {invoice.contact.email}
                </div>
              )}
            </div>

            <div style={{ backgroundColor: '#F8FAFC', padding: '1rem 1.25rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.85rem' }}>
                <span style={{ color: '#64748B' }}>Invoice Date:</span>
                <span style={{ fontWeight: 600, color: '#0F172A' }}>{invoice.issueDate.slice(0, 10)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.85rem' }}>
                <span style={{ color: '#64748B' }}>Payment Due:</span>
                <span style={{ fontWeight: 600, color: '#0F172A' }}>{invoice.dueDate.slice(0, 10)}</span>
              </div>
              {invoice.reference && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.85rem' }}>
                  <span style={{ color: '#64748B' }}>Reference / PO:</span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>{invoice.reference}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #E2E8F0', paddingTop: '0.4rem', fontSize: '0.85rem' }}>
                <span style={{ color: '#64748B' }}>Currency:</span>
                <span style={{ fontWeight: 600, color: '#0F172A' }}>{invoice.currency}</span>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div style={{ marginBottom: '2rem', borderTop: '1px solid #E2E8F0' }}>
            <table className="table" style={{ width: '100%', margin: 0 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
                  <th style={{ width: '8%', textAlign: 'center' }}>#</th>
                  <th style={{ width: '42%' }}>Item & Description</th>
                  <th style={{ width: '10%', textAlign: 'right' }}>Qty</th>
                  <th style={{ width: '15%', textAlign: 'right' }}>Unit Price</th>
                  <th style={{ width: '10%', textAlign: 'right' }}>VAT</th>
                  <th style={{ width: '15%', textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lines.map((line, idx) => (
                  <tr key={line.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ textAlign: 'center', color: '#64748B', fontSize: '0.85rem' }}>{idx + 1}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0F172A' }}>{line.description}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                        Account: {line.account.code} - {line.account.name}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontSize: '0.85rem' }}>{Number(line.quantity)}</td>
                    <td style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                      £{Number(line.unitPrice).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                      {Number(line.taxRate) > 0 ? `${(Number(line.taxRate) * 100).toFixed(0)}%` : '0%'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#0F172A', fontSize: '0.85rem' }}>
                      £{Number(line.lineTotal).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Totals */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2.5rem' }}>
            <div style={{ width: '320px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', fontSize: '0.9rem', color: '#64748B' }}>
                <span>Subtotal (Net)</span>
                <span>£{Number(invoice.subtotal).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', fontSize: '0.9rem', color: '#64748B' }}>
                <span>VAT / Sales Tax</span>
                <span>£{Number(invoice.taxTotal).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #0F172A', padding: '0.6rem 0', fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>
                <span>Total Due</span>
                <span style={{ color: '#2563EB' }}>
                  £{Number(invoice.totalAmount).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Notes and Terms Footer */}
          <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '1.25rem', fontSize: '0.8rem', color: '#64748B' }}>
            {invoice.notes && (
              <div style={{ marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 600, color: '#334155' }}>Notes: </span>
                {invoice.notes}
              </div>
            )}
            {invoice.terms && (
              <div>
                <span style={{ fontWeight: 600, color: '#334155' }}>Terms: </span>
                {invoice.terms}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
