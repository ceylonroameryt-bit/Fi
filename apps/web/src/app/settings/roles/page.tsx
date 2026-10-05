'use client';

import React, { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';

interface PermissionDef {
  code: string;
  description: string;
  category: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  systemKey: string | null;
  isSystem: boolean;
  permissions?: Array<{ code: string } | string>;
}

export default function RolesSettingsPage() {
  const { activeOrg } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [allPermissions, setAllPermissions] = useState<PermissionDef[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRolesAndPermissions() {
      if (!activeOrg) return;
      try {
        setLoading(true);
        const [rolesRes, permsRes] = await Promise.all([
          apiRequest<Role[]>('/roles').catch(() => []),
          apiRequest<PermissionDef[]>('/roles/permissions').catch(() => []),
        ]);

        const roleList: Role[] = Array.isArray(rolesRes) ? rolesRes : [];
        setRoles(roleList);
        if (roleList.length > 0 && !selectedRoleId) {
          setSelectedRoleId(roleList[0].id);
        }

        const defaultPermissions: PermissionDef[] = [
          { code: 'organization.view', description: 'View organization details and profile', category: 'Organisation' },
          { code: 'organization.edit', description: 'Modify legal details, registration and base currency settings', category: 'Organisation' },
          { code: 'organization.archive', description: 'Decommission or archive organisation entity', category: 'Organisation' },

          { code: 'users.view', description: 'View team members and role assignments', category: 'Users' },
          { code: 'users.invite', description: 'Invite new members to the organisation', category: 'Users' },
          { code: 'users.manage_roles', description: 'Promote or modify member permissions', category: 'Users' },
          { code: 'users.remove', description: 'Revoke organisation access from a user', category: 'Users' },

          { code: 'account.view', description: 'View nominal accounts and account balances', category: 'Accounts' },
          { code: 'account.create', description: 'Add new nominal accounts to the chart of accounts', category: 'Accounts' },
          { code: 'account.edit', description: 'Edit account descriptions and manual posting flags', category: 'Accounts' },
          { code: 'account.archive', description: 'Archive unused nominal accounts', category: 'Accounts' },

          { code: 'financial_year.view', description: 'View fiscal calendar years', category: 'Financial Years' },
          { code: 'financial_year.create', description: 'Initialize a new financial year with monthly periods', category: 'Financial Years' },
          { code: 'financial_year.close', description: 'Perform year-end closure and retained earnings sweep', category: 'Financial Years' },

          { code: 'period.view', description: 'Inspect period calendar and active status', category: 'Periods' },
          { code: 'period.soft_lock', description: 'Soft-lock period for review, preventing new postings', category: 'Periods' },
          { code: 'period.hard_lock', description: 'Permanently close period from any further modifications', category: 'Periods' },
          { code: 'period.unlock', description: 'Re-open soft-locked periods for authorized corrections', category: 'Periods' },

          { code: 'journal.view', description: 'View journal listings and journal line items', category: 'Journals' },
          { code: 'journal.create', description: 'Draft new double-entry manual journals', category: 'Journals' },
          { code: 'journal.edit_draft', description: 'Modify lines and memos on unvalidated drafts', category: 'Journals' },
          { code: 'journal.delete_draft', description: 'Delete draft journals before ledger validation', category: 'Journals' },
          { code: 'journal.validate', description: 'Trigger double-entry accounting engine validation', category: 'Journals' },
          { code: 'journal.post', description: 'Post validated journals to general ledger (Next Phase)', category: 'Journals' },

          { code: 'audit.view', description: 'Access immutable chronological audit event log', category: 'Audit' },
          { code: 'audit.export', description: 'Export tamper-evident audit trail for external auditors', category: 'Audit' },
        ];

        const permList: PermissionDef[] = (Array.isArray(permsRes) && permsRes.length > 0) ? permsRes : defaultPermissions;
        setAllPermissions(permList);
      } catch (err: any) {
        setError(err.message || 'Failed to load roles and permissions');
      } finally {
        setLoading(false);
      }
    }

    loadRolesAndPermissions();
  }, [activeOrg]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId) || roles[0];

  // Helper to extract granted permission codes
  const grantedCodes = new Set<string>();
  if (selectedRole?.permissions) {
    selectedRole.permissions.forEach((p) => {
      if (typeof p === 'string') grantedCodes.add(p);
      else if (p && typeof p.code === 'string') grantedCodes.add(p.code);
    });
  }

  // Fallback defaults if API returned summary without expanded permissions
  if (grantedCodes.size === 0 && selectedRole?.systemKey) {
    if (selectedRole.systemKey === 'OWNER') {
      allPermissions.forEach((p) => grantedCodes.add(p.code));
    } else if (selectedRole.systemKey === 'ADMINISTRATOR') {
      allPermissions.forEach((p) => {
        if (p.code !== 'organization.archive') grantedCodes.add(p.code);
      });
    } else if (selectedRole.systemKey === 'ACCOUNTANT') {
      [
        'organization.view',
        'users.view',
        'roles.view',
        'account.view',
        'account.create',
        'account.edit',
        'account.archive',
        'financial_year.view',
        'financial_year.create',
        'financial_year.edit',
        'period.view',
        'period.create',
        'period.lock',
        'period.unlock',
        'journal.view',
        'journal.create',
        'journal.edit_draft',
        'journal.delete_draft',
        'journal.validate',
        'audit.view',
      ].forEach((c) => grantedCodes.add(c));
    } else if (selectedRole.systemKey === 'BOOKKEEPER') {
      [
        'organization.view',
        'account.view',
        'financial_year.view',
        'period.view',
        'journal.view',
        'journal.create',
        'journal.edit_draft',
        'journal.delete_draft',
        'journal.validate',
      ].forEach((c) => grantedCodes.add(c));
    } else if (selectedRole.systemKey === 'VIEWER') {
      [
        'organization.view',
        'account.view',
        'financial_year.view',
        'period.view',
        'journal.view',
      ].forEach((c) => grantedCodes.add(c));
    }
  }

  // Group permissions by category
  const categories = Array.from(new Set(allPermissions.map((p) => p.category || 'General')));

  const getRoleBadgeClass = (key?: string | null) => {
    const k = (key || '').toUpperCase();
    if (k.includes('OWNER')) return 'badge-owner';
    if (k.includes('ADMIN')) return 'badge-admin';
    if (k.includes('ACCOUNTANT')) return 'badge-accountant';
    if (k.includes('BOOKKEEPER')) return 'badge-bookkeeper';
    return 'badge-viewer';
  };

  return (
    <AppShell>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Roles & Permissions</h1>
          <p className="page-subtitle">
            Configure access tiers and role-based permissions matrix for <strong>{activeOrg?.name}</strong>
          </p>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Two Column Layout (Left: Roles List, Right: Permissions Matrix) */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0, 1fr)', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left Column: Roles */}
        <div className="card">
          <div className="card-header" style={{ padding: '0.85rem 1.15rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#172033' }}>Available Roles</span>
            <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>{roles.length} tiers</span>
          </div>
          <div className="card-body" style={{ padding: '0.5rem' }}>
            {loading ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: '#6B7280', fontSize: '0.8rem' }}>
                Loading roles...
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {roles.map((r) => {
                  const isSelected = r.id === selectedRole?.id;
                  const badgeClass = getRoleBadgeClass(r.systemKey || r.name);
                  return (
                    <div
                      key={r.id}
                      onClick={() => setSelectedRoleId(r.id)}
                      style={{
                        padding: '0.85rem',
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
                          {r.name}
                        </span>
                        <span className={`badge ${badgeClass}`}>{r.systemKey ? 'System' : 'Custom'}</span>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: '#6B7280', margin: 0, lineHeight: 1.3 }}>
                        {r.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Permissions Matrix */}
        {selectedRole ? (
          <div className="card">
            <div className="card-header" style={{ padding: '1rem 1.25rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#172033' }}>
                    {selectedRole.name} Permissions
                  </h2>
                  <span className={`badge ${getRoleBadgeClass(selectedRole.systemKey || selectedRole.name)}`}>
                    {selectedRole.name}
                  </span>
                </div>
                <p style={{ fontSize: '0.785rem', color: '#6B7280', marginTop: '0.2rem' }}>
                  {selectedRole.description} • {grantedCodes.size} permissions granted
                </p>
              </div>
            </div>

            <div className="card-body" style={{ padding: '1.25rem' }}>
              {categories.map((cat) => {
                const permsInCategory = allPermissions.filter((p) => (p.category || 'General') === cat);

                return (
                  <div key={cat} style={{ marginBottom: '1.5rem' }}>
                    <div
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        color: '#172033',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        marginBottom: '0.65rem',
                        paddingBottom: '0.35rem',
                        borderBottom: '1px solid #E6EAF0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>{cat}</span>
                      <span style={{ fontSize: '0.7rem', color: '#6B7280', fontWeight: 500 }}>
                        {permsInCategory.filter((p) => grantedCodes.has(p.code)).length} / {permsInCategory.length} Granted
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.65rem' }}>
                      {permsInCategory.map((perm) => {
                        const isGranted = grantedCodes.has(perm.code);
                        const isFuture = perm.code === 'journal.post' || perm.code === 'journal.reverse';

                        return (
                          <div
                            key={perm.code}
                            style={{
                              padding: '0.6rem 0.75rem',
                              borderRadius: '6px',
                              border: '1px solid',
                              borderColor: isGranted ? '#A7F3D0' : '#E6EAF0',
                              backgroundColor: isGranted ? '#ECFDF5' : '#FAFCFE',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '0.65rem',
                            }}
                          >
                            <span
                              style={{
                                width: '18px',
                                height: '18px',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                backgroundColor: isGranted ? '#16A56A' : '#E5E7EB',
                                color: isGranted ? '#FFFFFF' : '#9CA3AF',
                                flexShrink: 0,
                                marginTop: '0.1rem',
                              }}
                            >
                              {isGranted ? '✓' : '—'}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#172033' }}>
                                  {perm.code}
                                </span>
                                {isFuture && (
                                  <span style={{ fontSize: '0.65rem', backgroundColor: '#F3F4F6', color: '#6B7280', padding: '0.05rem 0.35rem', borderRadius: '4px' }}>
                                    Next Phase
                                  </span>
                                )}
                              </div>
                              <p style={{ fontSize: '0.725rem', color: '#6B7280', margin: '0.15rem 0 0 0', lineHeight: 1.3 }}>
                                {perm.description}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center', padding: '3rem', color: '#6B7280' }}>
              Select a role from the left to view permissions.
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
