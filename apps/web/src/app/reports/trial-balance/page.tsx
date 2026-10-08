'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';

interface FinancialYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

interface AccountingPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  financialYearId: string;
}

interface TrialBalanceAccountRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  normalBalance: 'DEBIT' | 'CREDIT';
  grossDebit: string;
  grossCredit: string;
  debitBalance: string;
  creditBalance: string;
}

interface TrialBalanceReport {
  organizationId: string;
  organizationName: string;
  baseCurrency: string;
  asOfDate: string;
  filterApplied: {
    asOfDate?: string;
    financialYearId?: string;
    periodId?: string;
    periodName?: string;
    financialYearName?: string;
  };
  accounts: TrialBalanceAccountRow[];
  totalDebit: string;
  totalCredit: string;
  difference: string;
  isBalanced: boolean;
}

function TrialBalanceContent() {
  const router = useRouter();
  const { activeOrg, hasPermission } = useAuth();

  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);

  // Filters
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedFyId, setSelectedFyId] = useState('');
  const [selectedPeriodId, setSelectedPeriodId] = useState('');

  // Report Data
  const [report, setReport] = useState<TrialBalanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const canExport = hasPermission('trial_balance.export') || hasPermission('trial_balance.view');

  // Load FYs & Periods
  useEffect(() => {
    if (!activeOrg) return;
    const loadMetadata = async () => {
      try {
        const [fyRes, pRes] = await Promise.all([
          apiRequest<any>('/financial-years'),
          apiRequest<any>('/periods'),
        ]);
        setFinancialYears(Array.isArray(fyRes) ? fyRes : fyRes?.items || []);
        setPeriods(Array.isArray(pRes) ? pRes : pRes?.items || []);
      } catch (err: any) {
        console.error('Failed to load filter metadata', err);
      }
    };
    loadMetadata();
  }, [activeOrg]);

  // Load Trial Balance
  const loadReport = useCallback(async () => {
    if (!activeOrg) return;
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (selectedPeriodId) {
        params.set('periodId', selectedPeriodId);
      } else if (selectedFyId) {
        params.set('financialYearId', selectedFyId);
      } else if (asOfDate) {
        params.set('asOfDate', asOfDate);
      }

      const res = await apiRequest<TrialBalanceReport>(`/reports/trial-balance?${params.toString()}`);
      setReport(res);
    } catch (err: any) {
      setError(err.message || 'Failed to generate Trial Balance');
    } finally {
      setLoading(false);
    }
  }, [activeOrg, asOfDate, selectedFyId, selectedPeriodId]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleExportCsv = async () => {
    if (!activeOrg) return;
    try {
      setExporting(true);
      const params = new URLSearchParams();
      if (selectedPeriodId) params.set('periodId', selectedPeriodId);
      else if (selectedFyId) params.set('financialYearId', selectedFyId);
      else if (asOfDate) params.set('asOfDate', asOfDate);

      const res = await fetch(
        `/api/v1/organizations/${activeOrg.id}/reports/trial-balance/export?${params.toString()}`,
        {
          credentials: 'include',
          headers: {
            'x-organization-id': activeOrg.id,
          },
        },
      );

      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trial-balance-${asOfDate}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      alert(err.message || 'Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  const handleRowClick = (accountId: string) => {
    router.push(`/accounting/general-ledger?accountId=${accountId}`);
  };

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1 className="page-title">Trial Balance</h1>
          <p className="page-subtitle">
            Confirm that total debit balances equal total credit balances across all active accounts
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {canExport && (
            <button
              onClick={handleExportCsv}
              disabled={exporting || loading}
              className="btn btn-secondary btn-sm"
            >
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Balanced Status Banner */}
      {report && (
        <div
          style={{
            padding: '1rem 1.25rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: report.isBalanced ? '#F0FDF4' : '#FEF2F2',
            border: `1px solid ${report.isBalanced ? '#BBF7D0' : '#FECACA'}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.25rem' }}>{report.isBalanced ? '✓' : '⚠'}</span>
            <div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  color: report.isBalanced ? '#15803D' : '#B91C1C',
                }}
              >
                {report.isBalanced ? 'Balanced' : 'Critical Accounting Integrity Issue: Unbalanced'}
              </div>
              <div
                style={{
                  fontSize: '0.8rem',
                  color: report.isBalanced ? '#166534' : '#991B1B',
                  marginTop: '0.1rem',
                }}
              >
                {report.isBalanced
                  ? `Total Debits match Total Credits exactly at £${Number(report.totalDebit).toLocaleString('en-GB', { minimumFractionDigits: 2 })}. Difference: £0.00`
                  : `Out of balance by £${Number(report.difference).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`}
              </div>
            </div>
          </div>

          <div className="font-mono" style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Difference</div>
            <div
              style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                color: report.isBalanced ? '#15803D' : '#B91C1C',
              }}
            >
              £{Number(report.difference).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      )}

      {/* Filters Card */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-body">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              alignItems: 'flex-end',
            }}
          >
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">As of Date</label>
              <input
                type="date"
                className="form-input font-mono"
                value={asOfDate}
                onChange={(e) => {
                  setAsOfDate(e.target.value);
                  setSelectedFyId('');
                  setSelectedPeriodId('');
                }}
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Financial Year</label>
              <select
                className="form-select"
                value={selectedFyId}
                onChange={(e) => {
                  setSelectedFyId(e.target.value);
                  setSelectedPeriodId('');
                }}
              >
                <option value="">Specific Date</option>
                {financialYears.map((fy) => (
                  <option key={fy.id} value={fy.id}>
                    {fy.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Accounting Period</label>
              <select
                className="form-select"
                value={selectedPeriodId}
                onChange={(e) => {
                  setSelectedPeriodId(e.target.value);
                  if (e.target.value) {
                    const p = periods.find((x) => x.id === e.target.value);
                    if (p) setSelectedFyId(p.financialYearId);
                  }
                }}
              >
                <option value="">None (Use FY or Date)</option>
                {periods
                  .filter((p) => !selectedFyId || p.financialYearId === selectedFyId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Trial Balance Table */}
      <div className="card">
        <div className="table-wrapper" style={{ border: 'none' }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '120px' }}>Code</th>
                <th>Account Name</th>
                <th style={{ width: '140px' }}>Type</th>
                <th style={{ width: '180px' }} className="text-right">
                  Debit ({activeOrg?.baseCurrency})
                </th>
                <th style={{ width: '180px' }} className="text-right">
                  Credit ({activeOrg?.baseCurrency})
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                    Generating authoritative Trial Balance...
                  </td>
                </tr>
              ) : !report || report.accounts.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                    No posted ledger transactions exist as of {asOfDate}.
                  </td>
                </tr>
              ) : (
                report.accounts.map((row) => (
                  <tr
                    key={row.accountId}
                    onClick={() => handleRowClick(row.accountId)}
                    style={{ cursor: 'pointer' }}
                    title="Click to view Account General Ledger"
                  >
                    <td className="font-mono">
                      <strong style={{ color: '#146EF5' }}>{row.accountCode}</strong>
                    </td>
                    <td>
                      <strong style={{ color: '#0f172a' }}>{row.accountName}</strong>
                    </td>
                    <td>
                      <span className="badge badge-open" style={{ fontSize: '0.7rem' }}>
                        {row.accountType}
                      </span>
                    </td>
                    <td
                      className="text-right font-mono"
                      style={{ fontWeight: Number(row.debitBalance) > 0 ? 600 : 400 }}
                    >
                      {Number(row.debitBalance) > 0
                        ? Number(row.debitBalance).toLocaleString('en-GB', { minimumFractionDigits: 2 })
                        : '—'}
                    </td>
                    <td
                      className="text-right font-mono"
                      style={{ fontWeight: Number(row.creditBalance) > 0 ? 600 : 400 }}
                    >
                      {Number(row.creditBalance) > 0
                        ? Number(row.creditBalance).toLocaleString('en-GB', { minimumFractionDigits: 2 })
                        : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {report && report.accounts.length > 0 && (
              <tfoot>
                <tr style={{ backgroundColor: '#F8FAFC', fontWeight: 700, borderTop: '2px solid #CBD5E1' }}>
                  <td colSpan={3} className="text-right" style={{ padding: '0.85rem 1rem' }}>
                    TOTAL:
                  </td>
                  <td className="text-right font-mono" style={{ padding: '0.85rem 1rem', fontSize: '1rem' }}>
                    {Number(report.totalDebit).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="text-right font-mono" style={{ padding: '0.85rem 1rem', fontSize: '1rem' }}>
                    {Number(report.totalCredit).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr
                  style={{
                    backgroundColor: report.isBalanced ? '#F0FDF4' : '#FEF2F2',
                    fontWeight: 700,
                  }}
                >
                  <td colSpan={3} className="text-right" style={{ padding: '0.75rem 1rem' }}>
                    DIFFERENCE:
                  </td>
                  <td
                    colSpan={2}
                    className="text-right font-mono"
                    style={{
                      padding: '0.75rem 1rem',
                      color: report.isBalanced ? '#15803D' : '#B91C1C',
                    }}
                  >
                    £{Number(report.difference).toLocaleString('en-GB', { minimumFractionDigits: 2 })}{' '}
                    {report.isBalanced && (
                      <span style={{ marginLeft: '0.5rem', fontWeight: 500 }}>(Balanced)</span>
                    )}
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

export default function TrialBalancePage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div style={{ padding: '3rem', textAlign: 'center' }}>Loading Trial Balance...</div>
        </AppShell>
      }
    >
      <TrialBalanceContent />
    </Suspense>
  );
}
