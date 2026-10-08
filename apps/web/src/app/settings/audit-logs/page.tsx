'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';

interface AuditItem {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string | null;
  oldValues: any;
  newValues: any;
  ipAddress: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
}

export default function AuditLogsPage() {
  const { activeOrg } = useAuth();
  const [logs, setLogs] = useState<AuditItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedEventType, setSelectedEventType] = useState('ALL');
  const [selectedEntityType, setSelectedEntityType] = useState('ALL');
  const [selectedLog, setSelectedLog] = useState<AuditItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    if (!activeOrg) return;
    try {
      setLoading(true);
      const res = await apiRequest<any>('/audit-logs?page=1&pageSize=50');
      const items: AuditItem[] = Array.isArray(res) ? res : (res?.items || []);
      setLogs(items);
      setTotal(res?.total ?? items.length);
    } catch (err: any) {
      setError(err.message || 'Failed to load audit trail');
    } finally {
      setLoading(false);
    }
  }, [activeOrg]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const filteredLogs = logs.filter((log) => {
    if (selectedEventType !== 'ALL' && log.eventType !== selectedEventType) return false;
    if (selectedEntityType !== 'ALL' && log.entityType !== selectedEntityType) return false;
    if (search) {
      const q = search.toLowerCase();
      const userText = log.user ? `${log.user.firstName} ${log.user.lastName} ${log.user.email}`.toLowerCase() : 'system';
      return (
        log.eventType.toLowerCase().includes(q) ||
        log.entityType.toLowerCase().includes(q) ||
        (log.entityId && log.entityId.toLowerCase().includes(q)) ||
        userText.includes(q)
      );
    }
    return true;
  });

  const formatEventLabel = (type: string) => {
    return type
      .replace(/[._]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <AppShell>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Trail & Activity Logs</h1>
          <p className="page-subtitle">
            Cryptographically sealed, immutable record of all accounting and administrative actions in <strong>{activeOrg?.name}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', color: '#065F46', fontWeight: 600 }}>
          <span>🔒</span>
          <span>Append-Only Immutable Ledger</span>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-body" style={{ padding: '0.85rem 1.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search by action, user, or reference..."
                className="form-input"
                style={{ width: '260px', paddingLeft: '2rem' }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <span style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', fontSize: '0.8rem' }}>🔍</span>
            </div>

            {/* Action Type filter */}
            <select
              className="form-select"
              style={{ width: 'auto' }}
              value={selectedEventType}
              onChange={(e) => setSelectedEventType(e.target.value)}
            >
              <option value="ALL">All Actions</option>
              <option value="journal.validate">Journal Validated</option>
              <option value="journal.create">Journal Created</option>
              <option value="account.create">Account Created</option>
              <option value="account.archive">Account Archived</option>
              <option value="financial_year.create">Financial Year Created</option>
              <option value="period.lock">Period Locked</option>
              <option value="user.invite">User Invited</option>
              <option value="role.change">Role Changed</option>
            </select>

            {/* Entity Type filter */}
            <select
              className="form-select"
              style={{ width: 'auto' }}
              value={selectedEntityType}
              onChange={(e) => setSelectedEntityType(e.target.value)}
            >
              <option value="ALL">All Entities</option>
              <option value="ACCOUNT">Account</option>
              <option value="JOURNAL">Journal</option>
              <option value="PERIOD">Period</option>
              <option value="FINANCIAL_YEAR">Financial Year</option>
              <option value="ORGANIZATION">Organisation</option>
              <option value="USER">User / Member</option>
            </select>

            {/* Date Range filter */}
            <select
              className="form-select"
              style={{ width: 'auto' }}
              defaultValue="ALL_TIME"
            >
              <option value="ALL_TIME">All Time</option>
              <option value="TODAY">Today</option>
              <option value="LAST_7_DAYS">Last 7 Days</option>
              <option value="THIS_MONTH">This Month</option>
              <option value="THIS_FY">Current FY (2026/27)</option>
            </select>
          </div>

          <div style={{ fontSize: '0.8rem', color: '#6B7280' }}>
            Showing <strong>{filteredLogs.length}</strong> of <strong>{total}</strong> audit entries
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '160px' }}>Date & Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Reference</th>
                <th>Organisation</th>
                <th className="text-right" style={{ width: '80px' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: '#6B7280' }}>
                    Loading audit trail...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#6B7280' }}>
                    <div style={{ fontSize: '1.25rem', marginBottom: '0.4rem' }}>📜</div>
                    <div style={{ fontWeight: 600, color: '#172033' }}>No audit records found</div>
                    <div style={{ fontSize: '0.775rem', marginTop: '0.2rem' }}>
                      Audit records are recorded automatically whenever accounts, journals, or periods are modified.
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isAccount = log.entityType.toUpperCase().includes('ACCOUNT');
                  const isJournal = log.entityType.toUpperCase().includes('JOURNAL');
                  const isPeriod = log.entityType.toUpperCase().includes('PERIOD');

                  const entityBadgeClass = isAccount
                    ? 'badge-asset'
                    : isJournal
                    ? 'badge-open'
                    : isPeriod
                    ? 'badge-liability'
                    : 'badge-draft';

                  return (
                    <tr key={log.id}>
                      <td className="font-mono" style={{ fontSize: '0.775rem', color: '#4B5563' }}>
                        {new Date(log.createdAt).toLocaleString('en-GB', {
                          year: 'numeric',
                          month: 'short',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td>
                        {log.user ? (
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600, color: '#172033', fontSize: '0.825rem' }}>
                              {log.user.firstName} {log.user.lastName}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: '#6B7280' }}>{log.user.email}</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#6B7280', fontStyle: 'italic' }}>
                            System
                          </span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#172033', fontSize: '0.825rem' }}>
                          {formatEventLabel(log.eventType)}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${entityBadgeClass}`}>{log.entityType}</span>
                      </td>
                      <td className="font-mono" style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                        {log.entityId ? log.entityId.slice(0, 10) + '...' : '—'}
                      </td>
                      <td style={{ fontSize: '0.775rem', color: '#4B5563', fontWeight: 500 }}>
                        {activeOrg?.name ?? 'Alpha Consulting Ltd'}
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          View &rarr;
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Event Detail Slide-Over Drawer */}
      {selectedLog && (
        <div className="drawer-overlay" onClick={() => setSelectedLog(null)}>
          <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#172033' }}>
                  {formatEventLabel(selectedLog.eventType)}
                </h3>
                <p style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.15rem' }}>
                  Event ID: <span className="font-mono">{selectedLog.id}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#6B7280' }}
              >
                ×
              </button>
            </div>

            <div className="drawer-body">
              {/* Event Metadata */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div style={{ backgroundColor: '#F8FAFC', padding: '0.75rem', borderRadius: '6px', border: '1px solid #E6EAF0' }}>
                  <div style={{ fontSize: '0.7rem', color: '#6B7280', textTransform: 'uppercase', fontWeight: 600 }}>
                    Timestamp
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.775rem', color: '#172033', marginTop: '0.2rem' }}>
                    {new Date(selectedLog.createdAt).toISOString()}
                  </div>
                </div>

                <div style={{ backgroundColor: '#F8FAFC', padding: '0.75rem', borderRadius: '6px', border: '1px solid #E6EAF0' }}>
                  <div style={{ fontSize: '0.7rem', color: '#6B7280', textTransform: 'uppercase', fontWeight: 600 }}>
                    Actor
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#172033', marginTop: '0.2rem', fontWeight: 600 }}>
                    {selectedLog.user ? `${selectedLog.user.firstName} ${selectedLog.user.lastName}` : 'System'}
                  </div>
                  {selectedLog.user && (
                    <div style={{ fontSize: '0.7rem', color: '#6B7280' }}>{selectedLog.user.email}</div>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div style={{ backgroundColor: '#F8FAFC', padding: '0.75rem', borderRadius: '6px', border: '1px solid #E6EAF0' }}>
                  <div style={{ fontSize: '0.7rem', color: '#6B7280', textTransform: 'uppercase', fontWeight: 600 }}>
                    Target Entity
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#172033', marginTop: '0.2rem', fontWeight: 600 }}>
                    {selectedLog.entityType}
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.7rem', color: '#6B7280' }}>
                    {selectedLog.entityId || 'N/A'}
                  </div>
                </div>

                <div style={{ backgroundColor: '#F8FAFC', padding: '0.75rem', borderRadius: '6px', border: '1px solid #E6EAF0' }}>
                  <div style={{ fontSize: '0.7rem', color: '#6B7280', textTransform: 'uppercase', fontWeight: 600 }}>
                    Network Context
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.775rem', color: '#172033', marginTop: '0.2rem' }}>
                    IP: {selectedLog.ipAddress || '127.0.0.1'}
                  </div>
                </div>
              </div>

              {/* State Snapshots (Old vs New Values) */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#172033', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  New Value Snapshot
                </div>
                <pre
                  className="font-mono"
                  style={{
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E6EAF0',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    color: '#065F46',
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {selectedLog.newValues ? JSON.stringify(selectedLog.newValues, null, 2) : 'No state mutation recorded'}
                </pre>
              </div>

              {selectedLog.oldValues && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#172033', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                    Previous Value Snapshot
                  </div>
                  <pre
                    className="font-mono"
                    style={{
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E6EAF0',
                      padding: '0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      color: '#991B1B',
                      overflowX: 'auto',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {JSON.stringify(selectedLog.oldValues, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="drawer-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.72rem', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span>🔒</span>
                <span>Immutable Record • Editing not permitted</span>
              </span>
              <button onClick={() => setSelectedLog(null)} className="btn btn-secondary btn-sm">
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
