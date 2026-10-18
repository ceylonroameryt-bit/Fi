'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  X,
  Plus,
  Check,
  AlertCircle,
  Globe,
  Coins,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/auth-context';

interface AddCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (createdOrg: any) => void;
}

const COUNTRIES = [
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', defaultCurrency: 'GBP', timezone: 'Europe/London' },
  { code: 'US', name: 'United States', flag: '🇺🇸', defaultCurrency: 'USD', timezone: 'America/New_York' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪', defaultCurrency: 'EUR', timezone: 'Europe/Dublin' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', defaultCurrency: 'EUR', timezone: 'Europe/Berlin' },
  { code: 'FR', name: 'France', flag: '🇫🇷', defaultCurrency: 'EUR', timezone: 'Europe/Paris' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', defaultCurrency: 'CAD', timezone: 'America/Toronto' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', defaultCurrency: 'AUD', timezone: 'Australia/Sydney' },
];

const CURRENCIES = [
  { code: 'GBP', symbol: '£', label: 'GBP (£) — British Pound' },
  { code: 'USD', symbol: '$', label: 'USD ($) — US Dollar' },
  { code: 'EUR', symbol: '€', label: 'EUR (€) — Euro' },
  { code: 'CAD', symbol: 'CA$', label: 'CAD ($) — Canadian Dollar' },
  { code: 'AUD', symbol: 'AU$', label: 'AUD ($) — Australian Dollar' },
];

export function AddCompanyModal({ isOpen, onClose, onSuccess }: AddCompanyModalProps) {
  const router = useRouter();
  const { switchOrg, refreshOrgs } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    legalName: '',
    country: 'GB',
    baseCurrency: 'GBP',
    timezone: 'Europe/London',
    taxId: '',
    loadTemplate: true,
  });

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleCountryChange = (countryCode: string) => {
    const selected = COUNTRIES.find((c) => c.code === countryCode);
    setFormData((prev) => ({
      ...prev,
      country: countryCode,
      baseCurrency: selected?.defaultCurrency || prev.baseCurrency,
      timezone: selected?.timezone || prev.timezone,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Please provide a company display name');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const org = await apiRequest<any>('/organizations', {
        method: 'POST',
        body: JSON.stringify({
          name: formData.name.trim(),
          legalName: formData.legalName.trim() || undefined,
          country: formData.country,
          baseCurrency: formData.baseCurrency,
          timezone: formData.timezone,
          taxNumber: formData.taxId.trim() || undefined,
        }),
      });

      // Populate Chart of Accounts template if requested
      if (formData.loadTemplate && org?.id) {
        try {
          await apiRequest('/accounts/template', {
            method: 'POST',
            orgId: org.id,
          });
        } catch (templateErr) {
          console.warn('Template provisioning notice:', templateErr);
        }
      }

      // Refresh list of organizations and switch active context
      await refreshOrgs();
      if (org?.id) {
        await switchOrg(org.id);
      }

      onSuccess?.(org);
      onClose();
      // Reload router so all active components re-evaluate the new tenant
      router.refresh();
    } catch (err: any) {
      console.error('Failed to create company:', err);
      setError(err.message || 'Failed to create new company. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '1rem',
          maxWidth: '560px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          border: '1px solid #E2E8F0',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem 1.75rem',
            background: 'linear-gradient(135deg, #041F46 0%, #082E64 100%)',
            color: '#FFFFFF',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 112, 91, 0.2)',
                color: '#FF705B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Building2 size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                Add New Company
              </h2>
              <p style={{ fontSize: '0.775rem', color: '#94A3B8', margin: '0.15rem 0 0 0' }}>
                Add an additional corporate entity or subsidiary to your workspace
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
            }}
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem 1.75rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            {error && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1rem',
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: '8px',
                  color: '#DC2626',
                  fontSize: '0.85rem',
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Company Display Name */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.35rem' }}>
                Company Display Name <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Acme Innovations Ltd"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.875rem',
                  color: '#0F172A',
                  outline: 'none',
                  backgroundColor: '#F8FAFC',
                }}
              />
              <span style={{ fontSize: '0.725rem', color: '#64748B', marginTop: '0.25rem', display: 'block' }}>
                This is the primary name that appears in your top company switcher.
              </span>
            </div>

            {/* Legal Registered Name & Tax/Reg No (2 Columns) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.35rem' }}>
                  Legal Registered Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Acme Innovations Limited"
                  value={formData.legalName}
                  onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.875rem',
                    color: '#0F172A',
                    outline: 'none',
                    backgroundColor: '#FFFFFF',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.35rem' }}>
                  Tax / VAT Registration
                </label>
                <input
                  type="text"
                  placeholder="e.g. GB 987 6543 21"
                  value={formData.taxId}
                  onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.875rem',
                    color: '#0F172A',
                    outline: 'none',
                    backgroundColor: '#FFFFFF',
                  }}
                />
              </div>
            </div>

            {/* Country & Base Currency (2 Columns) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.35rem' }}>
                  Country <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  value={formData.country}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.875rem',
                    color: '#0F172A',
                    outline: 'none',
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.35rem' }}>
                  Base Currency <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  value={formData.baseCurrency}
                  onChange={(e) => setFormData({ ...formData, baseCurrency: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.875rem',
                    color: '#0F172A',
                    outline: 'none',
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  {CURRENCIES.map((cur) => (
                    <option key={cur.code} value={cur.code}>
                      {cur.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Template Initialization Card */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.85rem 1rem',
                backgroundColor: '#F0FDF4',
                borderRadius: '8px',
                border: '1px solid #BBF7D0',
                cursor: 'pointer',
              }}
              onClick={() => setFormData({ ...formData, loadTemplate: !formData.loadTemplate })}
            >
              <input
                type="checkbox"
                checked={formData.loadTemplate}
                onChange={(e) => setFormData({ ...formData, loadTemplate: e.target.checked })}
                style={{
                  width: '18px',
                  height: '18px',
                  accentColor: '#10B981',
                  marginTop: '0.15rem',
                  cursor: 'pointer',
                }}
              />
              <div>
                <div style={{ fontSize: '0.825rem', fontWeight: 700, color: '#166534' }}>
                  Provision Standard Chart of Accounts Template
                </div>
                <div style={{ fontSize: '0.725rem', color: '#15803D', marginTop: '0.15rem' }}>
                  Automatically load complete standard accounts (Bank accounts, Revenue, Expenses, VAT control, Assets &amp; Liabilities) so you can start immediately.
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div
            style={{
              padding: '1rem 1.75rem',
              backgroundColor: '#F8FAFC',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '0.6rem 1.1rem',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#475569',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.35rem',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #FF705B 0%, #FF5A43 100%)',
                color: '#FFFFFF',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(255, 112, 91, 0.3)',
                opacity: loading ? 0.7 : 1,
              }}
            >
              <Plus size={16} />
              <span>{loading ? 'Creating Company...' : 'Create & Switch to Company'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
