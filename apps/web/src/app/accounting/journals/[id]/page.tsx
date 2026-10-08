'use client';

import React, { useCallback, useEffect, useState, use } from 'react';
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
  isControlAccount: boolean;
  isActive: boolean;
}

interface JournalLine {
  id?: string;
  accountId: string;
  description?: string | null;
  debit: string | number;
  credit: string | number;
  account?: {
    code: string;
    name: string;
    type: string;
  };
}

interface JournalDetail {
  id: string;
  entryNumber: string;
  entryDate: string;
  postingDate: string;
  description: string;
  reference?: string | null;
  status: 'DRAFT' | 'VALIDATED' | 'POSTED' | 'REVERSED';
  totalDebit: string;
  totalCredit: string;
  lines: JournalLine[];
  createdBy?: {
    firstName: string;
    lastName: string;
    email: string;
  };
  validatedAt?: string | null;
  postedAt?: string | null;
  postedBy?: {
    firstName: string;
    lastName: string;
    email: string;
  };
  reversedByJournalId?: string | null;
  reversedByJournal?: {
    id: string;
    journalNumber: string;
  } | null;
  reversalOfJournalId?: string | null;
  reverses?: {
    id: string;
    journalNumber: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export default function JournalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const journalId = resolvedParams.id;
  const router = useRouter();
  const { activeOrg, hasPermission } = useAuth();

  const [journal, setJournal] = useState<JournalDetail | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [posting, setPosting] = useState(false);
  const [reversing, setReversing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Modals
  const [showPostModal, setShowPostModal] = useState(false);
  const [showReverseModal, setShowReverseModal] = useState(false);
  const [reversalDate, setReversalDate] = useState(new Date().toISOString().split('T')[0]);
  const [reversalReason, setReversalReason] = useState('');

  // Edit form state
  const [editDate, setEditDate] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editReference, setEditReference] = useState('');
  const [editLines, setEditLines] = useState<Array<{ accountId: string; description: string; debit: string; credit: string }>>([]);

  const canEditDraft = hasPermission('journal.edit_draft') || hasPermission('journal:update');
  const canDeleteDraft = hasPermission('journal.delete_draft') || hasPermission('journal:delete');
  const canValidate = hasPermission('journal.validate') || hasPermission('journal:validate');
  const canPost = hasPermission('journal.post');
  const canReverse = hasPermission('journal.reverse');

  const loadJournal = useCallback(async () => {
    if (!activeOrg || !journalId) return;
    try {
      setLoading(true);
      const [journalData, accountsData] = await Promise.all([
        apiRequest<any>(`/journals/${journalId}`),
        apiRequest<any>('/accounts'),
      ]);

      const formatted: JournalDetail = {
        id: journalData.id,
        entryNumber: journalData.journalNumber || journalData.entryNumber || 'JE-DRAFT',
        entryDate: journalData.journalDate || journalData.entryDate,
        postingDate: journalData.postingDate || journalData.journalDate,
        description: journalData.description,
        reference: journalData.reference,
        status: journalData.status,
        totalDebit: journalData.totalDebit || '0.00',
        totalCredit: journalData.totalCredit || '0.00',
        lines: (journalData.lines || []).map((l: any) => ({
          id: l.id,
          accountId: l.accountId,
          description: l.description,
          debit: l.debit,
          credit: l.credit,
          account: l.account
            ? {
                code: l.account.code,
                name: l.account.name,
                type: l.account.accountType || l.account.type,
              }
            : undefined,
        })),
        createdBy: journalData.createdBy,
        validatedAt: journalData.validatedAt,
        postedAt: journalData.postedAt,
        postedBy: journalData.postedBy,
        reversedByJournalId: journalData.reversedByJournalId,
        reversedByJournal: journalData.reversedByJournal,
        reversalOfJournalId: journalData.reversalOfJournalId,
        reverses: journalData.reverses,
        createdAt: journalData.createdAt,
        updatedAt: journalData.updatedAt,
      };

      setJournal(formatted);

      const accList = Array.isArray(accountsData) ? accountsData : accountsData?.items || [];
      setAccounts(
        accList.map((a: any) => ({
          id: a.id,
          code: a.code,
          name: a.name,
          type: a.accountType || a.type,
          isControlAccount: !!a.isControlAccount,
          isActive: a.isActive !== false,
        })),
      );

      // Populate edit fields
      const dateStr = journalData.journalDate || journalData.entryDate;
      setEditDate(new Date(dateStr).toISOString().split('T')[0]);
      setEditDescription(journalData.description);
      setEditReference(journalData.reference || '');
      setEditLines(
        formatted.lines.map((l: JournalLine) => ({
          accountId: l.accountId,
          description: l.description || '',
          debit: String(Number(l.debit).toFixed(2)),
          credit: String(Number(l.credit).toFixed(2)),
        })),
      );
    } catch (err: any) {
      setError(err.message || 'Failed to load journal details');
    } finally {
      setLoading(false);
    }
  }, [activeOrg, journalId]);

  useEffect(() => {
    loadJournal();
  }, [loadJournal]);

  const handleValidate = async () => {
    if (!journal) return;
    setValidating(true);
    setError(null);
    setSuccess(null);
    setValidationErrors([]);

    try {
      await apiRequest<any>(`/journals/${journal.id}/validate`, {
        method: 'POST',
      });
      await loadJournal();
      setSuccess('Journal validated successfully! Ready to be posted.');
    } catch (err: any) {
      if (err instanceof ApiError && err.details?.errors) {
        setValidationErrors(err.details.errors as string[]);
      }
      setError(err.message || 'Journal validation failed');
    } finally {
      setValidating(false);
    }
  };

  const handlePost = async () => {
    if (!journal) return;
    setPosting(true);
    setError(null);
    setSuccess(null);
    try {
      await apiRequest<any>(`/journals/${journal.id}/post`, {
        method: 'POST',
      });
      setShowPostModal(false);
      await loadJournal();
      setSuccess(`Journal ${journal.entryNumber} posted to General Ledger successfully!`);
    } catch (err: any) {
      setError(err.message || 'Failed to post journal');
    } finally {
      setPosting(false);
    }
  };

  const handleReverse = async () => {
    if (!journal) return;
    setReversing(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiRequest<any>(`/journals/${journal.id}/reverse`, {
        method: 'POST',
        body: JSON.stringify({
          reversalDate,
          reason: reversalReason.trim() || undefined,
        }),
      });
      setShowReverseModal(false);
      await loadJournal();
      setSuccess(
        `Journal ${journal.entryNumber} reversed successfully! Reversal journal ${res.reversalJournal.journalNumber} created.`,
      );
    } catch (err: any) {
      setError(err.message || 'Failed to reverse journal');
    } finally {
      setReversing(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!journal) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    setValidationErrors([]);

    try {
      const payload = {
        journalDate: editDate,
        postingDate: editDate,
        description: editDescription.trim(),
        reference: editReference.trim() || undefined,
        lines: editLines.map((l) => ({
          accountId: l.accountId,
          description: l.description.trim() || undefined,
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
        })),
      };

      const updated = await apiRequest<JournalDetail>(`/journals/${journal.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      setJournal(updated);
      setIsEditing(false);
      setSuccess('Journal updated successfully (status reset to DRAFT for review).');
      await loadJournal();
    } catch (err: any) {
      if (err instanceof ApiError && err.details?.errors) {
        setValidationErrors(err.details.errors as string[]);
      }
      setError(err.message || 'Failed to update journal');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!journal) return;
    if (
      !confirm(
        `Are you sure you want to delete journal entry ${journal.entryNumber}? This action is recorded in the audit log.`,
      )
    ) {
      return;
    }

    try {
      setError(null);
      await apiRequest(`/journals/${journal.id}`, {
        method: 'DELETE',
      });
      router.push('/accounting/journals');
    } catch (err: any) {
      setError(err.message || 'Failed to delete journal');
    }
  };

  const handleLineChange = (index: number, field: string, value: string) => {
    const updated = [...editLines];
    updated[index] = { ...updated[index], [field]: value };
    setEditLines(updated);
  };

  const handleAddLine = () => {
    setEditLines([...editLines, { accountId: '', description: '', debit: '0.00', credit: '0.00' }]);
  };

  const handleRemoveLine = (index: number) => {
    if (editLines.length <= 2) {
      alert('A double-entry manual journal must contain at least 2 lines.');
      return;
    }
    setEditLines(editLines.filter((_, idx) => idx !== index));
  };

  // Edit totals
  const editTotalDebit = editLines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const editTotalCredit = editLines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const editDiff = Math.abs(editTotalDebit - editTotalCredit);
  const editBalanced = editDiff < 0.0001 && editTotalDebit > 0;

  if (loading) {
    return (
      <AppShell>
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
          Loading journal entry...
        </div>
      </AppShell>
    );
  }

  if (!journal) {
    return (
      <AppShell>
        <div className="alert alert-danger">Journal not found.</div>
        <Link href="/accounting/journals" className="btn btn-secondary">
          &larr; Back to Journals
        </Link>
      </AppShell>
    );
  }

  const isPosted = journal.status === 'POSTED';
  const isReversed = journal.status === 'REVERSED';
  const isImmutable = isPosted || isReversed;

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 className="page-title font-mono">{journal.entryNumber}</h1>
            <span className={`badge badge-${journal.status.toLowerCase()}`}>
              {journal.status}
            </span>
          </div>
          <p className="page-subtitle">
            Date: {new Date(journal.entryDate).toISOString().split('T')[0]} | Created by{' '}
            {journal.createdBy?.firstName} {journal.createdBy?.lastName}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Link href="/accounting/journals" className="btn btn-secondary btn-sm">
            &larr; Back
          </Link>

          {/* DRAFT Actions */}
          {!isEditing && journal.status === 'DRAFT' && canValidate && (
            <button
              onClick={handleValidate}
              disabled={validating}
              className="btn btn-primary btn-sm"
            >
              {validating ? 'Validating...' : 'Validate Entry'}
            </button>
          )}

          {/* VALIDATED Actions */}
          {!isEditing && journal.status === 'VALIDATED' && canPost && (
            <button
              onClick={() => setShowPostModal(true)}
              className="btn btn-primary btn-sm"
              style={{ backgroundColor: '#10b981', borderColor: '#059669' }}
            >
              Post Journal
            </button>
          )}

          {/* POSTED Actions */}
          {!isEditing && isPosted && canReverse && (
            <button
              onClick={() => setShowReverseModal(true)}
              className="btn btn-secondary btn-sm"
              style={{ color: '#7c3aed', borderColor: '#c4b5fd' }}
            >
              Reverse Journal
            </button>
          )}

          {/* Edit / Delete only allowed for DRAFT or VALIDATED */}
          {!isEditing && !isImmutable && canEditDraft && (
            <button onClick={() => setIsEditing(true)} className="btn btn-secondary btn-sm">
              Edit
            </button>
          )}

          {!isEditing && !isImmutable && canDeleteDraft && (
            <button onClick={handleDelete} className="btn btn-danger btn-sm">
              Delete
            </button>
          )}
        </div>
      </div>

      {success && <div className="alert alert-success">{success}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      {/* Reversal Banner */}
      {journal.reversedByJournalId && (
        <div
          className="alert"
          style={{
            backgroundColor: '#F5F3FF',
            borderColor: '#DDD6FE',
            color: '#6D28D9',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <strong>Notice:</strong> This journal has been reversed and is no longer active in General Ledger.
          </div>
          <Link
            href={`/accounting/journals/${journal.reversedByJournalId}`}
            className="btn btn-secondary btn-sm"
            style={{ color: '#6D28D9' }}
          >
            View Reversal Entry &rarr;
          </Link>
        </div>
      )}

      {journal.reversalOfJournalId && (
        <div
          className="alert"
          style={{
            backgroundColor: '#EFF6FF',
            borderColor: '#BFDBFE',
            color: '#1D4ED8',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <strong>Reversal Journal:</strong> This entry offsets the accounting effect of the original journal.
          </div>
          <Link
            href={`/accounting/journals/${journal.reversalOfJournalId}`}
            className="btn btn-secondary btn-sm"
            style={{ color: '#1D4ED8' }}
          >
            View Original Entry &rarr;
          </Link>
        </div>
      )}

      {/* Validation status panel */}
      {journal.status === 'VALIDATED' && !isEditing && (
        <div className="validation-panel validation-panel-success" style={{ marginBottom: '1.5rem' }}>
          <strong style={{ color: '#15803d', display: 'block', fontSize: '0.9rem' }}>
            ✓ Validation Engine: All Rules Passed
          </strong>
          <span style={{ fontSize: '0.8rem', color: '#166534' }}>
            Total Debits match Credits ({Number(journal.totalDebit).toLocaleString('en-GB', { minimumFractionDigits: 2 })}{' '}
            {activeOrg?.baseCurrency}), accounting period is open, active accounts verified, and sequential numbering integrity maintained.
          </span>
        </div>
      )}

      {validationErrors.length > 0 && (
        <div className="validation-panel validation-panel-error" style={{ marginBottom: '1.5rem' }}>
          <strong style={{ color: '#b91c1c', display: 'block', marginBottom: '0.5rem' }}>
            Validation Engine Findings ({validationErrors.length} issues):
          </strong>
          <ul style={{ paddingLeft: '1.25rem', color: '#b91c1c', fontSize: '0.825rem' }}>
            {validationErrors.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Main Content Area */}
      {!isEditing ? (
        <>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-body">
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1.25rem',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                    Description
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a', marginTop: '0.2rem' }}>
                    {journal.description}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                    Reference
                  </div>
                  <div style={{ fontSize: '0.95rem', color: '#0f172a', marginTop: '0.2rem' }}>
                    {journal.reference || '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                    Posting Date
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.95rem', color: '#0f172a', marginTop: '0.2rem' }}>
                    {new Date(journal.postingDate || journal.entryDate).toISOString().split('T')[0]}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                    Total Balanced Amount
                  </div>
                  <div className="font-mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginTop: '0.2rem' }}>
                    {Number(journal.totalDebit).toLocaleString('en-GB', { minimumFractionDigits: 2 })} {activeOrg?.baseCurrency}
                  </div>
                </div>

                {isPosted && journal.postedAt && (
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                      Posted At
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#0f172a', marginTop: '0.2rem' }}>
                      {new Date(journal.postedAt).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Lines Table */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Journal Lines</h3>
            </div>
            <div className="table-wrapper" style={{ border: 'none' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: '50px' }}>#</th>
                    <th style={{ width: '120px' }}>Code</th>
                    <th>Account Name</th>
                    <th>Line Description</th>
                    <th style={{ width: '160px' }} className="text-right">
                      Debit ({activeOrg?.baseCurrency})
                    </th>
                    <th style={{ width: '160px' }} className="text-right">
                      Credit ({activeOrg?.baseCurrency})
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {journal.lines.map((line, idx) => (
                    <tr key={line.id || idx}>
                      <td className="font-mono text-center" style={{ color: '#64748b' }}>
                        {idx + 1}
                      </td>
                      <td className="font-mono">
                        <strong style={{ color: '#0f172a' }}>{line.account?.code}</strong>
                      </td>
                      <td>
                        <strong style={{ color: '#0f172a' }}>{line.account?.name}</strong>
                        <span className="badge badge-open" style={{ marginLeft: '0.5rem', fontSize: '0.65rem' }}>
                          {line.account?.type}
                        </span>
                      </td>
                      <td style={{ color: '#64748b' }}>{line.description || '—'}</td>
                      <td className="text-right font-mono" style={{ fontWeight: Number(line.debit) > 0 ? 600 : 400 }}>
                        {Number(line.debit) > 0
                          ? Number(line.debit).toLocaleString('en-GB', { minimumFractionDigits: 2 })
                          : '—'}
                      </td>
                      <td className="text-right font-mono" style={{ fontWeight: Number(line.credit) > 0 ? 600 : 400 }}>
                        {Number(line.credit) > 0
                          ? Number(line.credit).toLocaleString('en-GB', { minimumFractionDigits: 2 })
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: '#f8fafc', fontWeight: 700 }}>
                    <td colSpan={4} className="text-right" style={{ padding: '0.75rem 1rem' }}>
                      Totals:
                    </td>
                    <td className="text-right font-mono" style={{ padding: '0.75rem 1rem' }}>
                      {Number(journal.totalDebit).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="text-right font-mono" style={{ padding: '0.75rem 1rem' }}>
                      {Number(journal.totalCredit).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Edit Mode */
        <div>
          {journal.status === 'VALIDATED' && (
            <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
              <strong>Notice:</strong> This journal is currently VALIDATED. Modifying any line or header will reset its status back to DRAFT for re-validation.
            </div>
          )}

          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 200px', gap: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Entry Date *</label>
                  <input
                    type="date"
                    required
                    className="form-input font-mono"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Description *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Reference</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editReference}
                    onChange={(e) => setEditReference(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-header">
              <h3 className="card-title">Edit Lines</h3>
              <button type="button" onClick={handleAddLine} className="btn btn-secondary btn-sm">
                + Add Line
              </button>
            </div>

            <div className="table-wrapper" style={{ border: 'none' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>#</th>
                    <th style={{ width: '320px' }}>Account</th>
                    <th>Line Description</th>
                    <th style={{ width: '150px' }} className="text-right">
                      Debit
                    </th>
                    <th style={{ width: '150px' }} className="text-right">
                      Credit
                    </th>
                    <th style={{ width: '60px' }} className="text-center">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {editLines.map((line, idx) => (
                    <tr key={idx}>
                      <td className="font-mono text-center">{idx + 1}</td>
                      <td>
                        <select
                          className="form-select"
                          required
                          value={line.accountId}
                          onChange={(e) => handleLineChange(idx, 'accountId', e.target.value)}
                        >
                          <option value="">Select Account...</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id} disabled={a.isControlAccount}>
                              {a.code} - {a.name} ({a.type}) {a.isControlAccount ? '[Control Account]' : ''}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-input"
                          value={line.description}
                          onChange={(e) => handleLineChange(idx, 'description', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="form-input font-mono text-right"
                          value={line.debit}
                          onChange={(e) => {
                            const val = e.target.value;
                            handleLineChange(idx, 'debit', val);
                            if (parseFloat(val) > 0) handleLineChange(idx, 'credit', '0.00');
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="form-input font-mono text-right"
                          value={line.credit}
                          onChange={(e) => {
                            const val = e.target.value;
                            handleLineChange(idx, 'credit', val);
                            if (parseFloat(val) > 0) handleLineChange(idx, 'debit', '0.00');
                          }}
                        />
                      </td>
                      <td className="text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#b91c1c',
                            cursor: 'pointer',
                            fontSize: '1.1rem',
                          }}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: '#f8fafc', fontWeight: 700 }}>
                    <td colSpan={3} className="text-right" style={{ padding: '0.75rem 1rem' }}>
                      Total:
                    </td>
                    <td className="text-right font-mono" style={{ padding: '0.75rem 1rem' }}>
                      {editTotalDebit.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="text-right font-mono" style={{ padding: '0.75rem 1rem' }}>
                      {editTotalCredit.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                    </td>
                    <td></td>
                  </tr>
                  <tr style={{ backgroundColor: editBalanced ? '#f0fdf4' : '#fef2f2' }}>
                    <td colSpan={3} className="text-right" style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ fontWeight: 600, color: editBalanced ? '#15803d' : '#b91c1c' }}>
                        {editBalanced ? '✓ Balanced' : '⚠ Out of Balance:'}
                      </span>
                    </td>
                    <td
                      colSpan={2}
                      className="text-right font-mono"
                      style={{
                        padding: '0.75rem 1rem',
                        color: editBalanced ? '#15803d' : '#b91c1c',
                        fontWeight: 700,
                      }}
                    >
                      {editDiff.toLocaleString('en-GB', { minimumFractionDigits: 2 })} {activeOrg?.baseCurrency}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                loadJournal();
              }}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !editBalanced}
              onClick={handleSaveEdit}
              className="btn btn-primary"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Post Confirmation Modal */}
      {showPostModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(2px)',
          }}
        >
          <div
            className="card"
            style={{
              width: '460px',
              maxWidth: '90vw',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div className="card-header">
              <h3 className="card-title">Post Journal {journal.entryNumber}?</h3>
            </div>
            <div className="card-body">
              <p style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '1.25rem' }}>
                Once posted, this journal becomes part of the permanent accounting records and cannot be edited or deleted directly.
              </p>

              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '1rem',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.75rem',
                  marginBottom: '1.25rem',
                  fontSize: '0.85rem',
                }}
              >
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Debit Total</div>
                  <div className="font-mono" style={{ fontWeight: 600, color: '#0f172a' }}>
                    {Number(journal.totalDebit).toLocaleString('en-GB', { minimumFractionDigits: 2 })} {activeOrg?.baseCurrency}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Credit Total</div>
                  <div className="font-mono" style={{ fontWeight: 600, color: '#0f172a' }}>
                    {Number(journal.totalCredit).toLocaleString('en-GB', { minimumFractionDigits: 2 })} {activeOrg?.baseCurrency}
                  </div>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Posting Date</div>
                  <div className="font-mono" style={{ fontWeight: 600, color: '#0f172a' }}>
                    {new Date(journal.postingDate || journal.entryDate).toISOString().split('T')[0]}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  disabled={posting}
                  onClick={() => setShowPostModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={posting}
                  onClick={handlePost}
                  className="btn btn-primary"
                  style={{ backgroundColor: '#10b981', borderColor: '#059669' }}
                >
                  {posting ? 'Posting...' : 'Post Journal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reverse Modal */}
      {showReverseModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(2px)',
          }}
        >
          <div
            className="card"
            style={{
              width: '480px',
              maxWidth: '90vw',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div className="card-header">
              <h3 className="card-title">Reverse {journal.entryNumber}?</h3>
            </div>
            <div className="card-body">
              <p style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '1.25rem' }}>
                The original journal will remain in the accounting history. A new opposite journal with inverted debits and credits will be posted to the General Ledger.
              </p>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Reversal Date *</label>
                <input
                  type="date"
                  required
                  className="form-input font-mono"
                  value={reversalDate}
                  onChange={(e) => setReversalDate(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Reason for Reversal</label>
                <input
                  type="text"
                  placeholder="e.g. Error correction / Accrual reversal"
                  className="form-input"
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  disabled={reversing}
                  onClick={() => setShowReverseModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={reversing}
                  onClick={handleReverse}
                  className="btn btn-primary"
                  style={{ backgroundColor: '#7c3aed', borderColor: '#6d28d9' }}
                >
                  {reversing ? 'Reversing...' : 'Create Reversal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
