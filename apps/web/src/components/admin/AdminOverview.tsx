'use client';

import React from 'react';
import { AdminMetricCard } from './AdminMetricCard';

export interface PlatformStats {
  overview: {
    totalOrganizations: number;
    activeOrganizations: number;
    suspendedOrganizations: number;
    totalUsers: number;
    activeUsers: number;
    superAdmins: number;
    totalJournals: number;
    totalInvoices: number;
    totalTransactedVolume: number;
  };
  system: {
    dbStatus: string;
    dbLatencyMs: number;
    uptimeSeconds: number;
    memoryUsage: {
      rss: string;
      heapTotal: string;
      heapUsed: string;
    };
    nodeVersion: string;
    timestamp: string;
  };
  recentAuditLogs: Array<{
    id: string;
    eventType: string;
    entityType: string;
    entityId: string | null;
    ipAddress: string | null;
    createdAt: string;
    user?: { id: string; email: string; firstName: string; lastName: string } | null;
    organization?: { id: string; name: string } | null;
    metadata?: any;
  }>;
}

interface AdminOverviewProps {
  stats: PlatformStats | null;
  onNavigateTab: (tab: 'overview' | 'organizations' | 'users' | 'audit' | 'diagnostics') => void;
}

export function AdminOverview({ stats, onNavigateTab }: AdminOverviewProps) {
  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(amt);
  };

  return (
    <div>
      {/* KPI Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <AdminMetricCard
          title="Total Organizations"
          value={stats?.overview.totalOrganizations ?? '—'}
          subtitle={
            <div style={{ color: '#16A34A', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span>●</span>
              <span>{stats?.overview.activeOrganizations ?? 0} Active</span>
              {stats?.overview.suspendedOrganizations ? (
                <span style={{ color: '#E11D48', marginLeft: '0.3rem' }}>• {stats.overview.suspendedOrganizations} Suspended</span>
              ) : null}
            </div>
          }
        />

        <AdminMetricCard
          title="Global Users"
          value={stats?.overview.totalUsers ?? '—'}
          subtitle={
            <div>
              <strong style={{ color: '#F59E0B' }}>{stats?.overview.superAdmins ?? 0}</strong> Super Admins • {stats?.overview.activeUsers ?? 0} Active
            </div>
          }
        />

        <AdminMetricCard
          title="Total Journal Entries"
          value={stats?.overview.totalJournals ?? '—'}
          subtitle="Across all ledger organisations"
        />

        <AdminMetricCard
          title="System Transacted Volume"
          value={stats?.overview.totalTransactedVolume !== undefined ? formatCurrency(stats.overview.totalTransactedVolume) : '—'}
          subtitle={<span style={{ color: '#16A34A' }}>Sum of total posted ledger debits</span>}
        />

        <AdminMetricCard
          title="Total Invoices"
          value={stats?.overview.totalInvoices ?? '—'}
          subtitle="Invoices across all active clients"
        />
      </div>

      {/* Quick Actions & Recent Platform Audit Events */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Quick Platform Operations */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '10px',
            padding: '1.5rem',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#0F172A', marginBottom: '1rem' }}>
            Administrative Quick Actions
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              onClick={() => onNavigateTab('organizations')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.85rem 1rem',
                borderRadius: '8px',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, color: '#1E293B', fontSize: '0.875rem' }}>Manage Organizations</div>
                <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Inspect, activate, or suspend tenant workspaces</div>
              </div>
              <span style={{ color: '#2563EB', fontWeight: 600 }}>&rarr;</span>
            </button>

            <button
              onClick={() => onNavigateTab('users')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.85rem 1rem',
                borderRadius: '8px',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, color: '#1E293B', fontSize: '0.875rem' }}>Global User Directory</div>
                <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Search users, toggle Super Admin, reset passwords</div>
              </div>
              <span style={{ color: '#2563EB', fontWeight: 600 }}>&rarr;</span>
            </button>

            <button
              onClick={() => onNavigateTab('audit')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.85rem 1rem',
                borderRadius: '8px',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, color: '#1E293B', fontSize: '0.875rem' }}>Security Audit Trail</div>
                <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Cross-tenant log stream and admin action auditing</div>
              </div>
              <span style={{ color: '#2563EB', fontWeight: 600 }}>&rarr;</span>
            </button>

            <button
              onClick={() => onNavigateTab('diagnostics')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.85rem 1rem',
                borderRadius: '8px',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, color: '#1E293B', fontSize: '0.875rem' }}>Engine Telemetry & Health</div>
                <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Database latency, memory usage, uptime, version info</div>
              </div>
              <span style={{ color: '#2563EB', fontWeight: 600 }}>&rarr;</span>
            </button>
          </div>
        </div>

        {/* Recent Audit Logs Snapshot */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '10px',
            padding: '1.5rem',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#0F172A', margin: 0 }}>
              Recent System Events
            </h3>
            <button
              onClick={() => onNavigateTab('audit')}
              style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
            >
              View All &rarr;
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {stats?.recentAuditLogs && stats.recentAuditLogs.length > 0 ? (
              stats.recentAuditLogs.slice(0, 5).map((log) => (
                <div
                  key={log.id}
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: '6px',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    fontSize: '0.8rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                    <span
                      style={{
                        backgroundColor: log.eventType.startsWith('ADMIN') ? '#FEF3C7' : '#EFF6FF',
                        color: log.eventType.startsWith('ADMIN') ? '#92400E' : '#1E40AF',
                        padding: '0.15rem 0.4rem',
                        borderRadius: '4px',
                        fontWeight: 600,
                        fontSize: '0.7rem',
                      }}
                    >
                      {log.eventType}
                    </span>
                    <span style={{ color: '#94A3B8', fontSize: '0.7rem' }}>
                      {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ color: '#334155', fontWeight: 500 }}>
                    {log.user ? `${log.user.firstName} ${log.user.lastName} (${log.user.email})` : 'System Task'}
                  </div>
                  {log.organization && (
                    <div style={{ color: '#64748B', fontSize: '0.7rem' }}>
                      Org: {log.organization.name}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div style={{ color: '#94A3B8', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>
                No recent platform audit events
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
