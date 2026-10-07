'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';

interface ContactPersonSummary {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle?: string | null;
  email?: string | null;
  isPrimary: boolean;
}

interface ContactItem {
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
  city?: string | null;
  country: string;
  shippingCity?: string | null;
  shippingCountry?: string | null;
  primaryPerson?: ContactPersonSummary | null;
  _count?: {
    invoices: number;
    people: number;
  };
}

interface ContactSummary {
  total: number;
  active: number;
  archived: number;
  customers: number;
  suppliers: number;
  both: number;
  customersWithOutstandingBalance: number;
  suppliersWithOutstandingBalance: number;
}

interface PaginatedContacts {
  items: ContactItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface AccountOption {
  id: string;
  code: string;
  name: string;
  accountType: string;
  accountSubtype: string;
}

export default function ContactsPage() {
  const { activeOrg, hasPermission } = useAuth();
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [summary, setSummary] = useState<ContactSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Pagination & Filtering state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'CUSTOMER' | 'SUPPLIER' | 'BOTH'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [sortBy, setSortBy] = useState<'name' | 'companyName' | 'createdAt' | 'updatedAt'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Debounced search
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Archive confirmation modal state
  const [confirmModalContact, setConfirmModalContact] = useState<ContactItem | null>(null);
  const [confirmModalAction, setConfirmModalAction] = useState<'archive' | 'restore'>('archive');
  const [actionInProgress, setActionInProgress] = useState(false);

  // Advanced accounting account lists
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [showAdvancedAccounting, setShowAdvancedAccounting] = useState(false);
  const [shippingSameAsBilling, setShippingSameAsBilling] = useState(true);

  // Duplicate warning state in create modal
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

  // New Contact form state
  const [formData, setFormData] = useState({
    type: 'CUSTOMER' as 'CUSTOMER' | 'SUPPLIER' | 'BOTH',
    name: '',
    companyName: '',
    companyNumber: '',
    vatNumber: '',
    email: '',
    phone: '',
    website: '',
    taxNumber: '',
    paymentTermsDays: 30,
    creditLimit: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postcode: '',
    country: 'GB',
    shippingAddressLine1: '',
    shippingAddressLine2: '',
    shippingCity: '',
    shippingState: '',
    shippingPostcode: '',
    shippingCountry: 'GB',
    receivableAccountId: '',
    payableAccountId: '',
    notes: '',
  });

  const canCreate = hasPermission('contact.create');
  const canArchive = hasPermission('contact.archive');

  // Debounce search input (350ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1); // Reset to page 1 on new search
    }, 350);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Load summary metrics from authoritative API
  const loadSummary = useCallback(async () => {
    if (!activeOrg) return;
    try {
      setSummaryLoading(true);
      const res = await apiRequest<ContactSummary>('/contacts/summary');
      setSummary(res);
    } catch {
      // Summary metric degradation handled gracefully
    } finally {
      setSummaryLoading(false);
    }
  }, [activeOrg]);

  // Load paginated contacts
  const loadContacts = useCallback(async () => {
    if (!activeOrg) return;
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('pageSize', pageSize.toString());
      params.append('status', statusFilter);
      if (typeFilter !== 'ALL') params.append('type', typeFilter);
      if (debouncedSearch) params.append('search', debouncedSearch);
      params.append('sortBy', sortBy);
      params.append('sortDirection', sortDirection);

      const res = await apiRequest<PaginatedContacts>(`/contacts?${params.toString()}`);
      setContacts(res.items || []);
      setTotalPages(res.totalPages || 1);
      setTotalCount(res.total || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, [activeOrg, page, pageSize, statusFilter, typeFilter, debouncedSearch, sortBy, sortDirection]);

  // Load accounts for advanced accounting section
  useEffect(() => {
    if (!activeOrg) return;
    apiRequest<AccountOption[]>('/accounts')
      .then((accs) => {
        if (Array.isArray(accs)) setAccounts(accs);
      })
      .catch(() => {});
  }, [activeOrg]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Real-time duplicate check when email, companyNumber, or vatNumber changes
  const checkDuplicateTimeout = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!showCreateModal) {
      setDuplicateWarning(null);
      return;
    }
    if (checkDuplicateTimeout.current) clearTimeout(checkDuplicateTimeout.current);

    if (formData.email.trim() || formData.companyNumber.trim() || formData.vatNumber.trim()) {
      checkDuplicateTimeout.current = setTimeout(async () => {
        try {
          setCheckingDuplicates(true);
          const q = new URLSearchParams();
          if (formData.email.trim()) q.append('email', formData.email.trim());
          if (formData.companyNumber.trim()) q.append('companyNumber', formData.companyNumber.trim());
          if (formData.vatNumber.trim()) q.append('vatNumber', formData.vatNumber.trim());

          const res = await apiRequest<{ hasPotentialDuplicates: boolean; matches: Array<{ name: string; matchDetail: string }> }>(
            `/contacts/duplicate-check?${q.toString()}`,
          );

          if (res.hasPotentialDuplicates && res.matches.length > 0) {
            setDuplicateWarning(res.matches[0].matchDetail);
          } else {
            setDuplicateWarning(null);
          }
        } catch {
          // Ignore duplicate check lookup error
        } finally {
          setCheckingDuplicates(false);
        }
      }, 400);
    } else {
      setDuplicateWarning(null);
    }

    return () => {
      if (checkDuplicateTimeout.current) clearTimeout(checkDuplicateTimeout.current);
    };
  }, [formData.email, formData.companyNumber, formData.vatNumber, showCreateModal]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      setSubmitting(true);
      setError(null);

      const payload: any = {
        type: formData.type,
        name: formData.name.trim(),
        companyName: formData.companyName.trim() || undefined,
        companyNumber: formData.companyNumber.trim() || undefined,
        vatNumber: formData.vatNumber.trim() || undefined,
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        website: formData.website.trim() || undefined,
        taxNumber: formData.taxNumber.trim() || undefined,
        paymentTermsDays: Number(formData.paymentTermsDays) || 30,
        creditLimit: formData.creditLimit ? parseFloat(formData.creditLimit) : undefined,
        addressLine1: formData.addressLine1.trim() || undefined,
        addressLine2: formData.addressLine2.trim() || undefined,
        city: formData.city.trim() || undefined,
        state: formData.state.trim() || undefined,
        postcode: formData.postcode.trim() || undefined,
        country: formData.country || 'GB',
        notes: formData.notes.trim() || undefined,
      };

      if (shippingSameAsBilling) {
        payload.shippingAddressLine1 = payload.addressLine1;
        payload.shippingAddressLine2 = payload.addressLine2;
        payload.shippingCity = payload.city;
        payload.shippingState = payload.state;
        payload.shippingPostcode = payload.postcode;
        payload.shippingCountry = payload.country;
      } else {
        payload.shippingAddressLine1 = formData.shippingAddressLine1.trim() || undefined;
        payload.shippingAddressLine2 = formData.shippingAddressLine2.trim() || undefined;
        payload.shippingCity = formData.shippingCity.trim() || undefined;
        payload.shippingState = formData.shippingState.trim() || undefined;
        payload.shippingPostcode = formData.shippingPostcode.trim() || undefined;
        payload.shippingCountry = formData.shippingCountry || 'GB';
      }

      if (formData.receivableAccountId) {
        payload.receivableAccountId = formData.receivableAccountId;
      }
      if (formData.payableAccountId) {
        payload.payableAccountId = formData.payableAccountId;
      }

      await apiRequest('/contacts', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setShowCreateModal(false);
      resetForm();
      await Promise.all([loadContacts(), loadSummary()]);
    } catch (err: any) {
      alert(err.message || 'Failed to create contact');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      type: 'CUSTOMER',
      name: '',
      companyName: '',
      companyNumber: '',
      vatNumber: '',
      email: '',
      phone: '',
      website: '',
      taxNumber: '',
      paymentTermsDays: 30,
      creditLimit: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      postcode: '',
      country: 'GB',
      shippingAddressLine1: '',
      shippingAddressLine2: '',
      shippingCity: '',
      shippingState: '',
      shippingPostcode: '',
      shippingCountry: 'GB',
      receivableAccountId: '',
      payableAccountId: '',
      notes: '',
    });
    setShippingSameAsBilling(true);
    setShowAdvancedAccounting(false);
    setDuplicateWarning(null);
  };

  const executeArchiveOrRestore = async () => {
    if (!confirmModalContact) return;
    try {
      setActionInProgress(true);
      await apiRequest(`/contacts/${confirmModalContact.id}/${confirmModalAction}`, {
        method: 'POST',
      });
      setConfirmModalContact(null);
      await Promise.all([loadContacts(), loadSummary()]);
    } catch (err: any) {
      alert(err.message || `Failed to ${confirmModalAction} contact`);
    } finally {
      setActionInProgress(false);
    }
  };

  const receivableAccounts = accounts.filter(
    (a) => a.accountType === 'ASSET' && a.accountSubtype === 'ACCOUNTS_RECEIVABLE',
  );
  const payableAccounts = accounts.filter(
    (a) => a.accountType === 'LIABILITY' && a.accountSubtype === 'ACCOUNTS_PAYABLE',
  );

  return (
    <AppShell>
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 700, color: '#102654', margin: 0, letterSpacing: '-0.02em' }}>
            Contacts & Subledger Directory
          </h1>
          <p style={{ color: '#64748B', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Authoritative commercial accounts, customer & supplier subledgers, payment terms, and statements.
          </p>
        </div>
        {canCreate && (
          <button
            className="btn btn-primary"
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 2px 4px rgba(16,38,84,0.1)' }}
          >
            <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>+</span> New Contact
          </button>
        )}
      </div>

      {/* Authoritative KPI Cards from Summary API */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1.1rem 1.25rem', borderLeft: '4px solid #102654' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Directory</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#102654', marginTop: '0.25rem' }}>
            {summaryLoading ? '...' : summary?.total ?? 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.25rem' }}>
            {summary?.active ?? 0} active &bull; {summary?.archived ?? 0} archived
          </div>
        </div>

        <div className="card" style={{ padding: '1.1rem 1.25rem', borderLeft: '4px solid #2563EB' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Customers</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#2563EB', marginTop: '0.25rem' }}>
            {summaryLoading ? '...' : (summary?.customers ?? 0) + (summary?.both ?? 0)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.25rem' }}>
            {summary?.customersWithOutstandingBalance ?? 0} with outstanding AR
          </div>
        </div>

        <div className="card" style={{ padding: '1.1rem 1.25rem', borderLeft: '4px solid #059669' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Suppliers</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#059669', marginTop: '0.25rem' }}>
            {summaryLoading ? '...' : (summary?.suppliers ?? 0) + (summary?.both ?? 0)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.25rem' }}>
            {summary?.suppliersWithOutstandingBalance ?? 0} with payable balance
          </div>
        </div>

        <div className="card" style={{ padding: '1.1rem 1.25rem', borderLeft: '4px solid #FF7D6B' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#FF7D6B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Dual Commercial (Both)</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#FF7D6B', marginTop: '0.25rem' }}>
            {summaryLoading ? '...' : summary?.both ?? 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.25rem' }}>
            Customer & Supplier dual roles
          </div>
        </div>
      </div>

      {/* Filter, Search, and Sort Toolbar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          {/* Type filters */}
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B', marginRight: '0.25rem' }}>Type:</span>
            {(['ALL', 'CUSTOMER', 'SUPPLIER', 'BOTH'] as const).map((type) => (
              <button
                key={type}
                className={`btn btn-sm ${typeFilter === type ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  setTypeFilter(type);
                  setPage(1);
                }}
              >
                {type === 'ALL' ? 'All Types' : type === 'CUSTOMER' ? 'Customers' : type === 'SUPPLIER' ? 'Suppliers' : 'Dual (Both)'}
              </button>
            ))}
            <div style={{ width: '1px', height: '1.25rem', backgroundColor: '#E2E8F0', margin: '0 0.5rem' }} />
            <button
              className={`btn btn-sm ${statusFilter === 'ARCHIVED' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setStatusFilter(statusFilter === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE');
                setPage(1);
              }}
            >
              {statusFilter === 'ARCHIVED' ? 'Viewing Archived' : 'Show Archived'}
            </button>
          </div>

          {/* Search & Sort Controls */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {/* Sorting */}
            <select
              className="form-input"
              style={{ width: '180px', fontSize: '0.85rem', padding: '0.4rem 0.6rem' }}
              value={`${sortBy}-${sortDirection}`}
              onChange={(e) => {
                const [sb, sd] = e.target.value.split('-');
                setSortBy(sb as any);
                setSortDirection(sd as any);
                setPage(1);
              }}
            >
              <option value="name-asc">Sort: Name (A-Z)</option>
              <option value="name-desc">Sort: Name (Z-A)</option>
              <option value="companyName-asc">Sort: Company (A-Z)</option>
              <option value="createdAt-desc">Sort: Recently Added</option>
              <option value="updatedAt-desc">Sort: Recently Updated</option>
            </select>

            {/* Debounced Search */}
            <div style={{ width: '280px', position: 'relative' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search name, VAT, co. no, email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                style={{ fontSize: '0.85rem', paddingRight: '2rem' }}
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94A3B8',
                    cursor: 'pointer',
                    fontSize: '1rem',
                  }}
                >
                  &times;
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* Directory Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Contact Name & Company</th>
                <th>Type</th>
                <th>Identifiers</th>
                <th>Primary Contact</th>
                <th>Terms</th>
                <th>Invoices</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: '#64748B' }}>
                    Loading contacts directory...
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3.5rem', color: '#64748B' }}>
                    <div style={{ fontSize: '1.15rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                      No commercial contacts found
                    </div>
                    <div style={{ fontSize: '0.85rem' }}>
                      {debouncedSearch
                        ? `No results matching "${debouncedSearch}". Try broadening your search.`
                        : 'Create your first customer or supplier to activate the subledger.'}
                    </div>
                  </td>
                </tr>
              ) : (
                contacts.map((c) => (
                  <tr key={c.id} style={{ transition: 'background-color 0.15s' }}>
                    <td>
                      <Link
                        href={`/sales/contacts/${c.id}`}
                        style={{ textDecoration: 'none', color: 'inherit' }}
                      >
                        <div style={{ fontWeight: 600, color: '#102654', fontSize: '0.95rem' }} className="hover-link">
                          {c.name}
                        </div>
                        {c.companyName && (
                          <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                            {c.companyName}
                          </div>
                        )}
                      </Link>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          c.type === 'CUSTOMER'
                            ? 'badge-primary'
                            : c.type === 'SUPPLIER'
                            ? 'badge-success'
                            : 'badge-neutral'
                        }`}
                      >
                        {c.type}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.82rem', color: '#334155' }}>
                        {c.companyNumber && <div><span style={{ color: '#64748B' }}>Co:</span> {c.companyNumber}</div>}
                        {c.vatNumber && <div><span style={{ color: '#64748B' }}>VAT:</span> {c.vatNumber}</div>}
                        {!c.companyNumber && !c.vatNumber && <span style={{ color: '#94A3B8' }}>—</span>}
                      </div>
                    </td>
                    <td>
                      {c.primaryPerson ? (
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 500, color: '#0F172A' }}>
                            {c.primaryPerson.firstName} {c.primaryPerson.lastName}
                          </div>
                          {c.primaryPerson.jobTitle && (
                            <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{c.primaryPerson.jobTitle}</div>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.82rem', color: '#94A3B8' }}>{c.email || '—'}</span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem' }}>Net {c.paymentTermsDays || 30}d</div>
                      {c.creditLimit && (
                        <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                          Limit: £{parseFloat(c.creditLimit).toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-neutral">{c._count?.invoices ?? 0}</span>
                    </td>
                    <td>
                      <span
                        className={`badge ${c.status === 'ACTIVE' ? 'badge-success' : 'badge-neutral'}`}
                        style={{ fontSize: '0.72rem' }}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <Link href={`/sales/contacts/${c.id}`} className="btn btn-secondary btn-sm">
                          View
                        </Link>
                        {(c.type === 'CUSTOMER' || c.type === 'BOTH') && c.status === 'ACTIVE' && (
                          <Link href={`/sales/invoices/new?contactId=${c.id}`} className="btn btn-secondary btn-sm">
                            + Invoice
                          </Link>
                        )}
                        {canArchive && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setConfirmModalContact(c);
                              setConfirmModalAction(c.status === 'ARCHIVED' ? 'restore' : 'archive');
                            }}
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

        {/* Server-Side Pagination Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.85rem 1.25rem',
            borderTop: '1px solid #E2E8F0',
            backgroundColor: '#F8FAFC',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ fontSize: '0.85rem', color: '#64748B' }}>
            {totalCount > 0 ? (
              <>
                Showing <strong>{(page - 1) * pageSize + 1}</strong> to{' '}
                <strong>{Math.min(totalCount, page * pageSize)}</strong> of <strong>{totalCount}</strong> contacts
              </>
            ) : (
              '0 contacts'
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#64748B' }}>
              <span>Per page:</span>
              <select
                className="form-input"
                style={{ width: '70px', padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 0.5rem',
                  fontSize: '0.85rem',
                  color: '#334155',
                  fontWeight: 500,
                }}
              >
                Page {page} of {totalPages}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Archive / Restore Confirmation Modal */}
      {confirmModalContact && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              maxWidth: '440px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#102654', margin: '0 0 0.5rem 0' }}>
              {confirmModalAction === 'archive' ? 'Archive Contact' : 'Restore Contact'}
            </h3>
            <p style={{ color: '#475569', fontSize: '0.875rem', lineHeight: 1.5, margin: '0 0 1.25rem 0' }}>
              {confirmModalAction === 'archive' ? (
                <>
                  Are you sure you want to archive <strong>{confirmModalContact.name}</strong>?
                  Archived contacts cannot receive new invoices or bills, but all historical transactions and statements remain fully preserved.
                </>
              ) : (
                <>
                  Are you sure you want to restore <strong>{confirmModalContact.name}</strong> to active commercial status?
                </>
              )}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmModalContact(null)}
                disabled={actionInProgress}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn ${confirmModalAction === 'archive' ? 'btn-danger' : 'btn-primary'}`}
                onClick={executeArchiveOrRestore}
                disabled={actionInProgress}
              >
                {actionInProgress
                  ? 'Processing...'
                  : confirmModalAction === 'archive'
                  ? 'Confirm Archive'
                  : 'Confirm Restore'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Commercial Contact Modal */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '14px',
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.75rem',
              boxShadow: '0 25px 35px -5px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.25rem',
                borderBottom: '1px solid #E2E8F0',
                paddingBottom: '0.85rem',
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#102654' }}>
                  Add Commercial Contact
                </h2>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748B' }}>
                  Register customer or supplier account for subledger tracking
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#64748B',
                }}
              >
                &times;
              </button>
            </div>

            {/* Duplicate warning alert if duplicate detected */}
            {duplicateWarning && (
              <div
                style={{
                  backgroundColor: '#FFFBEB',
                  border: '1px solid #FDE68A',
                  color: '#92400E',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  marginBottom: '1rem',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>⚠️</span>
                <div>
                  <strong>Potential duplicate noticed:</strong> {duplicateWarning}
                </div>
              </div>
            )}

            <form onSubmit={handleCreateSubmit}>
              {/* Basic Section */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Contact Type *</label>
                  <select
                    className="form-input"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  >
                    <option value="CUSTOMER">Customer (Billable Client)</option>
                    <option value="SUPPLIER">Supplier (Vendor / Contractor)</option>
                    <option value="BOTH">Both (Customer & Supplier Dual Role)</option>
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
                  <label className="form-label">Legal / Company Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Official registered entity name"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Company Registration No</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. 12345678"
                    value={formData.companyNumber}
                    onChange={(e) => setFormData({ ...formData, companyNumber: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">VAT Number</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. GB 123 4567 89"
                    value={formData.vatNumber}
                    onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value })}
                  />
                </div>
              </div>

              {/* Communication Details */}
              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.75rem' }}>
                  Communication & Financial Terms
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Primary Email</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="accounts@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="+44 20 7123 4567"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Payment Terms (Days)</label>
                    <input
                      type="number"
                      min={0}
                      className="form-input"
                      value={formData.paymentTermsDays}
                      onChange={(e) => setFormData({ ...formData, paymentTermsDays: parseInt(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Credit Limit (£)</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      className="form-input"
                      placeholder="Optional credit ceiling"
                      value={formData.creditLimit}
                      onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Billing Address */}
              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.75rem' }}>
                  Billing Address
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Address Line 1"
                      value={formData.addressLine1}
                      onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="City"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Postcode"
                      value={formData.postcode}
                      onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Shipping Address */}
              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                    Shipping / Delivery Address
                  </div>
                  <label style={{ fontSize: '0.8rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={shippingSameAsBilling}
                      onChange={(e) => setShippingSameAsBilling(e.target.checked)}
                    />
                    Same as billing address
                  </label>
                </div>

                {!shippingSameAsBilling && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Shipping Address Line 1"
                        value={formData.shippingAddressLine1}
                        onChange={(e) => setFormData({ ...formData, shippingAddressLine1: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Shipping City"
                        value={formData.shippingCity}
                        onChange={(e) => setFormData({ ...formData, shippingCity: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Shipping Postcode"
                        value={formData.shippingPostcode}
                        onChange={(e) => setFormData({ ...formData, shippingPostcode: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Advanced Accounting Toggle */}
              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '1rem', marginBottom: '1.25rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAdvancedAccounting(!showAdvancedAccounting)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#2563EB',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: 0,
                  }}
                >
                  <span>{showAdvancedAccounting ? '▼' : '►'}</span> Advanced Accounting (Control Accounts)
                </button>

                {showAdvancedAccounting && (
                  <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Receivable Control Account</label>
                      <select
                        className="form-input"
                        value={formData.receivableAccountId}
                        onChange={(e) => setFormData({ ...formData, receivableAccountId: e.target.value })}
                      >
                        <option value="">Default (1100 - Accounts Receivable)</option>
                        {receivableAccounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} — {a.name}
                          </option>
                        ))}
                      </select>
                      <span style={{ fontSize: '0.72rem', color: '#64748B' }}>Must be active ASSET / ACCOUNTS_RECEIVABLE</span>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Payable Control Account</label>
                      <select
                        className="form-input"
                        value={formData.payableAccountId}
                        onChange={(e) => setFormData({ ...formData, payableAccountId: e.target.value })}
                      >
                        <option value="">Default (2000 - Accounts Payable)</option>
                        {payableAccounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} — {a.name}
                          </option>
                        ))}
                      </select>
                      <span style={{ fontSize: '0.72rem', color: '#64748B' }}>Must be active LIABILITY / ACCOUNTS_PAYABLE</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                  borderTop: '1px solid #E2E8F0',
                  paddingTop: '1rem',
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || checkingDuplicates}
                >
                  {submitting ? 'Creating Contact...' : 'Create Commercial Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
