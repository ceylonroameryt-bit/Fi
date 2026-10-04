'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';

export default function NewOrganizationPage() {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const org = await apiRequest<any>('/organizations', {
        method: 'POST',
        body: JSON.stringify({
          name: formData.name,
          legalName: formData.legalName || undefined,
          country: formData.country,
          baseCurrency: formData.baseCurrency,
          timezone: formData.timezone,
          taxId: formData.taxId || undefined,
        }),
      });

      // Switch context to newly created org
      await refreshOrgs();
      await switchOrg(org.id);

      // If user selected load template, call the template endpoint
      if (formData.loadTemplate) {
        try {
          await apiRequest('/accounts/template', {
            method: 'POST',
            orgId: org.id,
          });
        } catch (templateErr) {
          console.warn('Template loading skipped or already loaded', templateErr);
        }
      }

      router.push('/accounting/chart-of-accounts');
    } catch (err: any) {
      setError(err.message || 'Failed to create organisation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <div className="page-header">
          <div>
            <h1 className="page-title">New Organisation</h1>
            <p className="page-subtitle">Configure an isolated accounting tenant with its own Chart of Accounts</p>
          </div>
          <Link href="/organizations" className="btn btn-secondary btn-sm">
            Cancel
          </Link>
        </div>

        <div className="card">
          <div className="card-body">
            {error && <div className="alert alert-danger">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Organisation Display Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Holdings Ltd"
                  className="form-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Legal Registered Name</label>
                <input
                  type="text"
                  placeholder="e.g. Acme Holdings UK Limited"
                  className="form-input"
                  value={formData.legalName}
                  onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Country (ISO 3166-1) *</label>
                  <select
                    className="form-select"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  >
                    <option value="GB">United Kingdom (GB)</option>
                    <option value="US">United States (US)</option>
                    <option value="IE">Ireland (IE)</option>
                    <option value="AU">Australia (AU)</option>
                    <option value="CA">Canada (CA)</option>
                    <option value="DE">Germany (DE)</option>
                    <option value="FR">France (FR)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Base Currency (ISO 4217) *</label>
                  <select
                    className="form-select"
                    value={formData.baseCurrency}
                    onChange={(e) => setFormData({ ...formData, baseCurrency: e.target.value })}
                  >
                    <option value="GBP">GBP - Pound Sterling (£)</option>
                    <option value="USD">USD - US Dollar ($)</option>
                    <option value="EUR">EUR - Euro (€)</option>
                    <option value="AUD">AUD - Australian Dollar (A$)</option>
                    <option value="CAD">CAD - Canadian Dollar (C$)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Timezone</label>
                  <select
                    className="form-select"
                    value={formData.timezone}
                    onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  >
                    <option value="Europe/London">Europe/London</option>
                    <option value="America/New_York">America/New_York</option>
                    <option value="America/Los_Angeles">America/Los_Angeles</option>
                    <option value="Europe/Dublin">Europe/Dublin</option>
                    <option value="Australia/Sydney">Australia/Sydney</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Tax / VAT Number</label>
                  <input
                    type="text"
                    placeholder="e.g. GB123456789"
                    className="form-input"
                    value={formData.taxId}
                    onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0', margin: '1rem 0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={formData.loadTemplate}
                    onChange={(e) => setFormData({ ...formData, loadTemplate: e.target.checked })}
                  />
                  <span>
                    <strong>Populate standard Chart of Accounts template</strong>
                    <span style={{ display: 'block', color: '#64748b', fontSize: '0.75rem' }}>
                      Automatically loads standard nominal accounts (1000–8999, bank accounts, trade receivables/payables, retained earnings).
                    </span>
                  </span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
                <Link href="/organizations" className="btn btn-secondary">
                  Cancel
                </Link>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? 'Creating Organisation...' : 'Create Organisation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
