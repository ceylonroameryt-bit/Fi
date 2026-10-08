'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';
import { Scale, Download, CheckCircle2, AlertTriangle, Building2, Calendar, Layers } from 'lucide-react';

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

interface BalanceSheetAccountRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountSubtype: string | null;
  amount: string;
}

interface BalanceSheetSection {
  title: string;
  accounts: BalanceSheetAccountRow[];
  total: string;
}

interface BalanceSheetReport {
  organizationId: string;
  organizationName: string;
  baseCurrency: string;
  asOfDate: string;
  currentAssets: BalanceSheetSection;
  nonCurrentAssets: BalanceSheetSection;
  totalAssets: string;
  currentLiabilities: BalanceSheetSection;
  nonCurrentLiabilities: BalanceSheetSection;
  totalLiabilities: string;
  equity: BalanceSheetSection;
  currentYearEarnings: string;
  totalEquity: string;
  totalLiabilitiesAndEquity: string;
  isBalanced: boolean;
  difference: string;
}

function BalanceSheetContent() {
  const router = useRouter();
  const { activeOrg } = useAuth();

  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);

  // Filters
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedFyId, setSelectedFyId] = useState('');
  const [selectedPeriodId, setSelectedPeriodId] = useState('');

  // Report Data
  const [report, setReport] = useState<BalanceSheetReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

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

      const res = await apiRequest<BalanceSheetReport>(`/reports/balance-sheet?${params.toString()}`);
      setReport(res);
    } catch (err: any) {
      setError(err.message || 'Failed to generate Balance Sheet statement');
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
        `/api/v1/organizations/${activeOrg.id}/reports/balance-sheet/export?${params.toString()}`,
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
      a.download = `balance-sheet-${asOfDate}.csv`;
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
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h1 className="page-title" style={{ margin: 0 }}>
              Balance Sheet
            </h1>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: report?.isBalanced ? '#DCFCE7' : '#FEF3C7',
                color: report?.isBalanced ? '#15803D' : '#92400E',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.2rem 0.55rem',
                borderRadius: '6px',
              }}
            >
              <Scale size={12} />
              {report?.isBalanced ? 'Invariant Verified' : 'Checking Balance'}
            </span>
          </div>
          <p
            className="page-subtitle"
            style={{ margin: '0.25rem 0 0 0', color: '#64748B', fontSize: '0.875rem' }}
          >
            Snapshot of Assets, Liabilities, and Equity satisfying Assets ≡ Liabilities + Equity.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          disabled={exporting || loading}
          className="btn btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Download size={14} />
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      {/* Filter Toolbar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'flex-end',
          padding: '1rem 1.25rem',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '10px',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#475569',
              marginBottom: '0.25rem',
            }}
          >
            Financial Year
          </label>
          <select
            className="form-select"
            value={selectedFyId}
            onChange={(e) => {
              setSelectedFyId(e.target.value);
              setSelectedPeriodId('');
            }}
            style={{
              padding: '0.45rem 0.65rem',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              fontSize: '0.85rem',
            }}
          >
            <option value="">Custom As-Of Date</option>
            {financialYears.map((fy) => (
              <option key={fy.id} value={fy.id}>
                {fy.name}
              </option>
            ))}
          </select>
        </div>

        {selectedFyId && (
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#475569',
                marginBottom: '0.25rem',
              }}
            >
              Period (Optional)
            </label>
            <select
              className="form-select"
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              style={{
                padding: '0.45rem 0.65rem',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '0.85rem',
              }}
            >
              <option value="">Year End Date</option>
              {periods
                .filter((p) => p.financialYearId === selectedFyId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>
        )}

        {!selectedFyId && (
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#475569',
                marginBottom: '0.25rem',
              }}
            >
              As of Date
            </label>
            <input
              type="date"
              className="form-input"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              style={{
                padding: '0.45rem 0.65rem',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '0.85rem',
              }}
            />
          </div>
        )}

        <button
          onClick={() => loadReport()}
          disabled={loading}
          className="btn btn-secondary"
          style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}
        >
          Apply Filters
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FCA5A5',
            color: '#991B1B',
            borderRadius: '8px',
            marginBottom: '1.5rem',
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: '#94A3B8' }}>
          Compiling authoritative Balance Sheet statement...
        </div>
      ) : !report ? null : (
        <>
          {/* Invariant Health Banner */}
          <div
            style={{
              padding: '0.85rem 1.25rem',
              borderRadius: '8px',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: report.isBalanced ? '#F0FDF4' : '#FEF2F2',
              border: report.isBalanced ? '1px solid #86EFAC' : '1px solid #FCA5A5',
              color: report.isBalanced ? '#166534' : '#991B1B',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              {report.isBalanced ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
              <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                {report.isBalanced
                  ? 'Double-Entry Invariant Verified: Total Assets exactly equal Total Liabilities + Equity.'
                  : `Invariant Warning: Difference of £${report.difference} detected between Assets and Liabilities + Equity.`}
              </span>
            </div>
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>As of {report.asOfDate}</span>
          </div>

          {/* KPI Summary Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            <div
              style={{
                backgroundColor: '#FFFFFF',
                padding: '1.25rem',
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
              }}
            >
              <div
                style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}
              >
                Total Assets
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0F172A', marginTop: '0.35rem' }}>
                £{report.totalAssets}
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#FFFFFF',
                padding: '1.25rem',
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
              }}
            >
              <div
                style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}
              >
                Total Liabilities
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0F172A', marginTop: '0.35rem' }}>
                £{report.totalLiabilities}
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#FFFFFF',
                padding: '1.25rem',
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
              }}
            >
              <div
                style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}
              >
                Total Equity
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0F172A', marginTop: '0.35rem' }}>
                £{report.totalEquity}
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#FFFFFF',
                padding: '1.25rem',
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
              }}
            >
              <div
                style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}
              >
                Current Period Net Income
              </div>
              <div
                style={{
                  fontSize: '1.4rem',
                  fontWeight: 700,
                  color: Number(report.currentYearEarnings) >= 0 ? '#16A34A' : '#DC2626',
                  marginTop: '0.35rem',
                }}
              >
                £{report.currentYearEarnings}
              </div>
            </div>
          </div>

          {/* Statement Table */}
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
                  <th style={{ padding: '0.75rem 1.25rem', width: '120px' }}>Code</th>
                  <th style={{ padding: '0.75rem 1.25rem' }}>Account Name</th>
                  <th style={{ padding: '0.75rem 1.25rem', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {/* 1. CURRENT ASSETS */}
                <tr style={{ backgroundColor: '#F1F5F9', fontWeight: 700 }}>
                  <td colSpan={2} style={{ padding: '0.65rem 1.25rem', color: '#1E293B' }}>
                    CURRENT ASSETS
                  </td>
                  <td style={{ padding: '0.65rem 1.25rem', textAlign: 'right', color: '#1E293B' }}>
                    £{report.currentAssets.total}
                  </td>
                </tr>
                {report.currentAssets.accounts.map((a) => (
                  <tr
                    key={a.accountId}
                    onClick={() => handleRowClick(a.accountId)}
                    style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '0.6rem 1.25rem', fontFamily: 'monospace', color: '#64748B' }}>
                      {a.accountCode}
                    </td>
                    <td style={{ padding: '0.6rem 1.25rem', color: '#0F172A', fontWeight: 500 }}>
                      {a.accountName}
                    </td>
                    <td style={{ padding: '0.6rem 1.25rem', textAlign: 'right' }}>£{a.amount}</td>
                  </tr>
                ))}

                {/* 2. NON-CURRENT ASSETS */}
                {report.nonCurrentAssets.accounts.length > 0 && (
                  <>
                    <tr
                      style={{ backgroundColor: '#F1F5F9', fontWeight: 700, borderTop: '1px solid #E2E8F0' }}
                    >
                      <td colSpan={2} style={{ padding: '0.65rem 1.25rem', color: '#1E293B' }}>
                        NON-CURRENT ASSETS
                      </td>
                      <td style={{ padding: '0.65rem 1.25rem', textAlign: 'right', color: '#1E293B' }}>
                        £{report.nonCurrentAssets.total}
                      </td>
                    </tr>
                    {report.nonCurrentAssets.accounts.map((na) => (
                      <tr
                        key={na.accountId}
                        onClick={() => handleRowClick(na.accountId)}
                        style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                      >
                        <td style={{ padding: '0.6rem 1.25rem', fontFamily: 'monospace', color: '#64748B' }}>
                          {na.accountCode}
                        </td>
                        <td style={{ padding: '0.6rem 1.25rem', color: '#0F172A', fontWeight: 500 }}>
                          {na.accountName}
                        </td>
                        <td style={{ padding: '0.6rem 1.25rem', textAlign: 'right' }}>£{na.amount}</td>
                      </tr>
                    ))}
                  </>
                )}

                {/* TOTAL ASSETS */}
                <tr
                  style={{
                    backgroundColor: '#EEF2FF',
                    fontWeight: 800,
                    borderTop: '2px solid #CBD5E1',
                    borderBottom: '2px solid #CBD5E1',
                    fontSize: '0.95rem',
                  }}
                >
                  <td colSpan={2} style={{ padding: '0.8rem 1.25rem', color: '#312E81' }}>
                    TOTAL ASSETS
                  </td>
                  <td style={{ padding: '0.8rem 1.25rem', textAlign: 'right', color: '#312E81' }}>
                    £{report.totalAssets}
                  </td>
                </tr>

                {/* 3. CURRENT LIABILITIES */}
                <tr style={{ backgroundColor: '#F1F5F9', fontWeight: 700 }}>
                  <td colSpan={2} style={{ padding: '0.65rem 1.25rem', color: '#1E293B' }}>
                    CURRENT LIABILITIES
                  </td>
                  <td style={{ padding: '0.65rem 1.25rem', textAlign: 'right', color: '#1E293B' }}>
                    £{report.currentLiabilities.total}
                  </td>
                </tr>
                {report.currentLiabilities.accounts.map((l) => (
                  <tr
                    key={l.accountId}
                    onClick={() => handleRowClick(l.accountId)}
                    style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '0.6rem 1.25rem', fontFamily: 'monospace', color: '#64748B' }}>
                      {l.accountCode}
                    </td>
                    <td style={{ padding: '0.6rem 1.25rem', color: '#0F172A', fontWeight: 500 }}>
                      {l.accountName}
                    </td>
                    <td style={{ padding: '0.6rem 1.25rem', textAlign: 'right' }}>£{l.amount}</td>
                  </tr>
                ))}

                {/* 4. NON-CURRENT LIABILITIES */}
                {report.nonCurrentLiabilities.accounts.length > 0 && (
                  <>
                    <tr
                      style={{ backgroundColor: '#F1F5F9', fontWeight: 700, borderTop: '1px solid #E2E8F0' }}
                    >
                      <td colSpan={2} style={{ padding: '0.65rem 1.25rem', color: '#1E293B' }}>
                        NON-CURRENT LIABILITIES
                      </td>
                      <td style={{ padding: '0.65rem 1.25rem', textAlign: 'right', color: '#1E293B' }}>
                        £{report.nonCurrentLiabilities.total}
                      </td>
                    </tr>
                    {report.nonCurrentLiabilities.accounts.map((nl) => (
                      <tr
                        key={nl.accountId}
                        onClick={() => handleRowClick(nl.accountId)}
                        style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                      >
                        <td style={{ padding: '0.6rem 1.25rem', fontFamily: 'monospace', color: '#64748B' }}>
                          {nl.accountCode}
                        </td>
                        <td style={{ padding: '0.6rem 1.25rem', color: '#0F172A', fontWeight: 500 }}>
                          {nl.accountName}
                        </td>
                        <td style={{ padding: '0.6rem 1.25rem', textAlign: 'right' }}>£{nl.amount}</td>
                      </tr>
                    ))}
                  </>
                )}

                {/* TOTAL LIABILITIES */}
                <tr
                  style={{
                    backgroundColor: '#F8FAFC',
                    fontWeight: 700,
                    borderTop: '1px solid #CBD5E1',
                    borderBottom: '1px solid #CBD5E1',
                  }}
                >
                  <td colSpan={2} style={{ padding: '0.75rem 1.25rem', color: '#1E293B' }}>
                    TOTAL LIABILITIES
                  </td>
                  <td style={{ padding: '0.75rem 1.25rem', textAlign: 'right', color: '#1E293B' }}>
                    £{report.totalLiabilities}
                  </td>
                </tr>

                {/* 5. EQUITY */}
                <tr style={{ backgroundColor: '#F1F5F9', fontWeight: 700 }}>
                  <td colSpan={2} style={{ padding: '0.65rem 1.25rem', color: '#1E293B' }}>
                    EQUITY
                  </td>
                  <td style={{ padding: '0.65rem 1.25rem', textAlign: 'right', color: '#1E293B' }}>
                    £{report.equity.total}
                  </td>
                </tr>
                {report.equity.accounts.map((eq) => (
                  <tr
                    key={eq.accountId}
                    onClick={() => handleRowClick(eq.accountId)}
                    style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '0.6rem 1.25rem', fontFamily: 'monospace', color: '#64748B' }}>
                      {eq.accountCode}
                    </td>
                    <td style={{ padding: '0.6rem 1.25rem', color: '#0F172A', fontWeight: 500 }}>
                      {eq.accountName}
                    </td>
                    <td style={{ padding: '0.6rem 1.25rem', textAlign: 'right' }}>£{eq.amount}</td>
                  </tr>
                ))}
                {/* Current Year Net Income Line */}
                <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '0.6rem 1.25rem', fontFamily: 'monospace', color: '#64748B' }}>
                    GL-INC
                  </td>
                  <td style={{ padding: '0.6rem 1.25rem', color: '#0F172A', fontWeight: 600 }}>
                    Current Period Retained Earnings (Net Profit)
                  </td>
                  <td style={{ padding: '0.6rem 1.25rem', textAlign: 'right', fontWeight: 600 }}>
                    £{report.currentYearEarnings}
                  </td>
                </tr>

                {/* TOTAL EQUITY */}
                <tr
                  style={{
                    backgroundColor: '#F8FAFC',
                    fontWeight: 700,
                    borderTop: '1px solid #CBD5E1',
                    borderBottom: '1px solid #CBD5E1',
                  }}
                >
                  <td colSpan={2} style={{ padding: '0.75rem 1.25rem', color: '#1E293B' }}>
                    TOTAL EQUITY
                  </td>
                  <td style={{ padding: '0.75rem 1.25rem', textAlign: 'right', color: '#1E293B' }}>
                    £{report.totalEquity}
                  </td>
                </tr>

                {/* TOTAL LIABILITIES & EQUITY */}
                <tr
                  style={{
                    backgroundColor: report.isBalanced ? '#F0FDF4' : '#FEF2F2',
                    fontWeight: 800,
                    fontSize: '1rem',
                    borderTop: '2px solid #0F172A',
                  }}
                >
                  <td
                    colSpan={2}
                    style={{ padding: '0.9rem 1.25rem', color: report.isBalanced ? '#166534' : '#991B1B' }}
                  >
                    TOTAL LIABILITIES & EQUITY
                  </td>
                  <td
                    style={{
                      padding: '0.9rem 1.25rem',
                      textAlign: 'right',
                      color: report.isBalanced ? '#166534' : '#991B1B',
                    }}
                  >
                    £{report.totalLiabilitiesAndEquity}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </AppShell>
  );
}

export default function BalanceSheetPage() {
  return (
    <Suspense fallback={<div>Loading Balance Sheet...</div>}>
      <BalanceSheetContent />
    </Suspense>
  );
}
