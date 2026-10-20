'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';
import { askReason, confirmAction, notify } from '@/lib/dialog-bus';

interface Contact {
  id: string;
  name: string;
  companyName?: string | null;
}

interface Account {
  id: string;
  code: string;
  name: string;
  accountType: string;
}

interface OpenInvoice {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  totalAmount: string;
  amountPaid: string;
}

interface CreditNoteLine {
  id?: string;
  accountId: string;
  description: string;
  netAmount: number;
  taxRate: number;
  taxAmount: number;
}

interface CreditNoteItem {
  id: string;
  creditNoteNumber: string;
  kind: 'SALES_CREDIT_NOTE' | 'SUPPLIER_CREDIT_NOTE';
  issueDate: string;
  reference?: string | null;
  subtotal: string;
  taxTotal: string;
  totalAmount: string;
  amountAllocated: string;
  status: 'DRAFT' | 'POSTED' | 'VOIDED';
  contact: {
    id: string;
    name: string;
  };
  journalEntry?: {
    id: string;
    journalNumber: string;
    status: string;
  } | null;
  lines?: {
    id: string;
    description: string;
    netAmount: string;
    taxAmount: string;
    lineTotal: string;
    account?: { code: string; name: string } | null;
  }[];
  allocations?: {
    id: string;
    amount: string;
    invoice?: { invoiceNumber: string } | null;
  }[];
}

export default function CreditNotesPage() {
  const { activeOrg, hasPermission } = useAuth();
  const [creditNotes, setCreditNotes] = useState<CreditNoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'POSTED' | 'VOIDED'>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCreditNote, setSelectedCreditNote] = useState<CreditNoteItem | null>(null);
  const [allocatingCN, setAllocatingCN] = useState<CreditNoteItem | null>(null);

  // Form state for creating credit note
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<CreditNoteLine[]>([
    { accountId: '', description: 'Credit adjustment', netAmount: 0, taxRate: 0.20, taxAmount: 0 },
  ]);
  const [submitting, setSubmitting] = useState(false);

  // Allocation modal state
  const [openInvoices, setOpenInvoices] = useState<OpenInvoice[]>([]);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [allocating, setAllocating] = useState(false);

  const canCreate = hasPermission('credit_note.create');
  const canPost = hasPermission('credit_note.post');
  const canVoid = hasPermission('credit_note.void');

  const loadCreditNotes = useCallback(async () => {
    if (!activeOrg) return;
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.append('kind', 'SALES_CREDIT_NOTE');
      if (statusFilter !== 'ALL') params.append('status', statusFilter);

      const res = await apiRequest<{ items: CreditNoteItem[]; total: number }>(`/credit-notes?${params.toString()}`);
      setCreditNotes(res.items || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load credit notes');
    } finally {
      setLoading(false);
    }
  }, [activeOrg, statusFilter]);

  const loadDependencies = useCallback(async () => {
    if (!activeOrg) return;
    try {
      const [custRes, accRes] = await Promise.all([
        apiRequest<{ items: Contact[] }>('/contacts?type=CUSTOMER'),
        apiRequest<{ items: Account[] }>('/accounts'),
      ]);
      setCustomers(custRes.items || []);
      setAccounts(accRes.items || []);
      if (accRes.items && accRes.items.length > 0) {
        // default first line account to first REVENUE or general account
        const rev = accRes.items.find((a) => a.accountType === 'REVENUE') || accRes.items[0];
        setLines((prev) => prev.map((l) => ({ ...l, accountId: l.accountId || rev.id })));
      }
    } catch {
      // non-critical
    }
  }, [activeOrg]);

  useEffect(() => {
    loadCreditNotes();
    loadDependencies();
  }, [loadCreditNotes, loadDependencies]);

  const handleLineChange = (idx: number, field: keyof CreditNoteLine, val: any) => {
    setLines((prev) => {
      const copy = [...prev];
      const cur = { ...copy[idx], [field]: val };
      if (field === 'netAmount' || field === 'taxRate') {
        const net = field === 'netAmount' ? Number(val || 0) : cur.netAmount;
        const rate = field === 'taxRate' ? Number(val || 0) : cur.taxRate;
        cur.taxAmount = Math.round(net * rate * 100) / 100;
      }
      copy[idx] = cur;
      return copy;
    });
  };

  const addLine = () => {
    const rev = accounts.find((a) => a.accountType === 'REVENUE') || accounts[0];
    setLines((prev) => [
      ...prev,
      { accountId: rev?.id || '', description: '', netAmount: 0, taxRate: 0.20, taxAmount: 0 },
    ]);
  };

  const removeLine = (idx: number) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      notify('Please select a customer');
      return;
    }

    const validLines = lines.filter((l) => l.accountId && l.netAmount > 0);
    if (validLines.length === 0) {
      notify('Please enter at least one line with an account and net amount greater than zero');
      return;
    }

    try {
      setSubmitting(true);
      await apiRequest('/credit-notes', {
        method: 'POST',
        body: JSON.stringify({
          kind: 'SALES_CREDIT_NOTE',
          contactId: selectedCustomerId,
          issueDate,
          reference: reference || undefined,
          notes: notes || undefined,
          lines: validLines.map((l) => ({
            accountId: l.accountId,
            description: l.description || 'Sales credit',
            netAmount: l.netAmount,
            taxRate: l.taxRate,
            taxAmount: l.taxAmount,
          })),
        }),
      });

      setShowCreateModal(false);
      setSelectedCustomerId('');
      setReference('');
      setNotes('');
      setLines([{ accountId: accounts[0]?.id || '', description: 'Credit adjustment', netAmount: 0, taxRate: 0.20, taxAmount: 0 }]);
      await loadCreditNotes();
    } catch (err: any) {
      notify(err.message || 'Failed to create credit note');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePost = async (id: string, num: string) => {
    if (!await confirmAction(`Post credit note ${num} to the General Ledger? This will record double-entry reversals and reduce customer balance.`)) return;

    try {
      await apiRequest(`/credit-notes/${id}/post`, { method: 'POST' });
      await loadCreditNotes();
    } catch (err: any) {
      notify(err.message || 'Failed to post credit note');
    }
  };

  const handleVoid = async (id: string) => {
    const reason = await askReason('Please enter the reason for voiding this credit note:');
    if (!reason || !reason.trim()) return;

    try {
      await apiRequest(`/credit-notes/${id}/void`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() }),
      });
      await loadCreditNotes();
    } catch (err: any) {
      notify(err.message || 'Failed to void credit note');
    }
  };

  const openAllocateModal = async (cn: CreditNoteItem) => {
    setAllocatingCN(cn);
    setAllocations({});
    try {
      const res = await apiRequest<{ items: OpenInvoice[] }>(
        `/invoices?contactId=${cn.contact.id}&status=POSTED`,
      );
      const open = (res.items || []).filter(
        (inv) => Number(inv.totalAmount) - Number(inv.amountPaid) > 0.001,
      );
      setOpenInvoices(open);
    } catch {
      setOpenInvoices([]);
    }
  };

  const handleAllocateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocatingCN) return;

    const allocationList = Object.entries(allocations).map(([invoiceId, amt]) => ({
      invoiceId,
      amount: amt,
    }));

    if (allocationList.length === 0) {
      notify('Please enter an amount to allocate');
      return;
    }

    try {
      setAllocating(true);
      await apiRequest(`/credit-notes/${allocatingCN.id}/allocate`, {
        method: 'POST',
        body: JSON.stringify({ allocations: allocationList }),
      });

      setAllocatingCN(null);
      await loadCreditNotes();
    } catch (err: any) {
      notify(err.message || 'Failed to allocate credit note');
    } finally {
      setAllocating(false);
    }
  };

  // Metrics
  const totalCredit = creditNotes
    .filter((c) => c.status === 'POSTED')
    .reduce((acc, curr) => acc + Number(curr.totalAmount || 0), 0);

  const totalAllocated = creditNotes
    .filter((c) => c.status === 'POSTED')
    .reduce((acc, curr) => acc + Number(curr.amountAllocated || 0), 0);

  const availableCredit = totalCredit - totalAllocated;

  return (
    <AppShell>
      <div className="bl-legacy">
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Sales Credit Notes</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Issue customer credit notes, reduce open invoice balances, and integrate with VAT and the General Ledger.
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            <span>+</span> New Credit Note
          </button>
        )}
      </div>

      {/* Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ backgroundColor: '#FFFFFF', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Credited</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.35rem' }}>
            £{totalCredit.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--success-text)', marginTop: '0.25rem' }}>Posted to General Ledger</div>
        </div>
        <div style={{ backgroundColor: '#FFFFFF', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Allocated to Invoices</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)', marginTop: '0.35rem' }}>
            £{totalAllocated.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Offset against sales invoices</div>
        </div>
        <div style={{ backgroundColor: '#FFFFFF', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Available Credit</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: availableCredit > 0 ? 'var(--warning-text)' : 'var(--text-muted)', marginTop: '0.35rem' }}>
            £{availableCredit.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Unapplied customer credit</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {(['ALL', 'DRAFT', 'POSTED', 'VOIDED'] as const).map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: '0.375rem',
              border: statusFilter === st ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
              backgroundColor: statusFilter === st ? 'var(--info-bg)' : '#FFFFFF',
              color: statusFilter === st ? 'var(--primary)' : 'var(--ink-2)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {st}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', borderRadius: '0.375rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {/* Credit Notes Table */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-app)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--ink-2)', fontWeight: 600 }}>
              <th style={{ padding: '0.75rem 1rem' }}>Credit Note</th>
              <th style={{ padding: '0.75rem 1rem' }}>Date</th>
              <th style={{ padding: '0.75rem 1rem' }}>Customer</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Subtotal</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>VAT</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Total</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Allocated</th>
              <th style={{ padding: '0.75rem 1rem' }}>Status</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading credit notes...
                </td>
              </tr>
            ) : creditNotes.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No sales credit notes recorded yet.
                </td>
              </tr>
            ) : (
              creditNotes.map((cn) => {
                const isDraft = cn.status === 'DRAFT';
                const isPosted = cn.status === 'POSTED';
                const isVoided = cn.status === 'VOIDED';
                const remaining = Number(cn.totalAmount) - Number(cn.amountAllocated);

                return (
                  <tr key={cn.id} style={{ borderBottom: '1px solid var(--bg-soft)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      {cn.creditNoteNumber}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>
                      {new Date(cn.issueDate).toLocaleDateString('en-GB')}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--ink-2)' }}>
                      {cn.contact.name}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      £{Number(cn.subtotal).toFixed(2)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--text-muted)' }}>
                      £{Number(cn.taxTotal).toFixed(2)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-main)' }}>
                      £{Number(cn.totalAmount).toFixed(2)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--success-text)' }}>
                      £{Number(cn.amountAllocated).toFixed(2)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor: isDraft ? 'var(--warning-bg)' : isPosted ? 'var(--success-bg)' : 'var(--bg-soft)',
                          color: isDraft ? 'var(--warning-text)' : isPosted ? 'var(--success-text)' : 'var(--text-muted)',
                        }}
                      >
                        {cn.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                      <button
                        onClick={() => setSelectedCreditNote(cn)}
                        style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 500, marginRight: '0.5rem' }}
                      >
                        View
                      </button>
                      {isDraft && canPost && (
                        <button
                          onClick={() => handlePost(cn.id, cn.creditNoteNumber)}
                          style={{ background: 'none', border: 'none', color: 'var(--success-text)', cursor: 'pointer', fontWeight: 600, marginRight: '0.5rem' }}
                        >
                          Post
                        </button>
                      )}
                      {isPosted && remaining > 0.001 && canPost && (
                        <button
                          onClick={() => openAllocateModal(cn)}
                          style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 500, marginRight: '0.5rem' }}
                        >
                          Allocate
                        </button>
                      )}
                      {!isVoided && canVoid && (
                        <button
                          onClick={() => handleVoid(cn.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 500 }}
                        >
                          Void
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

      {/* Create Modal */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '0.75rem',
              width: '100%',
              maxWidth: '750px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              padding: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>New Sales Credit Note</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink-2)', marginBottom: '0.35rem' }}>
                    Customer *
                  </label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-strong)', fontSize: '0.875rem' }}
                  >
                    <option value="">Select customer...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink-2)', marginBottom: '0.35rem' }}>
                    Issue Date *
                  </label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-strong)', fontSize: '0.875rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink-2)', marginBottom: '0.35rem' }}>
                    Reference
                  </label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="e.g. Return #4401"
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-strong)', fontSize: '0.875rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink-2)', marginBottom: '0.35rem' }}>
                    Notes
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Internal note"
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-strong)', fontSize: '0.875rem' }}
                  />
                </div>
              </div>

              {/* Line items */}
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-main)' }}>Line Items</div>
                  <button
                    type="button"
                    onClick={addLine}
                    style={{ background: 'var(--info-bg)', border: '1px solid var(--info-border)', color: 'var(--primary)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    + Add Line
                  </button>
                </div>

                <div style={{ border: '1px solid var(--border-subtle)', borderRadius: '0.375rem', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-app)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--ink-2)' }}>
                        <th style={{ padding: '0.5rem' }}>Account</th>
                        <th style={{ padding: '0.5rem' }}>Description</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right', width: '100px' }}>Net (£)</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right', width: '90px' }}>VAT (£)</th>
                        <th style={{ padding: '0.5rem', width: '30px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--bg-soft)' }}>
                          <td style={{ padding: '0.5rem' }}>
                            <select
                              value={l.accountId}
                              onChange={(e) => handleLineChange(idx, 'accountId', e.target.value)}
                              required
                              style={{ width: '100%', padding: '0.25rem', fontSize: '0.8rem', border: '1px solid var(--border-strong)', borderRadius: '0.25rem' }}
                            >
                              {accounts.map((a) => (
                                <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            <input
                              type="text"
                              value={l.description}
                              onChange={(e) => handleLineChange(idx, 'description', e.target.value)}
                              placeholder="Description"
                              required
                              style={{ width: '100%', padding: '0.25rem', fontSize: '0.8rem', border: '1px solid var(--border-strong)', borderRadius: '0.25rem' }}
                            />
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={l.netAmount || ''}
                              onChange={(e) => handleLineChange(idx, 'netAmount', e.target.value)}
                              placeholder="0.00"
                              required
                              style={{ width: '100%', padding: '0.25rem', fontSize: '0.8rem', border: '1px solid var(--border-strong)', borderRadius: '0.25rem', textAlign: 'right' }}
                            />
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                            <input
                              type="number"
                              step="0.01"
                              value={l.taxAmount || ''}
                              onChange={(e) => handleLineChange(idx, 'taxAmount', e.target.value)}
                              placeholder="0.00"
                              style={{ width: '100%', padding: '0.25rem', fontSize: '0.8rem', border: '1px solid var(--border-strong)', borderRadius: '0.25rem', textAlign: 'right' }}
                            />
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                            {lines.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeLine(idx)}
                                style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 'bold' }}
                              >
                                ✕
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: '1px solid var(--border-strong)', backgroundColor: '#FFFFFF', color: 'var(--ink-2)', cursor: 'pointer', fontWeight: 500 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ padding: '0.5rem 1.25rem', borderRadius: '0.375rem', border: 'none', backgroundColor: 'var(--primary)', color: '#FFFFFF', cursor: 'pointer', fontWeight: 600 }}
                >
                  {submitting ? 'Creating...' : 'Create Draft Credit Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Allocate Modal */}
      {allocatingCN && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '0.75rem',
              width: '100%',
              maxWidth: '600px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              padding: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                Allocate Credit Note {allocatingCN.creditNoteNumber}
              </h2>
              <button
                onClick={() => setAllocatingCN(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Available credit to allocate: <strong>£{(Number(allocatingCN.totalAmount) - Number(allocatingCN.amountAllocated)).toFixed(2)}</strong>
            </p>

            <form onSubmit={handleAllocateSubmit}>
              {openInvoices.length === 0 ? (
                <div style={{ padding: '1rem', backgroundColor: 'var(--bg-app)', borderRadius: '0.375rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No open invoices available for customer {allocatingCN.contact.name}.
                </div>
              ) : (
                <div style={{ border: '1px solid var(--border-subtle)', borderRadius: '0.375rem', overflow: 'hidden', marginBottom: '1.25rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-app)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--ink-2)' }}>
                        <th style={{ padding: '0.5rem' }}>Invoice</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Total</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Due</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right', width: '120px' }}>Apply (£)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openInvoices.map((inv) => {
                        const bal = Number(inv.totalAmount) - Number(inv.amountPaid);
                        return (
                          <tr key={inv.id} style={{ borderBottom: '1px solid var(--bg-soft)' }}>
                            <td style={{ padding: '0.5rem', fontWeight: 600 }}>{inv.invoiceNumber}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>£{Number(inv.totalAmount).toFixed(2)}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--danger)', fontWeight: 600 }}>£{bal.toFixed(2)}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                              <input
                                type="number"
                                step="0.01"
                                max={bal}
                                value={allocations[inv.id] ?? ''}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  if (isNaN(val) || val <= 0) {
                                    setAllocations((prev) => {
                                      const next = { ...prev };
                                      delete next[inv.id];
                                      return next;
                                    });
                                  } else {
                                    setAllocations((prev) => ({ ...prev, [inv.id]: val }));
                                  }
                                }}
                                placeholder="0.00"
                                style={{ width: '100%', padding: '0.25rem 0.5rem', fontSize: '0.8rem', border: '1px solid var(--border-strong)', borderRadius: '0.25rem', textAlign: 'right' }}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setAllocatingCN(null)}
                  style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: '1px solid var(--border-strong)', backgroundColor: '#FFFFFF', color: 'var(--ink-2)', cursor: 'pointer', fontWeight: 500 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={allocating || openInvoices.length === 0}
                  style={{ padding: '0.5rem 1.25rem', borderRadius: '0.375rem', border: 'none', backgroundColor: 'var(--primary)', color: '#FFFFFF', cursor: 'pointer', fontWeight: 600 }}
                >
                  {allocating ? 'Applying...' : 'Apply Credit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {selectedCreditNote && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '0.75rem',
              width: '100%',
              maxWidth: '550px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              padding: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                Credit Note {selectedCreditNote.creditNoteNumber}
              </h2>
              <button
                onClick={() => setSelectedCreditNote(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
              <div><strong>Customer:</strong> {selectedCreditNote.contact.name}</div>
              <div><strong>Date:</strong> {new Date(selectedCreditNote.issueDate).toLocaleDateString('en-GB')}</div>
              <div><strong>Subtotal:</strong> £{Number(selectedCreditNote.subtotal).toFixed(2)}</div>
              <div><strong>VAT Total:</strong> £{Number(selectedCreditNote.taxTotal).toFixed(2)}</div>
              <div><strong>Total:</strong> £{Number(selectedCreditNote.totalAmount).toFixed(2)}</div>
              <div><strong>Allocated:</strong> £{Number(selectedCreditNote.amountAllocated).toFixed(2)}</div>
              <div><strong>Status:</strong> {selectedCreditNote.status}</div>
              <div><strong>Journal:</strong> {selectedCreditNote.journalEntry?.journalNumber || '—'}</div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', marginTop: '1rem' }}>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>Allocations</div>
              {!selectedCreditNote.allocations || selectedCreditNote.allocations.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                  No active allocations for this credit note.
                </div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem' }}>
                  {selectedCreditNote.allocations.map((a) => (
                    <li key={a.id} style={{ marginBottom: '0.25rem' }}>
                      £{Number(a.amount).toFixed(2)} allocated to Invoice {a.invoice?.invoiceNumber || '—'}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button
                onClick={() => setSelectedCreditNote(null)}
                style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: '1px solid var(--border-strong)', backgroundColor: '#FFFFFF', color: 'var(--ink-2)', cursor: 'pointer', fontWeight: 500 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </AppShell>
  );
}
