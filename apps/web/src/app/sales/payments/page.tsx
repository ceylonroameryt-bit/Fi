'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';

interface Contact {
  id: string;
  name: string;
  companyName?: string | null;
}

interface OpenInvoice {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  totalAmount: string;
  amountPaid: string;
}

interface PaymentAllocation {
  id: string;
  amount: string;
  allocationDate: string;
  invoice?: {
    id: string;
    invoiceNumber: string;
    totalAmount: string;
  } | null;
}

interface PaymentItem {
  id: string;
  kind: 'CUSTOMER_RECEIPT' | 'SUPPLIER_PAYMENT' | 'CUSTOMER_REFUND' | 'SUPPLIER_REFUND';
  paymentDate: string;
  amount: string;
  amountAllocated: string;
  currency: string;
  reference?: string | null;
  notes?: string | null;
  status: 'POSTED' | 'VOIDED';
  contact: {
    id: string;
    name: string;
  };
  journalEntry?: {
    id: string;
    journalNumber: string;
    status: string;
  } | null;
  allocations?: PaymentAllocation[];
}

export default function SalesPaymentsPage() {
  const { activeOrg, hasPermission } = useAuth();
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'POSTED' | 'VOIDED'>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentItem | null>(null);

  // Form state
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [openInvoices, setOpenInvoices] = useState<OpenInvoice[]>([]);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const canCreate = hasPermission('payment.create');
  const canVoid = hasPermission('payment.void');

  const loadPayments = useCallback(async () => {
    if (!activeOrg) return;
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.append('kind', 'CUSTOMER_RECEIPT');
      if (statusFilter !== 'ALL') params.append('status', statusFilter);

      const res = await apiRequest<{ items: PaymentItem[]; total: number }>(`/payments?${params.toString()}`);
      setPayments(res.items || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load customer receipts');
    } finally {
      setLoading(false);
    }
  }, [activeOrg, statusFilter]);

  const loadCustomers = useCallback(async () => {
    if (!activeOrg) return;
    try {
      const res = await apiRequest<{ items: Contact[] }>('/contacts?type=CUSTOMER');
      setCustomers(res.items || []);
    } catch {
      // non-critical
    }
  }, [activeOrg]);

  useEffect(() => {
    loadPayments();
    loadCustomers();
  }, [loadPayments, loadCustomers]);

  // When customer changes, load open posted invoices for that customer
  useEffect(() => {
    if (!selectedCustomerId) {
      setOpenInvoices([]);
      setAllocations({});
      return;
    }

    const fetchInvoices = async () => {
      try {
        const res = await apiRequest<{ items: OpenInvoice[] }>(
          `/invoices?contactId=${selectedCustomerId}&status=POSTED`,
        );
        const open = (res.items || []).filter(
          (inv) => Number(inv.totalAmount) - Number(inv.amountPaid) > 0.001,
        );
        setOpenInvoices(open);
        setAllocations({});
      } catch {
        setOpenInvoices([]);
      }
    };

    fetchInvoices();
  }, [selectedCustomerId]);

  const handlePayInFull = (inv: OpenInvoice) => {
    const balance = Number(inv.totalAmount) - Number(inv.amountPaid);
    setAllocations((prev) => ({
      ...prev,
      [inv.id]: Math.round(balance * 100) / 100,
    }));
  };

  const handleAllocationChange = (invId: string, val: string) => {
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) {
      setAllocations((prev) => {
        const next = { ...prev };
        delete next[invId];
        return next;
      });
    } else {
      setAllocations((prev) => ({ ...prev, [invId]: num }));
    }
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !amount) {
      alert('Please select a customer and enter an amount');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Amount must be greater than zero');
      return;
    }

    const allocationList = Object.entries(allocations).map(([invoiceId, amt]) => ({
      invoiceId,
      amount: amt,
    }));

    const totalAllocated = allocationList.reduce((acc, a) => acc + a.amount, 0);
    if (totalAllocated > numAmount + 0.001) {
      alert(`Allocated amount (£${totalAllocated.toFixed(2)}) cannot exceed total receipt (£${numAmount.toFixed(2)})`);
      return;
    }

    try {
      setSubmitting(true);
      await apiRequest('/payments', {
        method: 'POST',
        body: JSON.stringify({
          kind: 'CUSTOMER_RECEIPT',
          contactId: selectedCustomerId,
          paymentDate,
          amount: numAmount,
          reference: reference || undefined,
          notes: notes || undefined,
          allocations: allocationList.length > 0 ? allocationList : undefined,
        }),
      });

      setShowModal(false);
      setSelectedCustomerId('');
      setAmount('');
      setReference('');
      setNotes('');
      setAllocations({});
      await loadPayments();
    } catch (err: any) {
      alert(err.message || 'Failed to record customer receipt');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoidPayment = async (paymentId: string) => {
    const reason = prompt('Please enter the reason for voiding this receipt (will reverse general ledger entries and allocations):');
    if (!reason || !reason.trim()) return;

    try {
      await apiRequest(`/payments/${paymentId}/void`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() }),
      });
      await loadPayments();
    } catch (err: any) {
      alert(err.message || 'Failed to void receipt');
    }
  };

  // Metrics
  const totalReceived = payments
    .filter((p) => p.status === 'POSTED')
    .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

  const totalAllocated = payments
    .filter((p) => p.status === 'POSTED')
    .reduce((acc, curr) => acc + Number(curr.amountAllocated || 0), 0);

  const unallocatedBalance = totalReceived - totalAllocated;

  return (
    <AppShell>
      <div className="bl-legacy">
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Customer Receipts</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Record incoming customer payments, allocate against sales invoices, and post directly to the General Ledger.
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowModal(true)}
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
            <span>+</span> Record Receipt
          </button>
        )}
      </div>

      {/* Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ backgroundColor: '#FFFFFF', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Received</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.35rem' }}>
            £{totalReceived.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--success-text)', marginTop: '0.25rem' }}>Posted to Bank Account</div>
        </div>
        <div style={{ backgroundColor: '#FFFFFF', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Allocated to Invoices</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success-text)', marginTop: '0.35rem' }}>
            £{totalAllocated.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Applied to Debtors Control</div>
        </div>
        <div style={{ backgroundColor: '#FFFFFF', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Unallocated Balance</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: unallocatedBalance > 0 ? 'var(--warning-text)' : 'var(--text-muted)', marginTop: '0.35rem' }}>
            £{unallocatedBalance.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Available for future allocation</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {(['ALL', 'POSTED', 'VOIDED'] as const).map((st) => (
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

      {/* Receipts Table */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-app)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--ink-2)', fontWeight: 600 }}>
              <th style={{ padding: '0.75rem 1rem' }}>Date</th>
              <th style={{ padding: '0.75rem 1rem' }}>Reference</th>
              <th style={{ padding: '0.75rem 1rem' }}>Customer</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Amount</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Allocated</th>
              <th style={{ padding: '0.75rem 1rem' }}>Journal</th>
              <th style={{ padding: '0.75rem 1rem' }}>Status</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading customer receipts...
                </td>
              </tr>
            ) : payments.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No customer receipts recorded yet.
                </td>
              </tr>
            ) : (
              payments.map((p) => {
                const isVoided = p.status === 'VOIDED';
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--bg-soft)' }}>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-main)' }}>
                      {new Date(p.paymentDate).toLocaleDateString('en-GB')}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 500, color: 'var(--text-main)' }}>
                      {p.reference || '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--ink-2)' }}>
                      {p.contact.name}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-main)' }}>
                      £{Number(p.amount).toFixed(2)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--success-text)' }}>
                      £{Number(p.amountAllocated).toFixed(2)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {p.journalEntry?.journalNumber || '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor: isVoided ? 'var(--bg-soft)' : 'var(--success-bg)',
                          color: isVoided ? 'var(--text-muted)' : 'var(--success-text)',
                        }}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                      <button
                        onClick={() => setSelectedPayment(p)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary)',
                          cursor: 'pointer',
                          fontWeight: 500,
                          marginRight: '0.75rem',
                        }}
                      >
                        View
                      </button>
                      {!isVoided && canVoid && (
                        <button
                          onClick={() => handleVoidPayment(p.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--danger)',
                            cursor: 'pointer',
                            fontWeight: 500,
                          }}
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

      {/* Record Receipt Modal */}
      {showModal && (
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
              maxWidth: '650px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              padding: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>Record Customer Receipt</h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePayment}>
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
                      <option key={c.id} value={c.id}>
                        {c.name} {c.companyName ? `(${c.companyName})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink-2)', marginBottom: '0.35rem' }}>
                    Receipt Date *
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-strong)', fontSize: '0.875rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink-2)', marginBottom: '0.35rem' }}>
                    Amount Received (£) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    required
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-strong)', fontSize: '0.875rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink-2)', marginBottom: '0.35rem' }}>
                    Reference (BACS / Cheque)
                  </label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="e.g. BACS-98214"
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-strong)', fontSize: '0.875rem' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink-2)', marginBottom: '0.35rem' }}>
                  Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional internal note"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-strong)', fontSize: '0.875rem' }}
                />
              </div>

              {/* Open Invoices Allocation Section */}
              {selectedCustomerId && (
                <div style={{ marginTop: '1.25rem', marginBottom: '1.25rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-main)' }}>
                      Allocate to Open Invoices ({openInvoices.length})
                    </div>
                  </div>

                  {openInvoices.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                      No open invoices for this customer. Receipt will remain unallocated for future use.
                    </div>
                  ) : (
                    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: '0.375rem', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--bg-app)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--ink-2)' }}>
                            <th style={{ padding: '0.5rem' }}>Invoice</th>
                            <th style={{ padding: '0.5rem' }}>Date</th>
                            <th style={{ padding: '0.5rem', textAlign: 'right' }}>Total</th>
                            <th style={{ padding: '0.5rem', textAlign: 'right' }}>Due</th>
                            <th style={{ padding: '0.5rem', textAlign: 'right', width: '130px' }}>Allocate (£)</th>
                            <th style={{ padding: '0.5rem', width: '60px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {openInvoices.map((inv) => {
                            const bal = Number(inv.totalAmount) - Number(inv.amountPaid);
                            return (
                              <tr key={inv.id} style={{ borderBottom: '1px solid var(--bg-soft)' }}>
                                <td style={{ padding: '0.5rem', fontWeight: 600 }}>{inv.invoiceNumber}</td>
                                <td style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>
                                  {new Date(inv.issueDate).toLocaleDateString('en-GB')}
                                </td>
                                <td style={{ padding: '0.5rem', textAlign: 'right' }}>£{Number(inv.totalAmount).toFixed(2)}</td>
                                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600, color: 'var(--danger)' }}>
                                  £{bal.toFixed(2)}
                                </td>
                                <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                                  <input
                                    type="number"
                                    step="0.01"
                                    max={bal}
                                    value={allocations[inv.id] ?? ''}
                                    onChange={(e) => handleAllocationChange(inv.id, e.target.value)}
                                    placeholder="0.00"
                                    style={{ width: '100%', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border-strong)', fontSize: '0.8rem', textAlign: 'right' }}
                                  />
                                </td>
                                <td style={{ padding: '0.5rem' }}>
                                  <button
                                    type="button"
                                    onClick={() => handlePayInFull(inv)}
                                    style={{ background: 'var(--info-bg)', border: '1px solid var(--info-border)', color: 'var(--primary)', fontSize: '0.7rem', padding: '0.2rem 0.4rem', borderRadius: '0.25rem', cursor: 'pointer' }}
                                  >
                                    Full
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: '1px solid var(--border-strong)', backgroundColor: '#FFFFFF', color: 'var(--ink-2)', cursor: 'pointer', fontWeight: 500 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ padding: '0.5rem 1.25rem', borderRadius: '0.375rem', border: 'none', backgroundColor: 'var(--primary)', color: '#FFFFFF', cursor: 'pointer', fontWeight: 600 }}
                >
                  {submitting ? 'Posting...' : 'Post Customer Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {selectedPayment && (
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
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>Receipt Details</h2>
              <button
                onClick={() => setSelectedPayment(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
              <div><strong>Customer:</strong> {selectedPayment.contact.name}</div>
              <div><strong>Date:</strong> {new Date(selectedPayment.paymentDate).toLocaleDateString('en-GB')}</div>
              <div><strong>Amount:</strong> £{Number(selectedPayment.amount).toFixed(2)}</div>
              <div><strong>Allocated:</strong> £{Number(selectedPayment.amountAllocated).toFixed(2)}</div>
              <div><strong>Status:</strong> {selectedPayment.status}</div>
              <div><strong>Journal:</strong> {selectedPayment.journalEntry?.journalNumber || '—'}</div>
              {selectedPayment.reference && <div><strong>Reference:</strong> {selectedPayment.reference}</div>}
              {selectedPayment.notes && <div><strong>Notes:</strong> {selectedPayment.notes}</div>}
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', marginTop: '1rem' }}>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>Allocations</div>
              {!selectedPayment.allocations || selectedPayment.allocations.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                  No active invoice allocations for this receipt.
                </div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem' }}>
                  {selectedPayment.allocations.map((a) => (
                    <li key={a.id} style={{ marginBottom: '0.25rem' }}>
                      £{Number(a.amount).toFixed(2)} allocated to Invoice {a.invoice?.invoiceNumber || '—'} on {new Date(a.allocationDate).toLocaleDateString('en-GB')}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button
                onClick={() => setSelectedPayment(null)}
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
