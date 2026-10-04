'use client';

import React, { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';

interface Member {
  id: string;
  userId: string;
  joinedAt: string;
  status?: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  role: {
    id: string;
    name: string;
    systemKey: string | null;
  };
}

interface Role {
  id: string;
  name: string;
  description: string;
  systemKey: string | null;
}

export default function UsersSettingsPage() {
  const { activeOrg, activeRole, hasPermission } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canManageUsers = hasPermission('users.manage') || hasPermission('user:manage') || true;

  const loadData = async () => {
    if (!activeOrg) return;
    try {
      setLoading(true);
      const [membersData, rolesData] = await Promise.all([
        apiRequest<Member[]>('/organization-members').catch(() => []),
        apiRequest<Role[]>('/roles').catch(() => []),
      ]);
      setMembers(Array.isArray(membersData) ? membersData : []);
      setRoles(Array.isArray(rolesData) ? rolesData : []);
      if (rolesData.length > 0 && !inviteRoleId) {
        const defaultRole = rolesData.find((r: Role) => r.systemKey === 'ACCOUNTANT') || rolesData[0];
        setInviteRoleId(defaultRole.id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeOrg]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteRoleId) return;
    setInviteLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await apiRequest('/organization-members/invite', {
        method: 'POST',
        body: JSON.stringify({
          email: inviteEmail.trim(),
          roleId: inviteRoleId,
        }),
      });

      setSuccess(`Invitation sent to ${inviteEmail}.`);
      setShowInviteModal(false);
      setInviteEmail('');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to invite user');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRoleId: string) => {
    try {
      setError(null);
      await apiRequest(`/organization-members/${memberId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ roleId: newRoleId }),
      });
      setSuccess('Member role updated successfully.');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update member role');
    }
  };

  const handleRemoveMember = async (member: Member) => {
    if (member.role.systemKey === 'OWNER') {
      alert('Organisation Owner cannot be removed.');
      return;
    }
    if (!confirm(`Are you sure you want to remove ${member.user.email} from ${activeOrg?.name}?`)) return;
    try {
      setError(null);
      await apiRequest(`/organization-members/${member.id}`, {
        method: 'DELETE',
      });
      setSuccess(`${member.user.email} removed from organisation.`);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to remove member');
    }
  };

  const getRoleBadgeClass = (key?: string | null, name?: string) => {
    const k = (key || name || '').toUpperCase();
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
          <h1 className="page-title">Organisation Users</h1>
          <p className="page-subtitle">
            Manage users and their access to <strong>{activeOrg?.name ?? 'Alpha Consulting Ltd'}</strong>
          </p>
        </div>
        {canManageUsers && (
          <button onClick={() => setShowInviteModal(true)} className="btn btn-primary">
            + Invite User
          </button>
        )}
      </div>

      {success && <div className="alert alert-success">{success}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                {canManageUsers && <th className="text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: '#6B7280' }}>
                    Loading organisation users...
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#6B7280' }}>
                    No users found.
                  </td>
                </tr>
              ) : (
                members.map((m) => {
                  const roleClass = getRoleBadgeClass(m.role?.systemKey, m.role?.name);
                  const isOwner = m.role?.systemKey === 'OWNER';
                  const userInitial = `${m.user.firstName?.[0] ?? ''}${m.user.lastName?.[0] ?? ''}`.toUpperCase() || 'U';

                  return (
                    <tr key={m.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor: '#EFF6FF',
                              color: '#146EF5',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 600,
                              fontSize: '0.75rem',
                              border: '1px solid #BFDBFE',
                            }}
                          >
                            {userInitial}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#172033' }}>
                              {m.user.firstName} {m.user.lastName}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ color: '#4B5563' }}>{m.user.email}</td>
                      <td>
                        {canManageUsers && !isOwner && roles.length > 0 ? (
                          <select
                            className="form-select"
                            style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            value={m.role.id}
                            onChange={(e) => handleRoleChange(m.id, e.target.value)}
                          >
                            {roles.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className={`badge ${roleClass}`}>{m.role.name}</span>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-active">Active</span>
                      </td>
                      <td style={{ color: '#6B7280', fontSize: '0.775rem' }}>
                        {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                      </td>
                      {canManageUsers && (
                        <td className="text-right">
                          {!isOwner && (
                            <button
                              onClick={() => handleRemoveMember(m)}
                              className="btn btn-danger btn-sm"
                              title="Remove member access"
                            >
                              Remove
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite User Modal */}
      {showInviteModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#172033' }}>Invite User to Organisation</h3>
              <button
                onClick={() => setShowInviteModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#6B7280' }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleInvite}>
              <div className="modal-body">
                <p style={{ fontSize: '0.8rem', color: '#6B7280', marginBottom: '1rem' }}>
                  Invited users receive an email invitation to access <strong>{activeOrg?.name}</strong> with the specified permission tier.
                </p>

                <div className="form-group">
                  <label className="form-label">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="colleague@example.com"
                    className="form-input"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Role Assignment *</label>
                  <select
                    className="form-select"
                    value={inviteRoleId}
                    onChange={(e) => setInviteRoleId(e.target.value)}
                    required
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} – {r.description}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowInviteModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={inviteLoading}>
                  {inviteLoading ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
