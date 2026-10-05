'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';
import { LayoutDashboard, Building2, Users, ScrollText, Activity, RefreshCw, Shield } from 'lucide-react';

import { AdminOverview, type PlatformStats } from '@/components/admin/AdminOverview';
import { OrganisationTable, type AdminOrg } from '@/components/admin/OrganisationTable';
import { UserTable, type AdminUser } from '@/components/admin/UserTable';
import { AuditTable, type AuditLogItem } from '@/components/admin/AuditTable';
import { SystemDiagnostics } from '@/components/admin/SystemDiagnostics';

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

  // Users state
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userSearch, setUserSearch] = useState('');
  const [userStatus, setUserStatus] = useState<string>('');
  const [userSuperOnly, setUserSuperOnly] = useState(false);
  const [userPage, setUserPage] = useState(1);
  const [userLoading, setUserLoading] = useState(false);

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
        pageSize: '15',
        ...(orgSearch ? { search: orgSearch } : {}),
        ...(orgStatus ? { status: orgStatus } : {}),
      });
      const res = await apiRequest<{ items: AdminOrg[]; total: number }>(`/admin/organizations?${query}`);
      setOrgs(res.items || []);
      setOrgTotal(res.total || 0);
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
        pageSize: '15',
        ...(userSearch ? { search: userSearch } : {}),
        ...(userStatus ? { status: userStatus } : {}),
        ...(userSuperOnly ? { superAdminOnly: 'true' } : {}),
      });
      const res = await apiRequest<{ items: AdminUser[]; total: number }>(`/admin/users?${query}`);
      setUsers(res.items || []);
      setUserTotal(res.total || 0);
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
        pageSize: '20',
        ...(auditEventType ? { search: auditEventType } : {}),
      });
      const res = await apiRequest<{ items: AuditLogItem[]; total: number }>(`/admin/audit-logs?${query}`);
      setAuditLogs(res.items || []);
      setAuditTotal(res.total || 0);
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
  const handleResetPassword = async (userId: string, newPass: string) => {
    await apiRequest(`/admin/users/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword: newPass }),
    });
    setSuccess('Password successfully reset. Active sessions revoked.');
    setTimeout(() => setSuccess(null), 4000);
  };

  const tabs = [
    { id: 'overview', label: 'Overview & KPIs', icon: LayoutDashboard },
    { id: 'organizations', label: `Organizations (${stats?.overview?.totalOrganizations ?? orgTotal ?? 0})`, icon: Building2 },
    { id: 'users', label: `Global Users (${stats?.overview?.totalUsers ?? userTotal ?? 0})`, icon: Users },
    { id: 'audit', label: 'Security Audit Trail', icon: ScrollText },
    { id: 'diagnostics', label: 'System Diagnostics', icon: Activity },
  ] as const;

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
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <Shield size={12} />
                Platform Control Center
              </span>
              <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                Signed in as <strong style={{ color: '#F1F5F9' }}>{user?.email}</strong> (Super Admin)
              </span>
            </div>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: '#FFFFFF' }}>
              Warp Ledger Platform Governance
            </h1>
            <p style={{ margin: '0.35rem 0 0 0', color: '#94A3B8', fontSize: '0.875rem' }}>
              Multi-tenant surveillance, global identity management, and cross-organization audit trail
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              style={{
                backgroundColor: '#334155',
                color: '#F8FAFC',
                border: '1px solid #475569',
                borderRadius: '6px',
                padding: '0.5rem 1rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: refreshing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.15s ease',
              }}
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh Telemetry'}</span>
            </button>
          </div>
        </div>

        {/* Global Notifications / Alerts */}
        {error && (
          <div
            style={{
              backgroundColor: '#FEF2F2',
              color: '#991B1B',
              border: '1px solid #FECACA',
              padding: '0.85rem 1.25rem',
              borderRadius: '8px',
              marginBottom: '1.25rem',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{error}</span>
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#991B1B', cursor: 'pointer', fontWeight: 700 }}>
              &times;
            </button>
          </div>
        )}

        {success && (
          <div
            style={{
              backgroundColor: '#ECFDF5',
              color: '#065F46',
              border: '1px solid #A7F3D0',
              padding: '0.85rem 1.25rem',
              borderRadius: '8px',
              marginBottom: '1.25rem',
              fontSize: '0.875rem',
            }}
          >
            {success}
          </div>
        )}

        {/* Tabs Bar */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            borderBottom: '1px solid #CBD5E1',
            marginBottom: '1.5rem',
            overflowX: 'auto',
          }}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
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
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.15s ease',
                }}
              >
                <TabIcon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Contents */}
        {activeTab === 'overview' && (
          <AdminOverview stats={stats} onNavigateTab={setActiveTab} />
        )}

        {activeTab === 'organizations' && (
          <OrganisationTable
            orgs={orgs}
            orgTotal={orgTotal}
            orgSearch={orgSearch}
            orgStatus={orgStatus}
            orgPage={orgPage}
            orgLoading={orgLoading}
            onSearchChange={(search) => { setOrgSearch(search); setOrgPage(1); }}
            onStatusChange={(status) => { setOrgStatus(status); setOrgPage(1); }}
            onPageChange={setOrgPage}
            onSwitchToOrg={handleSwitchToOrg}
            onUpdateStatus={handleUpdateOrgStatus}
          />
        )}

        {activeTab === 'users' && (
          <UserTable
            users={users}
            userTotal={userTotal}
            userSearch={userSearch}
            userStatus={userStatus}
            userSuperOnly={userSuperOnly}
            userPage={userPage}
            userLoading={userLoading}
            currentUserId={user?.id}
            onSearchChange={(search) => { setUserSearch(search); setUserPage(1); }}
            onStatusChange={(status) => { setUserStatus(status); setUserPage(1); }}
            onSuperOnlyChange={(superOnly) => { setUserSuperOnly(superOnly); setUserPage(1); }}
            onPageChange={setUserPage}
            onToggleSuperAdmin={handleToggleSuperAdmin}
            onUpdateStatus={handleUpdateUserStatus}
            onResetPassword={handleResetPassword}
          />
        )}

        {activeTab === 'audit' && (
          <AuditTable
            auditLogs={auditLogs}
            auditTotal={auditTotal}
            auditEventType={auditEventType}
            auditPage={auditPage}
            auditLoading={auditLoading}
            onEventTypeChange={(type) => { setAuditEventType(type); setAuditPage(1); }}
            onPageChange={setAuditPage}
          />
        )}

        {activeTab === 'diagnostics' && (
          <SystemDiagnostics stats={stats} />
        )}
      </div>
    </AppShell>
  );
}
