'use client';

import React, { useCallback, useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';

interface AgeingBucketTotals {
  current: string;
  days1To30: string;
  days31To60: string;
  days61To90: string;
  days90Plus: string;
  total: string;
}

interface AgeingItem {
  id: string;
  referenceNumber: string;
  issueDate: string;
  dueDate: string;
  totalAmount: string;
  amountPaid: string;
  amountDue: string;
  daysOverdue: number;
  bucket: 'CURRENT' | '1_30' | '31_60' | '61_90' | '90_PLUS';
}

interface ContactAgeingGroup {
  contactId: string;
  contactName: string;
  companyName: string | null;
  items: AgeingItem[];
  totals: AgeingBucketTotals;
}

interface AgeingReport {
  organizationId: string;
  organizationName: string;
  baseCurrency: string;
  asOfDate: string;
  reportType: 'AR_AGEING' | 'AP_AGEING';
  groups: ContactAgeingGroup[];
  summaryTotals: AgeingBucketTotals;
  totalCount: number;
}

interface Contact {
  id: string;
  name: string;
}

function ArAgeingContent() {
  const { activeOrg } = useAuth();
  const searchParams = useSearchParams();
  const initialContactId = searchParams.get('contactId') || '';

  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedContactId, setSelectedContactId] = useState(initialContactId);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [report, setReport] = useState<AgeingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load customer contacts for filter
  useEffect(() => {
    if (!activeOrg) return;
    apiRequest<any>('/contacts?type=CUSTOMER').then((res) => {
      const list = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
      setContacts(list);
    }).catch(() => {});
  }, [activeOrg]);

  // Load report data
  const loadReport = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (asOfDate) params.set('asOfDate', asOfDate);
      if (selectedContactId) params.set('contactId', selectedContactId);

      const data = await apiRequest<AgeingReport>(`/reports/ar-ageing?${params.toString()}`);
      setReport(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load Aged Debtors report');
    } finally {
      setLoading(false);
    }
  }, [activeOrg, asOfDate, selectedContactId]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleExportCsv = async () => {
    if (!activeOrg) return;
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (asOfDate) params.set('asOfDate', asOfDate);
      if (selectedContactId) params.set('contactId', selectedContactId);

      const res = await fetch(
        `/api/v1/organizations/${activeOrg.id}/reports/ar-ageing/export?${params.toString()}`,
        {
          credentials: 'include',
          headers: { 'x-organization-id': activeOrg.id },
        }
      );

      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ar-ageing-${asOfDate}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      alert(err.message || 'Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  const totals = report?.summaryTotals;

  return (
    <AppShell>
      <div className="bl-legacy">
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
            Aged Debtors (AR Ageing)
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Monitor outstanding customer receivables bucketed by payment aging to optimize collections and cash flow.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handleExportCsv}
            disabled={exporting}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--border-strong)',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--ink-2)',
              cursor: exporting ? 'not-allowed' : 'pointer',
            }}
          >
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
          padding: '1rem 1.25rem',
          borderRadius: '0.5rem',
          border: '1px solid var(--border-subtle)',
          marginBottom: '1.5rem',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        }}
      >
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-2)', marginBottom: '0.25rem' }}>
            As of Date
          </label>
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            style={{ padding: '0.4rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: '0.375rem', fontSize: '0.875rem' }}
          />
        </div>

        <div style={{ minWidth: '220px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-2)', marginBottom: '0.25rem' }}>
            Filter Customer
          </label>
          <select
            value={selectedContactId}
            onChange={(e) => setSelectedContactId(e.target.value)}
            style={{ width: '100%', padding: '0.4rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: '0.375rem', fontSize: '0.875rem', backgroundColor: '#FFFFFF' }}
          >
            <option value="">All Customers</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', borderRadius: '0.375rem', marginBottom: '1.25rem', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {/* Ageing Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ backgroundColor: '#FFFFFF', padding: '1.1rem', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Receivables</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.25rem' }}>
            £{Number(totals?.total || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{report?.totalCount || 0} open invoices</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', padding: '1.1rem', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Current (Not Due)</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--success-text)', marginTop: '0.25rem' }}>
            £{Number(totals?.current || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--success-text)', marginTop: '0.2rem' }}>Within agreed credit terms</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', padding: '1.1rem', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>1 - 30 Days</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--warning-text)', marginTop: '0.25rem' }}>
            £{Number(totals?.days1To30 || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Overdue &lt; 1 month</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', padding: '1.1rem', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>31 - 60 Days</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--warning-text)', marginTop: '0.25rem' }}>
            £{Number(totals?.days31To60 || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Overdue 1-2 months</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', padding: '1.1rem', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>61 - 90 Days</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--warning-text)', marginTop: '0.25rem' }}>
            £{Number(totals?.days61To90 || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Overdue 2-3 months</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', padding: '1.1rem', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>90+ Days</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--danger)', marginTop: '0.25rem' }}>
            £{Number(totals?.days90Plus || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--danger)', marginTop: '0.2rem' }}>High risk collections</div>
        </div>
      </div>

      {/* Main Table */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-app)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--ink-2)', fontWeight: 600 }}>
              <th style={{ padding: '0.75rem 1rem' }}>Customer / Invoice</th>
              <th style={{ padding: '0.75rem 1rem' }}>Due Date</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Days Overdue</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Current</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>1 - 30 Days</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>31 - 60 Days</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>61 - 90 Days</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>90+ Days</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Total Due</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Calculating aged receivables...
                </td>
              </tr>
            ) : !report?.groups || report.groups.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>No outstanding debtors</div>
                  <div style={{ fontSize: '0.85rem' }}>All posted customer invoices have been fully paid as of {asOfDate}.</div>
                </td>
              </tr>
            ) : (
              report.groups.map((group) => (
                <React.Fragment key={group.contactId}>
                  {/* Customer Group Header */}
                  <tr style={{ backgroundColor: 'var(--bg-soft)', borderTop: '2px solid var(--border-subtle)', borderBottom: '1px solid var(--border-strong)' }}>
                    <td colSpan={3} style={{ padding: '0.65rem 1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      <Link
                        href={`/sales/contacts/${group.contactId}`}
                        style={{ color: 'var(--text-main)', textDecoration: 'none' }}
                      >
                        {group.contactName} {group.companyName ? `(${group.companyName})` : ''}
                      </Link>
                    </td>
                    <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: 700, color: 'var(--success-text)' }}>
                      £{Number(group.totals.current).toFixed(2)}
                    </td>
                    <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: 700, color: 'var(--warning-text)' }}>
                      £{Number(group.totals.days1To30).toFixed(2)}
                    </td>
                    <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: 700, color: 'var(--warning-text)' }}>
                      £{Number(group.totals.days31To60).toFixed(2)}
                    </td>
                    <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: 700, color: 'var(--warning-text)' }}>
                      £{Number(group.totals.days61To90).toFixed(2)}
                    </td>
                    <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: 700, color: 'var(--danger)' }}>
                      £{Number(group.totals.days90Plus).toFixed(2)}
                    </td>
                    <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-main)' }}>
                      £{Number(group.totals.total).toFixed(2)}
                    </td>
                  </tr>

                  {/* Individual Invoices for Customer */}
                  {group.items.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--bg-soft)' }}>
                      <td style={{ padding: '0.55rem 1rem 0.55rem 2rem' }}>
                        <Link
                          href={`/sales/invoices/${item.id}`}
                          style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}
                        >
                          {item.referenceNumber}
                        </Link>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                          (Issued {item.issueDate})
                        </span>
                      </td>
                      <td style={{ padding: '0.55rem 1rem', color: 'var(--text-muted)' }}>
                        {item.dueDate}
                      </td>
                      <td style={{ padding: '0.55rem 1rem', textAlign: 'center' }}>
                        {item.daysOverdue > 0 ? (
                          <span
                            style={{
                              backgroundColor: item.daysOverdue > 60 ? 'var(--danger-bg)' : 'var(--warning-bg)',
                              color: item.daysOverdue > 60 ? 'var(--danger)' : 'var(--warning-text)',
                              padding: '0.15rem 0.4rem',
                              borderRadius: '0.25rem',
                              fontWeight: 600,
                              fontSize: '0.75rem',
                            }}
                          >
                            {item.daysOverdue} days
                          </span>
                        ) : (
                          <span style={{ color: 'var(--success-text)', fontSize: '0.75rem', fontWeight: 600 }}>Not due</span>
                        )}
                      </td>
                      <td style={{ padding: '0.55rem 1rem', textAlign: 'right', color: item.bucket === 'CURRENT' ? 'var(--text-main)' : 'var(--text-muted)' }}>
                        {item.bucket === 'CURRENT' ? `£${Number(item.amountDue).toFixed(2)}` : '—'}
                      </td>
                      <td style={{ padding: '0.55rem 1rem', textAlign: 'right', color: item.bucket === '1_30' ? 'var(--text-main)' : 'var(--text-muted)' }}>
                        {item.bucket === '1_30' ? `£${Number(item.amountDue).toFixed(2)}` : '—'}
                      </td>
                      <td style={{ padding: '0.55rem 1rem', textAlign: 'right', color: item.bucket === '31_60' ? 'var(--text-main)' : 'var(--text-muted)' }}>
                        {item.bucket === '31_60' ? `£${Number(item.amountDue).toFixed(2)}` : '—'}
                      </td>
                      <td style={{ padding: '0.55rem 1rem', textAlign: 'right', color: item.bucket === '61_90' ? 'var(--text-main)' : 'var(--text-muted)' }}>
                        {item.bucket === '61_90' ? `£${Number(item.amountDue).toFixed(2)}` : '—'}
                      </td>
                      <td style={{ padding: '0.55rem 1rem', textAlign: 'right', color: item.bucket === '90_PLUS' ? 'var(--danger)' : 'var(--text-muted)', fontWeight: item.bucket === '90_PLUS' ? 600 : 400 }}>
                        {item.bucket === '90_PLUS' ? `£${Number(item.amountDue).toFixed(2)}` : '—'}
                      </td>
                      <td style={{ padding: '0.55rem 1rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-main)' }}>
                        £{Number(item.amountDue).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))
            )}
          </tbody>

          {/* Grand Totals Footer */}
          {report && report.groups.length > 0 && (
            <tfoot>
              <tr style={{ backgroundColor: 'var(--primary)', color: '#FFFFFF', fontWeight: 700, fontSize: '0.9rem' }}>
                <td colSpan={3} style={{ padding: '0.85rem 1rem' }}>
                  TOTAL RECEIVABLES (ALL DEBTORS)
                </td>
                <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                  £{Number(totals?.current).toFixed(2)}
                </td>
                <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                  £{Number(totals?.days1To30).toFixed(2)}
                </td>
                <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                  £{Number(totals?.days31To60).toFixed(2)}
                </td>
                <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                  £{Number(totals?.days61To90).toFixed(2)}
                </td>
                <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                  £{Number(totals?.days90Plus).toFixed(2)}
                </td>
                <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                  £{Number(totals?.total).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      </div>
    </AppShell>
  );
}

export default function ArAgeingPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="bl-legacy">
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading Aged Debtors report...
          </div>
          </div>
        </AppShell>
      }
    >
      <ArAgeingContent />
    </Suspense>
  );
}
