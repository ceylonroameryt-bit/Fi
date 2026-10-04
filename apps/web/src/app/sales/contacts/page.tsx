'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';

interface Contact {
  id: string;
  type: 'CUSTOMER' | 'SUPPLIER' | 'BOTH';
  status: 'ACTIVE' | 'ARCHIVED';
  name: string;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  taxNumber?: string | null;
  paymentTermsDays: number;
  city?: string | null;
  country: string;
  _count?: {
    invoices: number;
  };
}

export default function ContactsPage() {
  const { activeOrg, hasPermission } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'CUSTOMER' | 'SUPPLIER'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New Contact form state
  const [formData, setFormData] = useState({
    type: 'CUSTOMER' as 'CUSTOMER' | 'SUPPLIER' | 'BOTH',
    name: '',
    companyName: '',
    email: '',
    phone: '',
    website: '',
    taxNumber: '',
    paymentTermsDays: 30,
    addressLine1: '',
    city: '',
    postcode: '',
    country: 'GB',
    notes: '',
  });

  const canCreate = hasPermission('contact.create');
  const canEdit = hasPermission('contact.edit');
  const canArchive = hasPermission('contact.archive');

  const loadContacts = async () => {
    if (!activeOrg) return;
    try {
      setLoading(true);
      setError(null);
      const queryParams = new URLSearchParams();
      if (typeFilter !== 'ALL') queryParams.append('type', typeFilter);
      queryParams.append('status', statusFilter);
      if (search) queryParams.append('search', search);

      const data = await apiRequest<Contact[]>(`/contacts?${queryParams.toString()}`);
      setContacts(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, [activeOrg, typeFilter, statusFilter, search]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      setSubmitting(true);
      await apiRequest('/contacts', {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      setShowCreateModal(false);
      setFormData({
        type: 'CUSTOMER',
        name: '',
        companyName: '',
        email: '',
        phone: '',
        website: '',
        taxNumber: '',
        paymentTermsDays: 30,
        addressLine1: '',
        city: '',
        postcode: '',
        country: 'GB',
        notes: '',
      });
      await loadContacts();
    } catch (err: any) {
      alert(err.message || 'Failed to create contact');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleArchive = async (contact: Contact) => {
    const isArchived = contact.status === 'ARCHIVED';
    const action = isArchived ? 'restore' : 'archive';
    if (!confirm(`Are you sure you want to ${action} ${contact.name}?`)) return;

    try {
      await apiRequest(`/contacts/${contact.id}/${action}`, { method: 'POST' });
      await loadContacts();
    } catch (err: any) {
      alert(err.message || `Failed to ${action} contact`);
    }
  };

  const customerCount = contacts.filter((c) => c.type === 'CUSTOMER' || c.type === 'BOTH').length;
  const supplierCount = contacts.filter((c) => c.type === 'SUPPLIER' || c.type === 'BOTH').length;

  return (
    <AppShell>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>Contacts & Directory</h1>
          <p style={{ color: '#64748B', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Manage commercial relationships, customers, suppliers, credit terms, and billing information.
          </p>
        </div>
        {canCreate && (
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <span>+</span> New Contact
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Directory</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0F172A', marginTop: '0.25rem' }}>{contacts.length}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.25rem' }}>Commercial master records</div>
        </div>
        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Customers</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2563EB', marginTop: '0.25rem' }}>{customerCount}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.25rem' }}>Invoiced & billable clients</div>
        </div>
        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Suppliers</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#059669', marginTop: '0.25rem' }}>{supplierCount}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.25rem' }}>Vendors & contractors</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B', marginRight: '0.25rem' }}>Type:</span>
            {(['ALL', 'CUSTOMER', 'SUPPLIER'] as const).map((type) => (
              <button
                key={type}
                className={`btn btn-sm ${typeFilter === type ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTypeFilter(type)}
              >
                {type === 'ALL' ? 'All Contacts' : type === 'CUSTOMER' ? 'Customers' : 'Suppliers'}
              </button>
            ))}
            <div style={{ width: '1px', height: '1.25rem', backgroundColor: '#E2E8F0', margin: '0 0.5rem' }} />
            <button
              className={`btn btn-sm ${statusFilter === 'ARCHIVED' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setStatusFilter(statusFilter === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE')}
            >
              {statusFilter === 'ARCHIVED' ? 'Viewing Archived' : 'Show Archived'}
            </button>
          </div>

          <div style={{ width: '280px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search name, company, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ fontSize: '0.85rem' }}
            />
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* Contacts Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Contact Name</th>
                <th>Type</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Location</th>
                <th>Payment Terms</th>
                <th>Invoices</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#64748B' }}>
                    Loading contacts...
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: '#64748B' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>No contacts found</div>
                    <div style={{ fontSize: '0.85rem' }}>Create your first customer or supplier to start issuing invoices.</div>
                  </td>
                </tr>
              ) : (
                contacts.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0F172A' }}>{c.name}</div>
                      {c.companyName && <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{c.companyName}</div>}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          c.type === 'CUSTOMER' ? 'badge-primary' : c.type === 'SUPPLIER' ? 'badge-success' : 'badge-neutral'
                        }`}
                      >
                        {c.type}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{c.email || '—'}</td>
                    <td style={{ fontSize: '0.85rem' }}>{c.phone || '—'}</td>
                    <td style={{ fontSize: '0.85rem' }}>{[c.city, c.country].filter(Boolean).join(', ') || '—'}</td>
                    <td style={{ fontSize: '0.85rem' }}>Net {c.paymentTermsDays || 30} days</td>
                    <td>
                      <span className="badge badge-neutral">{c._count?.invoices ?? 0}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        {(c.type === 'CUSTOMER' || c.type === 'BOTH') && (
                          <Link href={`/sales/invoices/new?contactId=${c.id}`} className="btn btn-secondary btn-sm">
                            + Invoice
                          </Link>
                        )}
                        {canArchive && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleToggleArchive(c)}
                          >
                            {c.status === 'ARCHIVED' ? 'Restore' : 'Archive'}
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

      {/* Create Contact Modal */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '10px', width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0F172A' }}>Add Commercial Contact</h2>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748B' }}>&times;</button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Contact Type *</label>
                  <select
                    className="form-input"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  >
                    <option value="CUSTOMER">Customer (Billable Client)</option>
                    <option value="SUPPLIER">Supplier (Vendor)</option>
                    <option value="BOTH">Both (Customer & Supplier)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Contact Display Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Acme Corporation"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Legal Registered Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Acme Corporation UK Ltd"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="accounts@acme.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Telephone</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="+44 20 7946 0000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">VAT / Tax ID</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. GB123456789"
                    value={formData.taxNumber}
                    onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Terms (Days)</label>
                  <input
                    type="number"
                    min="0"
                    className="form-input"
                    value={formData.paymentTermsDays}
                    onChange={(e) => setFormData({ ...formData, paymentTermsDays: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Address Line 1</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Street address"
                    value={formData.addressLine1}
                    onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">City</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="London"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Postal Code</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="EC1A 1BB"
                    value={formData.postcode}
                    onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid #E2E8F0', paddingTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
