'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';
import {
  TrendingUp,
  Download,
  Calendar,
  DollarSign,
  TrendingDown,
  Layers,
  ArrowRight,
  Filter,
} from 'lucide-react';

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

interface PnlAccountRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountSubtype: string | null;
  amount: string;
}

interface PnlCategorySection {
  title: string;
  accounts: PnlAccountRow[];
  total: string;
}

interface ProfitAndLossReport {
  organizationId: string;
  organizationName: string;
  baseCurrency: string;
  startDate: string;
  endDate: string;
  revenue: PnlCategorySection;
  costOfSales: PnlCategorySection;
  grossProfit: string;
  operatingExpenses: PnlCategorySection;
  operatingProfit: string;
  otherExpenses: PnlCategorySection;
  netProfit: string;
  isProfitable: boolean;
}

function ProfitAndLossContent() {
  const router = useRouter();
  const { activeOrg } = useAuth();

  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);

  // Filters
  const now = new Date();
  const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString().split('T')[0];
  const defaultEnd = now.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [selectedFyId, setSelectedFyId] = useState('');
  const [selectedPeriodId, setSelectedPeriodId] = useState('');

  // Report Data
  const [report, setReport] = useState<ProfitAndLossReport | null>(null);
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
      } else {
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
      }

      const res = await apiRequest<ProfitAndLossReport>(`/reports/profit-and-loss?${params.toString()}`);
      setReport(res);
    } catch (err: any) {
      setError(err.message || 'Failed to generate Profit & Loss statement');
    } finally {
      setLoading(false);
    }
  }, [activeOrg, startDate, endDate, selectedFyId, selectedPeriodId]);

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
      else {
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
      }

      const res = await fetch(
        `/api/v1/organizations/${activeOrg.id}/reports/profit-and-loss/export?${params.toString()}`,
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
      a.download = `profit-and-loss-${startDate}-to-${endDate}.csv`;
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
              Profit & Loss
            </h1>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: '#DCFCE7',
                color: '#15803D',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.2rem 0.55rem',
                borderRadius: '6px',
              }}
            >
              <TrendingUp size={12} />
              Income Statement
            </span>
          </div>
          <p
            className="page-subtitle"
            style={{ margin: '0.25rem 0 0 0', color: '#64748B', fontSize: '0.875rem' }}
          >
            Authoritative statement of operational performance derived exclusively from posted General Ledger
            entries.
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
            <option value="">Custom Date Range</option>
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
              <option value="">Full Financial Year</option>
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
          <>
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
                From Date
              </label>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  padding: '0.45rem 0.65rem',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.85rem',
                }}
              />
            </div>

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
                To Date
              </label>
              <input
                type="date"
                className="form-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  padding: '0.45rem 0.65rem',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.85rem',
                }}
              />
            </div>
          </>
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
          Calculating Profit & Loss statement from General Ledger...
        </div>
      ) : !report ? null : (
        <>
          {/* Executive Summary Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
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
                Operating Revenue
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0F172A', marginTop: '0.35rem' }}>
                £{report.revenue.total}
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
                Cost of Sales
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0F172A', marginTop: '0.35rem' }}>
                £{report.costOfSales.total}
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
                Gross Profit
              </div>
              <div
                style={{
                  fontSize: '1.4rem',
                  fontWeight: 700,
                  color: Number(report.grossProfit) >= 0 ? '#16A34A' : '#DC2626',
                  marginTop: '0.35rem',
                }}
              >
                £{report.grossProfit}
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
                Operating Expenses
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0F172A', marginTop: '0.35rem' }}>
                £{report.operatingExpenses.total}
              </div>
            </div>

            <div
              style={{
                backgroundColor: report.isProfitable ? '#F0FDF4' : '#FEF2F2',
                padding: '1.25rem',
                borderRadius: '10px',
                border: report.isProfitable ? '1px solid #86EFAC' : '1px solid #FCA5A5',
              }}
            >
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: report.isProfitable ? '#166534' : '#991B1B',
                  textTransform: 'uppercase',
                }}
              >
                Net {report.isProfitable ? 'Profit' : 'Loss'}
              </div>
              <div
                style={{
                  fontSize: '1.4rem',
                  fontWeight: 700,
                  color: report.isProfitable ? '#15803D' : '#DC2626',
                  marginTop: '0.35rem',
                }}
              >
                £{report.netProfit}
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
                {/* 1. Revenue */}
                <tr style={{ backgroundColor: '#F1F5F9', fontWeight: 700 }}>
                  <td colSpan={2} style={{ padding: '0.65rem 1.25rem', color: '#1E293B' }}>
                    OPERATING REVENUE
                  </td>
                  <td style={{ padding: '0.65rem 1.25rem', textAlign: 'right', color: '#1E293B' }}>
                    £{report.revenue.total}
                  </td>
                </tr>
                {report.revenue.accounts.map((r) => (
                  <tr
                    key={r.accountId}
                    onClick={() => handleRowClick(r.accountId)}
                    style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '0.6rem 1.25rem', fontFamily: 'monospace', color: '#64748B' }}>
                      {r.accountCode}
                    </td>
                    <td style={{ padding: '0.6rem 1.25rem', color: '#0F172A', fontWeight: 500 }}>
                      {r.accountName}
                    </td>
                    <td style={{ padding: '0.6rem 1.25rem', textAlign: 'right' }}>£{r.amount}</td>
                  </tr>
                ))}

                {/* 2. Cost of Sales */}
                <tr style={{ backgroundColor: '#F1F5F9', fontWeight: 700, borderTop: '1px solid #E2E8F0' }}>
                  <td colSpan={2} style={{ padding: '0.65rem 1.25rem', color: '#1E293B' }}>
                    COST OF SALES (COGS)
                  </td>
                  <td style={{ padding: '0.65rem 1.25rem', textAlign: 'right', color: '#1E293B' }}>
                    £{report.costOfSales.total}
                  </td>
                </tr>
                {report.costOfSales.accounts.map((c) => (
                  <tr
                    key={c.accountId}
                    onClick={() => handleRowClick(c.accountId)}
                    style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '0.6rem 1.25rem', fontFamily: 'monospace', color: '#64748B' }}>
                      {c.accountCode}
                    </td>
                    <td style={{ padding: '0.6rem 1.25rem', color: '#0F172A', fontWeight: 500 }}>
                      {c.accountName}
                    </td>
                    <td style={{ padding: '0.6rem 1.25rem', textAlign: 'right' }}>£{c.amount}</td>
                  </tr>
                ))}

                {/* Gross Profit Subtotal */}
                <tr
                  style={{
                    backgroundColor: '#EEF2FF',
                    fontWeight: 700,
                    borderTop: '2px solid #CBD5E1',
                    borderBottom: '2px solid #CBD5E1',
                  }}
                >
                  <td colSpan={2} style={{ padding: '0.75rem 1.25rem', color: '#3730A3' }}>
                    GROSS PROFIT
                  </td>
                  <td style={{ padding: '0.75rem 1.25rem', textAlign: 'right', color: '#3730A3' }}>
                    £{report.grossProfit}
                  </td>
                </tr>

                {/* 3. Operating Expenses */}
                <tr style={{ backgroundColor: '#F1F5F9', fontWeight: 700 }}>
                  <td colSpan={2} style={{ padding: '0.65rem 1.25rem', color: '#1E293B' }}>
                    OPERATING EXPENSES
                  </td>
                  <td style={{ padding: '0.65rem 1.25rem', textAlign: 'right', color: '#1E293B' }}>
                    £{report.operatingExpenses.total}
                  </td>
                </tr>
                {report.operatingExpenses.accounts.map((o) => (
                  <tr
                    key={o.accountId}
                    onClick={() => handleRowClick(o.accountId)}
                    style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '0.6rem 1.25rem', fontFamily: 'monospace', color: '#64748B' }}>
                      {o.accountCode}
                    </td>
                    <td style={{ padding: '0.6rem 1.25rem', color: '#0F172A', fontWeight: 500 }}>
                      {o.accountName}
                    </td>
                    <td style={{ padding: '0.6rem 1.25rem', textAlign: 'right' }}>£{o.amount}</td>
                  </tr>
                ))}

                {/* Operating Profit Subtotal */}
                <tr
                  style={{
                    backgroundColor: '#F8FAFC',
                    fontWeight: 700,
                    borderTop: '1px solid #CBD5E1',
                    borderBottom: '1px solid #CBD5E1',
                  }}
                >
                  <td colSpan={2} style={{ padding: '0.75rem 1.25rem', color: '#1E293B' }}>
                    OPERATING PROFIT (EBIT)
                  </td>
                  <td style={{ padding: '0.75rem 1.25rem', textAlign: 'right', color: '#1E293B' }}>
                    £{report.operatingProfit}
                  </td>
                </tr>

                {/* 4. Other Expenses */}
                {report.otherExpenses.accounts.length > 0 && (
                  <>
                    <tr style={{ backgroundColor: '#F1F5F9', fontWeight: 700 }}>
                      <td colSpan={2} style={{ padding: '0.65rem 1.25rem', color: '#1E293B' }}>
                        OTHER EXPENSES & TAXES
                      </td>
                      <td style={{ padding: '0.65rem 1.25rem', textAlign: 'right', color: '#1E293B' }}>
                        £{report.otherExpenses.total}
                      </td>
                    </tr>
                    {report.otherExpenses.accounts.map((ot) => (
                      <tr
                        key={ot.accountId}
                        onClick={() => handleRowClick(ot.accountId)}
                        style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                      >
                        <td style={{ padding: '0.6rem 1.25rem', fontFamily: 'monospace', color: '#64748B' }}>
                          {ot.accountCode}
                        </td>
                        <td style={{ padding: '0.6rem 1.25rem', color: '#0F172A', fontWeight: 500 }}>
                          {ot.accountName}
                        </td>
                        <td style={{ padding: '0.6rem 1.25rem', textAlign: 'right' }}>£{ot.amount}</td>
                      </tr>
                    ))}
                  </>
                )}

                {/* Final Net Profit */}
                <tr
                  style={{
                    backgroundColor: report.isProfitable ? '#DCFCE7' : '#FEE2E2',
                    fontWeight: 800,
                    fontSize: '1rem',
                    borderTop: '2px solid #0F172A',
                  }}
                >
                  <td
                    colSpan={2}
                    style={{ padding: '0.9rem 1.25rem', color: report.isProfitable ? '#14532D' : '#7F1D1D' }}
                  >
                    NET PROFIT / (LOSS)
                  </td>
                  <td
                    style={{
                      padding: '0.9rem 1.25rem',
                      textAlign: 'right',
                      color: report.isProfitable ? '#14532D' : '#7F1D1D',
                    }}
                  >
                    £{report.netProfit}
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

export default function ProfitAndLossPage() {
  return (
    <Suspense fallback={<div>Loading P&L...</div>}>
      <ProfitAndLossContent />
    </Suspense>
  );
}
