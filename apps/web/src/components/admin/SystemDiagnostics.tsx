'use client';

import React from 'react';
import type { PlatformStats } from './AdminOverview';

interface SystemDiagnosticsProps {
  stats: PlatformStats | null;
}

export function SystemDiagnostics({ stats }: SystemDiagnosticsProps) {
  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${Math.floor(seconds % 60)}s`;
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
      {/* Database & Pool Health */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '10px',
          border: '1px solid var(--border-subtle)',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>🗄️</span> Supabase PostgreSQL Core
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--bg-soft)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Database Engine</span>
            <strong style={{ color: 'var(--text-main)' }}>PostgreSQL 15 (Supabase AWS Ireland)</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--bg-soft)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Health Status</span>
            <span style={{ color: 'var(--success-text)', fontWeight: 600 }}>● {stats?.system.dbStatus ? stats.system.dbStatus.toUpperCase() : 'ONLINE'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--bg-soft)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Live Query Latency</span>
            <strong style={{ color: 'var(--text-main)' }}>{stats?.system.dbLatencyMs ? `${stats.system.dbLatencyMs} ms` : '—'}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--bg-soft)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Tenant Isolation Mode</span>
            <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Composite (org_id, id) FK</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Migration Status</span>
            <span style={{ color: 'var(--success-text)', fontWeight: 600 }}>Up to date (Prisma Schema v0.1)</span>
          </div>
        </div>
      </div>

      {/* Backend Runtime & Gateway */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '10px',
          border: '1px solid var(--border-subtle)',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>⚡</span> API Gateway & Process Runtime
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--bg-soft)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Gateway Endpoint</span>
            <span style={{ color: 'var(--primary)', fontWeight: 500 }}>
              {process.env.NEXT_PUBLIC_API_URL || 'Configured via NEXT_PUBLIC_API_URL'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--bg-soft)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Process Uptime</span>
            <strong style={{ color: 'var(--text-main)' }}>{stats?.system.uptimeSeconds ? formatUptime(stats.system.uptimeSeconds) : '—'}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--bg-soft)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Node.js Runtime</span>
            <strong style={{ color: 'var(--text-main)' }}>{stats?.system.nodeVersion ?? 'Node 20+'}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--bg-soft)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Memory Heap (Used / Total)</span>
            <strong style={{ color: 'var(--text-main)' }}>{stats?.system.memoryUsage ? `${stats.system.memoryUsage.heapUsed} / ${stats.system.memoryUsage.heapTotal}` : '—'}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Process RSS Memory</span>
            <strong style={{ color: 'var(--text-main)' }}>{stats?.system.memoryUsage ? stats.system.memoryUsage.rss : '—'}</strong>
          </div>
        </div>
      </div>

      {/* Security Posture */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '10px',
          border: '1px solid var(--border-subtle)',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          gridColumn: '1 / -1',
        }}
      >
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>🛡️</span> Security & Compliance Architecture
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', fontSize: '0.85rem' }}>
          <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>HttpOnly Cookies + CSRF Protection</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Browser credentials stored in secure HttpOnly cookies. Double-submit CSRF protection on all state mutations.</div>
          </div>
          <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>SuperAdminGuard Protection</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>All admin routes protected by database-verified superadmin authorization with last-admin demotion prevention.</div>
          </div>
          <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>Immutable Audit Logging</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Every administrative privilege modification, tenant status change, and password reset is logged with IP and actor ID.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
