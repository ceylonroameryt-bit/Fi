'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useAuth, UserOrgMembership } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';

export default function OrganizationsPage() {
  const { activeOrg, switchOrg, refreshOrgs } = useAuth();
  const [organizations, setOrganizations] = useState<UserOrgMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchOrgs() {
      try {
        setLoading(true);
        const data = await apiRequest<UserOrgMembership[]>('/organizations');
        setOrganizations(data);
      } catch (err) {
        console.error('Failed to fetch organisations', err);
      } finally {
        setLoading(false);
      }
    }
    fetchOrgs();
  }, []);

  const handleSwitch = async (orgId: string) => {
    await switchOrg(orgId);
    await refreshOrgs();
    router.push('/');
  };

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1 className="page-title">Organisations</h1>
          <p className="page-subtitle">Manage organisations and multi-tenant accounting entities</p>
        </div>
        <Link href="/organizations/new" className="btn btn-primary">
          + Create New Organisation
        </Link>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Organisation Name</th>
                <th>Legal Name</th>
                <th>Country</th>
                <th>Currency</th>
                <th>Your Role</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    Loading organisations...
                  </td>
                </tr>
              ) : organizations.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    No organisations found. Create your first organisation above.
                  </td>
                </tr>
              ) : (
                organizations.map((m) => {
                  const isActive = activeOrg?.id === m.organization.id;
                  return (
                    <tr key={m.organization.id} style={{ backgroundColor: isActive ? '#f8fafc' : undefined }}>
                      <td>
                        <strong style={{ color: '#0f172a' }}>{m.organization.name}</strong>
                        {isActive && (
                          <span className="badge badge-open" style={{ marginLeft: '0.5rem', fontSize: '0.65rem' }}>
                            Active
                          </span>
                        )}
                      </td>
                      <td style={{ color: '#64748b' }}>{m.organization.legalName || '—'}</td>
                      <td>{m.organization.country}</td>
                      <td className="font-mono">{m.organization.baseCurrency}</td>
                      <td>
                        <span className="badge badge-draft">{m.role.name}</span>
                      </td>
                      <td>
                        <span style={{ color: '#16a34a', fontSize: '0.8rem', fontWeight: 600 }}>Active</span>
                      </td>
                      <td className="text-right">
                        {isActive ? (
                          <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>Current Org</span>
                        ) : (
                          <button
                            onClick={() => handleSwitch(m.organization.id)}
                            className="btn btn-secondary btn-sm"
                          >
                            Switch to this
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
