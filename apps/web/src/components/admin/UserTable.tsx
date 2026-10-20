'use client';

import React, { useState } from 'react';

export interface AdminUser {
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

interface UserTableProps {
  users: AdminUser[];
  userTotal: number;
  userSearch: string;
  userStatus: string;
  userSuperOnly: boolean;
  userPage: number;
  userLoading: boolean;
  currentUserId?: string;
  onSearchChange: (search: string) => void;
  onStatusChange: (status: string) => void;
  onSuperOnlyChange: (superOnly: boolean) => void;
  onPageChange: (page: number) => void;
  onToggleSuperAdmin: (user: AdminUser) => void;
  onUpdateStatus: (userId: string, status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED') => void;
  onResetPassword: (userId: string, newPass: string) => Promise<void>;
}

export function UserTable({
  users,
  userTotal,
  userSearch,
  userStatus,
  userSuperOnly,
  userPage,
  userLoading,
  currentUserId,
  onSearchChange,
  onStatusChange,
  onSuperOnlyChange,
  onPageChange,
  onToggleSuperAdmin,
  onUpdateStatus,
  onResetPassword,
}: UserTableProps) {
  const [resettingUser, setResettingUser] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser) return;
    if (!newPassword || newPassword.length < 8) {
      setModalError('Password must be at least 8 characters long');
      return;
    }

    try {
      setResetSubmitting(true);
      setModalError(null);
      await onResetPassword(resettingUser.id, newPassword);
      setResettingUser(null);
      setNewPassword('');
    } catch (err: any) {
      setModalError(err?.message || 'Failed to reset password');
    } finally {
      setResetSubmitting(false);
    }
  };

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '10px',
        border: '1px solid var(--border-subtle)',
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
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
            Global Users Directory
          </h2>
          <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {userTotal} accounts registered across all tenants
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search user name or email..."
            value={userSearch}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              padding: '0.5rem 0.85rem',
              borderRadius: '6px',
              border: '1px solid var(--border-strong)',
              fontSize: '0.85rem',
              minWidth: '220px',
            }}
          />

          <select
            value={userStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            style={{
              padding: '0.5rem 0.85rem',
              borderRadius: '6px',
              border: '1px solid var(--border-strong)',
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

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--ink-2)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={userSuperOnly}
              onChange={(e) => onSuperOnlyChange(e.target.checked)}
            />
            <span>Super Admins Only</span>
          </label>
        </div>
      </div>

      {/* Users Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-app)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--ink-2)' }}>User</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--ink-2)' }}>Privilege</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--ink-2)' }}>Status</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--ink-2)' }}>Verified</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--ink-2)' }}>Last Login</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--ink-2)', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {userLoading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                  Loading users...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                  No users found matching criteria.
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const isCurrentUser = u.id === currentUserId;
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--bg-soft)' }}>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                        {u.firstName || u.lastName ? `${u.firstName} ${u.lastName}` : 'No Name'}
                        {isCurrentUser && (
                          <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', color: 'var(--primary)', backgroundColor: 'var(--info-bg)', padding: '0.1rem 0.35rem', borderRadius: '3px' }}>
                            You
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.email}</div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      {u.isSuperAdmin ? (
                        <span
                          style={{
                            backgroundColor: 'var(--warning-bg)',
                            color: 'var(--warning-text)',
                            border: '1px solid #FCD34D',
                            padding: '0.2rem 0.55rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                          }}
                        >
                          Super Admin
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Standard User</span>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span
                        style={{
                          backgroundColor: u.status === 'ACTIVE' ? 'var(--success-bg)' : 'var(--danger-bg)',
                          color: u.status === 'ACTIVE' ? 'var(--success-text)' : 'var(--danger-text)',
                          border: `1px solid ${u.status === 'ACTIVE' ? 'var(--success-border)' : 'var(--danger-border)'}`,
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
                        <span style={{ color: 'var(--success-text)', fontWeight: 600 }}>✓ Verified</span>
                      ) : (
                        <span style={{ color: 'var(--warning-text)' }}>Pending</span>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button
                          onClick={() => {
                            setResettingUser(u);
                            setNewPassword('');
                            setModalError(null);
                          }}
                          style={{
                            backgroundColor: 'var(--bg-app)',
                            color: 'var(--ink-2)',
                            border: '1px solid var(--border-strong)',
                            padding: '0.35rem 0.65rem',
                            borderRadius: '5px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Reset Pass
                        </button>

                        {!isCurrentUser && (
                          <button
                            onClick={() => onToggleSuperAdmin(u)}
                            style={{
                              backgroundColor: u.isSuperAdmin ? 'var(--warning-bg)' : 'var(--bg-soft)',
                              color: u.isSuperAdmin ? 'var(--warning-text)' : 'var(--ink-2)',
                              border: `1px solid ${u.isSuperAdmin ? 'var(--warning-border)' : 'var(--border-strong)'}`,
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

                        {!isCurrentUser && (
                          <button
                            onClick={() => onUpdateStatus(u.id, u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE')}
                            style={{
                              backgroundColor: u.status === 'ACTIVE' ? 'var(--danger-bg)' : 'var(--success-bg)',
                              color: u.status === 'ACTIVE' ? 'var(--danger)' : 'var(--success-text)',
                              border: `1px solid ${u.status === 'ACTIVE' ? 'var(--danger-border)' : 'var(--success-border)'}`,
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Showing {(userPage - 1) * 15 + 1} to {Math.min(userPage * 15, userTotal)} of {userTotal}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              disabled={userPage <= 1}
              onClick={() => onPageChange(Math.max(1, userPage - 1))}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '5px',
                border: '1px solid var(--border-strong)',
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
              onClick={() => onPageChange(userPage + 1)}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '5px',
                border: '1px solid var(--border-strong)',
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
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 0.5rem 0' }}>
              Force Password Reset
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 1.25rem 0' }}>
              Resetting password for user <strong style={{ color: 'var(--text-main)' }}>{resettingUser.email}</strong>. This will revoke existing active sessions.
            </p>

            {modalError && (
              <div style={{ color: 'var(--danger)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '1rem' }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleModalSubmit}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink-2)', marginBottom: '0.4rem' }}>
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
                    border: '1px solid var(--border-strong)',
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
                    setModalError(null);
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-strong)',
                    backgroundColor: '#FFFFFF',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: 'var(--ink-2)',
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
                    backgroundColor: 'var(--primary)',
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
  );
}
