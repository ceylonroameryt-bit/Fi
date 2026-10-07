'use client';

import React, { useEffect, useState, use, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';

interface ContactPerson {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  isPrimary: boolean;
  isBillingContact: boolean;
  isActive: boolean;
  createdAt: string;
}

interface LinkedAccount {
  id: string;
  code: string;
  name: string;
  accountType: string;
  accountSubtype: string;
}

interface ContactDetail {
  id: string;
  type: 'CUSTOMER' | 'SUPPLIER' | 'BOTH';
  status: 'ACTIVE' | 'ARCHIVED';
  name: string;
  companyName?: string | null;
  companyNumber?: string | null;
  vatNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  taxNumber?: string | null;
  currency?: string | null;
  paymentTermsDays: number;
  creditLimit?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postcode?: string | null;
  country: string;
  shippingAddressLine1?: string | null;
  shippingAddressLine2?: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
  shippingPostcode?: string | null;
  shippingCountry?: string | null;
  notes?: string | null;
  receivableAccountId?: string | null;
  payableAccountId?: string | null;
  receivableAccount?: LinkedAccount | null;
  payableAccount?: LinkedAccount | null;
  primaryPerson?: ContactPerson | null;
  people: ContactPerson[];
  outstandingReceivableBalance: string;
  outstandingPayableBalance: string;
  _count?: {
    invoices: number;
  };
}

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  totalAmount: string;
  amountPaid: string;
  status: string;
}

interface StatementItem {
  id: string;
  date: string;
  postingDate: string;
  journalId: string;
  journalNumber: string;
  reference: string | null;
  sourceType: string;
  description: string;
  debit: string;
  credit: string;
  runningBalance: string;
}

interface StatementResponse {
  contactId: string;
  contactName: string;
  currency: string;
  from: string | null;
  to: string | null;
  openingBalance: string;
  closingBalance: string;
  items: StatementItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface ActivityItem {
  id: string;
  timestamp: string;
  type: string;
  title: string;
  description: string;
  reference?: string | null;
  amount?: string | null;
}

export default function ContactProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const contactId = resolvedParams.id;
  const router = useRouter();
  const { activeOrg, hasPermission } = useAuth();

  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'statement' | 'activity' | 'people' | 'accounting'>('overview');

  // Invoices tab state
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  // Statement tab state
  const [statement, setStatement] = useState<StatementResponse | null>(null);
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementFrom, setStatementFrom] = useState('');
  const [statementTo, setStatementTo] = useState('');

  // Activity tab state
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Edit contact modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});
  const [savingEdit, setSavingEdit] = useState(false);

  // Add person modal state
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [personFormData, setPersonFormData] = useState({
    firstName: '',
    lastName: '',
    jobTitle: '',
    email: '',
    phone: '',
    mobile: '',
    isPrimary: false,
    isBillingContact: false,
  });
  const [savingPerson, setSavingPerson] = useState(false);

  // Archive modal
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);

  const canEdit = hasPermission('contact.edit');
  const canArchive = hasPermission('contact.archive');

  const loadContact = useCallback(async () => {
    if (!activeOrg || !contactId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await apiRequest<ContactDetail>(`/contacts/${contactId}`);
      setContact(data);
      setEditFormData({
        name: data.name,
        companyName: data.companyName || '',
        companyNumber: data.companyNumber || '',
        vatNumber: data.vatNumber || '',
        email: data.email || '',
        phone: data.phone || '',
        website: data.website || '',
        taxNumber: data.taxNumber || '',
        paymentTermsDays: data.paymentTermsDays,
        creditLimit: data.creditLimit ? parseFloat(data.creditLimit) : '',
        addressLine1: data.addressLine1 || '',
        addressLine2: data.addressLine2 || '',
        city: data.city || '',
        state: data.state || '',
        postcode: data.postcode || '',
        country: data.country || 'GB',
        shippingAddressLine1: data.shippingAddressLine1 || '',
        shippingAddressLine2: data.shippingAddressLine2 || '',
        shippingCity: data.shippingCity || '',
        shippingState: data.shippingState || '',
        shippingPostcode: data.shippingPostcode || '',
        shippingCountry: data.shippingCountry || 'GB',
        notes: data.notes || '',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load contact');
    } finally {
      setLoading(false);
    }
  }, [activeOrg, contactId]);

  useEffect(() => {
    loadContact();
  }, [loadContact]);

  const loadStatement = useCallback(async () => {
    if (!contactId) return;
    try {
      setStatementLoading(true);
      const params = new URLSearchParams();
      if (statementFrom) params.append('from', statementFrom);
      if (statementTo) params.append('to', statementTo);
      const res = await apiRequest<StatementResponse>(`/contacts/${contactId}/statement?${params.toString()}`);
      setStatement(res);
    } catch {
      // Ignored
    } finally {
      setStatementLoading(false);
    }
  }, [contactId, statementFrom, statementTo]);

  // Lazy tab loaders
  useEffect(() => {
    if (!activeOrg || !contactId) return;

    if (activeTab === 'invoices') {
      setInvoicesLoading(true);
      apiRequest<{ items: InvoiceRow[] }>(`/invoices?contactId=${contactId}&pageSize=50`)
        .then((res) => setInvoices(res.items || []))
        .catch(() => {})
        .finally(() => setInvoicesLoading(false));
    } else if (activeTab === 'statement') {
      loadStatement();
    } else if (activeTab === 'activity') {
      setActivityLoading(true);
      apiRequest<{ items: ActivityItem[] }>(`/contacts/${contactId}/activity`)
        .then((res) => setActivities(res.items || []))
        .catch(() => {})
        .finally(() => setActivityLoading(false));
    }
  }, [activeTab, activeOrg, contactId, loadStatement]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingEdit(true);
      await apiRequest(`/contacts/${contactId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...editFormData,
          creditLimit: editFormData.creditLimit ? parseFloat(editFormData.creditLimit) : undefined,
          paymentTermsDays: Number(editFormData.paymentTermsDays),
        }),
      });
      setShowEditModal(false);
      await loadContact();
    } catch (err: any) {
      alert(err.message || 'Failed to update contact');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleAddPersonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personFormData.firstName || !personFormData.lastName) return;
    try {
      setSavingPerson(true);
      await apiRequest(`/contacts/${contactId}/people`, {
        method: 'POST',
        body: JSON.stringify(personFormData),
      });
      setShowAddPersonModal(false);
      setPersonFormData({
        firstName: '',
        lastName: '',
        jobTitle: '',
        email: '',
        phone: '',
        mobile: '',
        isPrimary: false,
        isBillingContact: false,
      });
      await loadContact();
    } catch (err: any) {
      alert(err.message || 'Failed to add contact person');
    } finally {
      setSavingPerson(false);
    }
  };

  const handleSetPrimaryPerson = async (personId: string) => {
    try {
      await apiRequest(`/contacts/${contactId}/people/${personId}/primary`, { method: 'POST' });
      await loadContact();
    } catch (err: any) {
      alert(err.message || 'Failed to set primary contact person');
    }
  };

  const handleDeactivatePerson = async (personId: string) => {
    try {
      await apiRequest(`/contacts/${contactId}/people/${personId}/deactivate`, { method: 'POST' });
      await loadContact();
    } catch (err: any) {
      alert(err.message || 'Failed to deactivate contact person');
    }
  };

  const handleToggleArchive = async () => {
    if (!contact) return;
    try {
      setActionInProgress(true);
      const action = contact.status === 'ARCHIVED' ? 'restore' : 'archive';
      await apiRequest(`/contacts/${contact.id}/${action}`, { method: 'POST' });
      setShowArchiveConfirm(false);
      await loadContact();
    } catch (err: any) {
      alert(err.message || 'Failed to change contact archive status');
    } finally {
      setActionInProgress(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div style={{ textAlign: 'center', padding: '4rem', color: '#64748B' }}>
          Loading commercial contact profile...
        </div>
      </AppShell>
    );
  }

  if (error || !contact) {
    return (
      <AppShell>
        <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
          {error || 'Contact not found'}
        </div>
        <Link href="/sales/contacts" className="btn btn-secondary">
          &larr; Return to Contacts Directory
        </Link>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* Breadcrumb Navigation */}
      <div style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
        <Link href="/sales/contacts" style={{ color: '#2563EB', textDecoration: 'none' }}>
          &larr; Contacts Directory
        </Link>
      </div>

      {/* Profile Header */}
      <div
        className="card"
        style={{
          padding: '1.5rem 1.75rem',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1.25rem',
          backgroundColor: '#FFFFFF',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#102654', margin: 0, letterSpacing: '-0.02em' }}>
              {contact.name}
            </h1>
            <span
              className={`badge ${
                contact.type === 'CUSTOMER'
                  ? 'badge-primary'
                  : contact.type === 'SUPPLIER'
                  ? 'badge-success'
                  : 'badge-neutral'
              }`}
            >
              {contact.type}
            </span>
            <span className={`badge ${contact.status === 'ACTIVE' ? 'badge-success' : 'badge-neutral'}`}>
              {contact.status}
            </span>
          </div>

          {contact.companyName && (
            <div style={{ fontSize: '0.95rem', color: '#64748B', marginTop: '0.25rem' }}>
              {contact.companyName}
            </div>
          )}

          {/* Quick Balance Metrics */}
          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Receivable Balance
              </span>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#102654', fontFamily: 'var(--font-mono)' }}>
                £{parseFloat(contact.outstandingReceivableBalance || '0').toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>

            {(contact.type === 'SUPPLIER' || contact.type === 'BOTH') && (
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Payable Balance
                </span>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#059669', fontFamily: 'var(--font-mono)' }}>
                  £{parseFloat(contact.outstandingPayableBalance || '0').toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {(contact.type === 'CUSTOMER' || contact.type === 'BOTH') && contact.status === 'ACTIVE' && (
            <Link href={`/sales/invoices/new?contactId=${contact.id}`} className="btn btn-primary btn-sm">
              + New Invoice
            </Link>
          )}

          {canEdit && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowEditModal(true)}
            >
              Edit Contact
            </button>
          )}

          {canArchive && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowArchiveConfirm(true)}
            >
              {contact.status === 'ARCHIVED' ? 'Restore' : 'Archive'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs Bar */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #E2E8F0', marginBottom: '1.5rem', overflowX: 'auto' }}>
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'invoices', label: `Invoices (${contact._count?.invoices ?? 0})` },
          { key: 'statement', label: 'Statement' },
          { key: 'activity', label: 'Activity' },
          { key: 'people', label: `Contacts / People (${contact.people.length})` },
          { key: 'accounting', label: 'Accounting' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              padding: '0.75rem 1.1rem',
              fontWeight: 600,
              fontSize: '0.875rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: activeTab === tab.key ? '#102654' : '#64748B',
              borderBottom: activeTab === tab.key ? '3px solid #FF7D6B' : '3px solid transparent',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {/* Business & Tax Details */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#102654', marginBottom: '1rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.5rem' }}>
              Business & Registration
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '0.75rem', fontSize: '0.875rem' }}>
              <span style={{ color: '#64748B' }}>Company No:</span>
              <span style={{ fontWeight: 500, color: '#0F172A' }}>{contact.companyNumber || '—'}</span>

              <span style={{ color: '#64748B' }}>VAT Number:</span>
              <span style={{ fontWeight: 500, color: '#0F172A' }}>{contact.vatNumber || '—'}</span>

              <span style={{ color: '#64748B' }}>Tax Number:</span>
              <span style={{ fontWeight: 500, color: '#0F172A' }}>{contact.taxNumber || '—'}</span>

              <span style={{ color: '#64748B' }}>Email:</span>
              <span>{contact.email ? <a href={`mailto:${contact.email}`} style={{ color: '#2563EB' }}>{contact.email}</a> : '—'}</span>

              <span style={{ color: '#64748B' }}>Phone:</span>
              <span style={{ color: '#0F172A' }}>{contact.phone || '—'}</span>

              <span style={{ color: '#64748B' }}>Website:</span>
              <span>{contact.website ? <a href={contact.website} target="_blank" rel="noreferrer" style={{ color: '#2563EB' }}>{contact.website}</a> : '—'}</span>
            </div>
          </div>

          {/* Commercial Terms */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#102654', marginBottom: '1rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.5rem' }}>
              Commercial & Credit Terms
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.75rem', fontSize: '0.875rem' }}>
              <span style={{ color: '#64748B' }}>Payment Terms:</span>
              <span style={{ fontWeight: 600, color: '#0F172A' }}>Net {contact.paymentTermsDays} days</span>

              <span style={{ color: '#64748B' }}>Credit Limit:</span>
              <span style={{ fontWeight: 600, color: '#0F172A' }}>
                {contact.creditLimit ? `£${parseFloat(contact.creditLimit).toLocaleString()}` : 'No limit set'}
              </span>

              <span style={{ color: '#64748B' }}>Base Currency:</span>
              <span style={{ fontWeight: 500, color: '#0F172A' }}>{contact.currency || 'Organisation Base (GBP)'}</span>

              <span style={{ color: '#64748B' }}>Primary Contact:</span>
              <span style={{ fontWeight: 500, color: '#0F172A' }}>
                {contact.primaryPerson ? `${contact.primaryPerson.firstName} ${contact.primaryPerson.lastName} (${contact.primaryPerson.jobTitle || 'Primary'})` : 'None assigned'}
              </span>
            </div>
          </div>

          {/* Addresses */}
          <div className="card" style={{ padding: '1.25rem', gridColumn: 'span 2' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#102654', marginBottom: '1rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.5rem' }}>
              Addresses
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', fontSize: '0.875rem' }}>
              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Billing Address
                </h4>
                <div style={{ lineHeight: 1.6, color: '#1E293B' }}>
                  <div>{contact.addressLine1 || '—'}</div>
                  {contact.addressLine2 && <div>{contact.addressLine2}</div>}
                  <div>{[contact.city, contact.postcode].filter(Boolean).join(', ')}</div>
                  <div>{contact.country}</div>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Shipping / Delivery Address
                </h4>
                <div style={{ lineHeight: 1.6, color: '#1E293B' }}>
                  <div>{contact.shippingAddressLine1 || contact.addressLine1 || '—'}</div>
                  {contact.shippingAddressLine2 && <div>{contact.shippingAddressLine2}</div>}
                  <div>{[contact.shippingCity || contact.city, contact.shippingPostcode || contact.postcode].filter(Boolean).join(', ')}</div>
                  <div>{contact.shippingCountry || contact.country}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INVOICES */}
      {activeTab === 'invoices' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Invoice Number</th>
                  <th>Issue Date</th>
                  <th>Due Date</th>
                  <th>Total Amount</th>
                  <th>Paid</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoicesLoading ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#64748B' }}>
                      Loading invoices...
                    </td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#64748B' }}>
                      No invoices found for this contact.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td style={{ fontWeight: 600 }}>
                        <Link href={`/sales/invoices/${inv.id}`} style={{ color: '#2563EB', textDecoration: 'none' }}>
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td>{inv.issueDate}</td>
                      <td>{inv.dueDate}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        £{parseFloat(inv.totalAmount).toFixed(2)}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>
                        £{parseFloat(inv.amountPaid).toFixed(2)}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            inv.status === 'POSTED'
                              ? 'badge-primary'
                              : inv.status === 'PAID'
                              ? 'badge-success'
                              : inv.status === 'VOIDED'
                              ? 'badge-danger'
                              : 'badge-neutral'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Link href={`/sales/invoices/${inv.id}`} className="btn btn-secondary btn-sm">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: STATEMENT */}
      {activeTab === 'statement' && (
        <div>
          {/* Statement Toolbar */}
          <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '0.25rem' }}>
                  From Date
                </label>
                <input
                  type="date"
                  className="form-input"
                  style={{ width: '160px', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                  value={statementFrom}
                  onChange={(e) => setStatementFrom(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '0.25rem' }}>
                  To Date
                </label>
                <input
                  type="date"
                  className="form-input"
                  style={{ width: '160px', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                  value={statementTo}
                  onChange={(e) => setStatementTo(e.target.value)}
                />
              </div>

              <div style={{ alignSelf: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={loadStatement}
                  disabled={statementLoading}
                >
                  {statementLoading ? 'Calculating...' : 'Generate Statement'}
                </button>
              </div>
            </div>
          </div>

          {/* Statement Document View */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #E2E8F0', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#102654', margin: 0 }}>
                  Account Statement
                </h2>
                <div style={{ fontSize: '0.85rem', color: '#64748B', marginTop: '0.25rem' }}>
                  Period: {statement?.from || 'Beginning'} &rarr; {statement?.to || 'Present'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748B', textTransform: 'uppercase' }}>Opening Balance</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#0F172A' }}>
                  £{parseFloat(statement?.openingBalance || '0').toFixed(2)}
                </div>
              </div>
            </div>

            <div className="table-responsive">
              <table className="table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Reference</th>
                    <th>Source</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'right' }}>Debit (Invoice)</th>
                    <th style={{ textAlign: 'right' }}>Credit (Paid/Rev)</th>
                    <th style={{ textAlign: 'right' }}>Running Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {statementLoading ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#64748B' }}>
                        Calculating subledger statement...
                      </td>
                    </tr>
                  ) : !statement || statement.items.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748B' }}>
                        No financial transactions in this period.
                      </td>
                    </tr>
                  ) : (
                    statement.items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.postingDate}</td>
                        <td style={{ fontWeight: 600 }}>{item.reference || item.journalNumber}</td>
                        <td><span className="badge badge-neutral">{item.sourceType}</span></td>
                        <td>{item.description}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                          {parseFloat(item.debit) > 0 ? `£${item.debit}` : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                          {parseFloat(item.credit) > 0 ? `£${item.credit}` : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          £{item.runningBalance}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '2px solid #E2E8F0', paddingTop: '1rem', marginTop: '1.25rem' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748B', textTransform: 'uppercase' }}>Closing Balance Due</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#102654' }}>
                  £{parseFloat(statement?.closingBalance || '0').toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ACTIVITY */}
      {activeTab === 'activity' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#102654', marginBottom: '1.25rem' }}>
            Lifecycle & Transaction Activity
          </h3>
          {activityLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748B' }}>Loading activity timeline...</div>
          ) : activities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748B' }}>No activity records found.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {activities.map((a) => (
                <div
                  key={a.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '1rem',
                    paddingBottom: '1rem',
                    borderBottom: '1px solid #F1F5F9',
                  }}
                >
                  <div
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: '#2563EB',
                      marginTop: '6px',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '0.9rem' }}>{a.title}</span>
                      <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                        {new Date(a.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '0.2rem' }}>
                      {a.description}
                    </div>
                    {a.amount && (
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#102654', marginTop: '0.2rem', fontFamily: 'var(--font-mono)' }}>
                        Amount: £{a.amount}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: CONTACTS / PEOPLE */}
      {activeTab === 'people' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#102654', margin: 0 }}>
                Associated Contact People
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748B' }}>
                Key personnel, procurement directors, and accounts payable contacts
              </p>
            </div>
            {canEdit && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setShowAddPersonModal(true)}
              >
                + Add Person
              </button>
            )}
          </div>

          <div className="table-responsive">
            <table className="table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Job Title</th>
                  <th>Email</th>
                  <th>Phone / Mobile</th>
                  <th>Roles</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {contact.people.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#64748B' }}>
                      No contact people recorded for this company yet.
                    </td>
                  </tr>
                ) : (
                  contact.people.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600, color: '#0F172A' }}>
                        {p.firstName} {p.lastName}
                      </td>
                      <td>{p.jobTitle || '—'}</td>
                      <td>{p.email ? <a href={`mailto:${p.email}`} style={{ color: '#2563EB' }}>{p.email}</a> : '—'}</td>
                      <td>{p.phone || p.mobile || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          {p.isPrimary && <span className="badge badge-primary">Primary</span>}
                          {p.isBillingContact && <span className="badge badge-neutral">Billing</span>}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${p.isActive ? 'badge-success' : 'badge-neutral'}`}>
                          {p.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                          {!p.isPrimary && p.isActive && canEdit && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleSetPrimaryPerson(p.id)}
                            >
                              Set Primary
                            </button>
                          )}
                          {p.isActive && canEdit && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleDeactivatePerson(p.id)}
                            >
                              Deactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: ACCOUNTING */}
      {activeTab === 'accounting' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#102654', marginBottom: '0.5rem' }}>
            Accountant Control Configuration
          </h3>
          <p style={{ color: '#64748B', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            General Ledger mapping and double-entry subledger control accounts.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            <div style={{ backgroundColor: '#F8FAFC', padding: '1.25rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
                Receivable Control Account (Debtors)
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#102654', marginTop: '0.35rem' }}>
                {contact.receivableAccount ? `${contact.receivableAccount.code} — ${contact.receivableAccount.name}` : '1100 — Accounts Receivable (Default)'}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '0.25rem' }}>
                Subtype: ACCOUNTS_RECEIVABLE &bull; Type: ASSET
              </div>
            </div>

            <div style={{ backgroundColor: '#F8FAFC', padding: '1.25rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
                Payable Control Account (Creditors)
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#102654', marginTop: '0.35rem' }}>
                {contact.payableAccount ? `${contact.payableAccount.code} — ${contact.payableAccount.name}` : '2000 — Accounts Payable (Default)'}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '0.25rem' }}>
                Subtype: ACCOUNTS_PAYABLE &bull; Type: LIABILITY
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
            <Link
              href={`/accounting/general-ledger?search=${contact.name}`}
              className="btn btn-secondary btn-sm"
            >
              View in General Ledger &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '14px', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#102654' }}>Edit Contact Details</h2>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748B' }}>&times;</button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Display Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Company Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editFormData.companyName}
                    onChange={(e) => setEditFormData({ ...editFormData, companyName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Company Number</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editFormData.companyNumber}
                    onChange={(e) => setEditFormData({ ...editFormData, companyNumber: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">VAT Number</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editFormData.vatNumber}
                    onChange={(e) => setEditFormData({ ...editFormData, vatNumber: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-input"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Terms (Days)</label>
                  <input
                    type="number"
                    min={0}
                    className="form-input"
                    value={editFormData.paymentTermsDays}
                    onChange={(e) => setEditFormData({ ...editFormData, paymentTermsDays: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Credit Limit (£)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    className="form-input"
                    value={editFormData.creditLimit}
                    onChange={(e) => setEditFormData({ ...editFormData, creditLimit: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid #E2E8F0', paddingTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={savingEdit}>
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD PERSON MODAL */}
      {showAddPersonModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '14px', width: '100%', maxWidth: '520px', padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#102654' }}>Add Contact Person</h2>
              <button onClick={() => setShowAddPersonModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748B' }}>&times;</button>
            </div>
            <form onSubmit={handleAddPersonSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">First Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={personFormData.firstName}
                    onChange={(e) => setPersonFormData({ ...personFormData, firstName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={personFormData.lastName}
                    onChange={(e) => setPersonFormData({ ...personFormData, lastName: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Job Title</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Procurement Lead"
                    value={personFormData.jobTitle}
                    onChange={(e) => setPersonFormData({ ...personFormData, jobTitle: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-input"
                    value={personFormData.email}
                    onChange={(e) => setPersonFormData({ ...personFormData, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input
                    type="text"
                    className="form-input"
                    value={personFormData.phone}
                    onChange={(e) => setPersonFormData({ ...personFormData, phone: e.target.value })}
                  />
                </div>
                <div style={{ gridColumn: 'span 2', display: 'flex', gap: '1.5rem', marginTop: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={personFormData.isPrimary}
                      onChange={(e) => setPersonFormData({ ...personFormData, isPrimary: e.target.checked })}
                    />
                    Set as Primary Contact
                  </label>
                  <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={personFormData.isBillingContact}
                      onChange={(e) => setPersonFormData({ ...personFormData, isBillingContact: e.target.checked })}
                    />
                    Billing Contact
                  </label>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid #E2E8F0', paddingTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddPersonModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={savingPerson}>
                  {savingPerson ? 'Adding...' : 'Add Person'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ARCHIVE CONFIRMATION MODAL */}
      {showArchiveConfirm && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', maxWidth: '440px', width: '100%', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#102654', margin: '0 0 0.5rem 0' }}>
              {contact.status === 'ARCHIVED' ? 'Restore Contact' : 'Archive Contact'}
            </h3>
            <p style={{ color: '#475569', fontSize: '0.875rem', lineHeight: 1.5, margin: '0 0 1.25rem 0' }}>
              {contact.status === 'ACTIVE' ? (
                <>
                  Are you sure you want to archive <strong>{contact.name}</strong>?
                  Archived contacts cannot receive new invoices or transactions, but all historical transactions, statements, and audit logs remain fully visible.
                </>
              ) : (
                <>
                  Restore <strong>{contact.name}</strong> to active commercial status?
                </>
              )}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowArchiveConfirm(false)}
                disabled={actionInProgress}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn ${contact.status === 'ACTIVE' ? 'btn-danger' : 'btn-primary'}`}
                onClick={handleToggleArchive}
                disabled={actionInProgress}
              >
                {actionInProgress ? 'Processing...' : contact.status === 'ACTIVE' ? 'Confirm Archive' : 'Confirm Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
