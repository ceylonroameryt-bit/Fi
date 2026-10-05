'use client';

import React from 'react';

export interface AdminOrg {
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

interface OrganisationTableProps {
  orgs: AdminOrg[];
  orgTotal: number;
  orgSearch: string;
  orgStatus: string;
  orgPage: number;
  orgLoading: boolean;
  onSearchChange: (search: string) => void;
  onStatusChange: (status: string) => void;
  onPageChange: (page: number) => void;
  onSwitchToOrg: (orgId: string) => void;
  onUpdateStatus: (orgId: string, status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED') => void;
}

export function OrganisationTable({
  orgs,
  orgTotal,
  orgSearch,
  orgStatus,
  orgPage,
  orgLoading,
  onSearchChange,
  onStatusChange,
  onPageChange,
  onSwitchToOrg,
  onUpdateStatus,
}: OrganisationTableProps) {
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
            {orgTotal} total tenants registered on this Ledgerline deployment
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search organization or country..."
            value={orgSearch}
            onChange={(e) => onSearchChange(e.target.value)}
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
            onChange={(e) => onStatusChange(e.target.value)}
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
                          onClick={() => onSwitchToOrg(org.id)}
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
                            onClick={() => onUpdateStatus(org.id, 'SUSPENDED')}
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
                            onClick={() => onUpdateStatus(org.id, 'ACTIVE')}
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
              onClick={() => onPageChange(Math.max(1, orgPage - 1))}
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
              onClick={() => onPageChange(orgPage + 1)}
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
  );
}
