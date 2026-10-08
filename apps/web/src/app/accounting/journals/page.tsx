'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';

interface JournalEntry {
  id: string;
  entryNumber: string;
  entryDate: string;
  description: string;
  reference?: string | null;
  status: 'DRAFT' | 'VALIDATED';
  totalDebit: string;
  totalCredit: string;
  createdBy?: {
    firstName: string;
    lastName: string;
  };
}

export default function JournalsPage() {
  const { activeOrg, hasPermission } = useAuth();
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'VALIDATED'>('ALL');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canCreateJournal = hasPermission('journal:create');

  const loadJournals = useCallback(async () => {
    if (!activeOrg) return;
    try {
      setLoading(true);
      const data = await apiRequest<any>('/journals');
      const list = Array.isArray(data) ? data : (data?.items || []);
      const formatted: JournalEntry[] = list.map((j: any) => ({
        id: j.id,
        entryNumber: j.journalNumber || j.entryNumber || 'JE-DRAFT',
        entryDate: j.journalDate || j.entryDate,
        description: j.description,
        reference: j.reference,
        status: j.status,
        totalDebit: j.totalDebit || '0.00',
        totalCredit: j.totalCredit || '0.00',
        createdBy: j.createdBy,
      }));
      setJournals(formatted);
    } catch (err: any) {
      setError(err.message || 'Failed to load manual journals');
    } finally {
      setLoading(false);
    }
  }, [activeOrg]);

  useEffect(() => {
    loadJournals();
  }, [loadJournals]);

  const filteredJournals = journals.filter((j) => {
    if (statusFilter !== 'ALL' && j.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        j.entryNumber.toLowerCase().includes(q) ||
        j.description.toLowerCase().includes(q) ||
        (j.reference && j.reference.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1 className="page-title">Manual Journals</h1>
          <p className="page-subtitle">Strict double-entry manual journal entries with multi-tier validation</p>
        </div>
        {canCreateJournal && (
          <Link href="/accounting/journals/new" className="btn btn-primary">
            + New Manual Journal
          </Link>
        )}
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-body" style={{ padding: '0.75rem 1rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search entry number, description, reference..."
              className="form-input"
              style={{ width: '320px' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              className="form-select"
              style={{ width: 'auto' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="VALIDATED">Validated</option>
            </select>
          </div>

          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Showing <strong>{filteredJournals.length}</strong> journals
          </div>
        </div>
      </div>

      {/* Journals Table */}
      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '150px' }}>Entry Number</th>
                <th style={{ width: '110px' }}>Date</th>
                <th>Description</th>
                <th>Reference</th>
                <th>Status</th>
                <th className="text-right">Total Debit</th>
                <th className="text-right">Total Credit</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    Loading manual journals...
                  </td>
                </tr>
              ) : filteredJournals.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                    No manual journals found. Click &quot;+ New Manual Journal&quot; to create an entry.
                  </td>
                </tr>
              ) : (
                filteredJournals.map((j) => (
                  <tr key={j.id}>
                    <td className="font-mono">
                      <Link
                        href={`/accounting/journals/${j.id}`}
                        style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}
                      >
                        {j.entryNumber}
                      </Link>
                    </td>
                    <td className="font-mono">{new Date(j.entryDate).toISOString().split('T')[0]}</td>
                    <td>
                      <div style={{ fontWeight: 500, color: '#0f172a' }}>{j.description}</div>
                      {j.createdBy && (
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                          By {j.createdBy.firstName} {j.createdBy.lastName}
                        </div>
                      )}
                    </td>
                    <td style={{ color: '#64748b', fontSize: '0.8rem' }}>{j.reference || '—'}</td>
                    <td>
                      <span className={`badge badge-${j.status.toLowerCase()}`}>
                        {j.status}
                      </span>
                    </td>
                    <td className="text-right font-mono" style={{ fontWeight: 600 }}>
                      {Number(j.totalDebit).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="text-right font-mono" style={{ fontWeight: 600 }}>
                      {Number(j.totalCredit).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="text-right">
                      <Link
                        href={`/accounting/journals/${j.id}`}
                        className="btn btn-secondary btn-sm"
                      >
                        View & Edit &rarr;
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
