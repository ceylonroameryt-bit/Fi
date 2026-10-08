'use client';

import React, { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';

export default function OrganizationSettingsPage() {
  const { activeOrg, refreshOrgs } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    legalName: '',
    registrationNumber: '',
    taxNumber: '',
    country: 'GB',
    addressLine1: '',
    addressLine2: '',
    city: '',
    postcode: '',
    baseCurrency: 'GBP',
    timezone: 'Europe/London',
    fiscalYearStart: 'April',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    async function loadOrgDetails() {
      if (!activeOrg) return;
      try {
        setError(null);
        const org = await apiRequest<any>(`/organizations/${activeOrg.id}`);
        if (isCancelled) return;
        setFormData({
          name: org.name || '',
          legalName: org.legalName || '',
          registrationNumber: org.registrationNumber || '',
          taxNumber: org.taxNumber || '',
          country: org.country || 'GB',
          addressLine1: org.addressLine1 || '',
          addressLine2: org.addressLine2 || '',
          city: org.city || '',
          postcode: org.postcode || '',
          baseCurrency: org.baseCurrency || 'GBP',
          timezone: org.timezone || 'Europe/London',
          fiscalYearStart: org.financialYearStartMonth === 1 ? 'January' : org.financialYearStartMonth === 7 ? 'July' : org.financialYearStartMonth === 10 ? 'October' : 'April',
        });
      } catch (err: any) {
        if (!isCancelled) {
          setError(err.message || 'Failed to load organization settings');
        }
      }
    }

    loadOrgDetails();
    return () => {
      isCancelled = true;
    };
  }, [activeOrg]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg) return;
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await apiRequest(`/organizations/${activeOrg.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: formData.name.trim(),
          legalName: formData.legalName.trim() || null,
          registrationNumber: formData.registrationNumber.trim() || null,
          taxNumber: formData.taxNumber.trim() || null,
          addressLine1: formData.addressLine1.trim() || null,
          addressLine2: formData.addressLine2.trim() || null,
          city: formData.city.trim() || null,
          postcode: formData.postcode.trim() || null,
          timezone: formData.timezone,
        }),
      });

      await refreshOrgs();
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to update organisation details');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div style={{ maxWidth: '860px', margin: '0 auto' }}>
        <div className="page-header">
          <div>
            <h1 className="page-title">Organisation Settings</h1>
            <p className="page-subtitle">
              Manage legal entity registration, business information, and accounting controls
            </p>
          </div>
        </div>

        {success && <div className="alert alert-success">Organisation details updated successfully.</div>}
        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Section 1: General Information */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-header">
              <h3 className="card-title">General Information</h3>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Organisation Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                  <span style={{ fontSize: '0.725rem', color: '#6B7280' }}>
                    Display name across navigation, reports, and team invites.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Legal Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Alpha Consulting Ltd"
                    value={formData.legalName}
                    onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                  />
                  <span style={{ fontSize: '0.725rem', color: '#6B7280' }}>
                    Official statutory name recorded at Companies House / registry.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Business Information */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-header">
              <h3 className="card-title">Business Information</h3>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Company Registration Number</label>
                  <input
                    type="text"
                    className="form-input font-mono"
                    placeholder="e.g. 12345678"
                    value={formData.registrationNumber}
                    onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Tax / VAT Number</label>
                  <input
                    type="text"
                    className="form-input font-mono"
                    placeholder="e.g. GB 987 6543 21"
                    value={formData.taxNumber}
                    onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Address Line 1</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. 12 High Street"
                    value={formData.addressLine1}
                    onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Address Line 2</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Suite 4B"
                    value={formData.addressLine2}
                    onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">City</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. London"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Postcode</label>
                  <input
                    type="text"
                    className="form-input font-mono"
                    placeholder="e.g. EC1A 1BB"
                    value={formData.postcode}
                    onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Country Jurisdiction</label>
                  <input
                    type="text"
                    disabled
                    className="form-input"
                    value={`${formData.country} (United Kingdom)`}
                    style={{ backgroundColor: '#F8FAFC', color: '#4B5563', cursor: 'not-allowed', fontWeight: 600 }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Financial Settings */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-header">
              <h3 className="card-title">Financial Settings</h3>
            </div>
            <div className="card-body">
              {/* Caution Callout */}
              <div
                style={{
                  backgroundColor: '#FFFBEB',
                  border: '1px solid #FDE68A',
                  borderRadius: '6px',
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.65rem',
                  marginBottom: '1.25rem',
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>⚠️</span>
                <div>
                  <strong style={{ fontSize: '0.825rem', color: '#92400E', display: 'block' }}>
                    Financial Anchor: Base Currency
                  </strong>
                  <p style={{ fontSize: '0.775rem', color: '#92400E', margin: '0.2rem 0 0 0', lineHeight: 1.4 }}>
                    Base currency establishes the reporting anchor for all nominal accounts and tax revaluations. Once financial activity is recorded, modifying base currency requires administrative audit reconciliation.
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Base Currency (Ledger Default)</label>
                  <input
                    type="text"
                    disabled
                    className="form-input font-mono"
                    value={`${formData.baseCurrency} — British Pound Sterling (£)`}
                    style={{ backgroundColor: '#F8FAFC', color: '#172033', cursor: 'not-allowed', fontWeight: 600 }}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Operating Timezone</label>
                  <select
                    className="form-select"
                    value={formData.timezone}
                    onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  >
                    <option value="Europe/London">Europe/London (GMT / BST)</option>
                    <option value="America/New_York">America/New_York (EST / EDT)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (PST / PDT)</option>
                    <option value="Europe/Dublin">Europe/Dublin (IST / GMT)</option>
                    <option value="Europe/Paris">Europe/Paris (CET / CEST)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Accounting Settings */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-header">
              <h3 className="card-title">Accounting Settings</h3>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Financial Year Start</label>
                  <select
                    className="form-select"
                    value={formData.fiscalYearStart}
                    onChange={(e) => setFormData({ ...formData, fiscalYearStart: e.target.value })}
                  >
                    <option value="April">April (UK Standard: 01 Apr – 31 Mar)</option>
                    <option value="January">January (Calendar: 01 Jan – 31 Dec)</option>
                    <option value="July">July (01 Jul – 30 Jun)</option>
                    <option value="October">October (01 Oct – 30 Sep)</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Double-Entry Enforcement</label>
                  <input
                    type="text"
                    disabled
                    className="form-input"
                    value="Strict Balanced Postings (ΣDr = ΣCr)"
                    style={{ backgroundColor: '#F8FAFC', color: '#065F46', cursor: 'not-allowed', fontWeight: 600 }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2rem' }}>
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? 'Saving Changes...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
