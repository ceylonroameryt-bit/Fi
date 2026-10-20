'use client';

import React, { useCallback, useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';
import { SlidersHorizontal, HelpCircle, CheckCheck, Zap, Sparkles, ShieldCheck } from 'lucide-react';
import {
  AiCustomizationModal,
  AiPreferences,
  DEFAULT_AI_PREFERENCES,
} from '@/components/banking/ai-customization-modal';
import { TransactionsVsReconciliationModal } from '@/components/banking/transactions-vs-reconciliation-modal';

interface BankAccount {
  id: string;
  name: string;
  currency: string;
  nominalAccount: {
    code: string;
    name: string;
  };
}

interface Contact {
  id: string;
  name: string;
}

interface NominalAccount {
  id: string;
  code: string;
  name: string;
  accountType: string;
}

interface BankStatementLine {
  id: string;
  transactionDate: string;
  description: string;
  payee?: string | null;
  reference?: string | null;
  amount: string;
  balance?: string | null;
  currency: string;
  status: 'UNMATCHED' | 'MATCHED' | 'CATEGORISED' | 'EXCLUDED';
  suggestedAccountId?: string | null;
  suggestedContactId?: string | null;
  matchConfidence?: string | null;
  matchExplanation?: string | null;
  bankAccount: {
    id: string;
    name: string;
    currency: string;
  };
}

interface LinesResponse {
  items: BankStatementLine[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function BankTransactionsContent() {
  const { activeOrg, hasPermission } = useAuth();
  const searchParams = useSearchParams();
  const initialAccountId = searchParams.get('bankAccountId') || '';

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [accounts, setAccounts] = useState<NominalAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState(initialAccountId);
  const [activeTab, setActiveTab] = useState<'ALL' | 'TO_CONFIRM' | 'CONFIRMED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [lines, setLines] = useState<BankStatementLine[]>([]);
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(false);
  const [aiRunning, setAiRunning] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [batchConfirming, setBatchConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [showLearnBanner, setShowLearnBanner] = useState(true);

  // AI & Workflow Customization Modals
  const [showAiModal, setShowAiModal] = useState(false);
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [aiPrefs, setAiPrefs] = useState<AiPreferences>(DEFAULT_AI_PREFERENCES);

  // Load custom AI preferences from localStorage
  useEffect(() => {
    if (!activeOrg?.id) return;
    try {
      const stored = localStorage.getItem(`blynt_ai_prefs_${activeOrg.id}`);
      if (stored) {
        setAiPrefs((prev) => ({ ...prev, ...JSON.parse(stored) }));
      }
    } catch (e) {
      console.warn('Failed to load stored AI preferences', e);
    }
  }, [activeOrg?.id]);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLines, setTotalLines] = useState(0);

  // Import Statement modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importBankAccountId, setImportBankAccountId] = useState(initialAccountId);
  const [importFileFormat, setImportFileFormat] = useState<'CSV' | 'OFX' | 'QIF'>('CSV');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [importing, setImporting] = useState(false);

  const canManage = hasPermission('bank_reconciliation.manage');
  const canImport = hasPermission('bank_statement.import');

  // Load supporting options (accounts, contacts, bank accounts)
  useEffect(() => {
    if (!activeOrg) {
      setBankAccounts([]);
      setAccounts([]);
      setContacts([]);
      return;
    }
    Promise.all([
      apiRequest<BankAccount[]>('/bank-accounts'),
      apiRequest<any>('/accounts'),
      apiRequest<any>('/contacts'),
    ]).then(([bData, aData, cData]) => {
      setBankAccounts(bData || []);
      const aList = Array.isArray(aData) ? aData : Array.isArray(aData?.items) ? aData.items : [];
      setAccounts(aList);
      const cList = Array.isArray(cData) ? cData : Array.isArray(cData?.items) ? cData.items : [];
      setContacts(cList);
      if (!importBankAccountId && bData && bData.length > 0) {
        setImportBankAccountId(bData[0].id);
      }
    }).catch(console.error);
  }, [activeOrg, importBankAccountId]);

  // Load statement lines
  const loadLines = useCallback(async () => {
    if (!activeOrg) {
      setLoading(false);
      setLines([]);
      setTotalPages(1);
      setTotalLines(0);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (selectedAccountId) queryParams.set('bankAccountId', selectedAccountId);
      if (activeTab === 'TO_CONFIRM') {
        // Will filter on client or server
      } else if (activeTab === 'CONFIRMED') {
        queryParams.set('status', 'MATCHED');
      }
      queryParams.set('page', page.toString());
      queryParams.set('limit', '100');

      const data = await apiRequest<LinesResponse>(`/bank-statements/lines?${queryParams.toString()}`);
      setLines(data.items || []);
      setTotalPages(data.totalPages || 1);
      setTotalLines(data.total || 0);
    } catch (err: any) {
      setError(err?.message || 'Failed to load bank transactions');
    } finally {
      setLoading(false);
    }
  }, [activeOrg, selectedAccountId, activeTab, page]);

  useEffect(() => {
    loadLines();
  }, [loadLines]);

  // Run AI Auto-Categorisation
  const handleRunAiCategorisation = async () => {
    if (!activeOrg) return;
    setAiRunning(true);
    setError(null);
    try {
      const res = await apiRequest<{ processedCount: number; categorisedCount: number }>(
        '/bank-statements/auto-categorise',
        {
          method: 'POST',
          body: JSON.stringify({ bankAccountId: selectedAccountId || undefined }),
        }
      );
      setBannerMessage(`✨ Blynt AI analysed ${res.processedCount} transactions and automatically identified vendors & categorised ${res.categorisedCount}.`);
      setActiveTab('TO_CONFIRM');
      const cData = await apiRequest<any>('/contacts');
      const cList = Array.isArray(cData) ? cData : Array.isArray(cData?.items) ? cData.items : [];
      setContacts(cList);
      await loadLines();
    } catch (err: any) {
      setError(err?.message || 'AI Auto-categorisation failed');
    } finally {
      setAiRunning(false);
    }
  };

  // Inline update handler (for Vendor/Customer or Nominal Category)
  const handleInlineUpdate = async (lineId: string, updates: { contactId?: string | null; accountId?: string | null }) => {
    try {
      // Optimistic state update
      setLines((prev) =>
        prev.map((l) =>
          l.id === lineId
            ? {
                ...l,
                suggestedContactId: updates.contactId !== undefined ? updates.contactId : l.suggestedContactId,
                suggestedAccountId: updates.accountId !== undefined ? updates.accountId : l.suggestedAccountId,
                status: updates.accountId ? 'CATEGORISED' : l.status,
              }
            : l
        )
      );

      await apiRequest(`/bank-statements/lines/${lineId}/inline-update`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    } catch (err: any) {
      console.error('Inline update failed', err);
    }
  };

  // Single Confirm
  const handleConfirmLine = async (lineId: string) => {
    setConfirmingId(lineId);
    setError(null);
    try {
      await apiRequest(`/bank-statements/lines/${lineId}/confirm`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      // Update local state to MATCHED
      setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, status: 'MATCHED' } : l)));
    } catch (err: any) {
      setError(err?.message || 'Failed to confirm transaction');
    } finally {
      setConfirmingId(null);
    }
  };

  // Single Unconfirm
  const handleUnconfirmLine = async (lineId: string) => {
    setConfirmingId(lineId);
    setError(null);
    try {
      await apiRequest(`/bank-statements/lines/${lineId}/unmatch`, {
        method: 'POST',
      });
      setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, status: 'UNMATCHED' } : l)));
    } catch (err: any) {
      setError(err?.message || 'Failed to unconfirm transaction');
    } finally {
      setConfirmingId(null);
    }
  };

  // Batch Confirm
  const handleBatchConfirm = async () => {
    if (selectedLineIds.size === 0) return;
    setBatchConfirming(true);
    setError(null);
    try {
      const ids = Array.from(selectedLineIds);
      const res = await apiRequest<{ confirmedCount: number; failedCount: number }>(
        '/bank-statements/batch-confirm',
        {
          method: 'POST',
          body: JSON.stringify({ lineIds: ids }),
        }
      );
      setBannerMessage(`Successfully confirmed ${res.confirmedCount} transaction(s) to General Ledger.`);
      setSelectedLineIds(new Set());
      await loadLines();
    } catch (err: any) {
      setError(err?.message || 'Batch confirmation failed');
    } finally {
      setBatchConfirming(false);
    }
  };

  // Multi-select toggle
  const toggleSelectLine = (id: string) => {
    setSelectedLineIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (filteredIds: string[]) => {
    if (selectedLineIds.size === filteredIds.length) {
      setSelectedLineIds(new Set());
    } else {
      setSelectedLineIds(new Set(filteredIds));
    }
  };

  // Statement file handling
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    const ext = file.name.split('.').pop()?.toUpperCase();
    if (ext === 'OFX') setImportFileFormat('OFX');
    else if (ext === 'QIF') setImportFileFormat('QIF');
    else setImportFileFormat('CSV');

    const reader = new FileReader();
    reader.onload = (event) => {
      setFileContent(event.target?.result as string);
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importBankAccountId || !fileContent.trim()) {
      setError('Please choose a bank account and file');
      return;
    }

    setImporting(true);
    setError(null);
    try {
      const res = await apiRequest<{ linesImported: number }>(
        '/bank-statements/import',
        {
          method: 'POST',
          body: JSON.stringify({
            bankAccountId: importBankAccountId,
            fileName: selectedFileName,
            fileFormat: importFileFormat,
            fileContent,
          }),
        }
      );
      setShowImportModal(false);
      setFileContent('');
      setSelectedFileName('');
      setBannerMessage(`Imported ${res.linesImported} transaction(s). Automatically running AI categorisation...`);
      await handleRunAiCategorisation();
    } catch (err: any) {
      setError(err?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  // Client filtering for tabs and search
  const filteredLines = lines.filter((l) => {
    if (activeTab === 'TO_CONFIRM') {
      if (l.status === 'MATCHED') return false;
    } else if (activeTab === 'CONFIRMED') {
      if (l.status !== 'MATCHED') return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchDesc = l.description.toLowerCase().includes(q);
      const matchPayee = l.payee?.toLowerCase().includes(q);
      const matchRef = l.reference?.toLowerCase().includes(q);
      if (!matchDesc && !matchPayee && !matchRef) return false;
    }
    return true;
  });

  const allCount = lines.length;
  const toConfirmCount = lines.filter((l) => l.status !== 'MATCHED').length;
  const confirmedCount = lines.filter((l) => l.status === 'MATCHED').length;
  const allFilteredIds = filteredLines.map((l) => l.id);

  return (
    <AppShell>
      <div className="bl-legacy">
      {/* Title & Top Toolbar */}
      <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
            Transactions
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
            Review, auto-categorise with AI, and confirm your bank activity into the General Ledger.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowAiModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              backgroundColor: '#FFFFFF',
              color: 'var(--text-main)',
              border: '1px solid var(--border-strong)',
              padding: '0.5rem 0.85rem',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <SlidersHorizontal size={14} color="#102654" />
            <span>AI Settings</span>
          </button>

          <button
            onClick={() => setShowDiffModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              backgroundColor: 'var(--bg-app)',
              color: 'var(--ink-2)',
              border: '1px solid var(--border-subtle)',
              padding: '0.5rem 0.85rem',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
            }}
          >
            <HelpCircle size={14} color="#5B6478" />
            <span>Guide</span>
          </button>

          <button
            onClick={handleRunAiCategorisation}
            disabled={aiRunning}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: 'var(--success)',
              backgroundImage: 'linear-gradient(135deg, var(--success) 0%, var(--success) 100%)',
              color: '#FFFFFF',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              cursor: aiRunning ? 'not-allowed' : 'pointer',
              fontWeight: 700,
              fontSize: '0.875rem',
              boxShadow: '0 2px 4px rgba(16, 185, 129, 0.25)',
            }}
          >
            <Zap size={15} fill="#FFFFFF" />
            <span>{aiRunning ? 'Predicting & Categorising...' : '⚡ Predict & Auto-Categorise (ML + LLM)'}</span>
          </button>
          {canImport && (
            <button
              onClick={() => setShowImportModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}
            >
              <span>↑</span> Import Statement
            </button>
          )}
        </div>
      </div>

      {/* Puzzle-style "Learn about transactions" banner */}
      {showLearnBanner && (
        <div
          style={{
            backgroundColor: 'var(--bg-app)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '0.5rem',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            position: 'relative',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ maxWidth: '800px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '1.2rem' }}>📖</span>
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                Automated AI Accounting & Categorisation
              </span>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--ink-2)', lineHeight: 1.5 }}>
              Blynt AI makes bookkeeping effortless in 3 key ways:
              <br />
              ✦ <strong>Automatically identifies vendors &amp; customers</strong> from transaction descriptions and merchants.
              <br />
              ✦ <strong>Automatically categorises</strong> statement lines into correct Chart of Accounts nominal codes.
              <br />
              ✦ <strong>One-click confirmation</strong>: click Confirm to generate and post balanced General Ledger journals instantly.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={handleRunAiCategorisation}
              disabled={aiRunning}
              style={{
                backgroundColor: 'var(--success)',
                color: '#FFFFFF',
                border: 'none',
                padding: '0.55rem 1.1rem',
                borderRadius: '0.375rem',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <span>⚡</span>
              <span>{aiRunning ? 'Identifying Vendors & Categories...' : 'Auto-Identify Vendors & Categories'}</span>
            </button>
            <button
              onClick={() => setShowLearnBanner(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '1.1rem',
              }}
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {bannerMessage && (
        <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--success-bg)', border: '1px solid var(--success-border)', color: 'var(--success-text)', borderRadius: '0.375rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
          {bannerMessage}
        </div>
      )}

      {error && (
        <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', borderRadius: '0.375rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {/* Puzzle.io Tabs */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
        <button
          onClick={() => setActiveTab('ALL')}
          style={{
            backgroundColor: activeTab === 'ALL' ? '#FFFFFF' : 'transparent',
            border: activeTab === 'ALL' ? '1px solid var(--border-strong)' : '1px solid transparent',
            borderRadius: '0.375rem',
            padding: '0.5rem 1rem',
            cursor: 'pointer',
            textAlign: 'left',
            boxShadow: activeTab === 'ALL' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>All</span>
            <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--bg-soft)', padding: '0.1rem 0.4rem', borderRadius: '9999px', fontWeight: 600, color: 'var(--ink-2)' }}>
              {allCount}
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
            Every transaction in range
          </div>
        </button>

        <button
          onClick={() => setActiveTab('TO_CONFIRM')}
          style={{
            backgroundColor: activeTab === 'TO_CONFIRM' ? '#FFFFFF' : 'transparent',
            border: activeTab === 'TO_CONFIRM' ? '1px solid var(--border-strong)' : '1px solid transparent',
            borderRadius: '0.375rem',
            padding: '0.5rem 1rem',
            cursor: 'pointer',
            textAlign: 'left',
            boxShadow: activeTab === 'TO_CONFIRM' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>To confirm</span>
            <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--warning-bg)', padding: '0.1rem 0.4rem', borderRadius: '9999px', fontWeight: 700, color: 'var(--warning-text)' }}>
              {toConfirmCount}
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
            Still awaiting confirmation
          </div>
        </button>

        <button
          onClick={() => setActiveTab('CONFIRMED')}
          style={{
            backgroundColor: activeTab === 'CONFIRMED' ? '#FFFFFF' : 'transparent',
            border: activeTab === 'CONFIRMED' ? '1px solid var(--border-strong)' : '1px solid transparent',
            borderRadius: '0.375rem',
            padding: '0.5rem 1rem',
            cursor: 'pointer',
            textAlign: 'left',
            boxShadow: activeTab === 'CONFIRMED' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>Confirmed</span>
            <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--success-bg)', padding: '0.1rem 0.4rem', borderRadius: '9999px', fontWeight: 700, color: 'var(--success-text)' }}>
              {confirmedCount}
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
            Already in your reports
          </div>
        </button>
      </div>

      {/* Filter and Bulk Action Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <select
            value={selectedAccountId}
            onChange={(e) => {
              setSelectedAccountId(e.target.value);
              setPage(1);
            }}
            style={{ padding: '0.45rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: '0.375rem', fontSize: '0.85rem', backgroundColor: '#FFFFFF', fontWeight: 600 }}
          >
            <option value="">All Bank Accounts</option>
            {bankAccounts.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.currency})
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Search by description or reference..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ padding: '0.45rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: '0.375rem', fontSize: '0.85rem', width: '280px' }}
          />
        </div>

        {/* Bulk Action Button */}
        {selectedLineIds.size > 0 && canManage && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              {selectedLineIds.size} selected
            </span>
            <button
              onClick={handleBatchConfirm}
              disabled={batchConfirming}
              style={{
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                border: 'none',
                padding: '0.45rem 0.9rem',
                borderRadius: '0.375rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: batchConfirming ? 'not-allowed' : 'pointer',
              }}
            >
              {batchConfirming ? 'Confirming...' : `Confirm Selected (${selectedLineIds.size})`}
            </button>
          </div>
        )}
      </div>

      {/* Puzzle.io Interactive Table */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-app)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--ink-2)', fontWeight: 600 }}>
              <th style={{ padding: '0.75rem 1rem', width: '40px' }}>
                <input
                  type="checkbox"
                  checked={allFilteredIds.length > 0 && selectedLineIds.size === allFilteredIds.length}
                  onChange={() => toggleSelectAll(allFilteredIds)}
                />
              </th>
              <th style={{ padding: '0.75rem 1rem', width: '110px' }}>Date</th>
              <th style={{ padding: '0.75rem 1rem', width: '200px' }}>Vendor / Customer</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right', width: '120px' }}>Amount</th>
              <th style={{ padding: '0.75rem 1rem' }}>Description</th>
              <th style={{ padding: '0.75rem 1rem', width: '240px' }}>Category</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'center', width: '110px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading transactions...
                </td>
              </tr>
            ) : filteredLines.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                    No transactions to show
                  </div>
                  <div style={{ fontSize: '0.85rem' }}>
                    {activeTab === 'TO_CONFIRM'
                      ? 'All transactions have been confirmed into your reports!'
                      : 'Import a statement or run AI auto-categorisation to see lines here.'}
                  </div>
                </td>
              </tr>
            ) : (
              filteredLines.map((line) => {
                const num = Number(line.amount);
                const isPositive = num > 0;
                const isConfirmed = line.status === 'MATCHED';
                const isSelected = selectedLineIds.has(line.id);

                return (
                  <tr
                    key={line.id}
                    style={{
                      borderBottom: '1px solid var(--bg-soft)',
                      backgroundColor: isSelected ? 'var(--info-bg)' : '#FFFFFF',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    {/* Checkbox */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectLine(line.id)}
                      />
                    </td>

                    {/* Date */}
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(line.transactionDate).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>

                    {/* Vendor / Customer Inline Selector */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {(() => {
                        const matchedContact =
                          contacts.find((c) => c.id === line.suggestedContactId) ||
                          contacts.find(
                            (c) =>
                              c.name &&
                              (line.description.toLowerCase().includes(c.name.toLowerCase().trim()) ||
                                (line.payee && line.payee.toLowerCase().includes(c.name.toLowerCase().trim()))),
                          );

                        const currentVal = line.suggestedContactId || (matchedContact ? matchedContact.id : '');

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <select
                              value={currentVal}
                              disabled={isConfirmed}
                              onChange={(e) => handleInlineUpdate(line.id, { contactId: e.target.value || null })}
                              style={{
                                width: '100%',
                                padding: '0.35rem 0.5rem',
                                border: currentVal ? '1px solid var(--success-border)' : '1px solid var(--border-strong)',
                                borderRadius: '0.35rem',
                                fontSize: '0.8rem',
                                backgroundColor: isConfirmed
                                  ? 'var(--bg-app)'
                                  : currentVal
                                  ? 'var(--success-bg)'
                                  : '#FFFFFF',
                                color: currentVal ? 'var(--success-text)' : 'var(--text-muted)',
                                fontWeight: currentVal ? 600 : 400,
                              }}
                            >
                              <option value="">No vendor assigned</option>
                              {contacts.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>

                            {currentVal && (
                              <span
                                style={{
                                  fontSize: '0.675rem',
                                  fontWeight: 600,
                                  color: 'var(--success-text)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                }}
                              >
                                <span>✨</span> AI Identified
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>

                    {/* Amount */}
                    <td
                      style={{
                        padding: '0.75rem 1rem',
                        textAlign: 'right',
                        fontWeight: 700,
                        color: isPositive ? 'var(--success-text)' : 'var(--text-main)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {isPositive ? '+' : ''}£{Math.abs(num).toFixed(2)}
                    </td>

                    {/* Description */}
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-main)' }}>
                      <div style={{ fontWeight: 500 }}>{line.description}</div>
                      {line.matchExplanation && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--primary)', marginTop: '0.15rem' }}>
                          {line.matchExplanation}
                        </div>
                      )}
                    </td>

                    {/* Category (Chart of Accounts Nominal Inline Selector) */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <select
                        value={line.suggestedAccountId || ''}
                        disabled={isConfirmed}
                        onChange={(e) => handleInlineUpdate(line.id, { accountId: e.target.value || null })}
                        title={
                          line.matchConfidence
                            ? `AI Suggested: ${Math.round(Number(line.matchConfidence) * 100)}% accuracy (${line.matchExplanation || 'Matched to chart of accounts'})`
                            : undefined
                        }
                        style={{
                          width: '100%',
                          padding: '0.35rem 0.5rem',
                          border: line.suggestedAccountId ? '1px solid var(--info-border)' : '1px solid var(--border-strong)',
                          borderRadius: '0.25rem',
                          fontSize: '0.8rem',
                          backgroundColor: isConfirmed ? 'var(--bg-app)' : line.suggestedAccountId ? 'var(--info-bg)' : '#FFFFFF',
                          color: line.suggestedAccountId ? 'var(--info-text)' : 'var(--text-muted)',
                          fontWeight: line.suggestedAccountId ? 600 : 400,
                        }}
                      >
                        <option value="">Choose category...</option>
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.code} - {acc.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Action (Confirm / Unconfirm) */}
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                      {isConfirmed ? (
                        <button
                          onClick={() => handleUnconfirmLine(line.id)}
                          disabled={confirmingId === line.id}
                          style={{
                            padding: '0.25rem 0.55rem',
                            backgroundColor: '#FFFFFF',
                            border: '1px solid var(--border-strong)',
                            borderRadius: '0.25rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                          }}
                        >
                          ↺ Unconfirm
                        </button>
                      ) : (
                        <button
                          onClick={() => handleConfirmLine(line.id)}
                          disabled={confirmingId === line.id || !line.suggestedAccountId}
                          style={{
                            padding: '0.25rem 0.65rem',
                            backgroundColor: line.suggestedAccountId ? 'var(--success)' : 'var(--border-subtle)',
                            color: line.suggestedAccountId ? '#FFFFFF' : 'var(--text-muted)',
                            border: 'none',
                            borderRadius: '0.25rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: line.suggestedAccountId ? 'pointer' : 'not-allowed',
                          }}
                        >
                          {confirmingId === line.id ? '...' : '✓ Confirm'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', backgroundColor: 'var(--bg-app)', borderTop: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>
              Showing Page {page} of {totalPages} ({totalLines} total transactions)
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{
                  padding: '0.35rem 0.75rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: '0.25rem',
                  backgroundColor: page <= 1 ? 'var(--bg-soft)' : '#FFFFFF',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  fontSize: '0.8rem',
                }}
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                style={{
                  padding: '0.35rem 0.75rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: '0.25rem',
                  backgroundColor: page >= totalPages ? 'var(--bg-soft)' : '#FFFFFF',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  fontSize: '0.8rem',
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Import Statement Modal */}
      {showImportModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '0.5rem',
              width: '100%',
              maxWidth: '520px',
              padding: '1.5rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                Import Bank Statement
              </h2>
              <button
                onClick={() => setShowImportModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleImportSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-2)', marginBottom: '0.25rem' }}>
                  Target Bank Account *
                </label>
                <select
                  required
                  value={importBankAccountId}
                  onChange={(e) => setImportBankAccountId(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: '0.375rem', fontSize: '0.875rem', backgroundColor: '#FFFFFF' }}
                >
                  <option value="">Select bank account...</option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.currency})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-2)', marginBottom: '0.25rem' }}>
                  Statement Format
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {(['CSV', 'OFX', 'QIF'] as const).map((fmt) => (
                    <label
                      key={fmt}
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        border: importFileFormat === fmt ? '2px solid var(--primary)' : '1px solid var(--border-strong)',
                        borderRadius: '0.375rem',
                        backgroundColor: importFileFormat === fmt ? 'var(--info-bg)' : '#FFFFFF',
                        cursor: 'pointer',
                        textAlign: 'center',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        color: importFileFormat === fmt ? 'var(--primary)' : 'var(--ink-2)',
                      }}
                    >
                      <input
                        type="radio"
                        name="fileFormat"
                        value={fmt}
                        checked={importFileFormat === fmt}
                        onChange={() => setImportFileFormat(fmt)}
                        style={{ display: 'none' }}
                      />
                      {fmt}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-2)', marginBottom: '0.25rem' }}>
                  Statement File (.csv, .ofx, .qif) *
                </label>
                <div
                  style={{
                    border: '2px dashed var(--border-strong)',
                    borderRadius: '0.375rem',
                    padding: '1.5rem',
                    textAlign: 'center',
                    backgroundColor: 'var(--bg-app)',
                    cursor: 'pointer',
                  }}
                  onClick={() => document.getElementById('file-upload-input')?.click()}
                >
                  <input
                    id="file-upload-input"
                    type="file"
                    accept=".csv,.ofx,.qif,.txt"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  <div style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>📄</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    {selectedFileName || 'Click to select statement file'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Supports standard bank CSV, Quicken OFX / QFX, and QIF formats.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--border-strong)',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--ink-2)',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={importing || !selectedFileName}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: 'var(--primary)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: importing || !selectedFileName ? 'not-allowed' : 'pointer',
                  }}
                >
                  {importing ? 'Importing...' : 'Upload & Auto-Categorise'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Preferences & Guide Modals */}
      <AiCustomizationModal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        orgId={activeOrg?.id || ''}
        currentTotalItems={lines.length}
        qualifyingItemsCount={lines.filter((l) => l.status !== 'MATCHED' && Number(l.matchConfidence || 0.9) >= aiPrefs.confidenceThreshold).length}
        nominalAccounts={accounts}
        onSavePreferences={(newPrefs) => {
          setAiPrefs(newPrefs);
          setBannerMessage(`Updated AI Bookkeeping preferences: ${newPrefs.mode} mode at ${Math.round(newPrefs.confidenceThreshold * 100)}% sensitivity.`);
        }}
      />

      <TransactionsVsReconciliationModal
        isOpen={showDiffModal}
        onClose={() => setShowDiffModal(false)}
        bankAccountId={selectedAccountId}
      />
      </div>
    </AppShell>
  );
}

export default function BankTransactionsPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="bl-legacy">
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading transactions...
          </div>
          </div>
        </AppShell>
      }
    >
      <BankTransactionsContent />
    </Suspense>
  );
}
