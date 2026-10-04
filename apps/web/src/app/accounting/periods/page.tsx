'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';

interface AccountingPeriod {
  id: string;
  financialYearId: string;
  periodNumber: number;
  name: string;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'SOFT_LOCKED' | 'HARD_LOCKED';
  lockedAt?: string | null;
  financialYear?: {
    name: string;
  };
}

interface FinancialYear {
  id: string;
  name: string;
}

function PeriodsContent() {
  const { activeOrg, hasPermission } = useAuth();
  const searchParams = useSearchParams();
  const initialFyId = searchParams.get('financialYearId') || '';

  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [selectedFyId, setSelectedFyId] = useState<string>(initialFyId);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canSoftLock = hasPermission('period:soft_lock');
  const canHardLock = hasPermission('period:hard_lock');
  const canUnlock = hasPermission('period:unlock');

  const loadData = async () => {
    if (!activeOrg) return;
    try {
      setLoading(true);
      const [fyList, periodsList] = await Promise.all([
        apiRequest<FinancialYear[]>('/financial-years'),
        apiRequest<AccountingPeriod[]>(
          selectedFyId ? `/accounting-periods?financialYearId=${selectedFyId}` : '/accounting-periods',
        ),
      ]);
      setFinancialYears(fyList);
      setPeriods(periodsList);
    } catch (err: any) {
      setError(err.message || 'Failed to load accounting periods');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeOrg, selectedFyId]);

  const handlePeriodAction = async (periodId: string, action: 'soft-lock' | 'hard-lock' | 'unlock') => {
    if (action === 'hard-lock') {
      if (!confirm('Warning: HARD LOCK permanently prevents any posting or validation of journals in this period. Only administrators can unlock. Proceed?')) {
        return;
      }
    }

    try {
      setActionLoadingId(periodId);
      setError(null);
      setSuccess(null);
      await apiRequest(`/accounting-periods/${periodId}/${action}`, {
        method: 'POST',
      });
      setSuccess(`Period successfully transitioned via ${action}`);
      await loadData();
    } catch (err: any) {
      setError(err.message || `Failed to perform ${action}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1 className="page-title">Accounting Periods</h1>
          <p className="page-subtitle">Period closing controls: Soft lock (review phase) & Hard lock (permanent audit closure)</p>
        </div>
        <Link href="/accounting/financial-years" className="btn btn-secondary">
          Financial Years
        </Link>
      </div>

      {success && <div className="alert alert-success">{success}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      {/* Filter by Financial Year */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-body" style={{ padding: '0.75rem 1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Filter by Fiscal Year:</label>
          <select
            className="form-select"
            style={{ width: 'auto', minWidth: '200px' }}
            value={selectedFyId}
            onChange={(e) => setSelectedFyId(e.target.value)}
          >
            <option value="">All Financial Years</option>
            {financialYears.map((fy) => (
              <option key={fy.id} value={fy.id}>
                {fy.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Periods Table */}
      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>#</th>
                <th>Period Name</th>
                <th>Fiscal Year</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Lock Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    Loading accounting periods...
                  </td>
                </tr>
              ) : periods.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                    No accounting periods found. Create a Financial Year with auto-generated periods first.
                  </td>
                </tr>
              ) : (
                periods.map((p) => {
                  const isActing = actionLoadingId === p.id;
                  let badgeClass = 'badge-open';
                  if (p.status === 'SOFT_LOCKED') badgeClass = 'badge-soft-locked';
                  if (p.status === 'HARD_LOCKED') badgeClass = 'badge-hard-locked';

                  return (
                    <tr key={p.id}>
                      <td className="font-mono text-center">
                        <strong style={{ color: '#0f172a' }}>{p.periodNumber}</strong>
                      </td>
                      <td>
                        <strong style={{ color: '#0f172a' }}>{p.name}</strong>
                      </td>
                      <td style={{ color: '#64748b' }}>{p.financialYear?.name || '—'}</td>
                      <td className="font-mono">{new Date(p.startDate).toISOString().split('T')[0]}</td>
                      <td className="font-mono">{new Date(p.endDate).toISOString().split('T')[0]}</td>
                      <td>
                        <span className={`badge ${badgeClass}`}>
                          {p.status.replace('_', ' ')}
                        </span>
                        {p.lockedAt && (
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>
                            Locked: {new Date(p.lockedAt).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td className="text-right">
                        <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                          {p.status === 'OPEN' && canSoftLock && (
                            <button
                              disabled={isActing}
                              onClick={() => handlePeriodAction(p.id, 'soft-lock')}
                              className="btn btn-secondary btn-sm"
                            >
                              Soft Lock
                            </button>
                          )}

                          {(p.status === 'OPEN' || p.status === 'SOFT_LOCKED') && canHardLock && (
                            <button
                              disabled={isActing}
                              onClick={() => handlePeriodAction(p.id, 'hard-lock')}
                              className="btn btn-danger btn-sm"
                            >
                              Hard Lock
                            </button>
                          )}

                          {p.status !== 'OPEN' && canUnlock && (
                            <button
                              disabled={isActing}
                              onClick={() => handlePeriodAction(p.id, 'unlock')}
                              className="btn btn-secondary btn-sm"
                            >
                              Unlock
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

export default function AccountingPeriodsPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: '#64748b' }}>Loading periods...</div>
        </div>
      }
    >
      <PeriodsContent />
    </Suspense>
  );
}
