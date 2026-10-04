'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';

interface Contact {
  id: string;
  name: string;
  companyName?: string | null;
  currency?: string | null;
  paymentTermsDays?: number;
}

interface NominalAccount {
  id: string;
  code: string;
  name: string;
  accountType: string;
}

interface LineItem {
  id: string;
  accountId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

function NewInvoiceForm() {
  const { activeOrg } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialContactId = searchParams.get('contactId') || '';

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [revenueAccounts, setRevenueAccounts] = useState<NominalAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const today = new Date().toISOString().slice(0, 10);
  const [contactId, setContactId] = useState(initialContactId);
  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('Payment is due within agreed terms.');
  const [terms, setTerms] = useState('Standard 30 days commercial credit.');

  const [lines, setLines] = useState<LineItem[]>([
    {
      id: '1',
      accountId: '',
      description: 'Consulting & Advisory Services',
      quantity: 1,
      unitPrice: 500,
      taxRate: 0.20,
    },
  ]);

  useEffect(() => {
    async function loadPrerequisites() {
      if (!activeOrg) return;
      try {
        setLoading(true);
        const [contactsData, accountsData] = await Promise.all([
          apiRequest<Contact[]>('/contacts?type=CUSTOMER'),
          apiRequest<NominalAccount[]>('/accounts'),
        ]);

        const customerList = Array.isArray(contactsData) ? contactsData : [];
        setContacts(customerList);
        if (!contactId && customerList.length > 0) {
          setContactId(customerList[0].id);
        }

        const revAccs = (Array.isArray(accountsData) ? accountsData : []).filter(
          (a) => a.accountType === 'REVENUE' || a.code.startsWith('4'),
        );
        setRevenueAccounts(revAccs);

        // Set default account for line 1
        const defaultAcc = revAccs.find((a) => a.code === '4000') || revAccs[0];
        if (defaultAcc) {
          setLines((prev) =>
            prev.map((l) => (l.accountId ? l : { ...l, accountId: defaultAcc.id })),
          );
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load customers or chart of accounts');
      } finally {
        setLoading(false);
      }
    }
    loadPrerequisites();
  }, [activeOrg]);

  const addLine = () => {
    const defaultAcc = revenueAccounts.find((a) => a.code === '4000') || revenueAccounts[0];
    setLines((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        accountId: defaultAcc ? defaultAcc.id : '',
        description: '',
        quantity: 1,
        unitPrice: 0,
        taxRate: 0.20,
      },
    ]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, idx) => idx !== index));
  };

  const updateLine = (index: number, updates: Partial<LineItem>) => {
    setLines((prev) =>
      prev.map((line, idx) => (idx === index ? { ...line, ...updates } : line)),
    );
  };

  // Calculations
  const calculatedLines = lines.map((l) => {
    const net = (l.quantity || 0) * (l.unitPrice || 0);
    const tax = net * (l.taxRate || 0);
    const total = net + tax;
    return { ...l, net, tax, total };
  });

  const subtotal = calculatedLines.reduce((acc, curr) => acc + curr.net, 0);
  const taxTotal = calculatedLines.reduce((acc, curr) => acc + curr.tax, 0);
  const totalAmount = subtotal + taxTotal;

  const handleSubmit = async (postToLedger: boolean) => {
    if (!contactId) {
      alert('Please select a customer');
      return;
    }
    if (lines.some((l) => !l.accountId || !l.description.trim())) {
      alert('Please provide account and description for every line item');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // 1. Create invoice
      const invoice = await apiRequest('/invoices', {
        method: 'POST',
        body: JSON.stringify({
          contactId,
          issueDate,
          dueDate,
          reference: reference.trim() || undefined,
          notes,
          terms,
          lines: lines.map((l) => ({
            accountId: l.accountId,
            description: l.description.trim(),
            quantity: Number(l.quantity),
            unitPrice: Number(l.unitPrice),
            taxRate: Number(l.taxRate),
          })),
        }),
      });

      // 2. Post to ledger if requested
      if (postToLedger) {
        await apiRequest(`/invoices/${invoice.id}/post`, { method: 'POST' });
      }

      router.push(`/sales/invoices/${invoice.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to save sales invoice');
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <Link href="/sales/invoices" style={{ color: '#64748B', textDecoration: 'none', fontSize: '0.85rem' }}>
                &larr; Back to Invoices
              </Link>
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>Create Sales Invoice</h1>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={submitting}
              onClick={() => handleSubmit(false)}
            >
              Save as Draft
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={submitting}
              onClick={() => handleSubmit(true)}
            >
              {submitting ? 'Posting...' : 'Save & Post to General Ledger'}
            </button>
          </div>
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>{error}</div>}

        {/* Invoice Header Details Card */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#0F172A', marginBottom: '1rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.5rem' }}>
            Invoice Header & Customer
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Customer *</label>
              <select
                className="form-input"
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
              >
                {contacts.length === 0 ? (
                  <option value="">No customers found — add one first</option>
                ) : (
                  contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.companyName ? `(${c.companyName})` : ''}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Reference / PO #</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. PO-9842"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Issue Date</label>
              <input
                type="date"
                required
                className="form-input"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Due Date</label>
              <input
                type="date"
                required
                className="form-input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Line Items Table Card */}
        <div className="card" style={{ marginBottom: '1.5rem', padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#0F172A', margin: 0 }}>
              Line Items & Commercial Services
            </h2>
            <button type="button" className="btn btn-secondary btn-sm" onClick={addLine}>
              + Add Item
            </button>
          </div>

          <div className="table-responsive">
            <table className="table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>Revenue Account</th>
                  <th style={{ width: '30%' }}>Description</th>
                  <th style={{ width: '10%', textAlign: 'right' }}>Qty</th>
                  <th style={{ width: '13%', textAlign: 'right' }}>Unit Price</th>
                  <th style={{ width: '12%' }}>VAT Rate</th>
                  <th style={{ width: '13%', textAlign: 'right' }}>Line Total</th>
                  <th style={{ width: '5%' }}></th>
                </tr>
              </thead>
              <tbody>
                {calculatedLines.map((line, index) => (
                  <tr key={line.id}>
                    <td>
                      <select
                        className="form-input"
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                        value={line.accountId}
                        onChange={(e) => updateLine(index, { accountId: e.target.value })}
                      >
                        {revenueAccounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} - {a.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Item or service description"
                        style={{ fontSize: '0.85rem', padding: '0.35rem 0.5rem' }}
                        value={line.description}
                        onChange={(e) => updateLine(index, { description: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        className="form-input"
                        style={{ fontSize: '0.85rem', padding: '0.35rem 0.5rem', textAlign: 'right' }}
                        value={line.quantity}
                        onChange={(e) => updateLine(index, { quantity: parseFloat(e.target.value) || 0 })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="form-input"
                        style={{ fontSize: '0.85rem', padding: '0.35rem 0.5rem', textAlign: 'right' }}
                        value={line.unitPrice}
                        onChange={(e) => updateLine(index, { unitPrice: parseFloat(e.target.value) || 0 })}
                      />
                    </td>
                    <td>
                      <select
                        className="form-input"
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                        value={line.taxRate}
                        onChange={(e) => updateLine(index, { taxRate: parseFloat(e.target.value) || 0 })}
                      >
                        <option value={0.20}>Standard VAT (20%)</option>
                        <option value={0.05}>Reduced VAT (5%)</option>
                        <option value={0}>Zero Rated / Exempt (0%)</option>
                      </select>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#0F172A', verticalAlign: 'middle' }}>
                      £{line.total.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                      <button
                        type="button"
                        onClick={() => removeLine(index)}
                        style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '1.1rem' }}
                        title="Delete line"
                      >
                        &times;
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Invoice Summary and Footer */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', marginBottom: '2rem' }}>
          <div className="card">
            <div className="form-group">
              <label className="form-label">Client Notes & Payment Instructions</label>
              <textarea
                className="form-input"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Terms & Conditions</label>
              <input
                type="text"
                className="form-input"
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
              />
            </div>
          </div>

          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0F172A', marginBottom: '1rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.5rem' }}>
              Financial Summary
            </h3>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#64748B' }}>
              <span>Subtotal (Net)</span>
              <span>£{subtotal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.875rem', color: '#64748B' }}>
              <span>VAT / Sales Tax</span>
              <span>£{taxTotal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #E2E8F0', paddingTop: '0.75rem', fontSize: '1.15rem', fontWeight: 700, color: '#0F172A' }}>
              <span>Total Invoiced</span>
              <span style={{ color: '#2563EB' }}>
                £{totalAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #F1F5F9' }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', marginBottom: '0.5rem' }}
                disabled={submitting}
                onClick={() => handleSubmit(true)}
              >
                {submitting ? 'Processing...' : 'Save & Post to General Ledger'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: '100%' }}
                disabled={submitting}
                onClick={() => handleSubmit(false)}
              >
                Save as Draft
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function NewInvoicePage() {
  return (
    <Suspense fallback={<div style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>Loading invoice builder...</div>}>
      <NewInvoiceForm />
    </Suspense>
  );
}

