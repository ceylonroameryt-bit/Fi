'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';

interface IntegrityCheckResult {
  checkName: string;
  passed: boolean;
  severity: 'CRITICAL' | 'WARNING';
  message: string;
  details?: any;
}

interface AccountingIntegritySummary {
  organizationId: string;
  checkedAt: string;
  allPassed: boolean;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  checks: IntegrityCheckResult[];
}

export default function AccountingIntegrityPage() {
  const { activeOrg, hasPermission } = useAuth();
  const [summary, setSummary] = useState<AccountingIntegritySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canView = hasPermission('accounting_integrity.view') || hasPermission('audit.view');

  const runChecks = useCallback(async () => {
    if (!activeOrg) return;
    try {
      setRunning(true);
      setError(null);
      const res = await apiRequest<AccountingIntegritySummary>('/accounting-integrity');
      setSummary(res);
    } catch (err: any) {
      setError(err.message || 'Failed to run accounting integrity verification checks');
    } finally {
      setRunning(false);
      setLoading(false);
    }
  }, [activeOrg]);

  useEffect(() => {
    runChecks();
  }, [runChecks]);

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1 className="page-title">Accounting Integrity & Controls</h1>
          <p className="page-subtitle">
            Authoritative system checks enforcing multi-tenant isolation, double-entry equality, and reversal symmetry
          </p>
        </div>

        <div>
          <button
            onClick={runChecks}
            disabled={running}
            className="btn btn-primary btn-sm"
          >
            {running ? 'Running Diagnostic Checks...' : 'Run Integrity Checks'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Summary KPI Cards */}
      {summary && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <div className="card">
            <div className="card-body">
              <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                System Status
              </div>
              <div
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: summary.allPassed ? '#15803D' : '#B91C1C',
                  marginTop: '0.25rem',
                }}
              >
                {summary.allPassed ? '✓ All Controls Healthy' : '⚠ Issues Detected'}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                Total Controls Checked
              </div>
              <div className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginTop: '0.25rem' }}>
                {summary.totalChecks}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                Controls Passed
              </div>
              <div className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: '#15803D', marginTop: '0.25rem' }}>
                {summary.passedChecks}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                Controls Failed
              </div>
              <div
                className="font-mono"
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: summary.failedChecks > 0 ? '#B91C1C' : '#64748b',
                  marginTop: '0.25rem',
                }}
              >
                {summary.failedChecks}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                Last Diagnostic Check
              </div>
              <div style={{ fontSize: '0.85rem', color: '#0f172a', marginTop: '0.4rem' }}>
                {new Date(summary.checkedAt).toLocaleTimeString()} ({new Date(summary.checkedAt).toLocaleDateString()})
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Control Results Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Accounting Control Engine Verification</h3>
        </div>
        <div className="table-wrapper" style={{ border: 'none' }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th style={{ width: '220px' }}>Control Name</th>
                <th style={{ width: '100px' }}>Severity</th>
                <th style={{ width: '100px' }}>Status</th>
                <th>Diagnostic Findings</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                    Running accounting integrity checks...
                  </td>
                </tr>
              ) : !summary || summary.checks.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                    No check results available.
                  </td>
                </tr>
              ) : (
                summary.checks.map((chk, idx) => (
                  <tr key={chk.checkName}>
                    <td className="font-mono text-center" style={{ color: '#64748b' }}>
                      {idx + 1}
                    </td>
                    <td>
                      <strong style={{ color: '#0f172a' }}>{chk.checkName}</strong>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          backgroundColor: chk.severity === 'CRITICAL' ? '#FEF2F2' : '#FFFBEB',
                          color: chk.severity === 'CRITICAL' ? '#B91C1C' : '#B45309',
                          border: `1px solid ${chk.severity === 'CRITICAL' ? '#FECACA' : '#FDE68A'}`,
                          fontSize: '0.7rem',
                        }}
                      >
                        {chk.severity}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${chk.passed ? 'badge-posted' : 'badge-danger'}`}
                        style={{ fontSize: '0.75rem' }}
                      >
                        {chk.passed ? '✓ PASSED' : '✕ FAILED'}
                      </span>
                    </td>
                    <td style={{ color: chk.passed ? '#334155' : '#B91C1C' }}>
                      <div>{chk.message}</div>
                      {chk.details && !chk.passed && (
                        <pre
                          style={{
                            marginTop: '0.5rem',
                            padding: '0.5rem',
                            backgroundColor: '#FEF2F2',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            overflowX: 'auto',
                          }}
                        >
                          {JSON.stringify(chk.details, null, 2)}
                        </pre>
                      )}
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
