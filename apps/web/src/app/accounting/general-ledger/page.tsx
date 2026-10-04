'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

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

interface LedgerEntry {
  id: string;
  date: string;
  postingDate: string;
  journalId: string;
  journalNumber: string;
  journalType: string;
  reference: string | null;
  description: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  debit: string;
  credit: string;
  runningBalance: string;
  source: string;
}

interface AccountSummary {
  account: {
    id: string;
    code: string;
    name: string;
    type: string;
    normalBalance: 'DEBIT' | 'CREDIT';
  };
  openingBalance: string;
  totalDebits: string;
  totalCredits: string;
  closingBalance: string;
  transactions: LedgerEntry[];
}

function GeneralLedgerContent() {
  const searchParams = useSearchParams();
  const initialAccountId = searchParams.get('accountId') || '';

  const { activeOrg, hasPermission } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);

  // Filters
  const [selectedAccountId, setSelectedAccountId] = useState(initialAccountId);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedFyId, setSelectedFyId] = useState('');
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Data
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [accountSummary, setAccountSummary] = useState<AccountSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const canExport = hasPermission('ledger.export') || hasPermission('ledger.view');

  // Load metadata (accounts, FYs, periods)
  useEffect(() => {
    if (!activeOrg) return;
    const loadMetadata = async () => {
      try {
        const [accRes, fyRes, pRes] = await Promise.all([
          apiRequest<any>('/accounts'),
          apiRequest<any>('/financial-years'),
          apiRequest<any>('/periods'),
        ]);

        const accList = Array.isArray(accRes) ? accRes : accRes?.items || [];
        setAccounts(
          accList.map((a: any) => ({
            id: a.id,
            code: a.code,
            name: a.name,
            type: a.accountType || a.type,
          })),
        );

        setFinancialYears(Array.isArray(fyRes) ? fyRes : fyRes?.items || []);
        setPeriods(Array.isArray(pRes) ? pRes : pRes?.items || []);
      } catch (err: any) {
        console.error('Failed to load ledger filter metadata', err);
      }
    };
    loadMetadata();
  }, [activeOrg]);

  // Load ledger data
  const loadLedgerData = useCallback(async () => {
    if (!activeOrg) return;
    try {
      setLoading(true);
      setError(null);

      if (selectedAccountId) {
        // Query account-specific ledger
        const params = new URLSearchParams();
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
        if (selectedFyId) params.set('financialYearId', selectedFyId);
        if (selectedPeriodId) params.set('periodId', selectedPeriodId);

        const summary = await apiRequest<AccountSummary>(
          `/general-ledger/accounts/${selectedAccountId}?${params.toString()}`,
        );
        setAccountSummary(summary);
        setEntries(summary.transactions);
        setTotalEntries(summary.transactions.length);
      } else {
        // Query global general ledger
        const params = new URLSearchParams();
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
        if (selectedFyId) params.set('financialYearId', selectedFyId);
        if (selectedPeriodId) params.set('periodId', selectedPeriodId);
        if (search) params.set('search', search);
        params.set('page', String(page));
        params.set('pageSize', '50');

        const res = await apiRequest<any>(`/general-ledger?${params.toString()}`);
        setAccountSummary(null);
        setEntries(res.entries || []);
        setTotalEntries(res.total || 0);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load general ledger entries');
    } finally {
      setLoading(false);
    }
  }, [activeOrg, selectedAccountId, startDate, endDate, selectedFyId, selectedPeriodId, search, page]);

  useEffect(() => {
    loadLedgerData();
  }, [loadLedgerData]);

  const handleExportCsv = async () => {
    if (!activeOrg) return;
    try {
      setExporting(true);
      const params = new URLSearchParams();
      if (selectedAccountId) params.set('accountId', selectedAccountId);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (selectedFyId) params.set('financialYearId', selectedFyId);
      if (selectedPeriodId) params.set('periodId', selectedPeriodId);

      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/v1/organizations/${activeOrg.id}/general-ledger/export?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': activeOrg.id,
        },
      });

      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `general-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      alert(err.message || 'Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  const handleResetFilters = () => {
    setSelectedAccountId('');
    setStartDate('');
    setEndDate('');
    setSelectedFyId('');
    setSelectedPeriodId('');
    setSearch('');
    setPage(1);
  };

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1 className="page-title">General Ledger</h1>
          <p className="page-subtitle">View posted double-entry accounting records across all accounts</p>
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

      {/* Filters Card */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-body">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '1rem',
              alignItems: 'flex-end',
            }}
          >
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Account</label>
              <select
                className="form-select"
                value={selectedAccountId}
                onChange={(e) => {
                  setSelectedAccountId(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Accounts</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} - {a.name} ({a.type})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Financial Year</label>
              <select
                className="form-select"
                value={selectedFyId}
                onChange={(e) => {
                  setSelectedFyId(e.target.value);
                  setSelectedPeriodId('');
                  setPage(1);
                }}
              >
                <option value="">Any Year</option>
                {financialYears.map((fy) => (
                  <option key={fy.id} value={fy.id}>
                    {fy.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Period</label>
              <select
                className="form-select"
                value={selectedPeriodId}
                onChange={(e) => {
                  setSelectedPeriodId(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Any Period</option>
                {periods
                  .filter((p) => !selectedFyId || p.financialYearId === selectedFyId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">From Date</label>
              <input
                type="date"
                className="form-input font-mono"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setSelectedPeriodId('');
                  setSelectedFyId('');
                  setPage(1);
                }}
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">To Date</label>
              <input
                type="date"
                className="form-input font-mono"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setSelectedPeriodId('');
                  setSelectedFyId('');
                  setPage(1);
                }}
              />
            </div>

            {!selectedAccountId && (
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Search</label>
                <input
                  type="text"
                  placeholder="Journal #, desc, ref..."
                  className="form-input"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            )}

            <div>
              <button
                type="button"
                onClick={handleResetFilters}
                className="btn btn-secondary btn-sm"
                style={{ width: '100%', height: '38px' }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Account Summary Cards (if single account selected) */}
      {accountSummary && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <div className="card">
            <div className="card-body">
              <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                Account
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginTop: '0.25rem' }}>
                {accountSummary.account.code} - {accountSummary.account.name}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.1rem' }}>
                Normal Balance: <strong>{accountSummary.account.normalBalance}</strong>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                Opening Balance
              </div>
              <div className="font-mono" style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginTop: '0.25rem' }}>
                {Number(accountSummary.openingBalance).toLocaleString('en-GB', { minimumFractionDigits: 2 })}{' '}
                <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>{activeOrg?.baseCurrency}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                Period Debits
              </div>
              <div className="font-mono" style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginTop: '0.25rem' }}>
                {Number(accountSummary.totalDebits).toLocaleString('en-GB', { minimumFractionDigits: 2 })}{' '}
                <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>{activeOrg?.baseCurrency}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                Period Credits
              </div>
              <div className="font-mono" style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginTop: '0.25rem' }}>
                {Number(accountSummary.totalCredits).toLocaleString('en-GB', { minimumFractionDigits: 2 })}{' '}
                <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>{activeOrg?.baseCurrency}</span>
              </div>
            </div>
          </div>

          <div className="card" style={{ backgroundColor: '#F8FAFC' }}>
            <div className="card-body">
              <div style={{ fontSize: '0.75rem', color: '#1E40AF', textTransform: 'uppercase', fontWeight: 600 }}>
                Closing Balance
              </div>
              <div className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1E40AF', marginTop: '0.25rem' }}>
                {Number(accountSummary.closingBalance).toLocaleString('en-GB', { minimumFractionDigits: 2 })}{' '}
                <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>{activeOrg?.baseCurrency}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ledger Table */}
      <div className="card">
        <div className="table-wrapper" style={{ border: 'none' }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '100px' }}>Date</th>
                <th style={{ width: '130px' }}>Journal #</th>
                <th style={{ width: '110px' }}>Reference</th>
                {!selectedAccountId && <th style={{ width: '220px' }}>Account</th>}
                <th>Description</th>
                <th style={{ width: '140px' }} className="text-right">
                  Debit ({activeOrg?.baseCurrency})
                </th>
                <th style={{ width: '140px' }} className="text-right">
                  Credit ({activeOrg?.baseCurrency})
                </th>
                {selectedAccountId && (
                  <th style={{ width: '150px' }} className="text-right">
                    Balance ({activeOrg?.baseCurrency})
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={selectedAccountId ? 7 : 7} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                    Loading General Ledger records...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={selectedAccountId ? 7 : 7} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                    No posted general ledger entries match the selected filters.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="font-mono" style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {entry.postingDate}
                    </td>
                    <td className="font-mono">
                      <Link
                        href={`/accounting/journals/${entry.journalId}`}
                        style={{ color: '#146EF5', textDecoration: 'none', fontWeight: 600 }}
                      >
                        {entry.journalNumber}
                      </Link>
                    </td>
                    <td style={{ fontSize: '0.825rem', color: '#64748b' }}>{entry.reference || '—'}</td>
                    {!selectedAccountId && (
                      <td>
                        <strong style={{ color: '#0f172a' }}>{entry.accountCode}</strong>
                        <span style={{ color: '#64748b', marginLeft: '0.35rem', fontSize: '0.8rem' }}>
                          {entry.accountName}
                        </span>
                      </td>
                    )}
                    <td style={{ color: '#334155' }}>{entry.description || '—'}</td>
                    <td className="text-right font-mono" style={{ fontWeight: Number(entry.debit) > 0 ? 600 : 400 }}>
                      {Number(entry.debit) > 0 ? Number(entry.debit).toLocaleString('en-GB', { minimumFractionDigits: 2 }) : '—'}
                    </td>
                    <td className="text-right font-mono" style={{ fontWeight: Number(entry.credit) > 0 ? 600 : 400 }}>
                      {Number(entry.credit) > 0 ? Number(entry.credit).toLocaleString('en-GB', { minimumFractionDigits: 2 }) : '—'}
                    </td>
                    {selectedAccountId && (
                      <td className="text-right font-mono" style={{ fontWeight: 600, color: '#0f172a' }}>
                        {Number(entry.runningBalance).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination when showing All Accounts */}
        {!selectedAccountId && totalEntries > 50 && (
          <div
            style={{
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTop: '1px solid #e2e8f0',
              fontSize: '0.85rem',
            }}
          >
            <div style={{ color: '#64748b' }}>
              Showing {entries.length} of {totalEntries} entries
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="btn btn-secondary btn-sm"
              >
                Previous
              </button>
              <button
                disabled={entries.length < 50 || page * 50 >= totalEntries}
                onClick={() => setPage((p) => p + 1)}
                className="btn btn-secondary btn-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function GeneralLedgerPage() {
  return (
    <Suspense fallback={<AppShell><div style={{ padding: '3rem', textAlign: 'center' }}>Loading General Ledger...</div></AppShell>}>
      <GeneralLedgerContent />
    </Suspense>
  );
}
