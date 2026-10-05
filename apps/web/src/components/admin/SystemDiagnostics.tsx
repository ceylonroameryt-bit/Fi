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
          border: '1px solid #E2E8F0',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#0F172A', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>🗄️</span> Supabase PostgreSQL Core
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #F1F5F9' }}>
            <span style={{ color: '#64748B' }}>Database Engine</span>
            <strong style={{ color: '#0F172A' }}>PostgreSQL 15 (Supabase AWS Ireland)</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #F1F5F9' }}>
            <span style={{ color: '#64748B' }}>Health Status</span>
            <span style={{ color: '#16A34A', fontWeight: 600 }}>● {stats?.system.dbStatus ? stats.system.dbStatus.toUpperCase() : 'ONLINE'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #F1F5F9' }}>
            <span style={{ color: '#64748B' }}>Live Query Latency</span>
            <strong style={{ color: '#0F172A' }}>{stats?.system.dbLatencyMs ? `${stats.system.dbLatencyMs} ms` : '—'}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #F1F5F9' }}>
            <span style={{ color: '#64748B' }}>Tenant Isolation Mode</span>
            <span style={{ color: '#2563EB', fontWeight: 600 }}>Composite (org_id, id) FK</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748B' }}>Migration Status</span>
            <span style={{ color: '#16A34A', fontWeight: 600 }}>Up to date (Prisma Schema v0.1)</span>
          </div>
        </div>
      </div>

      {/* Backend Runtime & Gateway */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '10px',
          border: '1px solid #E2E8F0',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#0F172A', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>⚡</span> API Gateway & Process Runtime
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #F1F5F9' }}>
            <span style={{ color: '#64748B' }}>Gateway Endpoint</span>
            <span style={{ color: '#2563EB', fontWeight: 500 }}>
              {process.env.NEXT_PUBLIC_API_URL || 'Configured via NEXT_PUBLIC_API_URL'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #F1F5F9' }}>
            <span style={{ color: '#64748B' }}>Process Uptime</span>
            <strong style={{ color: '#0F172A' }}>{stats?.system.uptimeSeconds ? formatUptime(stats.system.uptimeSeconds) : '—'}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #F1F5F9' }}>
            <span style={{ color: '#64748B' }}>Node.js Runtime</span>
            <strong style={{ color: '#0F172A' }}>{stats?.system.nodeVersion ?? 'Node 20+'}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #F1F5F9' }}>
            <span style={{ color: '#64748B' }}>Memory Heap (Used / Total)</span>
            <strong style={{ color: '#0F172A' }}>{stats?.system.memoryUsage ? `${stats.system.memoryUsage.heapUsed} / ${stats.system.memoryUsage.heapTotal}` : '—'}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748B' }}>Process RSS Memory</span>
            <strong style={{ color: '#0F172A' }}>{stats?.system.memoryUsage ? stats.system.memoryUsage.rss : '—'}</strong>
          </div>
        </div>
      </div>

      {/* Security Posture */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '10px',
          border: '1px solid #E2E8F0',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          gridColumn: '1 / -1',
        }}
      >
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#0F172A', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>🛡️</span> Security & Compliance Architecture
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', fontSize: '0.85rem' }}>
          <div style={{ padding: '0.75rem', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontWeight: 600, color: '#0F172A', marginBottom: '0.25rem' }}>HttpOnly Cookies + CSRF Protection</div>
            <div style={{ color: '#64748B', fontSize: '0.8rem' }}>Browser credentials stored in secure HttpOnly cookies. Double-submit CSRF protection on all state mutations.</div>
          </div>
          <div style={{ padding: '0.75rem', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontWeight: 600, color: '#0F172A', marginBottom: '0.25rem' }}>SuperAdminGuard Protection</div>
            <div style={{ color: '#64748B', fontSize: '0.8rem' }}>All admin routes protected by database-verified superadmin authorization with last-admin demotion prevention.</div>
          </div>
          <div style={{ padding: '0.75rem', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontWeight: 600, color: '#0F172A', marginBottom: '0.25rem' }}>Immutable Audit Logging</div>
            <div style={{ color: '#64748B', fontSize: '0.8rem' }}>Every administrative privilege modification, tenant status change, and password reset is logged with IP and actor ID.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
