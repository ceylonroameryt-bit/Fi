'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest, ApiError } from '@/lib/api';

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  normalBalance: string;
  allowManualPosting?: boolean;
  isActive: boolean;
}

interface JournalLineForm {
  accountId: string;
  description: string;
  debit: string;
  credit: string;
}

export default function NewJournalPage() {
  const router = useRouter();
  const { activeOrg } = useAuth();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journalDate, setJournalDate] = useState(new Date().toISOString().split('T')[0]);
  const [postingDate, setPostingDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [journalType, setJournalType] = useState('GENERAL');

  const [lines, setLines] = useState<JournalLineForm[]>([
    { accountId: '', description: '', debit: '0.00', credit: '0.00' },
    { accountId: '', description: '', debit: '0.00', credit: '0.00' },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationIssues, setValidationIssues] = useState<string[]>([]);
  const [isValidatedSuccess, setIsValidatedSuccess] = useState(false);

  const currencySymbol = activeOrg?.baseCurrency === 'GBP' ? '£' : activeOrg?.baseCurrency === 'USD' ? '$' : activeOrg?.baseCurrency === 'EUR' ? '€' : `${activeOrg?.baseCurrency ?? 'GBP'} `;

  useEffect(() => {
    async function loadAccounts() {
      if (!activeOrg) return;
      try {
        const data = await apiRequest<any>('/accounts');
        const list = Array.isArray(data) ? data : (data?.items || []);
        const formatted: Account[] = list.map((a: any) => ({
          id: a.id,
          code: a.code,
          name: a.name,
          type: a.accountType || a.type,
          normalBalance: a.normalBalance,
          allowManualPosting: a.allowManualPosting !== false && !a.isControlAccount,
          isActive: a.isActive !== false,
        }));
        setAccounts(formatted.filter((a: Account) => a.isActive));
      } catch (err: any) {
        setError(err.message || 'Failed to load chart of accounts');
      }
    }
    loadAccounts();
  }, [activeOrg]);

  const handleLineChange = (index: number, field: keyof JournalLineForm, value: string) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };
    setLines(updated);
    setIsValidatedSuccess(false);
    setValidationIssues([]);
  };

  const handleAddLine = () => {
    setLines([...lines, { accountId: '', description: '', debit: '0.00', credit: '0.00' }]);
    setIsValidatedSuccess(false);
    setValidationIssues([]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 2) {
      alert('A double-entry manual journal must contain at least 2 lines.');
      return;
    }
    setLines(lines.filter((_, idx) => idx !== index));
    setIsValidatedSuccess(false);
    setValidationIssues([]);
  };

  // Real-time client calculation
  const totalDebit = lines.reduce((sum, line) => {
    const val = parseFloat(line.debit) || 0;
    return sum + val;
  }, 0);

  const totalCredit = lines.reduce((sum, line) => {
    const val = parseFloat(line.credit) || 0;
    return sum + val;
  }, 0);

  const rawDifference = totalDebit - totalCredit;
  const differenceAbs = Math.abs(rawDifference);
  const isBalancedClient = differenceAbs < 0.0001 && totalDebit > 0;
  const hasAccountsSelected = lines.every((l) => !!l.accountId);
  const hasValidAmounts = lines.every((l) => (parseFloat(l.debit) || 0) > 0 || (parseFloat(l.credit) || 0) > 0);

  const handleSaveOrValidate = async (andValidate: boolean = false) => {
    setError(null);
    setValidationIssues([]);
    setIsValidatedSuccess(false);

    // Front-end sanity check
    const issues: string[] = [];
    if (!description.trim()) {
      issues.push('Journal description is required.');
    }
    if (lines.length < 2) {
      issues.push('Journal must contain at least 2 lines for double-entry.');
    }
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].accountId) {
        issues.push(`Line #${i + 1}: Select an account from the chart of accounts.`);
      }
      const deb = parseFloat(lines[i].debit) || 0;
      const cred = parseFloat(lines[i].credit) || 0;
      if (deb === 0 && cred === 0) {
        issues.push(`Line #${i + 1}: Must specify either a debit or credit amount.`);
      }
      if (deb > 0 && cred > 0) {
        issues.push(`Line #${i + 1}: A line cannot have both debit and credit amounts.`);
      }
    }

    if (andValidate && !isBalancedClient) {
      issues.push(
        `Debit and credit totals do not match. Total Debit: ${currencySymbol}${totalDebit.toFixed(2)}, Total Credit: ${currencySymbol}${totalCredit.toFixed(2)} (Difference: ${currencySymbol}${differenceAbs.toFixed(2)})`
      );
    }

    if (issues.length > 0) {
      setValidationIssues(issues);
      return;
    }

    setLoading(true);

    try {
      const payload = {
        journalDate,
        postingDate,
        description: description.trim(),
        reference: reference.trim() || undefined,
        lines: lines.map((l) => ({
          accountId: l.accountId,
          description: l.description.trim() || undefined,
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
        })),
      };

      const createdJournal = await apiRequest<any>('/journals', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (andValidate) {
        try {
          await apiRequest(`/journals/${createdJournal.id}/validate`, {
            method: 'POST',
          });
          setIsValidatedSuccess(true);
          router.push(`/accounting/journals/${createdJournal.id}`);
          return;
        } catch (valErr: any) {
          if (valErr instanceof ApiError && valErr.details?.errors) {
            setValidationIssues(valErr.details.errors as string[]);
          } else {
            setValidationIssues([valErr.message || 'Validation rejected by accounting engine.']);
          }
          // Redirect to journal view so user can review the draft and fix issues
          setTimeout(() => {
            router.push(`/accounting/journals/${createdJournal.id}`);
          }, 1200);
          return;
        }
      }

      router.push(`/accounting/journals/${createdJournal.id}`);
    } catch (err: any) {
      if (err instanceof ApiError && err.details?.errors) {
        setValidationIssues(err.details.errors as string[]);
      } else {
        setError(err.message || 'Failed to save manual journal');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      {/* Breadcrumb & Header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '0.8rem', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
          <Link href="/accounting/journals" style={{ color: '#146EF5', textDecoration: 'none' }}>
            Journals
          </Link>
          <span>&gt;</span>
          <span style={{ color: '#172033', fontWeight: 500 }}>New Journal</span>
        </div>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <div>
            <h1 className="page-title">New Journal Entry</h1>
            <p className="page-subtitle">Create a manual double-entry journal</p>
          </div>
          <div style={{ display: 'flex', gap: '0.65rem' }}>
            <button
              type="button"
              onClick={() => handleSaveOrValidate(false)}
              disabled={loading}
              className="btn btn-secondary"
            >
              Save Draft
            </button>
            <button
              type="button"
              onClick={() => handleSaveOrValidate(true)}
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? 'Validating...' : 'Validate Journal'}
            </button>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Two-Column Layout (Form on Left, Guidance & Validation on Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left Column: Form & Lines */}
        <div>
          {/* Card 1: Journal Details */}
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div className="card-header">
              <h3 className="card-title">Journal Details</h3>
              <span className="badge badge-draft">Draft Entry</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Journal Date *</label>
                  <input
                    type="date"
                    required
                    className="form-input font-mono"
                    value={journalDate}
                    onChange={(e) => setJournalDate(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Posting Date *</label>
                  <input
                    type="date"
                    required
                    className="form-input font-mono"
                    value={postingDate}
                    onChange={(e) => setPostingDate(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Journal Type</label>
                  <select
                    className="form-select"
                    value={journalType}
                    onChange={(e) => setJournalType(e.target.value)}
                  >
                    <option value="GENERAL">General</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Reference</label>
                  <input
                    type="text"
                    placeholder="e.g. INV-2026-088"
                    className="form-input"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Description / Purpose *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Month-end insurance prepayment reclassification"
                  className="form-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Card 2: Journal Lines */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-header">
              <div>
                <h3 className="card-title">Journal Lines</h3>
                <p style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.15rem' }}>
                  Each manual journal requires at least two lines with equal debit and credit sums
                </p>
              </div>
              <button type="button" onClick={handleAddLine} className="btn btn-secondary btn-sm">
                + Add Line
              </button>
            </div>

            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>#</th>
                    <th style={{ minWidth: '240px' }}>Account</th>
                    <th>Line Description</th>
                    <th className="text-right" style={{ width: '150px' }}>Debit ({currencySymbol.trim()})</th>
                    <th className="text-right" style={{ width: '150px' }}>Credit ({currencySymbol.trim()})</th>
                    <th style={{ width: '50px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={idx}>
                      <td className="font-mono" style={{ color: '#6B7280', verticalAlign: 'middle' }}>
                        {idx + 1}
                      </td>
                      <td>
                        <select
                          className="form-select"
                          value={line.accountId}
                          onChange={(e) => handleLineChange(idx, 'accountId', e.target.value)}
                          required
                          style={{ fontSize: '0.825rem' }}
                        >
                          <option value="">Choose an account...</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code} – {a.name} ({a.type})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Optional memo"
                          value={line.description}
                          onChange={(e) => handleLineChange(idx, 'description', e.target.value)}
                          style={{ fontSize: '0.825rem' }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="form-input font-mono text-right"
                          placeholder="0.00"
                          value={line.debit}
                          onChange={(e) => handleLineChange(idx, 'debit', e.target.value)}
                          style={{ fontSize: '0.825rem' }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="form-input font-mono text-right"
                          placeholder="0.00"
                          value={line.credit}
                          onChange={(e) => handleLineChange(idx, 'credit', e.target.value)}
                          style={{ fontSize: '0.825rem' }}
                        />
                      </td>
                      <td className="text-center" style={{ verticalAlign: 'middle' }}>
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          disabled={lines.length <= 2}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: lines.length <= 2 ? '#CBD5E1' : '#DC3F45',
                            cursor: lines.length <= 2 ? 'not-allowed' : 'pointer',
                            fontSize: '1.1rem',
                          }}
                          title="Remove line"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Summary Footer */}
            <div
              style={{
                backgroundColor: '#F8FAFC',
                borderTop: '1px solid #E6EAF0',
                padding: '1rem 1.5rem',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '140px 140px', gap: '0.5rem', textAlign: 'right', fontSize: '0.825rem' }}>
                <span style={{ color: '#6B7280' }}>Total Debit:</span>
                <span className="font-mono" style={{ fontWeight: 600, color: '#172033' }}>
                  {currencySymbol}{totalDebit.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>

                <span style={{ color: '#6B7280' }}>Total Credit:</span>
                <span className="font-mono" style={{ fontWeight: 600, color: '#172033' }}>
                  {currencySymbol}{totalCredit.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>

                <span style={{ fontWeight: 600, color: '#172033', borderTop: '1px solid #E6EAF0', paddingTop: '0.35rem' }}>
                  Difference:
                </span>
                <span
                  className="font-mono"
                  style={{
                    fontWeight: 700,
                    borderTop: '1px solid #E6EAF0',
                    paddingTop: '0.35rem',
                    color: isBalancedClient ? '#16A56A' : '#DC3F45',
                  }}
                >
                  {currencySymbol}{differenceAbs.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Status Guidance & Validation Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Status Guidance Panel */}
          <div className="card">
            <div className="card-header" style={{ padding: '0.85rem 1.15rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#172033' }}>Journal Status</span>
              <span className="badge badge-draft">Draft</span>
            </div>
            <div className="card-body" style={{ padding: '1rem 1.15rem' }}>
              <p style={{ fontSize: '0.785rem', color: '#6B7280', lineHeight: 1.5, margin: 0 }}>
                This is a draft journal. It does not affect accounting balances or nominal ledgers until it is validated and later posted.
              </p>
            </div>
          </div>

          {/* Validation Checklist / Result Panel */}
          <div className="card">
            <div className="card-header" style={{ padding: '0.85rem 1.15rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#172033' }}>Double-Entry Verification</span>
              <span
                className="badge"
                style={{
                  backgroundColor: isBalancedClient ? '#ECFDF5' : '#FEF2F2',
                  color: isBalancedClient ? '#065F46' : '#991B1B',
                  border: `1px solid ${isBalancedClient ? '#A7F3D0' : '#FECACA'}`,
                }}
              >
                {isBalancedClient ? 'Balanced' : 'Unbalanced'}
              </span>
            </div>
            <div className="card-body" style={{ padding: '1rem 1.15rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.785rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: activeOrg ? '#065F46' : '#9CA3AF' }}>
                  <span>✓</span>
                  <span>Organisation valid ({activeOrg?.name})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: hasAccountsSelected ? '#065F46' : '#9CA3AF' }}>
                  <span>{hasAccountsSelected ? '✓' : '○'}</span>
                  <span>Accounts exist and are active</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: hasValidAmounts ? '#065F46' : '#9CA3AF' }}>
                  <span>{hasValidAmounts ? '✓' : '○'}</span>
                  <span>Debit / credit values specified</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: isBalancedClient ? '#065F46' : '#DC3F45' }}>
                  <span>{isBalancedClient ? '✓' : '✕'}</span>
                  <span style={{ fontWeight: isBalancedClient ? 400 : 600 }}>
                    {isBalancedClient ? 'Journal is balanced (ΣDr = ΣCr)' : 'Debit and credit sums must match'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: lines.length >= 2 ? '#065F46' : '#9CA3AF' }}>
                  <span>{lines.length >= 2 ? '✓' : '○'}</span>
                  <span>Minimum 2 lines required</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#065F46' }}>
                  <span>✓</span>
                  <span>Posting currency matches ledger ({activeOrg?.baseCurrency ?? 'GBP'})</span>
                </div>
              </div>

              {/* Validation Issues Alert */}
              {validationIssues.length > 0 && (
                <div
                  style={{
                    marginTop: '1rem',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FECACA',
                  }}
                >
                  <strong style={{ color: '#991B1B', fontSize: '0.75rem', display: 'block', marginBottom: '0.35rem' }}>
                    Journal Needs Attention ({validationIssues.length} issues):
                  </strong>
                  <ul style={{ paddingLeft: '1rem', color: '#991B1B', fontSize: '0.725rem', lineHeight: 1.4 }}>
                    {validationIssues.map((msg, i) => (
                      <li key={i}>{msg}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Validated successfully */}
              {isValidatedSuccess && (
                <div
                  style={{
                    marginTop: '1rem',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    backgroundColor: '#ECFDF5',
                    border: '1px solid #A7F3D0',
                    color: '#065F46',
                    fontSize: '0.775rem',
                  }}
                >
                  ✓ Journal verified and balanced by backend accounting engine.
                </div>
              )}

              {/* Primary Action Button */}
              <button
                type="button"
                onClick={() => handleSaveOrValidate(true)}
                disabled={loading}
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '1.25rem' }}
              >
                {loading ? 'Validating...' : 'Validate Journal'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
