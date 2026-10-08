'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';
import {
  FileCheck,
  Plus,
  Search,
  Sparkles,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
} from 'lucide-react';

interface Bill {
  id: string;
  invoiceNumber: string;
  reference?: string | null;
  issueDate: string;
  dueDate: string;
  status: 'DRAFT' | 'APPROVED' | 'POSTED' | 'PAID' | 'VOIDED';
  subtotal: string;
  taxTotal: string;
  totalAmount: string;
  amountPaid: string;
  currency: string;
  contact: {
    id: string;
    name: string;
    companyName?: string | null;
  };
}

export default function BillsPage() {
  const router = useRouter();
  const { activeOrg } = useAuth();

  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'APPROVED' | 'POSTED' | 'PAID'>('ALL');
  const [error, setError] = useState<string | null>(null);

  const loadBills = useCallback(async () => {
    if (!activeOrg) return;
    try {
      setLoading(true);
      setError(null);
      // Invoices API fetches all invoices; bills represent purchase payables or AI draft bills
      const data = await apiRequest<any>('/invoices');
      const list = Array.isArray(data) ? data : data?.items || [];
      setBills(list);
    } catch (err: any) {
      setError(err.message || 'Failed to load supplier bills');
    } finally {
      setLoading(false);
    }
  }, [activeOrg]);

  useEffect(() => {
    loadBills();
  }, [loadBills]);

  const filtered = bills.filter((b) => {
    if (statusFilter !== 'ALL' && b.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      b.invoiceNumber.toLowerCase().includes(q) ||
      b.contact?.name.toLowerCase().includes(q) ||
      (b.reference && b.reference.toLowerCase().includes(q))
    );
  });

  return (
    <AppShell>
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h1 className="page-title" style={{ margin: 0 }}>
              Supplier Bills
            </h1>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: '#FEF3C7',
                color: '#92400E',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.2rem 0.55rem',
                borderRadius: '6px',
              }}
            >
              <FileCheck size={12} />
              Purchases
            </span>
          </div>
          <p
            className="page-subtitle"
            style={{ margin: '0.25rem 0 0 0', color: '#64748B', fontSize: '0.875rem' }}
          >
            Accounts payable bills, vendor invoices, and AI Document Intelligence purchase drafts.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => loadBills()}
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          <button
            onClick={() => router.push('/accounting/documents')}
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: '#4F46E5',
              borderColor: '#4F46E5',
            }}
          >
            <Sparkles size={14} />
            AI Ingest Bill
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FCA5A5',
            color: '#991B1B',
            borderRadius: '8px',
            marginBottom: '1rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.25rem',
        }}
      >
        <div style={{ position: 'relative', width: '360px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94A3B8',
            }}
          />
          <input
            type="text"
            className="form-input"
            placeholder="Search bills by number, supplier, reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              paddingLeft: '2.25rem',
              width: '100%',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['ALL', 'DRAFT', 'APPROVED', 'POSTED', 'PAID'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 600,
                border: '1px solid',
                borderColor: statusFilter === st ? '#2563EB' : '#CBD5E1',
                backgroundColor: statusFilter === st ? '#EFF6FF' : '#FFFFFF',
                color: statusFilter === st ? '#1D4ED8' : '#64748B',
                cursor: 'pointer',
              }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Bills Table */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '10px',
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr
              style={{
                backgroundColor: '#F8FAFC',
                borderBottom: '1px solid #E2E8F0',
                textAlign: 'left',
                color: '#64748B',
              }}
            >
              <th style={{ padding: '0.75rem 1.25rem' }}>Bill #</th>
              <th style={{ padding: '0.75rem 1.25rem' }}>Supplier</th>
              <th style={{ padding: '0.75rem 1.25rem' }}>Issue Date</th>
              <th style={{ padding: '0.75rem 1.25rem' }}>Due Date</th>
              <th style={{ padding: '0.75rem 1.25rem', textAlign: 'right' }}>Tax</th>
              <th style={{ padding: '0.75rem 1.25rem', textAlign: 'right' }}>Total</th>
              <th style={{ padding: '0.75rem 1.25rem' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#94A3B8' }}>
                  Loading supplier bills...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#94A3B8' }}>
                  No supplier bills found. Use <strong>AI Ingest Bill</strong> above to upload invoices and
                  auto-draft entries.
                </td>
              </tr>
            ) : (
              filtered.map((b) => (
                <tr
                  key={b.id}
                  onClick={() => router.push(`/sales/invoices/${b.id}`)}
                  style={{
                    borderBottom: '1px solid #F1F5F9',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <td
                    style={{
                      padding: '0.75rem 1.25rem',
                      fontWeight: 600,
                      color: '#0F172A',
                      fontFamily: 'monospace',
                    }}
                  >
                    {b.invoiceNumber}
                  </td>
                  <td style={{ padding: '0.75rem 1.25rem', color: '#0F172A', fontWeight: 500 }}>
                    {b.contact?.name || '—'}
                  </td>
                  <td style={{ padding: '0.75rem 1.25rem', color: '#64748B' }}>
                    {b.issueDate?.slice(0, 10)}
                  </td>
                  <td style={{ padding: '0.75rem 1.25rem', color: '#64748B' }}>{b.dueDate?.slice(0, 10)}</td>
                  <td style={{ padding: '0.75rem 1.25rem', textAlign: 'right', color: '#64748B' }}>
                    £{Number(b.taxTotal || 0).toFixed(2)}
                  </td>
                  <td
                    style={{
                      padding: '0.75rem 1.25rem',
                      textAlign: 'right',
                      fontWeight: 700,
                      color: '#0F172A',
                    }}
                  >
                    £{Number(b.totalAmount || 0).toFixed(2)}
                  </td>
                  <td style={{ padding: '0.75rem 1.25rem' }}>
                    <span
                      style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor:
                          b.status === 'PAID'
                            ? '#DCFCE7'
                            : b.status === 'APPROVED' || b.status === 'POSTED'
                              ? '#EFF6FF'
                              : '#FEF3C7',
                        color:
                          b.status === 'PAID'
                            ? '#166534'
                            : b.status === 'APPROVED' || b.status === 'POSTED'
                              ? '#1D4ED8'
                              : '#92400E',
                      }}
                    >
                      {b.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
