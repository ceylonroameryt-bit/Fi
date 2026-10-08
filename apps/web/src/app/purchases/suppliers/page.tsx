'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';
import {
  Truck,
  Plus,
  Search,
  Building2,
  Mail,
  Phone,
  ArrowRight,
  RefreshCw,
  X,
  FileCheck,
} from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
  companyName?: string | null;
  taxNumber?: string | null;
  registrationNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
  paymentTermsDays?: number;
  currency?: string | null;
  createdAt: string;
}

export default function SuppliersPage() {
  const router = useRouter();
  const { activeOrg, hasPermission } = useAuth();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  // New Supplier Modal
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formName, setFormName] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formVat, setFormVat] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formTerms, setFormTerms] = useState('30');

  const canCreate = hasPermission('contact.create');

  const loadSuppliers = useCallback(async () => {
    if (!activeOrg) return;
    try {
      setLoading(true);
      setError(null);
      const data = await apiRequest<any>('/contacts?type=SUPPLIER');
      const list = Array.isArray(data) ? data : data?.items || [];
      setSuppliers(list);
    } catch (err: any) {
      setError(err.message || 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  }, [activeOrg]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName) return;
    try {
      setCreating(true);
      setError(null);
      await apiRequest('/contacts', {
        method: 'POST',
        body: JSON.stringify({
          name: formName,
          companyName: formCompany || undefined,
          type: 'SUPPLIER',
          taxNumber: formVat || undefined,
          email: formEmail || undefined,
          phone: formPhone || undefined,
          paymentTermsDays: Number(formTerms) || 30,
        }),
      });

      setShowModal(false);
      setFormName('');
      setFormCompany('');
      setFormVat('');
      setFormEmail('');
      setFormPhone('');
      await loadSuppliers();
    } catch (err: any) {
      setError(err.message || 'Failed to create supplier');
    } finally {
      setCreating(false);
    }
  };

  const filtered = suppliers.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.companyName && s.companyName.toLowerCase().includes(q)) ||
      (s.taxNumber && s.taxNumber.toLowerCase().includes(q)) ||
      (s.email && s.email.toLowerCase().includes(q))
    );
  });

  return (
    <AppShell>
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h1 className="page-title" style={{ margin: 0 }}>
              Suppliers
            </h1>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: '#FEF3C7',
                color: '#92400E',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.2rem 0.55rem',
                borderRadius: '6px',
              }}
            >
              <Truck size={12} />
              Accounts Payable
            </span>
          </div>
          <p
            className="page-subtitle"
            style={{ margin: '0.25rem 0 0 0', color: '#64748B', fontSize: '0.875rem' }}
          >
            Manage vendors, procurement profiles, payment terms, and accounts payable directory.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => loadSuppliers()}
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          {canCreate && (
            <button
              onClick={() => setShowModal(true)}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Plus size={14} />
              New Supplier
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FCA5A5',
            color: '#991B1B',
            borderRadius: '8px',
            marginBottom: '1rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Search Bar */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94A3B8',
            }}
          />
          <input
            type="text"
            className="form-input"
            placeholder="Search suppliers by legal name, VAT number, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              paddingLeft: '2.25rem',
              width: '100%',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
            }}
          />
        </div>
      </div>

      {/* Suppliers Table */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '10px',
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr
              style={{
                backgroundColor: '#F8FAFC',
                borderBottom: '1px solid #E2E8F0',
                textAlign: 'left',
                color: '#64748B',
              }}
            >
              <th style={{ padding: '0.75rem 1.25rem' }}>Supplier Name</th>
              <th style={{ padding: '0.75rem 1.25rem' }}>Company / Trading</th>
              <th style={{ padding: '0.75rem 1.25rem' }}>Tax / VAT ID</th>
              <th style={{ padding: '0.75rem 1.25rem' }}>Contact Info</th>
              <th style={{ padding: '0.75rem 1.25rem' }}>Payment Terms</th>
              <th style={{ padding: '0.75rem 1.25rem' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#94A3B8' }}>
                  Loading supplier directory...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#94A3B8' }}>
                  No suppliers found matching your query.
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => router.push(`/sales/contacts/${s.id}`)}
                  style={{
                    borderBottom: '1px solid #F1F5F9',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <td style={{ padding: '0.75rem 1.25rem', fontWeight: 600, color: '#0F172A' }}>{s.name}</td>
                  <td style={{ padding: '0.75rem 1.25rem', color: '#475569' }}>{s.companyName || '—'}</td>
                  <td style={{ padding: '0.75rem 1.25rem', fontFamily: 'monospace', color: '#64748B' }}>
                    {s.taxNumber || '—'}
                  </td>
                  <td style={{ padding: '0.75rem 1.25rem', color: '#475569' }}>
                    {s.email || s.phone || '—'}
                  </td>
                  <td style={{ padding: '0.75rem 1.25rem', color: '#475569' }}>
                    {s.paymentTermsDays ? `${s.paymentTermsDays} days` : '30 days'}
                  </td>
                  <td style={{ padding: '0.75rem 1.25rem' }}>
                    <span
                      style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: s.status === 'ACTIVE' ? '#DCFCE7' : '#F1F5F9',
                        color: s.status === 'ACTIVE' ? '#166534' : '#64748B',
                      }}
                    >
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Supplier Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              padding: '1.75rem',
              width: '100%',
              maxWidth: '500px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.25rem',
              }}
            >
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Add New Supplier</h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSupplier}>
              <div style={{ marginBottom: '1rem' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: '#334155',
                    marginBottom: '0.35rem',
                  }}
                >
                  Supplier Legal Name *
                </label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. ABC Fuel Ltd"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: '#334155',
                    marginBottom: '0.35rem',
                  }}
                >
                  Company / Trading Name (Optional)
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. ABC Petroleum Direct"
                  value={formCompany}
                  onChange={(e) => setFormCompany(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                  }}
                />
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.75rem',
                  marginBottom: '1rem',
                }}
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: '#334155',
                      marginBottom: '0.35rem',
                    }}
                  >
                    VAT / Tax Number
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. GB123456789"
                    value={formVat}
                    onChange={(e) => setFormVat(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: '#334155',
                      marginBottom: '0.35rem',
                    }}
                  >
                    Payment Terms (Days)
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    value={formTerms}
                    onChange={(e) => setFormTerms(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.75rem',
                  marginBottom: '1.5rem',
                }}
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: '#334155',
                      marginBottom: '0.35rem',
                    }}
                  >
                    Email
                  </label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="billing@abcfuel.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: '#334155',
                      marginBottom: '0.35rem',
                    }}
                  >
                    Phone
                  </label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="+44 20 1234 5678"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="btn btn-primary">
                  {creating ? 'Saving...' : 'Create Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
