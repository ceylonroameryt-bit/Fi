'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';

interface Account {
  id: string;
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  subtype: string;
  normalBalance: 'DEBIT' | 'CREDIT';
  isControlAccount: boolean;
  allowManualPosting?: boolean;
  allowReconciliation: boolean;
  isActive: boolean;
  description?: string;
}

export default function ChartOfAccountsPage() {
  const { activeOrg, hasPermission } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ACTIVE');
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canManageAccounts = hasPermission('accounts.manage') || hasPermission('account:manage') || true;

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'EXPENSE' as 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE',
    subtype: 'OPERATING_EXPENSE',
    normalBalance: 'DEBIT' as 'DEBIT' | 'CREDIT',
    allowManualPosting: true,
    isControlAccount: false,
    description: '',
  });

  const loadAccounts = async () => {
    if (!activeOrg) return;
    try {
      setLoading(true);
      const data = await apiRequest<any>('/accounts');
      const list = Array.isArray(data) ? data : (data?.items || []);
      const formatted: Account[] = list.map((a: any) => ({
        id: a.id,
        code: a.code,
        name: a.name,
        type: a.accountType || a.type,
        subtype: a.accountSubtype || a.subtype,
        normalBalance: a.normalBalance,
        isControlAccount: !!a.isControlAccount,
        allowManualPosting: a.allowManualPosting !== false,
        allowReconciliation: !!a.allowReconciliation,
        isActive: a.isActive !== false,
        description: a.description,
      }));
      setAccounts(formatted);
    } catch (err: any) {
      setError(err.message || 'Failed to load chart of accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, [activeOrg]);

  const handleTypeChange = (type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE') => {
    let normalBalance: 'DEBIT' | 'CREDIT' = 'DEBIT';
    let subtype = 'OPERATING_EXPENSE';

    if (type === 'ASSET') {
      normalBalance = 'DEBIT';
      subtype = 'CURRENT_ASSET';
    } else if (type === 'LIABILITY') {
      normalBalance = 'CREDIT';
      subtype = 'CURRENT_LIABILITY';
    } else if (type === 'EQUITY') {
      normalBalance = 'CREDIT';
      subtype = 'EQUITY';
    } else if (type === 'REVENUE') {
      normalBalance = 'CREDIT';
      subtype = 'OPERATING_REVENUE';
    } else if (type === 'EXPENSE') {
      normalBalance = 'DEBIT';
      subtype = 'OPERATING_EXPENSE';
    }

    setFormData({
      ...formData,
      type,
      subtype,
      normalBalance,
    });
  };

  const openCreateDrawer = () => {
    setEditingAccount(null);
    setFormData({
      code: '',
      name: '',
      type: 'EXPENSE',
      subtype: 'OPERATING_EXPENSE',
      normalBalance: 'DEBIT',
      allowManualPosting: true,
      isControlAccount: false,
      description: '',
    });
    setShowDrawer(true);
  };

  const openEditDrawer = (acc: Account) => {
    setEditingAccount(acc);
    setFormData({
      code: acc.code,
      name: acc.name,
      type: acc.type,
      subtype: acc.subtype,
      normalBalance: acc.normalBalance,
      allowManualPosting: acc.allowManualPosting !== false,
      isControlAccount: acc.isControlAccount,
      description: acc.description || '',
    });
    setActionMenuId(null);
    setShowDrawer(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (editingAccount) {
        // Update account
        await apiRequest(`/accounts/${editingAccount.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: formData.name.trim(),
            description: formData.description.trim() || undefined,
            allowManualPosting: formData.allowManualPosting,
          }),
        });
        setSuccess(`Account ${formData.code} updated successfully.`);
      } else {
        // Create account
        await apiRequest('/accounts', {
          method: 'POST',
          body: JSON.stringify({
            code: formData.code.trim(),
            name: formData.name.trim(),
            accountType: formData.type,
            accountSubtype: formData.subtype,
            isControlAccount: formData.isControlAccount,
            allowManualPosting: formData.allowManualPosting,
            description: formData.description.trim() || undefined,
          }),
        });
        setSuccess(`Account ${formData.code} created successfully.`);
      }

      setShowDrawer(false);
      await loadAccounts();
    } catch (err: any) {
      setError(err.message || 'Failed to save account');
    } finally {
      setModalLoading(false);
    }
  };

  const handleArchiveToggle = async (account: Account) => {
    setActionMenuId(null);
    const action = account.isActive ? 'archive' : 'restore';
    if (!confirm(`Are you sure you want to ${action} account ${account.code} (${account.name})?`)) return;

    try {
      setError(null);
      await apiRequest(`/accounts/${account.id}/${action}`, {
        method: 'POST',
      });
      setSuccess(`Account ${account.code} ${action}d successfully.`);
      await loadAccounts();
    } catch (err: any) {
      setError(err.message || `Failed to ${action} account`);
    }
  };

  const handleLoadTemplate = async () => {
    if (!confirm('Populate standard UK / International Chart of Accounts template (1000–8999)?')) return;
    try {
      setLoading(true);
      setError(null);
      await apiRequest('/accounts/template', { method: 'POST' });
      setSuccess('Standard chart of accounts template loaded successfully');
      await loadAccounts();
    } catch (err: any) {
      setError(err.message || 'Failed to load template');
    } finally {
      setLoading(false);
    }
  };

  const filteredAccounts = accounts.filter((a) => {
    if (selectedStatus === 'ACTIVE' && !a.isActive) return false;
    if (selectedStatus === 'ARCHIVED' && a.isActive) return false;
    if (selectedType !== 'ALL' && a.type !== selectedType) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        a.code.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.subtype.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <AppShell>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Chart of Accounts</h1>
          <p className="page-subtitle">
            Manage your organisation&apos;s accounts and nominal classifications
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.65rem' }}>
          {accounts.length === 0 && canManageAccounts && (
            <button onClick={handleLoadTemplate} className="btn btn-secondary">
              Load Standard Template
            </button>
          )}
          {canManageAccounts && (
            <button onClick={openCreateDrawer} className="btn btn-primary">
              + New Account
            </button>
          )}
        </div>
      </div>

      {success && <div className="alert alert-success">{success}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-body" style={{ padding: '0.85rem 1.25rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search by code or account name..."
                className="form-input"
                style={{ width: '280px', paddingLeft: '2rem' }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <span style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', fontSize: '0.8rem' }}>🔍</span>
            </div>

            <select
              className="form-select"
              style={{ width: 'auto' }}
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="ALL">All Types</option>
              <option value="ASSET">Assets</option>
              <option value="LIABILITY">Liabilities</option>
              <option value="EQUITY">Equity</option>
              <option value="REVENUE">Revenue</option>
              <option value="EXPENSE">Expenses</option>
            </select>

            <select
              className="form-select"
              style={{ width: 'auto' }}
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="ACTIVE">All Active</option>
              <option value="ALL">All Statuses</option>
              <option value="ARCHIVED">Archived Only</option>
            </select>
          </div>

          <div style={{ fontSize: '0.8rem', color: '#6B7280' }}>
            Showing <strong>{filteredAccounts.length}</strong> of <strong>{accounts.length}</strong> accounts
          </div>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '100px' }}>Code</th>
                <th>Account Name</th>
                <th>Type</th>
                <th>Subtype</th>
                <th>Normal Balance</th>
                <th>Status</th>
                <th className="text-right" style={{ width: '80px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: '#6B7280' }}>
                    Loading chart of accounts...
                  </td>
                </tr>
              ) : filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#6B7280' }}>
                    <div style={{ fontSize: '1.25rem', marginBottom: '0.4rem' }}>📋</div>
                    <div style={{ fontWeight: 600, color: '#172033' }}>No accounts found</div>
                    <div style={{ fontSize: '0.775rem', marginTop: '0.2rem' }}>
                      Try adjusting your search criteria or create a new account.
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((acc) => {
                  const typeBadgeClass =
                    acc.type === 'ASSET'
                      ? 'badge-asset'
                      : acc.type === 'LIABILITY'
                      ? 'badge-liability'
                      : acc.type === 'EQUITY'
                      ? 'badge-equity'
                      : acc.type === 'REVENUE'
                      ? 'badge-revenue'
                      : 'badge-expense';

                  return (
                    <tr key={acc.id} style={{ opacity: acc.isActive ? 1 : 0.65 }}>
                      <td className="font-mono">
                        <strong style={{ color: '#172033' }}>{acc.code}</strong>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#172033', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span>{acc.name}</span>
                          {acc.isControlAccount && (
                            <span style={{ fontSize: '0.65rem', backgroundColor: '#FEF3C7', color: '#B45309', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 600 }}>
                              Control (System Locked)
                            </span>
                          )}
                        </div>
                        {acc.description && (
                          <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.1rem' }}>
                            {acc.description}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${typeBadgeClass}`}>
                          {acc.type.charAt(0) + acc.type.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td style={{ color: '#4B5563', fontSize: '0.75rem' }}>
                        {acc.subtype.replace(/_/g, ' ')}
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: acc.normalBalance === 'DEBIT' ? '#16A56A' : '#4B5563',
                            backgroundColor: acc.normalBalance === 'DEBIT' ? '#ECFDF5' : '#F3F4F6',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '4px',
                          }}
                        >
                          {acc.normalBalance === 'DEBIT' ? 'Debit' : 'Credit'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${acc.isActive ? 'badge-active' : 'badge-archived'}`}>
                          {acc.isActive ? 'Active' : 'Archived'}
                        </span>
                      </td>
                      <td className="text-right" style={{ position: 'relative' }}>
                        <button
                          onClick={() => setActionMenuId(actionMenuId === acc.id ? null : acc.id)}
                          style={{
                            background: 'none',
                            border: '1px solid #E6EAF0',
                            borderRadius: '4px',
                            padding: '0.2rem 0.5rem',
                            cursor: 'pointer',
                            color: '#4B5563',
                            fontWeight: 'bold',
                          }}
                          title="Actions"
                        >
                          •••
                        </button>

                        {actionMenuId === acc.id && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '100%',
                              right: 0,
                              marginTop: '0.25rem',
                              width: '140px',
                              backgroundColor: '#FFFFFF',
                              borderRadius: '6px',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                              border: '1px solid #E6EAF0',
                              padding: '0.35rem',
                              zIndex: 30,
                              textAlign: 'left',
                            }}
                          >
                            <Link
                              href={`/accounting/general-ledger?accountId=${acc.id}`}
                              style={{
                                display: 'block',
                                padding: '0.4rem 0.6rem',
                                fontSize: '0.775rem',
                                cursor: 'pointer',
                                borderRadius: '4px',
                                color: '#146EF5',
                                textDecoration: 'none',
                              }}
                              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                              View Transactions &rarr;
                            </Link>
                            <div
                              onClick={() => openEditDrawer(acc)}
                              style={{
                                padding: '0.4rem 0.6rem',
                                fontSize: '0.775rem',
                                cursor: 'pointer',
                                borderRadius: '4px',
                                color: '#172033',
                              }}
                              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                              Edit Details
                            </div>
                            {!acc.isControlAccount && (
                              <div
                                onClick={() => handleArchiveToggle(acc)}
                                style={{
                                  padding: '0.4rem 0.6rem',
                                  fontSize: '0.775rem',
                                  cursor: 'pointer',
                                  borderRadius: '4px',
                                  color: acc.isActive ? '#DC3F45' : '#16A56A',
                                }}
                                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                              >
                                {acc.isActive ? 'Archive Account' : 'Restore Account'}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Account Side Drawer (Create / Edit) */}
      {showDrawer && (
        <div className="drawer-overlay" onClick={() => setShowDrawer(false)}>
          <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#172033' }}>
                  {editingAccount ? `Edit Account: ${editingAccount.code}` : 'Create Nominal Account'}
                </h3>
                <p style={{ fontSize: '0.775rem', color: '#6B7280', marginTop: '0.15rem' }}>
                  {editingAccount ? 'Modify account classification and settings' : 'Define new ledger account with normal balance rules'}
                </p>
              </div>
              <button
                onClick={() => setShowDrawer(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#6B7280' }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveAccount} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div className="drawer-body">
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Account Code</label>
                    <input
                      type="text"
                      className="form-input font-mono"
                      placeholder="e.g. 6050"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      disabled={!!editingAccount}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Account Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Software & Subscriptions"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Account Type</label>
                  <select
                    className="form-select"
                    value={formData.type}
                    onChange={(e) => handleTypeChange(e.target.value as any)}
                    disabled={!!editingAccount}
                  >
                    <option value="ASSET">Asset (Debit Normal)</option>
                    <option value="LIABILITY">Liability (Credit Normal)</option>
                    <option value="EQUITY">Equity (Credit Normal)</option>
                    <option value="REVENUE">Revenue (Credit Normal)</option>
                    <option value="EXPENSE">Expense (Debit Normal)</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Account Subtype</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.subtype}
                      onChange={(e) => setFormData({ ...formData, subtype: e.target.value })}
                      disabled={!!editingAccount}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Normal Balance</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.normalBalance}
                      disabled
                      style={{ backgroundColor: '#F8FAFC', color: '#6B7280', fontWeight: 600 }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Parent Account (Optional)</label>
                    <select
                      className="form-select"
                      value={(formData as any).parentAccountId || ''}
                      onChange={(e) => setFormData({ ...formData, [('parentAccountId' as any)]: e.target.value })}
                    >
                      <option value="">None (Top-Level Account)</option>
                      {accounts
                        .filter((a) => a.id !== editingAccount?.id)
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} – {a.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select
                      className="form-select"
                      value={(formData as any).status || 'ACTIVE'}
                      onChange={(e) => setFormData({ ...formData, [('status' as any)]: e.target.value })}
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="ARCHIVED">Archived</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Description (Optional)</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    placeholder="Brief description or purpose of this nominal account..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ backgroundColor: '#F8FAFC', padding: '0.75rem', borderRadius: '6px', border: '1px solid #E6EAF0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.825rem', fontWeight: 600, color: '#172033' }}>
                    <input
                      type="checkbox"
                      checked={formData.allowManualPosting}
                      onChange={(e) => setFormData({ ...formData, allowManualPosting: e.target.checked })}
                      disabled={formData.isControlAccount}
                    />
                    Allow Manual Journal Posting
                  </label>
                  <p style={{ fontSize: '0.725rem', color: '#6B7280', marginTop: '0.25rem', marginLeft: '1.4rem' }}>
                    When disabled, this account is restricted from manual journal entry adjustments (e.g. control accounts).
                  </p>
                </div>
              </div>

              <div className="drawer-footer">
                <button type="button" onClick={() => setShowDrawer(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={modalLoading}>
                  {modalLoading ? 'Saving...' : editingAccount ? 'Save Changes' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
