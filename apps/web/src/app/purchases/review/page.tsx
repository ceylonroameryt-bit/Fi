'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';

interface QueueItem {
  id: string;
  fileName: string;
  direction: 'PURCHASE' | 'SALE' | 'UNKNOWN';
  createdAt: string;
  confidenceScore: number;
  confidenceLevel: string;
  invoiceNumber: string | null;
  total: string | null;
  counterparty: string | null;
  consistent: boolean | null;
  inconsistentFields: number | null;
  missingFields: number | null;
}

type Sort = 'confidence_desc' | 'confidence_asc' | 'oldest';

/** Documents the AI has prepared, waiting for a person. Confidence only orders the list. */
export default function ReviewQueuePage() {
  const { activeOrg } = useAuth();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [sort, setSort] = useState<Sort>('confidence_desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeOrg) return;
    try {
      setLoading(true);
      setError(null);
      setItems(await apiRequest<QueueItem[]>(`/ai/review-queue?sort=${sort}`));
    } catch (e: any) {
      setError(e.message || 'Failed to load the review queue');
    } finally {
      setLoading(false);
    }
  }, [activeOrg, sort]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AppShell>
      <div className="bl-legacy">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0 }}>Review queue</h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)' }}>
            AI-prepared drafts waiting for approval. Nothing is created or posted until someone approves it.
          </p>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          Sort
          <select className="form-input" value={sort} onChange={(e) => setSort(e.target.value as Sort)} style={{ width: 'auto' }}>
            <option value="confidence_desc">Highest confidence first</option>
            <option value="confidence_asc">Lowest confidence first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Document</th>
                <th>Type</th>
                <th>Counterparty</th>
                <th>Invoice no.</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th>Checks</th>
                <th style={{ textAlign: 'right' }}>Confidence</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: '1.5rem', textAlign: 'center' }}>Loading…</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>Nothing is waiting for review.</td>
                </tr>
              ) : (
                items.map((d) => (
                  <tr key={d.id}>
                    <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.fileName}</td>
                    <td>{d.direction === 'PURCHASE' ? 'Supplier bill' : d.direction === 'SALE' ? 'Sales invoice' : 'Unclassified'}</td>
                    <td>{d.counterparty ?? <span style={{ color: 'var(--text-muted)' }}>Not matched</span>}</td>
                    <td>{d.invoiceNumber ?? '—'}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{d.total ? `£${d.total}` : '—'}</td>
                    <td>
                      {d.inconsistentFields ? (
                        <span className="badge badge-danger">{d.inconsistentFields} to check</span>
                      ) : (
                        <span className="badge badge-posted">Consistent</span>
                      )}
                      {d.missingFields ? <span style={{ marginLeft: 6, color: 'var(--text-muted)', fontSize: '0.8rem' }}>{d.missingFields} missing</span> : null}
                    </td>
                    <td style={{ textAlign: 'right' }}>{Math.round(d.confidenceScore * 100)}%</td>
                    <td style={{ textAlign: 'right' }}>
                      <Link href={`/purchases/review/${d.id}`} className="btn btn-primary btn-sm">
                        Review
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </AppShell>
  );
}
