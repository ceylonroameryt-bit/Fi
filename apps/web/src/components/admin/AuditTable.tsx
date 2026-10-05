'use client';

import React from 'react';

export interface AuditLogItem {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user?: { id: string; email: string; firstName: string; lastName: string } | null;
  organization?: { id: string; name: string } | null;
  metadata?: any;
}

interface AuditTableProps {
  auditLogs: AuditLogItem[];
  auditTotal: number;
  auditEventType: string;
  auditPage: number;
  auditLoading: boolean;
  onEventTypeChange: (eventType: string) => void;
  onPageChange: (page: number) => void;
}

export function AuditTable({
  auditLogs,
  auditTotal,
  auditEventType,
  auditPage,
  auditLoading,
  onEventTypeChange,
  onPageChange,
}: AuditTableProps) {
  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '10px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        padding: '1.5rem',
      }}
    >
      {/* Header & Filter */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
            Platform Security & Audit Trail
          </h2>
          <p style={{ margin: '0.2rem 0 0 0', color: '#64748B', fontSize: '0.85rem' }}>
            Immutable cross-tenant activity log stream ({auditTotal} records)
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <select
            value={auditEventType}
            onChange={(e) => onEventTypeChange(e.target.value)}
            style={{
              padding: '0.5rem 0.85rem',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              fontSize: '0.85rem',
              backgroundColor: '#FFFFFF',
            }}
          >
            <option value="">All Event Types</option>
            <option value="USER_LOGIN">USER_LOGIN</option>
            <option value="USER_REGISTER">USER_REGISTER</option>
            <option value="ADMIN_ORG_STATUS_CHANGED">ADMIN_ORG_STATUS_CHANGED</option>
            <option value="ADMIN_USER_STATUS_CHANGED">ADMIN_USER_STATUS_CHANGED</option>
            <option value="ADMIN_USER_SUPER_ADMIN_TOGGLED">ADMIN_USER_SUPER_ADMIN_TOGGLED</option>
            <option value="ADMIN_USER_PASSWORD_RESET">ADMIN_USER_PASSWORD_RESET</option>
            <option value="JOURNAL_POSTED">JOURNAL_POSTED</option>
            <option value="INVOICE_CREATED">INVOICE_CREATED</option>
          </select>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left' }}>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569' }}>Timestamp</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569' }}>Event Type</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569' }}>Actor</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569' }}>Tenant</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569' }}>Target Entity</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569' }}>IP Address</th>
            </tr>
          </thead>
          <tbody>
            {auditLoading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748B' }}>
                  Loading audit logs...
                </td>
              </tr>
            ) : auditLogs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748B' }}>
                  No audit records found matching criteria.
                </td>
              </tr>
            ) : (
              auditLogs.map((log) => {
                const isAdminEvent = log.eventType.startsWith('ADMIN');
                return (
                  <tr key={log.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '0.75rem 1rem', color: '#64748B', whiteSpace: 'nowrap' }}>
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        style={{
                          backgroundColor: isAdminEvent ? '#FEF3C7' : '#EFF6FF',
                          color: isAdminEvent ? '#92400E' : '#1E40AF',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                        }}
                      >
                        {log.eventType}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {log.user ? (
                        <div>
                          <div style={{ fontWeight: 500, color: '#0F172A' }}>{log.user.firstName} {log.user.lastName}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{log.user.email}</div>
                        </div>
                      ) : (
                        <span style={{ color: '#94A3B8' }}>System Engine</span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#334155' }}>
                      {log.organization?.name || 'Platform Wide'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#64748B', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {log.entityType} {log.entityId ? `(${log.entityId.slice(0, 8)}...)` : ''}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#64748B', fontSize: '0.8rem' }}>
                      {log.ipAddress || '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {auditTotal > 20 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #E2E8F0' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
            Showing {(auditPage - 1) * 20 + 1} to {Math.min(auditPage * 20, auditTotal)} of {auditTotal}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              disabled={auditPage <= 1}
              onClick={() => onPageChange(Math.max(1, auditPage - 1))}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '5px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                fontSize: '0.8rem',
                cursor: auditPage <= 1 ? 'not-allowed' : 'pointer',
                opacity: auditPage <= 1 ? 0.5 : 1,
              }}
            >
              Previous
            </button>
            <button
              disabled={auditPage * 20 >= auditTotal}
              onClick={() => onPageChange(auditPage + 1)}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '5px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                fontSize: '0.8rem',
                cursor: auditPage * 20 >= auditTotal ? 'not-allowed' : 'pointer',
                opacity: auditPage * 20 >= auditTotal ? 0.5 : 1,
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
