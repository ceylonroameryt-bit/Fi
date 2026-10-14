'use client';

import React from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { FileCheck } from 'lucide-react';

/**
 * Supplier bills are not implemented in the API yet. This page used to load *sales*
 * invoices and present them as bills, which was misleading, so it now says so plainly.
 */
export default function BillsPage() {
  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1 className="page-title">Bills</h1>
          <p className="page-subtitle">Supplier bills and payables</p>
        </div>
      </div>
      <div className="page-body">
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
            <FileCheck size={28} style={{ color: '#64748B', marginBottom: '0.75rem' }} />
            <h3 style={{ marginBottom: '0.5rem' }}>Supplier bills are coming soon</h3>
            <p style={{ color: '#64748B', maxWidth: 480, margin: '0 auto 1.25rem' }}>
              You can already keep supplier details, and record purchases with a manual journal in the meantime.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/purchases/suppliers" className="btn btn-secondary">
                Suppliers
              </Link>
              <Link href="/accounting/journals/new" className="btn btn-primary">
                New journal
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
