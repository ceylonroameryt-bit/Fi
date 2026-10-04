'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';

interface PlatformStats {
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

interface AdminOrg {
  id: string;
  name: string;
  legalName?: string;
  country: string;
  baseCurrency: string;
  timezone: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  createdAt: string;
  createdBy?: { id: string; email: string; firstName: string; lastName: string };
  _count: {
    members: number;
    journals: number;
    invoices: number;
    accounts: number;
  };
}

interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'DISABLED';
  isSuperAdmin: boolean;
  emailVerified: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  _count?: {
    memberships: number;
  };
}

interface AuditLogItem {
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

export default function AdminPortalPage() {
  const { user, switchOrg, refreshOrgs } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'overview' | 'organizations' | 'users' | 'audit' | 'diagnostics'>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Overview stats
  const [stats, setStats] = useState<PlatformStats | null>(null);

  // Organizations state
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [orgTotal, setOrgTotal] = useState(0);
  const [orgSearch, setOrgSearch] = useState('');
  const [orgStatus, setOrgStatus] = useState<string>('');
  const [orgPage, setOrgPage] = useState(1);
  const [orgLoading, setOrgLoading] = useState(false);
  const [selectedOrgDetails, setSelectedOrgDetails] = useState<any | null>(null);

  // Users state
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userSearch, setUserSearch] = useState('');
  const [userStatus, setUserStatus] = useState<string>('');
  const [userSuperOnly, setUserSuperOnly] = useState(false);
  const [userPage, setUserPage] = useState(1);
  const [userLoading, setUserLoading] = useState(false);

  // Password reset modal state
  const [resettingUser, setResettingUser] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);

  // Audit state
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditEventType, setAuditEventType] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [auditLoading, setAuditLoading] = useState(false);

  // Verify super admin access
  useEffect(() => {
    if (user && !user.isSuperAdmin) {
      router.push('/');
    }
  }, [user, router]);

  // Load platform overview
  const loadStats = useCallback(async () => {
    try {
      setError(null);
      const res = await apiRequest<PlatformStats>('/admin/stats');
      setStats(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to load platform stats');
    }
  }, []);

  // Load organizations
  const loadOrganizations = useCallback(async () => {
    try {
      setOrgLoading(true);
      const query = new URLSearchParams({
        page: orgPage.toString(),
        limit: '15',
        ...(orgSearch ? { search: orgSearch } : {}),
        ...(orgStatus ? { status: orgStatus } : {}),
      });
      const res = await apiRequest<{ organizations: AdminOrg[]; meta: { total: number } }>(`/admin/organizations?${query}`);
      setOrgs(res.organizations);
      setOrgTotal(res.meta.total);
    } catch (err: any) {
      setError(err?.message || 'Failed to load organizations');
    } finally {
      setOrgLoading(false);
    }
  }, [orgPage, orgSearch, orgStatus]);

  // Load users
  const loadUsers = useCallback(async () => {
    try {
      setUserLoading(true);
      const query = new URLSearchParams({
        page: userPage.toString(),
        limit: '15',
        ...(userSearch ? { search: userSearch } : {}),
        ...(userStatus ? { status: userStatus } : {}),
        ...(userSuperOnly ? { superAdminOnly: 'true' } : {}),
      });
      const res = await apiRequest<{ users: AdminUser[]; meta: { total: number } }>(`/admin/users?${query}`);
      setUsers(res.users);
      setUserTotal(res.meta.total);
    } catch (err: any) {
      setError(err?.message || 'Failed to load users');
    } finally {
      setUserLoading(false);
    }
  }, [userPage, userSearch, userStatus, userSuperOnly]);

  // Load audit logs
  const loadAuditLogs = useCallback(async () => {
    try {
      setAuditLoading(true);
      const query = new URLSearchParams({
        page: auditPage.toString(),
        limit: '20',
        ...(auditEventType ? { eventType: auditEventType } : {}),
      });
      const res = await apiRequest<{ logs: AuditLogItem[]; meta: { total: number } }>(`/admin/audit-logs?${query}`);
      setAuditLogs(res.logs);
      setAuditTotal(res.meta.total);
    } catch (err: any) {
      setError(err?.message || 'Failed to load audit logs');
    } finally {
      setAuditLoading(false);
    }
  }, [auditPage, auditEventType]);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadStats();
      setLoading(false);
    };
    init();
  }, [loadStats]);

  // Lazy tab loader
  useEffect(() => {
    if (activeTab === 'organizations') loadOrganizations();
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'audit') loadAuditLogs();
  }, [activeTab, loadOrganizations, loadUsers, loadAuditLogs]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    if (activeTab === 'organizations') await loadOrganizations();
    if (activeTab === 'users') await loadUsers();
    if (activeTab === 'audit') await loadAuditLogs();
    setRefreshing(false);
  };

  // Org status update
  const handleUpdateOrgStatus = async (orgId: string, nextStatus: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED') => {
    try {
      await apiRequest(`/admin/organizations/${orgId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setSuccess(`Organization status updated to ${nextStatus}`);
      loadOrganizations();
      loadStats();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to update organization status');
      setTimeout(() => setError(null), 5000);
    }
  };

  // Switch workspace as admin
  const handleSwitchToOrg = async (orgId: string) => {
    try {
      await switchOrg(orgId);
      await refreshOrgs();
      router.push('/');
    } catch (err: any) {
      setError(err?.message || 'Failed to switch workspace');
    }
  };

  // User status update
  const handleUpdateUserStatus = async (userId: string, nextStatus: 'ACTIVE' | 'SUSPENDED' | 'DISABLED') => {
    try {
      await apiRequest(`/admin/users/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setSuccess(`User status changed to ${nextStatus}`);
      loadUsers();
      loadStats();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to update user status');
      setTimeout(() => setError(null), 5000);
    }
  };

  // Toggle super admin
  const handleToggleSuperAdmin = async (u: AdminUser) => {
    const nextVal = !u.isSuperAdmin;
    const confirmMsg = nextVal
      ? `Promote ${u.email} to Platform Super Admin? They will gain unrestricted access to all tenants and system data.`
      : `Revoke Super Admin privileges from ${u.email}?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await apiRequest(`/admin/users/${u.id}/super-admin`, {
        method: 'PATCH',
        body: JSON.stringify({ isSuperAdmin: nextVal }),
      });
      setSuccess(`Super Admin privilege ${nextVal ? 'granted to' : 'revoked from'} ${u.email}`);
      loadUsers();
      loadStats();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to toggle Super Admin status');
      setTimeout(() => setError(null), 5000);
    }
  };

  // Submit password reset
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser) return;
    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    try {
      setResetSubmitting(true);
      await apiRequest(`/admin/users/${resettingUser.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword }),
      });
      setSuccess(`Password successfully reset for ${resettingUser.email}`);
      setResettingUser(null);
      setNewPassword('');
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to reset password');
    } finally {
      setResetSubmitting(false);
    }
  };

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(amt);
  };

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${Math.floor(seconds % 60)}s`;
  };

  return (
    <AppShell>
      <div style={{ maxWidth: '1380px', margin: '0 auto', paddingBottom: '3rem' }}>
        {/* Top Header Banner */}
        <div
          style={{
            backgroundColor: '#1E293B',
            color: '#FFFFFF',
            borderRadius: '12px',
            padding: '1.5rem 2rem',
            marginBottom: '1.5rem',
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Background subtle glow effect */}
          <div
            style={{
              position: 'absolute',
              top: '-40px',
              right: '-40px',
              width: '200px',
              height: '200px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(245, 158, 11, 0.25) 0%, rgba(245, 158, 11, 0) 70%)',
              pointerEvents: 'none',
            }}
          />

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
              <span
                style={{
                  backgroundColor: '#F59E0B',
                  color: '#78350F',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                }}
              >
                ⚡ Platform Control Center
              </span>
              <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                Signed in as <strong style={{ color: '#F1F5F9' }}>{user?.email}</strong> (Super Admin)
              </span>
            </div>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: '#F8FAFC' }}>
              Super Admin Console
            </h1>
            <p style={{ margin: '0.3rem 0 0 0', color: '#94A3B8', fontSize: '0.875rem' }}>
              Real-time multi-tenant management, user control, cross-organization audit trail, and engine telemetry.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.8rem',
                border: '1px solid rgba(255, 255, 255, 0.12)',
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981' }}></span>
              <span>Supabase DB: <strong style={{ color: '#10B981' }}>{stats?.system.dbLatencyMs ? `${stats.system.dbLatencyMs}ms` : 'Healthy'}</strong></span>
            </div>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              style={{
                backgroundColor: '#3B82F6',
                color: '#FFFFFF',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.825rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'background-color 0.2s',
              }}
            >
              <span style={{ display: 'inline-block', transform: refreshing ? 'rotate(360deg)' : 'none', transition: 'transform 0.5s' }}>🔄</span>
              <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Global Notifications */}
        {error && (
          <div
            style={{
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              color: '#991B1B',
              padding: '0.85rem 1.25rem',
              borderRadius: '8px',
              marginBottom: '1rem',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#991B1B', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
          </div>
        )}

        {success && (
          <div
            style={{
              backgroundColor: '#ECFDF5',
              border: '1px solid #A7F3D0',
              color: '#065F46',
              padding: '0.85rem 1.25rem',
              borderRadius: '8px',
              marginBottom: '1rem',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>✓ {success}</span>
            <button onClick={() => setSuccess(null)} style={{ background: 'none', border: 'none', color: '#065F46', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            borderBottom: '1px solid #E2E8F0',
            marginBottom: '1.5rem',
            overflowX: 'auto',
          }}
        >
          {[
            { id: 'overview', label: '📊 Overview & KPIs' },
            { id: 'organizations', label: `🏢 Organizations (${stats?.overview.totalOrganizations ?? 0})` },
            { id: 'users', label: `👥 Global Users (${stats?.overview.totalUsers ?? 0})` },
            { id: 'audit', label: '📜 Security Audit Trail' },
            { id: 'diagnostics', label: '🩺 System Diagnostics' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '0.75rem 1.25rem',
                  fontSize: '0.9rem',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#1E293B' : '#64748B',
                  borderBottom: isActive ? '2px solid #2563EB' : '2px solid transparent',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
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
              {/* Total Tenants */}
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '10px',
                  padding: '1.25rem',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                  Total Organizations
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.35rem' }}>
                  {stats?.overview.totalOrganizations ?? '—'}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#16A34A', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span>●</span>
                  <span>{stats?.overview.activeOrganizations ?? 0} Active</span>
                  {stats?.overview.suspendedOrganizations ? (
                    <span style={{ color: '#E11D48', marginLeft: '0.3rem' }}>• {stats.overview.suspendedOrganizations} Suspended</span>
                  ) : null}
                </div>
              </div>

              {/* Total Users */}
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '10px',
                  padding: '1.25rem',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                  Global Users
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.35rem' }}>
                  {stats?.overview.totalUsers ?? '—'}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                  <strong style={{ color: '#F59E0B' }}>{stats?.overview.superAdmins ?? 0}</strong> Super Admins • {stats?.overview.activeUsers ?? 0} Active
                </div>
              </div>

              {/* Total Journals */}
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '10px',
                  padding: '1.25rem',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                  Total Journal Entries
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.35rem' }}>
                  {stats?.overview.totalJournals ?? '—'}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                  Across all ledger organisations
                </div>
              </div>

              {/* Ledger Volume */}
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '10px',
                  padding: '1.25rem',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                  System Transacted Volume
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.35rem' }}>
                  {stats?.overview.totalTransactedVolume !== undefined ? formatCurrency(stats.overview.totalTransactedVolume) : '—'}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#16A34A' }}>
                  Sum of total posted ledger debits
                </div>
              </div>

              {/* Invoices */}
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '10px',
                  padding: '1.25rem',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                  Total Invoices
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.35rem' }}>
                  {stats?.overview.totalInvoices ?? '—'}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                  Invoices across all active clients
                </div>
              </div>
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
                    onClick={() => setActiveTab('organizations')}
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
                    onClick={() => setActiveTab('users')}
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
                    onClick={() => setActiveTab('audit')}
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
                    onClick={() => setActiveTab('diagnostics')}
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
                    onClick={() => setActiveTab('audit')}
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
        )}

        {/* TAB 2: ORGANIZATIONS */}
        {activeTab === 'organizations' && (
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              padding: '1.5rem',
            }}
          >
            {/* Header & Filters */}
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
                  Organizations Directory
                </h2>
                <p style={{ margin: '0.2rem 0 0 0', color: '#64748B', fontSize: '0.85rem' }}>
                  {orgTotal} total tenants registered on this LedgerPro deployment
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Search organization or country..."
                  value={orgSearch}
                  onChange={(e) => {
                    setOrgSearch(e.target.value);
                    setOrgPage(1);
                  }}
                  style={{
                    padding: '0.5rem 0.85rem',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.85rem',
                    minWidth: '240px',
                  }}
                />

                <select
                  value={orgStatus}
                  onChange={(e) => {
                    setOrgStatus(e.target.value);
                    setOrgPage(1);
                  }}
                  style={{
                    padding: '0.5rem 0.85rem',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.85rem',
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <option value="">All Statuses</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </div>
            </div>

            {/* Organizations Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569' }}>Organization</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569' }}>Country & Base</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569' }}>Created By</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569' }}>Members</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569' }}>Journals</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569' }}>Status</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orgLoading ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748B' }}>
                        Loading organizations...
                      </td>
                    </tr>
                  ) : orgs.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748B' }}>
                        No organizations found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    orgs.map((org) => {
                      const statusColor =
                        org.status === 'ACTIVE'
                          ? { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' }
                          : org.status === 'SUSPENDED'
                          ? { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' }
                          : { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' };

                      return (
                        <tr key={org.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <div style={{ fontWeight: 600, color: '#0F172A' }}>{org.name}</div>
                            {org.legalName && <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{org.legalName}</div>}
                            <div style={{ fontSize: '0.7rem', color: '#94A3B8', fontFamily: 'monospace' }}>ID: {org.id.slice(0, 8)}...</div>
                          </td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <span style={{ fontWeight: 500, color: '#334155' }}>{org.country}</span> • <span style={{ color: '#2563EB', fontWeight: 600 }}>{org.baseCurrency}</span>
                          </td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            {org.createdBy ? (
                              <div>
                                <div style={{ fontWeight: 500, color: '#334155' }}>{org.createdBy.firstName} {org.createdBy.lastName}</div>
                                <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{org.createdBy.email}</div>
                              </div>
                            ) : (
                              <span style={{ color: '#94A3B8' }}>System</span>
                            )}
                          </td>
                          <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#334155' }}>
                            {org._count.members}
                          </td>
                          <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#334155' }}>
                            {org._count.journals}
                          </td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <span
                              style={{
                                backgroundColor: statusColor.bg,
                                color: statusColor.text,
                                border: `1px solid ${statusColor.border}`,
                                padding: '0.2rem 0.55rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                              }}
                            >
                              {org.status}
                            </span>
                          </td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                              <button
                                onClick={() => handleSwitchToOrg(org.id)}
                                style={{
                                  backgroundColor: '#EFF6FF',
                                  color: '#2563EB',
                                  border: '1px solid #BFDBFE',
                                  padding: '0.35rem 0.65rem',
                                  borderRadius: '5px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                                title="Switch current session into this workspace"
                              >
                                Enter Workspace
                              </button>

                              {org.status === 'ACTIVE' ? (
                                <button
                                  onClick={() => handleUpdateOrgStatus(org.id, 'SUSPENDED')}
                                  style={{
                                    backgroundColor: '#FEF2F2',
                                    color: '#DC2626',
                                    border: '1px solid #FECACA',
                                    padding: '0.35rem 0.6rem',
                                    borderRadius: '5px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                  }}
                                  title="Suspend Organization"
                                >
                                  Suspend
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleUpdateOrgStatus(org.id, 'ACTIVE')}
                                  style={{
                                    backgroundColor: '#ECFDF5',
                                    color: '#059669',
                                    border: '1px solid #A7F3D0',
                                    padding: '0.35rem 0.6rem',
                                    borderRadius: '5px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                  }}
                                  title="Activate Organization"
                                >
                                  Activate
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

            {/* Pagination Controls */}
            {orgTotal > 15 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
                  Showing {(orgPage - 1) * 15 + 1} to {Math.min(orgPage * 15, orgTotal)} of {orgTotal}
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    disabled={orgPage <= 1}
                    onClick={() => setOrgPage((p) => Math.max(1, p - 1))}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '5px',
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      fontSize: '0.8rem',
                      cursor: orgPage <= 1 ? 'not-allowed' : 'pointer',
                      opacity: orgPage <= 1 ? 0.5 : 1,
                    }}
                  >
                    Previous
                  </button>
                  <button
                    disabled={orgPage * 15 >= orgTotal}
                    onClick={() => setOrgPage((p) => p + 1)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '5px',
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      fontSize: '0.8rem',
                      cursor: orgPage * 15 >= orgTotal ? 'not-allowed' : 'pointer',
                      opacity: orgPage * 15 >= orgTotal ? 0.5 : 1,
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: USERS */}
        {activeTab === 'users' && (
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              padding: '1.5rem',
            }}
          >
            {/* Header & Filters */}
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
                  Global Users Directory
                </h2>
                <p style={{ margin: '0.2rem 0 0 0', color: '#64748B', fontSize: '0.85rem' }}>
                  {userTotal} accounts registered across all tenants
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Search user name or email..."
                  value={userSearch}
                  onChange={(e) => {
                    setUserSearch(e.target.value);
                    setUserPage(1);
                  }}
                  style={{
                    padding: '0.5rem 0.85rem',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.85rem',
                    minWidth: '220px',
                  }}
                />

                <select
                  value={userStatus}
                  onChange={(e) => {
                    setUserStatus(e.target.value);
                    setUserPage(1);
                  }}
                  style={{
                    padding: '0.5rem 0.85rem',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.85rem',
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <option value="">All Statuses</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                  <option value="DISABLED">DISABLED</option>
                  <option value="INVITED">INVITED</option>
                </select>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={userSuperOnly}
                    onChange={(e) => {
                      setUserSuperOnly(e.target.checked);
                      setUserPage(1);
                    }}
                  />
                  <span>Super Admins Only</span>
                </label>
              </div>
            </div>

            {/* Users Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569' }}>User</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569' }}>Privilege</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569' }}>Status</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569' }}>Verified</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569' }}>Last Login</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {userLoading ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748B' }}>
                        Loading users...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748B' }}>
                        No users found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => {
                      const isCurrentUser = u.id === user?.id;
                      return (
                        <tr key={u.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <div style={{ fontWeight: 600, color: '#0F172A' }}>
                              {u.firstName || u.lastName ? `${u.firstName} ${u.lastName}` : 'No Name'}
                              {isCurrentUser && (
                                <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', color: '#2563EB', backgroundColor: '#EFF6FF', padding: '0.1rem 0.35rem', borderRadius: '3px' }}>
                                  You
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{u.email}</div>
                          </td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            {u.isSuperAdmin ? (
                              <span
                                style={{
                                  backgroundColor: '#FEF3C7',
                                  color: '#92400E',
                                  border: '1px solid #FCD34D',
                                  padding: '0.2rem 0.55rem',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                }}
                              >
                                ⚡ Super Admin
                              </span>
                            ) : (
                              <span style={{ color: '#94A3B8', fontSize: '0.8rem' }}>Standard User</span>
                            )}
                          </td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <span
                              style={{
                                backgroundColor: u.status === 'ACTIVE' ? '#ECFDF5' : '#FEF2F2',
                                color: u.status === 'ACTIVE' ? '#065F46' : '#991B1B',
                                border: `1px solid ${u.status === 'ACTIVE' ? '#A7F3D0' : '#FECACA'}`,
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                              }}
                            >
                              {u.status}
                            </span>
                          </td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            {u.emailVerified ? (
                              <span style={{ color: '#16A34A', fontWeight: 600 }}>✓ Verified</span>
                            ) : (
                              <span style={{ color: '#D97706' }}>Pending</span>
                            )}
                          </td>
                          <td style={{ padding: '0.85rem 1rem', color: '#64748B', fontSize: '0.8rem' }}>
                            {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
                          </td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                              {/* Reset Password Button */}
                              <button
                                onClick={() => {
                                  setResettingUser(u);
                                  setNewPassword('');
                                }}
                                style={{
                                  backgroundColor: '#F8FAFC',
                                  color: '#334155',
                                  border: '1px solid #CBD5E1',
                                  padding: '0.35rem 0.65rem',
                                  borderRadius: '5px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                Reset Pass
                              </button>

                              {/* Toggle Super Admin */}
                              {!isCurrentUser && (
                                <button
                                  onClick={() => handleToggleSuperAdmin(u)}
                                  style={{
                                    backgroundColor: u.isSuperAdmin ? '#FFFBEB' : '#F1F5F9',
                                    color: u.isSuperAdmin ? '#B45309' : '#475569',
                                    border: `1px solid ${u.isSuperAdmin ? '#FDE68A' : '#CBD5E1'}`,
                                    padding: '0.35rem 0.65rem',
                                    borderRadius: '5px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                  }}
                                  title={u.isSuperAdmin ? 'Demote from Super Admin' : 'Make Super Admin'}
                                >
                                  {u.isSuperAdmin ? 'Revoke Super' : 'Grant Super'}
                                </button>
                              )}

                              {/* Toggle Active / Suspended */}
                              {!isCurrentUser && (
                                <button
                                  onClick={() => handleUpdateUserStatus(u.id, u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE')}
                                  style={{
                                    backgroundColor: u.status === 'ACTIVE' ? '#FEF2F2' : '#ECFDF5',
                                    color: u.status === 'ACTIVE' ? '#DC2626' : '#059669',
                                    border: `1px solid ${u.status === 'ACTIVE' ? '#FECACA' : '#A7F3D0'}`,
                                    padding: '0.35rem 0.65rem',
                                    borderRadius: '5px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                  }}
                                >
                                  {u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
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

            {/* Pagination Controls */}
            {userTotal > 15 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
                  Showing {(userPage - 1) * 15 + 1} to {Math.min(userPage * 15, userTotal)} of {userTotal}
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    disabled={userPage <= 1}
                    onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '5px',
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      fontSize: '0.8rem',
                      cursor: userPage <= 1 ? 'not-allowed' : 'pointer',
                      opacity: userPage <= 1 ? 0.5 : 1,
                    }}
                  >
                    Previous
                  </button>
                  <button
                    disabled={userPage * 15 >= userTotal}
                    onClick={() => setUserPage((p) => p + 1)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '5px',
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      fontSize: '0.8rem',
                      cursor: userPage * 15 >= userTotal ? 'not-allowed' : 'pointer',
                      opacity: userPage * 15 >= userTotal ? 0.5 : 1,
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: AUDIT TRAIL */}
        {activeTab === 'audit' && (
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
                  onChange={(e) => {
                    setAuditEventType(e.target.value);
                    setAuditPage(1);
                  }}
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
                    onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
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
                    onClick={() => setAuditPage((p) => p + 1)}
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
        )}

        {/* TAB 5: DIAGNOSTICS */}
        {activeTab === 'diagnostics' && (
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
                  <span style={{ color: '#16A34A', fontWeight: 600 }}>● {stats?.system.dbStatus.toUpperCase()}</span>
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
                  <a href="https://fi-46xw.onrender.com/health" target="_blank" rel="noreferrer" style={{ color: '#2563EB', textDecoration: 'none', fontWeight: 500 }}>
                    fi-46xw.onrender.com ↗
                  </a>
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
                  <div style={{ fontWeight: 600, color: '#0F172A', marginBottom: '0.25rem' }}>Strict JWT Token Expiry</div>
                  <div style={{ color: '#64748B', fontSize: '0.8rem' }}>15-minute rolling access tokens + cryptographically hashed refresh tokens in PostgreSQL sessions table.</div>
                </div>
                <div style={{ padding: '0.75rem', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontWeight: 600, color: '#0F172A', marginBottom: '0.25rem' }}>SuperAdminGuard Protection</div>
                  <div style={{ color: '#64748B', fontSize: '0.8rem' }}>All admin routes protected by database-verified superadmin authorization with automatic demotion prevention.</div>
                </div>
                <div style={{ padding: '0.75rem', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontWeight: 600, color: '#0F172A', marginBottom: '0.25rem' }}>Immutable Audit Logging</div>
                  <div style={{ color: '#64748B', fontSize: '0.8rem' }}>Every administrative privilege modification, tenant status change, and password reset is logged with IP and actor ID.</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Password Reset Modal */}
        {resettingUser && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100,
              padding: '1rem',
            }}
          >
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                width: '100%',
                maxWidth: '460px',
                padding: '1.75rem',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              }}
            >
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0F172A', margin: '0 0 0.5rem 0' }}>
                Force Password Reset
              </h3>
              <p style={{ color: '#64748B', fontSize: '0.85rem', margin: '0 0 1.25rem 0' }}>
                Resetting password for user <strong style={{ color: '#0F172A' }}>{resettingUser.email}</strong>. This will revoke existing active sessions.
              </p>

              <form onSubmit={handleResetPassword}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                    New Password (min 8 characters)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new secure password..."
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.85rem',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.9rem',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setResettingUser(null);
                      setNewPassword('');
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#FFFFFF',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: '#475569',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetSubmitting}
                    style={{
                      padding: '0.5rem 1.25rem',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: '#2563EB',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: '#FFFFFF',
                      cursor: resetSubmitting ? 'not-allowed' : 'pointer',
                      opacity: resetSubmitting ? 0.7 : 1,
                    }}
                  >
                    {resetSubmitting ? 'Updating...' : 'Set Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
