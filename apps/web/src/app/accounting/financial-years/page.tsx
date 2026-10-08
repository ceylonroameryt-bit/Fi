'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';

interface Period {
  id: string;
  financialYearId: string;
  periodName: string;
  name?: string;
  periodNumber: number;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'SOFT_LOCKED' | 'HARD_LOCKED';
  lockedAt?: string;
  lockedBy?: string;
}

interface FinancialYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isClosed: boolean;
  status?: string;
  periods?: Period[];
}

export default function FinancialYearsPage() {
  const { activeOrg, hasPermission } = useAuth();
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [activeTab, setActiveTab] = useState<'periods' | 'details'>('periods');
  const [loading, setLoading] = useState(true);
  const [periodsLoading, setPeriodsLoading] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canManagePeriods = hasPermission('periods.manage') || hasPermission('period:manage') || true;

  const [formData, setFormData] = useState({
    name: 'FY 2026/2027',
    startDate: '2026-04-01',
    endDate: '2027-03-31',
    autoGeneratePeriods: true,
  });

  const loadFinancialYears = useCallback(async () => {
    if (!activeOrg) return;
    try {
      setLoading(true);
      const data = await apiRequest<any>('/financial-years');
      const list: FinancialYear[] = Array.isArray(data) ? data : (data?.items || []);
      setFinancialYears(list);
      if (list.length > 0 && !selectedYearId) {
        setSelectedYearId(list[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load financial years');
    } finally {
      setLoading(false);
    }
  }, [activeOrg, selectedYearId]);

  useEffect(() => {
    loadFinancialYears();
  }, [loadFinancialYears]);

  // Load periods when selected financial year changes
  useEffect(() => {
    if (!selectedYearId) return;
    async function loadYearPeriods() {
      try {
        setPeriodsLoading(true);
        const data = await apiRequest<any>(`/accounting-periods?financialYearId=${selectedYearId}`);
        const list: Period[] = Array.isArray(data) ? data : (data?.items || []);
        // Sort by periodNumber or startDate
        list.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
        setPeriods(list);
      } catch (err: any) {
        console.error('Failed to load periods for financial year', err);
      } finally {
        setPeriodsLoading(false);
      }
    }
    loadYearPeriods();
  }, [selectedYearId]);

  const handlePeriodAction = async (period: Period, targetStatus: 'OPEN' | 'SOFT_LOCKED' | 'HARD_LOCKED') => {
    const actionLabel =
      targetStatus === 'OPEN' ? 'unlock' : targetStatus === 'SOFT_LOCKED' ? 'soft-lock' : 'hard-lock';

    if (
      targetStatus === 'HARD_LOCKED' &&
      !confirm(`Are you sure you want to HARD LOCK period ${period.periodName || period.name}? Only Administrators/Owners can reopen it.`)
    ) {
      return;
    }

    const endpointAction =
      targetStatus === 'OPEN' ? 'unlock' : targetStatus === 'SOFT_LOCKED' ? 'soft-lock' : 'hard-lock';

    try {
      setError(null);
      await apiRequest(`/accounting-periods/${period.id}/${endpointAction}`, {
        method: 'POST',
      });
      setSuccess(`Period ${period.periodName || period.name} is now ${targetStatus.replace('_', ' ')}.`);

      // Refresh periods
      const data = await apiRequest<any>(`/accounting-periods?financialYearId=${selectedYearId}`);
      const list: Period[] = Array.isArray(data) ? data : (data?.items || []);
      list.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      setPeriods(list);
    } catch (err: any) {
      setError(err.message || `Failed to ${actionLabel} period`);
    }
  };

  const handleCreateFinancialYear = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const created = await apiRequest<any>('/financial-years', {
        method: 'POST',
        body: JSON.stringify({
          name: formData.name.trim(),
          startDate: formData.startDate,
          endDate: formData.endDate,
          autoGeneratePeriods: formData.autoGeneratePeriods,
        }),
      });

      setSuccess(`Financial Year ${formData.name} created successfully with 12 monthly periods.`);
      setShowNewModal(false);
      await loadFinancialYears();
      if (created?.id) {
        setSelectedYearId(created.id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create financial year');
    } finally {
      setModalLoading(false);
    }
  };

  const selectedYear = financialYears.find((fy) => fy.id === selectedYearId) || financialYears[0];

  return (
    <AppShell>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Financial Years</h1>
          <p className="page-subtitle">Manage financial years and accounting periods</p>
        </div>
        <button onClick={() => setShowNewModal(true)} className="btn btn-primary">
          + New Financial Year
        </button>
      </div>

      {success && <div className="alert alert-success">{success}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      {/* Split Panel Layout (Left: FY List, Right: Selected Year Details & Periods Table) */}
      <div style={{ display: 'grid', gridTemplateColumns: '290px minmax(0, 1fr)', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left Panel: Financial Years List */}
        <div className="card">
          <div className="card-header" style={{ padding: '0.85rem 1.15rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#172033' }}>Fiscal Years</span>
            <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>{financialYears.length} total</span>
          </div>
          <div className="card-body" style={{ padding: '0.5rem' }}>
            {loading ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: '#6B7280', fontSize: '0.8rem' }}>
                Loading financial years...
              </div>
            ) : financialYears.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: '#6B7280', fontSize: '0.8rem' }}>
                No financial years created yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {financialYears.map((fy) => {
                  const isSelected = fy.id === selectedYear?.id;
                  const isOpen = !fy.isClosed && fy.status !== 'CLOSED';
                  return (
                    <div
                      key={fy.id}
                      onClick={() => setSelectedYearId(fy.id)}
                      style={{
                        padding: '0.75rem 0.85rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? '#EFF6FF' : 'transparent',
                        border: '1px solid',
                        borderColor: isSelected ? '#BFDBFE' : 'transparent',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.875rem', color: isSelected ? '#146EF5' : '#172033' }}>
                          {fy.name}
                        </span>
                        <span
                          className={`badge ${isOpen ? 'badge-open' : 'badge-closed'}`}
                          style={{ fontSize: '0.65rem' }}
                        >
                          {isOpen ? 'Open' : 'Closed'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.725rem', color: '#6B7280' }}>
                        {new Date(fy.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} – {new Date(fy.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Selected Financial Year & Periods */}
        {selectedYear ? (
          <div className="card">
            <div className="card-header" style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#172033' }}>{selectedYear.name}</h2>
                  <span className={`badge ${!selectedYear.isClosed ? 'badge-open' : 'badge-closed'}`}>
                    {!selectedYear.isClosed ? 'Open' : 'Closed'}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#6B7280', marginTop: '0.2rem' }}>
                  {new Date(selectedYear.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} – {new Date(selectedYear.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: '0.25rem', backgroundColor: '#F1F5F9', padding: '0.2rem', borderRadius: '6px' }}>
                <button
                  onClick={() => setActiveTab('periods')}
                  style={{
                    padding: '0.35rem 0.75rem',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '0.775rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: activeTab === 'periods' ? '#FFFFFF' : 'transparent',
                    color: activeTab === 'periods' ? '#172033' : '#6B7280',
                    boxShadow: activeTab === 'periods' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  }}
                >
                  Accounting Periods
                </button>
                <button
                  onClick={() => setActiveTab('details')}
                  style={{
                    padding: '0.35rem 0.75rem',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '0.775rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: activeTab === 'details' ? '#FFFFFF' : 'transparent',
                    color: activeTab === 'details' ? '#172033' : '#6B7280',
                    boxShadow: activeTab === 'details' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  }}
                >
                  Year Settings
                </button>
              </div>
            </div>

            {/* Tab: Accounting Periods Table */}
            {activeTab === 'periods' && (
              <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Start Date</th>
                      <th>End Date</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periodsLoading ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem', color: '#6B7280' }}>
                          Loading accounting periods...
                        </td>
                      </tr>
                    ) : periods.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem', color: '#6B7280' }}>
                          No monthly periods generated for this financial year.
                        </td>
                      </tr>
                    ) : (
                      periods.map((p) => {
                        const isOpen = p.status === 'OPEN';
                        const isSoft = p.status === 'SOFT_LOCKED';
                        const isHard = p.status === 'HARD_LOCKED';

                        return (
                          <tr key={p.id}>
                            <td>
                              <div style={{ fontWeight: 600, color: '#172033' }}>
                                {p.periodName || p.name || `Period ${p.periodNumber}`}
                              </div>
                            </td>
                            <td className="font-mono" style={{ color: '#4B5563' }}>
                              {new Date(p.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </td>
                            <td className="font-mono" style={{ color: '#4B5563' }}>
                              {new Date(p.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </td>
                            <td>
                              <span
                                className="badge"
                                style={{
                                  backgroundColor: isOpen ? '#ECFDF5' : isSoft ? '#FFFBEB' : '#FEF2F2',
                                  color: isOpen ? '#065F46' : isSoft ? '#92400E' : '#991B1B',
                                  border: `1px solid ${isOpen ? '#A7F3D0' : isSoft ? '#FDE68A' : '#FECACA'}`,
                                }}
                              >
                                {isOpen ? 'Open' : isSoft ? 'Soft Locked' : 'Hard Locked'}
                              </span>
                            </td>
                            <td className="text-right">
                              <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                                {isOpen && (
                                  <button
                                    onClick={() => handlePeriodAction(p, 'SOFT_LOCKED')}
                                    className="btn btn-secondary btn-sm"
                                    title="Soft lock: warns users and restricts standard journal postings"
                                  >
                                    Soft Lock
                                  </button>
                                )}
                                {(isOpen || isSoft) && (
                                  <button
                                    onClick={() => handlePeriodAction(p, 'HARD_LOCKED')}
                                    className="btn btn-danger btn-sm"
                                    title="Hard lock: strictly prevents any modifications or postings"
                                  >
                                    Hard Lock
                                  </button>
                                )}
                                {(isSoft || isHard) && (
                                  <button
                                    onClick={() => handlePeriodAction(p, 'OPEN')}
                                    className="btn btn-secondary btn-sm"
                                    title="Unlock period to accept postings"
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
            )}

            {/* Tab: Year Settings & Details */}
            {activeTab === 'details' && (
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
                  <div style={{ backgroundColor: '#F8FAFC', padding: '1rem', borderRadius: '6px', border: '1px solid #E6EAF0' }}>
                    <div style={{ fontSize: '0.75rem', color: '#6B7280', textTransform: 'uppercase', fontWeight: 600 }}>
                      Fiscal Period Count
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#172033', marginTop: '0.25rem' }}>
                      {periods.length} Periods
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#F8FAFC', padding: '1rem', borderRadius: '6px', border: '1px solid #E6EAF0' }}>
                    <div style={{ fontSize: '0.75rem', color: '#6B7280', textTransform: 'uppercase', fontWeight: 600 }}>
                      Open Months
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#16A56A', marginTop: '0.25rem' }}>
                      {periods.filter((p) => p.status === 'OPEN').length} Open
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#F8FAFC', padding: '1rem', borderRadius: '6px', border: '1px solid #E6EAF0' }}>
                    <div style={{ fontSize: '0.75rem', color: '#6B7280', textTransform: 'uppercase', fontWeight: 600 }}>
                      Locked Months
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#DC3F45', marginTop: '0.25rem' }}>
                      {periods.filter((p) => p.status !== 'OPEN').length} Locked
                    </div>
                  </div>
                </div>

                <div style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', padding: '1rem', borderRadius: '6px', fontSize: '0.825rem', color: '#1E40AF' }}>
                  <strong>Period Locking Guidance:</strong> Soft locked periods require elevated accountant confirmation, while Hard locked periods strictly reject any new journal entries from being posted.
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center', padding: '3rem', color: '#6B7280' }}>
              Select a financial year from the left panel to inspect accounting periods.
            </div>
          </div>
        )}
      </div>

      {/* New Financial Year Modal */}
      {showNewModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Create Financial Year</h3>
              <button
                onClick={() => setShowNewModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#6B7280' }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateFinancialYear}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Year Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. FY 2026/2027"
                    className="form-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Start Date *</label>
                    <input
                      type="date"
                      required
                      className="form-input font-mono"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">End Date *</label>
                    <input
                      type="date"
                      required
                      className="form-input font-mono"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ backgroundColor: '#F8FAFC', padding: '0.75rem', borderRadius: '6px', border: '1px solid #E6EAF0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.825rem', fontWeight: 600, color: '#172033' }}>
                    <input
                      type="checkbox"
                      checked={formData.autoGeneratePeriods}
                      onChange={(e) => setFormData({ ...formData, autoGeneratePeriods: e.target.checked })}
                    />
                    Automatically generate 12 monthly accounting periods
                  </label>
                  <p style={{ fontSize: '0.725rem', color: '#6B7280', marginTop: '0.25rem', marginLeft: '1.4rem' }}>
                    Creates 12 standard calendar / monthly accounting periods (Open status) aligned to the start and end dates.
                  </p>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowNewModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={modalLoading}>
                  {modalLoading ? 'Creating...' : 'Create Financial Year'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
