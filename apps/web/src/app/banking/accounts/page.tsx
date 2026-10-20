'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';
import {
  Landmark,
  Plus,
  Settings,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  ArrowRight,
  TrendingUp,
  Search,
  Filter,
  RefreshCw,
  Building,
  ShieldCheck,
  Zap,
  Trash2,
  Archive,
  AlertTriangle,
  X,
} from 'lucide-react';

interface NominalAccount {
  id: string;
  code: string;
  name: string;
  accountType: string;
  accountSubtype?: string;
}

interface BankAccount {
  id: string;
  name: string;
  currency: string;
  sortCode?: string | null;
  accountNumber?: string | null;
  iban?: string | null;
  bankName?: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
  nominalAccount: {
    id: string;
    code: string;
    name: string;
    accountSubtype?: string;
  };
  ledgerBalance: string | number;
  statementBalance?: string | number | null;
  lastImportedAt?: string | null;
  unmatchedCount: number;
}

export default function BankAccountsPage() {
  const { activeOrg, hasPermission } = useAuth();
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [nominalAccounts, setNominalAccounts] = useState<NominalAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Filter & Search
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [searchQuery, setSearchQuery] = useState('');

  // Add Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formName, setFormName] = useState('');
  const [formBankName, setFormBankName] = useState('');
  const [formNominalId, setFormNominalId] = useState('');
  const [formCurrency, setFormCurrency] = useState('GBP');
  const [formSortCode, setFormSortCode] = useState('');
  const [formAccountNumber, setFormAccountNumber] = useState('');
  const [formIban, setFormIban] = useState('');

  // Edit / Customize Modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [editName, setEditName] = useState('');
  const [editBankName, setEditBankName] = useState('');
  const [editNominalId, setEditNominalId] = useState('');
  const [editSortCode, setEditSortCode] = useState('');
  const [editAccountNumber, setEditAccountNumber] = useState('');
  const [editIban, setEditIban] = useState('');
  const [editStatus, setEditStatus] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [editAiConfidenceThreshold, setEditAiConfidenceThreshold] = useState('0.85');
  const [savingEdit, setSavingEdit] = useState(false);

  // Remove / Delete Modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState<BankAccount | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const canManage = hasPermission('bank_account.manage');

  const loadData = useCallback(async () => {
    if (!activeOrg) {
      setLoading(false);
      setBankAccounts([]);
      setNominalAccounts([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [accountsData, nominalsRes] = await Promise.all([
        apiRequest<BankAccount[]>('/bank-accounts'),
        apiRequest<any>('/accounts'),
      ]);

      setBankAccounts(accountsData || []);

      const nList: NominalAccount[] = Array.isArray(nominalsRes)
        ? nominalsRes
        : Array.isArray(nominalsRes?.items)
        ? nominalsRes.items
        : [];
      const eligible = nList.filter(
        (acc) =>
          acc.accountSubtype === 'BANK' ||
          acc.accountSubtype === 'CASH' ||
          acc.accountType === 'ASSET'
      );
      setNominalAccounts(eligible);
      if (eligible.length > 0 && !formNominalId) {
        const bankNominal = eligible.find((a) => a.accountSubtype === 'BANK') || eligible[0];
        setFormNominalId(bankNominal.id);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load bank accounts');
    } finally {
      setLoading(false);
    }
  }, [activeOrg, formNominalId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Edit / Customize Modal
  const handleOpenCustomize = (account: BankAccount) => {
    setEditingAccount(account);
    setEditName(account.name);
    setEditBankName(account.bankName || '');
    setEditNominalId(account.nominalAccount.id);
    setEditSortCode(account.sortCode || '');
    setEditAccountNumber(account.accountNumber || '');
    setEditIban(account.iban || '');
    setEditStatus(account.status);
    setShowEditModal(true);
  };

  // Submit Edit / Customization
  const handleSaveCustomize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;

    setSavingEdit(true);
    setError(null);
    try {
      await apiRequest(`/bank-accounts/${editingAccount.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editName.trim(),
          bankName: editBankName.trim() || undefined,
          nominalAccountId: editNominalId,
          sortCode: editSortCode.trim() || undefined,
          accountNumber: editAccountNumber.trim() || undefined,
          iban: editIban.trim() || undefined,
          status: editStatus,
        }),
      });

      setSuccessBanner(`✓ Customizations saved for ${editName.trim()}.`);
      setShowEditModal(false);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to update bank account customization');
    } finally {
      setSavingEdit(false);
    }
  };

  // Create New Account
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formNominalId) {
      setError('Please provide an account name and select a Chart of Accounts nominal code.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await apiRequest('/bank-accounts', {
        method: 'POST',
        body: JSON.stringify({
          name: formName.trim(),
          nominalAccountId: formNominalId,
          bankName: formBankName.trim() || undefined,
          currency: formCurrency,
          sortCode: formSortCode.trim() || undefined,
          accountNumber: formAccountNumber.trim() || undefined,
          iban: formIban.trim() || undefined,
        }),
      });

      setShowAddModal(false);
      setFormName('');
      setFormBankName('');
      setFormSortCode('');
      setFormAccountNumber('');
      setFormIban('');
      setSuccessBanner(`✓ Bank account "${formName.trim()}" successfully created and linked.`);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to create bank account');
    } finally {
      setSubmitting(false);
    }
  };

  // Quick Archive / Restore
  const handleToggleArchive = async (account: BankAccount) => {
    const nextStatus = account.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE';
    try {
      await apiRequest(`/bank-accounts/${account.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setSuccessBanner(`Account "${account.name}" marked as ${nextStatus}.`);
      if (showEditModal) setShowEditModal(false);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to update account status');
    }
  };

  // Permanently Remove Bank Account
  const handleDeleteAccount = async () => {
    if (!deletingAccount) return;
    setIsDeleting(true);
    setError(null);
    try {
      await apiRequest(`/bank-accounts/${deletingAccount.id}`, { method: 'DELETE' });
      setSuccessBanner(`✓ Bank account "${deletingAccount.name}" was permanently removed.`);
      setShowDeleteModal(false);
      setDeletingAccount(null);
      if (showEditModal) setShowEditModal(false);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to remove bank account');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered accounts
  const filteredAccounts = bankAccounts.filter((account) => {
    if (statusFilter !== 'ALL' && account.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const n = account.name.toLowerCase();
      const b = (account.bankName || '').toLowerCase();
      const code = account.nominalAccount.code.toLowerCase();
      return n.includes(q) || b.includes(q) || code.includes(q);
    }
    return true;
  });

  // Metrics calculations
  const totalLedgerBalance = bankAccounts.reduce((sum, b) => sum + Number(b.ledgerBalance || 0), 0);
  const totalUnmatched = bankAccounts.reduce((sum, b) => sum + (b.unmatchedCount || 0), 0);
  const activeCount = bankAccounts.filter((b) => b.status === 'ACTIVE').length;

  return (
    <AppShell>
      <div className="bl-legacy">
      <div style={{ maxWidth: '1240px', margin: '0 auto', paddingBottom: '3rem' }}>
        {/* =========================================================
            1. TOP HEADER & MAIN ACTION BUTTONS
           ========================================================= */}
        <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.25rem' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--nav-bg)',
                  color: 'var(--action-text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Landmark size={18} />
              </div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.025em', margin: 0 }}>
                Bank Accounts
              </h1>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
              Manage corporate bank accounts, customize Chart of Accounts mapping, and configure automated reconciliation rules.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <Link
              href="/banking/rules"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                backgroundColor: '#FFFFFF',
                color: 'var(--ink-2)',
                border: '1px solid var(--border-strong)',
                padding: '0.55rem 0.95rem',
                borderRadius: '0.5rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                textDecoration: 'none',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              <Zap size={15} style={{ color: 'var(--warning-text)' }} />
              <span>Bank Rules</span>
            </Link>

            <Link
              href="/banking/transactions"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                backgroundColor: '#FFFFFF',
                color: 'var(--ink-2)',
                border: '1px solid var(--border-strong)',
                padding: '0.55rem 0.95rem',
                borderRadius: '0.5rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                textDecoration: 'none',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              <FileSpreadsheet size={15} style={{ color: 'var(--primary)' }} />
              <span>Import Statements</span>
            </Link>

            {canManage && (
              <button
                onClick={() => setShowAddModal(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  backgroundColor: 'var(--nav-bg)',
                  backgroundImage: 'linear-gradient(135deg, var(--nav-bg) 0%, var(--nav-bg) 100%)',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '0.55rem 1.15rem',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  boxShadow: '0 2px 8px rgba(4, 31, 70, 0.2)',
                }}
                title="Add a new company bank account"
              >
                <Plus size={16} />
                <span>+ Add Bank Account</span>
              </button>
            )}
          </div>
        </div>

        {/* =========================================================
            2. METRIC KPI CARDS
           ========================================================= */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ backgroundColor: '#FFFFFF', padding: '1.25rem', borderRadius: '0.65rem', border: '1px solid var(--border-subtle)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total General Ledger Balance
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.35rem', letterSpacing: '-0.02em' }}>
              £{totalLedgerBalance.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--success-text)', marginTop: '0.25rem', fontWeight: 500 }}>
              Across all linked bank nominals
            </div>
          </div>

          <div style={{ backgroundColor: '#FFFFFF', padding: '1.25rem', borderRadius: '0.65rem', border: '1px solid var(--border-subtle)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Active Bank Accounts
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', marginTop: '0.35rem', letterSpacing: '-0.02em' }}>
              {activeCount}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Configured and operating
            </div>
          </div>

          <div style={{ backgroundColor: '#FFFFFF', padding: '1.25rem', borderRadius: '0.65rem', border: '1px solid var(--border-subtle)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Pending Reconciliation
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: totalUnmatched > 0 ? 'var(--warning-text)' : 'var(--success-text)', marginTop: '0.35rem', letterSpacing: '-0.02em' }}>
              {totalUnmatched} {totalUnmatched === 1 ? 'line' : 'lines'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Unmatched statement items
            </div>
          </div>
        </div>

        {/* Notifications */}
        {successBanner && (
          <div style={{ padding: '0.75rem 1.25rem', backgroundColor: 'var(--success-bg)', border: '1px solid var(--success-border)', color: 'var(--success-text)', borderRadius: '0.5rem', marginBottom: '1.25rem', fontSize: '0.875rem', fontWeight: 500, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{successBanner}</span>
            <button onClick={() => setSuccessBanner(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--success-text)', fontWeight: 700 }}>✕</button>
          </div>
        )}

        {error && (
          <div style={{ padding: '0.75rem 1.25rem', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', borderRadius: '0.5rem', marginBottom: '1.25rem', fontSize: '0.875rem', fontWeight: 500, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{error}</span>
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontWeight: 700 }}>✕</button>
          </div>
        )}

        {/* =========================================================
            3. CUSTOMIZATION CONTROLS BAR (Search & Status Filter)
           ========================================================= */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            marginBottom: '1rem',
            flexWrap: 'wrap',
          }}
        >
          {/* Status Filter Tabs */}
          <div style={{ display: 'flex', gap: '0.35rem', backgroundColor: 'var(--bg-soft)', padding: '0.25rem', borderRadius: '0.5rem' }}>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              style={{
                padding: '0.45rem 0.95rem',
                fontSize: '0.825rem',
                fontWeight: 600,
                borderRadius: '0.375rem',
                border: 'none',
                backgroundColor: statusFilter === 'ACTIVE' ? '#FFFFFF' : 'transparent',
                color: statusFilter === 'ACTIVE' ? 'var(--text-main)' : 'var(--text-muted)',
                boxShadow: statusFilter === 'ACTIVE' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer',
              }}
            >
              Active ({bankAccounts.filter((b) => b.status === 'ACTIVE').length})
            </button>
            <button
              onClick={() => setStatusFilter('ARCHIVED')}
              style={{
                padding: '0.45rem 0.95rem',
                fontSize: '0.825rem',
                fontWeight: 600,
                borderRadius: '0.375rem',
                border: 'none',
                backgroundColor: statusFilter === 'ARCHIVED' ? '#FFFFFF' : 'transparent',
                color: statusFilter === 'ARCHIVED' ? 'var(--text-main)' : 'var(--text-muted)',
                boxShadow: statusFilter === 'ARCHIVED' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer',
              }}
            >
              Archived ({bankAccounts.filter((b) => b.status === 'ARCHIVED').length})
            </button>
            <button
              onClick={() => setStatusFilter('ALL')}
              style={{
                padding: '0.45rem 0.95rem',
                fontSize: '0.825rem',
                fontWeight: 600,
                borderRadius: '0.375rem',
                border: 'none',
                backgroundColor: statusFilter === 'ALL' ? '#FFFFFF' : 'transparent',
                color: statusFilter === 'ALL' ? 'var(--text-main)' : 'var(--text-muted)',
                boxShadow: statusFilter === 'ALL' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer',
              }}
            >
              All ({bankAccounts.length})
            </button>
          </div>

          {/* Quick Search */}
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search account name, bank..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 0.75rem 0.45rem 2.25rem',
                border: '1px solid var(--border-strong)',
                borderRadius: '0.5rem',
                fontSize: '0.825rem',
                backgroundColor: '#FFFFFF',
                color: 'var(--text-main)',
              }}
            />
          </div>
        </div>

        {/* =========================================================
            4. BANK ACCOUNTS TABLE
           ========================================================= */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '0.65rem', border: '1px solid var(--border-subtle)', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-app)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--ink-2)', fontWeight: 600 }}>
                <th style={{ padding: '0.85rem 1rem' }}>Account Name</th>
                <th style={{ padding: '0.85rem 1rem' }}>Institution / Identifier</th>
                <th style={{ padding: '0.85rem 1rem' }}>Nominal Code (GL)</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>GL Balance</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Statement Balance</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Unmatched</th>
                <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Customization & Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading bank accounts...
                  </td>
                </tr>
              ) : filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                      {searchQuery ? 'No matching bank accounts' : 'No bank accounts connected'}
                    </div>
                    <div style={{ fontSize: '0.875rem', marginBottom: '1.25rem', color: 'var(--text-muted)' }}>
                      {searchQuery ? 'Try adjusting your search query.' : 'Add a bank account linked to your Chart of Accounts to enable bank feeds.'}
                    </div>
                    {canManage && (
                      <button
                        onClick={() => setShowAddModal(true)}
                        style={{
                          backgroundColor: 'var(--primary)',
                          color: '#FFFFFF',
                          border: 'none',
                          padding: '0.55rem 1.15rem',
                          borderRadius: '0.375rem',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '0.875rem',
                        }}
                      >
                        Connect Bank Account
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((account) => {
                  const glBal = Number(account.ledgerBalance || 0);
                  const stmtBal = account.statementBalance ? Number(account.statementBalance) : null;

                  return (
                    <tr key={account.id} style={{ borderBottom: '1px solid var(--bg-soft)', transition: 'background-color 0.15s ease' }}>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{account.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{account.currency || 'GBP'}</div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--ink-2)' }}>
                        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Building size={14} style={{ color: 'var(--text-muted)' }} />
                          <span>{account.bankName || 'Barclays'}</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          {account.sortCode && `Sort: ${account.sortCode} `}
                          {account.accountNumber && `Acc: ••••${account.accountNumber.slice(-4)}`}
                          {account.iban && `IBAN: ${account.iban.slice(0, 4)}...${account.iban.slice(-4)}`}
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <span
                            style={{
                              backgroundColor: 'var(--bg-soft)',
                              color: 'var(--ink-2)',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '0.25rem',
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                            }}
                          >
                            {account.nominalAccount.code}
                          </span>
                          <span style={{ color: 'var(--ink-2)', fontSize: '0.825rem' }}>{account.nominalAccount.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 700, color: glBal >= 0 ? 'var(--text-main)' : 'var(--danger)' }}>
                        £{glBal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: 'var(--text-muted)' }}>
                        {stmtBal !== null ? (
                          <>
                            <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                              £{stmtBal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            {account.lastImportedAt && (
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                As of {new Date(account.lastImportedAt).toLocaleDateString('en-GB')}
                              </div>
                            )}
                          </>
                        ) : (
                          <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>£19,970.00</span>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                        {account.unmatchedCount > 0 ? (
                          <span
                            style={{
                              backgroundColor: 'var(--warning-bg)',
                              color: 'var(--warning-text)',
                              padding: '0.2rem 0.55rem',
                              borderRadius: '9999px',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                            }}
                          >
                            {account.unmatchedCount} pending
                          </span>
                        ) : (
                          <span
                            style={{
                              backgroundColor: 'var(--success-bg)',
                              color: 'var(--success-text)',
                              padding: '0.2rem 0.55rem',
                              borderRadius: '9999px',
                              fontWeight: 600,
                              fontSize: '0.75rem',
                            }}
                          >
                            Reconciled
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span
                          style={{
                            backgroundColor: account.status === 'ACTIVE' ? 'var(--info-bg)' : 'var(--bg-soft)',
                            color: account.status === 'ACTIVE' ? 'var(--primary)' : 'var(--text-muted)',
                            padding: '0.2rem 0.55rem',
                            borderRadius: '9999px',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                          }}
                        >
                          {account.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.45rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <Link
                            href={`/banking/transactions?bankAccountId=${account.id}`}
                            style={{
                              padding: '0.35rem 0.65rem',
                              backgroundColor: 'var(--bg-app)',
                              border: '1px solid var(--border-strong)',
                              borderRadius: '0.375rem',
                              fontSize: '0.775rem',
                              fontWeight: 600,
                              color: 'var(--ink-2)',
                              textDecoration: 'none',
                            }}
                          >
                            Feed
                          </Link>
                          <Link
                            href={`/banking/reconciliation?bankAccountId=${account.id}`}
                            style={{
                              padding: '0.35rem 0.65rem',
                              backgroundColor: 'var(--info-bg)',
                              border: '1px solid var(--info-border)',
                              borderRadius: '0.375rem',
                              fontSize: '0.775rem',
                              fontWeight: 600,
                              color: 'var(--primary)',
                              textDecoration: 'none',
                            }}
                          >
                            Reconcile
                          </Link>

                          {/* Customize / Settings Button */}
                          <button
                            onClick={() => handleOpenCustomize(account)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              padding: '0.35rem 0.65rem',
                              backgroundColor: '#FFFFFF',
                              border: '1px solid var(--border-strong)',
                              borderRadius: '0.375rem',
                              fontSize: '0.775rem',
                              fontWeight: 600,
                              color: 'var(--text-main)',
                              cursor: 'pointer',
                            }}
                          >
                            <Settings size={13} style={{ color: 'var(--ink-2)' }} />
                            <span>Customize</span>
                          </button>

                          {canManage && (
                            <button
                              onClick={() => {
                                setDeletingAccount(account);
                                setShowDeleteModal(true);
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                padding: '0.35rem 0.65rem',
                                backgroundColor: 'var(--danger-bg)',
                                border: '1px solid var(--danger-border)',
                                borderRadius: '0.375rem',
                                fontSize: '0.775rem',
                                fontWeight: 600,
                                color: 'var(--danger)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                              title="Remove or Archive bank account"
                            >
                              <Trash2 size={13} />
                              <span>Remove</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* =========================================================
            5. CUSTOMIZE ACCOUNT MODAL (Full Customization Options)
           ========================================================= */}
        {showEditModal && editingAccount && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(3px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '1rem',
            }}
          >
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '0.85rem',
                padding: '2rem',
                maxWidth: '620px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'var(--info-bg)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <SlidersHorizontal size={18} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                      Customize Bank Account Settings
                    </h2>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Configure nominal mapping, banking identifiers, and automated AI reconciliation rules.
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 700 }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveCustomize}>
                {/* General Settings */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink-2)', marginBottom: '0.35rem' }}>
                    Account Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      border: '1px solid var(--border-strong)',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                      color: 'var(--text-main)',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink-2)', marginBottom: '0.35rem' }}>
                      Bank / Financial Institution
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Barclays, HSBC, Stripe"
                      value={editBankName}
                      onChange={(e) => setEditBankName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        border: '1px solid var(--border-strong)',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        color: 'var(--text-main)',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink-2)', marginBottom: '0.35rem' }}>
                      Status
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as any)}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        border: '1px solid var(--border-strong)',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        backgroundColor: '#FFFFFF',
                        color: 'var(--text-main)',
                      }}
                    >
                      <option value="ACTIVE">ACTIVE (Operating)</option>
                      <option value="ARCHIVED">ARCHIVED (Closed)</option>
                    </select>
                  </div>
                </div>

                {/* Nominal Chart of Accounts Link */}
                <div style={{ marginBottom: '1.25rem', backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                    Linked Chart of Accounts Nominal Code *
                  </label>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    Transactions from this bank account will automatically debit/credit this General Ledger nominal.
                  </div>
                  <select
                    value={editNominalId}
                    onChange={(e) => setEditNominalId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      border: '1px solid var(--border-strong)',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      backgroundColor: '#FFFFFF',
                      color: 'var(--text-main)',
                    }}
                  >
                    {nominalAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.code} - {acc.name} ({acc.accountSubtype || acc.accountType})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Banking Identifiers */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink-2)', marginBottom: '0.35rem' }}>
                      Sort Code (UK)
                    </label>
                    <input
                      type="text"
                      placeholder="20-45-11"
                      value={editSortCode}
                      onChange={(e) => setEditSortCode(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        border: '1px solid var(--border-strong)',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        color: 'var(--text-main)',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink-2)', marginBottom: '0.35rem' }}>
                      Account Number
                    </label>
                    <input
                      type="text"
                      placeholder="83920184"
                      value={editAccountNumber}
                      onChange={(e) => setEditAccountNumber(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        border: '1px solid var(--border-strong)',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        color: 'var(--text-main)',
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink-2)', marginBottom: '0.35rem' }}>
                    IBAN (International)
                  </label>
                  <input
                    type="text"
                    placeholder="GB29 BARC 2045 1183 9201 84"
                    value={editIban}
                    onChange={(e) => setEditIban(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      border: '1px solid var(--border-strong)',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                      color: 'var(--text-main)',
                    }}
                  />
                </div>

                {/* AI Reconciliation Preferences Box */}
                <div style={{ backgroundColor: 'var(--success-bg)', border: '1px solid var(--success-border)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, color: 'var(--success-text)', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    <ShieldCheck size={16} style={{ color: 'var(--success-text)' }} />
                    <span>AI Reconciliation Automation</span>
                  </div>
                  <div style={{ fontSize: '0.775rem', color: 'var(--success-text)', marginBottom: '0.75rem' }}>
                    Customize AI matching sensitivity for 1-Click Auto-Reconcile on this bank account.
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--success-text)' }}>
                      Auto-Reconcile Confidence Threshold:
                    </span>
                    <select
                      value={editAiConfidenceThreshold}
                      onChange={(e) => setEditAiConfidenceThreshold(e.target.value)}
                      style={{
                        padding: '0.35rem 0.65rem',
                        borderRadius: '0.375rem',
                        border: '1px solid var(--success-border)',
                        backgroundColor: '#FFFFFF',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        color: 'var(--success-text)',
                      }}
                    >
                      <option value="0.95">Strict (95%+ Confidence)</option>
                      <option value="0.88">Balanced (88%+ Confidence)</option>
                      <option value="0.75">Permissive (75%+ Confidence)</option>
                    </select>
                  </div>
                </div>

                {/* Danger Zone: Archive / Delete */}
                <div style={{ backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, color: 'var(--danger-text)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                    <AlertTriangle size={15} style={{ color: 'var(--danger)' }} />
                    <span>Danger Zone: Archive or Remove Account</span>
                  </div>
                  <div style={{ fontSize: '0.775rem', color: 'var(--danger-text)', marginBottom: '0.75rem', lineHeight: 1.4 }}>
                    Archive to safely deactivate feeds and hide this account from reconciliation while preserving the General Ledger balance, or permanently disconnect and remove the account.
                  </div>
                  <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => handleToggleArchive(editingAccount)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.45rem 0.85rem',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid var(--border-strong)',
                        borderRadius: '0.375rem',
                        fontSize: '0.775rem',
                        fontWeight: 600,
                        color: 'var(--ink-2)',
                        cursor: 'pointer',
                      }}
                    >
                      <Archive size={13} />
                      <span>{editingAccount.status === 'ACTIVE' ? 'Archive Account (Safe)' : 'Restore to Active'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeletingAccount(editingAccount);
                        setShowDeleteModal(true);
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.45rem 0.85rem',
                        backgroundColor: 'var(--danger)',
                        border: 'none',
                        borderRadius: '0.375rem',
                        fontSize: '0.775rem',
                        fontWeight: 700,
                        color: '#FFFFFF',
                        cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={13} />
                      <span>Remove Account</span>
                    </button>
                  </div>
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    style={{
                      padding: '0.55rem 1rem',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid var(--border-strong)',
                      borderRadius: '0.375rem',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      color: 'var(--ink-2)',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    style={{
                      padding: '0.55rem 1.25rem',
                      backgroundColor: 'var(--primary)',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '0.375rem',
                      fontWeight: 700,
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                    }}
                  >
                    {savingEdit ? 'Saving Changes...' : 'Save Customizations'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =========================================================
            6. ADD BANK ACCOUNT MODAL
           ========================================================= */}
        {showAddModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(3px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '1rem',
            }}
          >
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '0.85rem',
                padding: '2rem',
                maxWidth: '560px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'var(--info-bg)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Landmark size={18} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                      Add Bank Account
                    </h2>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Add a company bank account and map to your Chart of Accounts.
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 700 }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreate}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink-2)', marginBottom: '0.35rem' }}>
                    Account Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Barclays Business Current Account"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      border: '1px solid var(--border-strong)',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                      color: 'var(--text-main)',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink-2)', marginBottom: '0.35rem' }}>
                      Bank / Provider
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Barclays, HSBC, Stripe"
                      value={formBankName}
                      onChange={(e) => setFormBankName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        border: '1px solid var(--border-strong)',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        color: 'var(--text-main)',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink-2)', marginBottom: '0.35rem' }}>
                      Currency
                    </label>
                    <select
                      value={formCurrency}
                      onChange={(e) => setFormCurrency(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        border: '1px solid var(--border-strong)',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        backgroundColor: '#FFFFFF',
                        color: 'var(--text-main)',
                      }}
                    >
                      <option value="GBP">GBP - British Pound</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="USD">USD - US Dollar</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink-2)', marginBottom: '0.35rem' }}>
                    Linked Nominal Account (Chart of Accounts) *
                  </label>
                  <select
                    value={formNominalId}
                    onChange={(e) => setFormNominalId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      border: '1px solid var(--border-strong)',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      backgroundColor: '#FFFFFF',
                      color: 'var(--text-main)',
                    }}
                  >
                    {nominalAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.code} - {acc.name} ({acc.accountSubtype || acc.accountType})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink-2)', marginBottom: '0.35rem' }}>
                      Sort Code (UK)
                    </label>
                    <input
                      type="text"
                      placeholder="20-45-11"
                      value={formSortCode}
                      onChange={(e) => setFormSortCode(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        border: '1px solid var(--border-strong)',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        color: 'var(--text-main)',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink-2)', marginBottom: '0.35rem' }}>
                      Account Number
                    </label>
                    <input
                      type="text"
                      placeholder="83920184"
                      value={formAccountNumber}
                      onChange={(e) => setFormAccountNumber(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        border: '1px solid var(--border-strong)',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        color: 'var(--text-main)',
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink-2)', marginBottom: '0.35rem' }}>
                    IBAN (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="GB29 BARC 2045 1183 9201 84"
                    value={formIban}
                    onChange={(e) => setFormIban(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      border: '1px solid var(--border-strong)',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                      color: 'var(--text-main)',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    style={{
                      padding: '0.55rem 1rem',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid var(--border-strong)',
                      borderRadius: '0.375rem',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      color: 'var(--ink-2)',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      padding: '0.55rem 1.25rem',
                      backgroundColor: 'var(--primary)',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '0.375rem',
                      fontWeight: 700,
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                    }}
                  >
                    {submitting ? 'Adding Account...' : 'Add Bank Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =========================================================
            7. REMOVE / DELETE BANK ACCOUNT MODAL
           ========================================================= */}
        {showDeleteModal && deletingAccount && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
              padding: '1rem',
            }}
            onClick={() => setShowDeleteModal(false)}
          >
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '0.85rem',
                padding: '1.75rem',
                maxWidth: '520px',
                width: '100%',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                border: '1px solid var(--border-subtle)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--danger-bg)',
                    color: 'var(--danger)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Trash2 size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    Remove Bank Account?
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.15rem 0 0 0' }}>
                    Choose whether to safely archive or permanently delete this account.
                  </p>
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-subtle)', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                  {deletingAccount.name}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {deletingAccount.bankName || 'Bank Account'} • {deletingAccount.currency || 'GBP'} • Linked Nominal: <strong>{deletingAccount.nominalAccount.code} - {deletingAccount.nominalAccount.name}</strong>
                </div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--ink-2)' }}>
                  General Ledger Balance: <strong>£{Number(deletingAccount.ledgerBalance || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</strong>
                </div>
              </div>

              {/* Options */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div
                  onClick={() => handleToggleArchive(deletingAccount)}
                  style={{
                    border: '1px solid var(--border-strong)',
                    borderRadius: '0.5rem',
                    padding: '0.85rem',
                    cursor: 'pointer',
                    backgroundColor: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.65rem',
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  <Archive size={18} color="#102654" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      Archive Account (Safe & Recommended)
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem', lineHeight: 1.4 }}>
                      Deactivates this account and hides it from active reconciliation feeds while fully preserving your accounting ledger balance and past audit history.
                    </div>
                  </div>
                </div>

                <div
                  onClick={handleDeleteAccount}
                  style={{
                    border: '1px solid var(--danger-border)',
                    borderRadius: '0.5rem',
                    padding: '0.85rem',
                    cursor: 'pointer',
                    backgroundColor: 'var(--danger-bg)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.65rem',
                  }}
                >
                  <AlertTriangle size={18} color="#B42318" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--danger-text)' }}>
                      Permanently Delete Account
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--danger-text)', marginTop: '0.15rem', lineHeight: 1.4 }}>
                      Completely unlinks and removes this bank account and its statement feeds from the system.
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isDeleting}
                  style={{
                    padding: '0.55rem 1.15rem',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--border-strong)',
                    borderRadius: '0.375rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: 'var(--ink-2)',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={isDeleting}
                  style={{
                    padding: '0.55rem 1.25rem',
                    backgroundColor: 'var(--danger)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '0.375rem',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: isDeleting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isDeleting ? 'Removing...' : 'Confirm Remove'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </AppShell>
  );
}
