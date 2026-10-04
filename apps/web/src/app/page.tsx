'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  accountType?: string;
  normalBalance: string;
}

interface Period {
  id: string;
  periodName: string;
  name?: string;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'SOFT_LOCKED' | 'HARD_LOCKED';
}

interface FinancialYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isClosed: boolean;
}

interface JournalEntry {
  id: string;
  journalNumber?: string;
  entryNumber?: string;
  journalDate?: string;
  entryDate?: string;
  description: string;
  status: string;
  totalDebit: string | number;
  totalCredit: string | number;
  reference?: string;
  createdAt?: string;
}

interface AuditLogItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  actor?: {
    email: string;
    firstName?: string;
    lastName?: string;
  };
  details?: any;
}

export default function DashboardPage() {
  const { user, activeOrg, activeRole } = useAuth();
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [periods, setPeriods] = useState<Period[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      if (!activeOrg) return;
      try {
        setLoading(true);
        const [fysRes, periodsRes, accountsRes, journalsRes, auditRes] = await Promise.all([
          apiRequest<any>('/financial-years').catch(() => []),
          apiRequest<any>('/accounting-periods').catch(() => []),
          apiRequest<any>('/accounts').catch(() => []),
          apiRequest<any>('/journals').catch(() => ({ items: [] })),
          apiRequest<any>('/audit-logs').catch(() => ({ items: [] })),
        ]);

        const fyList: FinancialYear[] = Array.isArray(fysRes) ? fysRes : (fysRes?.items || []);
        setFinancialYears(fyList);
        if (fyList.length > 0 && !selectedYearId) {
          const current = fyList.find((fy) => !fy.isClosed) || fyList[0];
          setSelectedYearId(current.id);
        }

        const pList: Period[] = Array.isArray(periodsRes) ? periodsRes : (periodsRes?.items || []);
        setPeriods(pList);

        const aList: Account[] = Array.isArray(accountsRes) ? accountsRes : (accountsRes?.items || []);
        setAccounts(aList);

        const jList: JournalEntry[] = Array.isArray(journalsRes) ? journalsRes : (journalsRes?.items || []);
        setJournals(jList);

        const auditList: AuditLogItem[] = Array.isArray(auditRes) ? auditRes : (auditRes?.items || []);
        setAuditLogs(auditList);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, [activeOrg]);

  const activeFY = financialYears.find((fy) => fy.id === selectedYearId) || financialYears[0];

  // Count accounting breakdown
  const assetAccounts = accounts.filter((a) => (a.accountType || a.type) === 'ASSET');
  const liabilityAccounts = accounts.filter((a) => (a.accountType || a.type) === 'LIABILITY');
  const equityAccounts = accounts.filter((a) => (a.accountType || a.type) === 'EQUITY');

  const draftJournals = journals.filter((j) => j.status === 'DRAFT');
  const validatedJournals = journals.filter((j) => j.status === 'VALIDATED');

  // Format currency
  const currencySymbol = activeOrg?.baseCurrency === 'GBP' ? '£' : activeOrg?.baseCurrency === 'USD' ? '$' : activeOrg?.baseCurrency === 'EUR' ? '€' : `${activeOrg?.baseCurrency ?? 'GBP'} `;

  return (
    <AppShell>
      {/* Header with Greeting & Financial Year Selector */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Good morning, {user?.firstName ?? 'Alex'} 👋
          </h1>
          <p className="page-subtitle">
            Here&apos;s what&apos;s happening in <strong>{activeOrg?.name ?? 'Alpha Consulting Ltd'}</strong>
          </p>
        </div>

        {/* Financial Year Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={{ fontSize: '0.8rem', color: '#6B7280', fontWeight: 500 }}>Financial Year:</span>
          {financialYears.length > 0 ? (
            <select
              className="form-select"
              style={{ width: 'auto', fontWeight: 600, fontSize: '0.825rem' }}
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
            >
              {financialYears.map((fy) => (
                <option key={fy.id} value={fy.id}>
                  {fy.name} ({new Date(fy.startDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })} – {new Date(fy.endDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })})
                </option>
              ))}
            </select>
          ) : (
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#172033', backgroundColor: '#FFFFFF', padding: '0.35rem 0.75rem', borderRadius: '4px', border: '1px solid #E6EAF0' }}>
              Apr 2026 – Mar 2027
            </span>
          )}
        </div>
      </div>

      {/* KPI Cards (3-4 summary cards with large tabular values) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Total Assets Metric */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Nominal Assets</span>
            <div className="kpi-icon" style={{ backgroundColor: '#EFF6FF', color: '#146EF5' }}>
              🏛️
            </div>
          </div>
          <div className="kpi-value font-mono">
            {loading ? '...' : `${assetAccounts.length} Accounts`}
          </div>
          <div className="kpi-meta">
            <span style={{ color: '#16A56A', fontWeight: 600 }}>Active in COA</span>
            <span>• Bank, receivables & cash</span>
          </div>
        </div>

        {/* Total Liabilities Metric */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Liabilities Setup</span>
            <div className="kpi-icon" style={{ backgroundColor: '#FFFBEB', color: '#E7A51A' }}>
              ⚖️
            </div>
          </div>
          <div className="kpi-value font-mono">
            {loading ? '...' : `${liabilityAccounts.length} Accounts`}
          </div>
          <div className="kpi-meta">
            <span style={{ color: '#6B7280' }}>Payables & tax obligations</span>
          </div>
        </div>

        {/* Equity Accounts Metric */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Equity Structure</span>
            <div className="kpi-icon" style={{ backgroundColor: '#F5F3FF', color: '#7557D3' }}>
              🪙
            </div>
          </div>
          <div className="kpi-value font-mono" style={{ color: '#7557D3' }}>
            {loading ? '...' : `${equityAccounts.length} Accounts`}
          </div>
          <div className="kpi-meta">
            <span style={{ color: '#7557D3', fontWeight: 600 }}>Capital & retained earnings</span>
          </div>
        </div>

        {/* Journal Activity Metric */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Journal Activity</span>
            <div className="kpi-icon" style={{ backgroundColor: '#ECFDF5', color: '#16A56A' }}>
              📑
            </div>
          </div>
          <div className="kpi-value font-mono">
            {loading ? '...' : `${journals.length}`}
          </div>
          <div className="kpi-meta">
            <span style={{ color: '#16A56A', fontWeight: 600 }}>{validatedJournals.length} Validated</span>
            <span>•</span>
            <span style={{ color: '#E7A51A', fontWeight: 600 }}>{draftJournals.length} Draft</span>
          </div>
        </div>
      </div>

      {/* Accounting Period Summary Strip (Predictable status psychology: Green Open, Amber Soft Lock, Red Hard Lock) */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header" style={{ padding: '0.85rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem' }}>⏱️</span>
            <h3 className="card-title" style={{ fontSize: '0.9rem' }}>Accounting Period Statuses</h3>
            <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>({activeFY?.name ?? 'FY 2026/2027'})</span>
          </div>
          <Link href="/accounting/periods" className="btn btn-secondary btn-sm">
            Manage Period Locks &rarr;
          </Link>
        </div>
        <div className="card-body" style={{ padding: '1rem 1.25rem' }}>
          {periods.length === 0 ? (
            <div style={{ fontSize: '0.825rem', color: '#6B7280', textAlign: 'center', padding: '0.75rem' }}>
              No accounting periods initialized yet.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(130px, 1fr))`, gap: '0.75rem' }}>
              {periods.slice(0, 8).map((p) => {
                const isSoft = p.status === 'SOFT_LOCKED';
                const isHard = p.status === 'HARD_LOCKED';
                const isOpen = p.status === 'OPEN';
                return (
                  <div
                    key={p.id}
                    style={{
                      padding: '0.65rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: isOpen ? '#A7F3D0' : isSoft ? '#FDE68A' : '#FECACA',
                      backgroundColor: isOpen ? '#ECFDF5' : isSoft ? '#FFFBEB' : '#FEF2F2',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem',
                    }}
                  >
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#172033' }}>
                      {p.periodName || p.name || 'Period'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: isOpen ? '#16A56A' : isSoft ? '#E7A51A' : '#DC3F45',
                        }}
                      ></span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          color: isOpen ? '#065F46' : isSoft ? '#92400E' : '#991B1B',
                          textTransform: 'uppercase',
                        }}
                      >
                        {isOpen ? 'Open' : isSoft ? 'Soft Lock' : 'Hard Lock'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Quick Actions:
        </span>
        <Link href="/accounting/journals/new" className="quick-action-btn">
          <span className="quick-action-dot" style={{ backgroundColor: '#146EF5' }}></span>
          <span>New Journal</span>
        </Link>
        <Link href="/accounting/chart-of-accounts" className="quick-action-btn">
          <span className="quick-action-dot" style={{ backgroundColor: '#16A56A' }}></span>
          <span>Manage Accounts</span>
        </Link>
        <Link href="/accounting/financial-years" className="quick-action-btn">
          <span className="quick-action-dot" style={{ backgroundColor: '#7557D3' }}></span>
          <span>Financial Year</span>
        </Link>
        <Link href="/settings/users" className="quick-action-btn">
          <span className="quick-action-dot" style={{ backgroundColor: '#6B7280' }}></span>
          <span>Invite User</span>
        </Link>
      </div>

      {/* Main Grid: Income vs Expenses Panel + Recent Activity Timeline */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
        {/* Income vs Expenses Panel (Accurate reporting state: no faked numbers) */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Income vs Expenses Overview</h3>
              <p style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.15rem' }}>
                Financial Statement Ingestion & Analysis
              </p>
            </div>
            <span className="badge badge-draft">Core Phase</span>
          </div>
          <div className="card-body">
            <div
              style={{
                backgroundColor: '#F8FAFC',
                border: '1px dashed #CBD5E1',
                borderRadius: '8px',
                padding: '2.5rem 1.5rem',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📊</div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#172033', marginBottom: '0.35rem' }}>
                General Ledger & Reporting Pipeline
              </div>
              <p style={{ fontSize: '0.8rem', color: '#6B7280', maxWidth: '380px', margin: '0 auto 1.25rem auto', lineHeight: 1.4 }}>
                Double-entry verification is operational. Real-time Income Statement & Balance Sheet generation activates upon posting engine handoff.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.65rem' }}>
                <Link href="/accounting/journals/new" className="btn btn-primary btn-sm">
                  + Create First Journal
                </Link>
                <Link href="/accounting/chart-of-accounts" className="btn btn-secondary btn-sm">
                  Review COA Structure
                </Link>
              </div>
            </div>

            {/* Quick Core Integrity Checklist */}
            <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #E6EAF0' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: '0.65rem' }}>
                Double-Entry Core Integrity Controls
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.775rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#065F46' }}>
                  <span>✓</span>
                  <span>Strict Balanced Postings (ΣDr = ΣCr)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#065F46' }}>
                  <span>✓</span>
                  <span>Active Period Enforcement</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#065F46' }}>
                  <span>✓</span>
                  <span>Multi-Tenant Org Isolation</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#065F46' }}>
                  <span>✓</span>
                  <span>Immutable Audit Log Trail</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity / Journals */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent Activity & Journals</h3>
            <Link href="/accounting/journals" className="btn btn-secondary btn-sm">
              View All Journals
            </Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {journals.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: '#6B7280', fontSize: '0.85rem' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📝</div>
                <div style={{ fontWeight: 600, color: '#172033' }}>No manual journals recorded yet</div>
                <div style={{ fontSize: '0.775rem', marginTop: '0.25rem' }}>Create your first manual journal to begin recording double-entry entries.</div>
                <Link href="/accounting/journals/new" className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>
                  + New Journal
                </Link>
              </div>
            ) : (
              <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Status</th>
                      <th className="text-right">Total ({currencySymbol.trim()})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journals.slice(0, 6).map((j) => (
                      <tr key={j.id}>
                        <td className="font-mono">
                          <Link href={`/accounting/journals/${j.id}`} style={{ color: '#146EF5', fontWeight: 600, textDecoration: 'none' }}>
                            {j.journalNumber || j.entryNumber || 'JE-DRAFT'}
                          </Link>
                        </td>
                        <td style={{ color: '#4B5563' }}>
                          {j.journalDate ? new Date(j.journalDate).toISOString().split('T')[0] : (j.entryDate ? new Date(j.entryDate).toISOString().split('T')[0] : '-')}
                        </td>
                        <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {j.description}
                        </td>
                        <td>
                          <span className={`badge badge-${j.status.toLowerCase().replace('_', '-')}`}>
                            {j.status}
                          </span>
                        </td>
                        <td className="text-right font-mono" style={{ fontWeight: 600 }}>
                          {Number(j.totalDebit).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
