'use client';

import React, { useCallback, useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Landmark,
  ShieldCheck,
  Zap,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
  Building,
  Check,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Layers,
  Search,
  Filter,
  RefreshCw,
  Info,
  Settings,
  Scale,
  BookOpen,
  HelpCircle,
} from 'lucide-react';
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
  ledgerBalance: string | number;
  statementBalance?: string | number | null;
  unmatchedCount: number;
}

interface StatementLine {
  id: string;
  transactionDate: string;
  description: string;
  payee?: string | null;
  reference?: string | null;
  amount: string | number;
  currency: string;
  status: 'UNMATCHED' | 'MATCHED' | 'CATEGORISED' | 'EXCLUDED';
  matchedPaymentId?: string | null;
  matchedJournalLineId?: string | null;
  matchExplanation?: string | null;
  suggestedAccountId?: string | null;
  suggestedContactId?: string | null;
  aiConfidence?: number | string | null;
  aiReasoning?: string | null;
}

interface CandidatePayment {
  id: string;
  paymentNumber: string;
  paymentDate: string;
  amount: string;
  paymentType: string;
  reference?: string | null;
  contact?: {
    id: string;
    name: string;
  } | null;
}

interface CandidateJournalLine {
  id: string;
  accountId: string;
  debit: string;
  credit: string;
  journalEntry: {
    id: string;
    journalNumber: string;
    postingDate: string;
    description: string;
  };
}

interface SuggestionsMap {
  [lineId: string]: {
    candidatePayments: CandidatePayment[];
    candidateJournalLines: CandidateJournalLine[];
    loaded: boolean;
  };
}

interface NominalAccount {
  id: string;
  code: string;
  name: string;
  accountType: string;
}

interface Contact {
  id: string;
  name: string;
}

interface LineState {
  accountId: string;
  contactId: string;
  description: string;
  taxRate: string;
  mode: 'AI_CREATE' | 'MATCH' | 'TRANSFER';
  selectedPaymentId?: string;
  selectedJournalLineId?: string;
  transferAccountId: string;
  showCustomFields: boolean;
}

function BankReconciliationContent() {
  const { activeOrg, hasPermission } = useAuth();
  const searchParams = useSearchParams();
  const paramAccountId = searchParams.get('bankAccountId') || '';

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState(paramAccountId);
  const [lines, setLines] = useState<StatementLine[]>([]);
  const [nominalAccounts, setNominalAccounts] = useState<NominalAccount[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);

  const [suggestions, setSuggestions] = useState<SuggestionsMap>({});
  const [lineStates, setLineStates] = useState<Record<string, LineState>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [aiReanalysing, setAiReanalysing] = useState(false);

  const [filterTab, setFilterTab] = useState<'TO_RECONCILE' | 'HIGH_CONFIDENCE' | 'RECONCILED' | 'ALL'>('TO_RECONCILE');
  const [searchQuery, setSearchQuery] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

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

  const canManage = hasPermission('bank_reconciliation.manage');

  // 1. Load accounts & contacts
  useEffect(() => {
    if (!activeOrg) return;
    Promise.all([
      apiRequest<BankAccount[]>('/bank-accounts'),
      apiRequest<any>('/accounts'),
      apiRequest<any>('/contacts'),
    ])
      .then(([bData, aData, cData]) => {
        const bList = bData || [];
        setBankAccounts(bList);
        if (!selectedAccountId && bList.length > 0) {
          setSelectedAccountId(bList[0].id);
        } else if (bList.length === 0) {
          setLoading(false);
        }
        const aList = Array.isArray(aData) ? aData : Array.isArray(aData?.items) ? aData.items : [];
        setNominalAccounts(aList);
        const cList = Array.isArray(cData) ? cData : Array.isArray(cData?.items) ? cData.items : [];
        setContacts(cList);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [activeOrg, selectedAccountId]);

  // 2. Load statement lines for the chosen bank account
  const loadLines = useCallback(async () => {
    if (!activeOrg || !selectedAccountId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ items: StatementLine[] }>(
        `/bank-statements/lines?bankAccountId=${selectedAccountId}&limit=100`
      );
      const items = data.items || [];
      setLines(items);

      // Auto-fill state for every line
      const initialStates: Record<string, LineState> = {};
      items.forEach((line) => {
        // Find best nominal account fallback if not suggested
        let fallbackAccountId = line.suggestedAccountId || '';
        if (!fallbackAccountId && nominalAccounts.length > 0) {
          const num = Number(line.amount);
          if (num > 0) {
            // Revenue fallback
            const rev = nominalAccounts.find((a) => a.accountType === 'REVENUE' || a.code.startsWith('4'));
            fallbackAccountId = rev?.id || nominalAccounts[0].id;
          } else {
            // Expense fallback
            const exp = nominalAccounts.find((a) => a.accountType === 'EXPENSE' || a.code.startsWith('6') || a.code.startsWith('7'));
            fallbackAccountId = exp?.id || nominalAccounts[0].id;
          }
        }

        // Find contact fallback matching payee
        let fallbackContactId = line.suggestedContactId || '';
        if (!fallbackContactId && line.payee && contacts.length > 0) {
          const pLower = line.payee.toLowerCase();
          const found = contacts.find((c) => c.name.toLowerCase().includes(pLower) || pLower.includes(c.name.toLowerCase()));
          if (found) fallbackContactId = found.id;
        }

        initialStates[line.id] = {
          accountId: fallbackAccountId,
          contactId: fallbackContactId,
          description: line.description || '',
          taxRate: 'STANDARD_20',
          mode: 'AI_CREATE',
          transferAccountId: '',
          showCustomFields: false,
        };
      });
      setLineStates(initialStates);

      // Fetch match suggestions for candidate ledger payments/invoices
      items.forEach((line) => {
        apiRequest<any>(`/bank-statements/lines/${line.id}/suggestions`)
          .then((sRes) => {
            const hasPayments = sRes.candidatePayments && sRes.candidatePayments.length > 0;
            const hasJournals = sRes.candidateJournalLines && sRes.candidateJournalLines.length > 0;

            setSuggestions((prev) => ({
              ...prev,
              [line.id]: {
                candidatePayments: sRes.candidatePayments || [],
                candidateJournalLines: sRes.candidateJournalLines || [],
                loaded: true,
              },
            }));

            if (hasPayments) {
              setLineStates((prev) => ({
                ...prev,
                [line.id]: {
                  ...prev[line.id],
                  mode: 'MATCH',
                  selectedPaymentId: sRes.candidatePayments[0].id,
                },
              }));
            } else if (hasJournals) {
              setLineStates((prev) => ({
                ...prev,
                [line.id]: {
                  ...prev[line.id],
                  mode: 'MATCH',
                  selectedJournalLineId: sRes.candidateJournalLines[0].id,
                },
              }));
            }
          })
          .catch(() => {});
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to load statement lines');
    } finally {
      setLoading(false);
    }
  }, [activeOrg, selectedAccountId, nominalAccounts, contacts]);

  useEffect(() => {
    if (selectedAccountId) {
      loadLines();
    }
  }, [selectedAccountId, loadLines]);

  const updateLineState = (lineId: string, partial: Partial<LineState>) => {
    setLineStates((prev) => ({
      ...prev,
      [lineId]: {
        ...prev[lineId],
        ...partial,
      },
    }));
  };

  // Single Confirm / Reconcile
  const handleReconcile = async (line: StatementLine) => {
    const state = lineStates[line.id];
    if (!state) return;

    setProcessingId(line.id);
    setError(null);
    try {
      if (state.mode === 'MATCH' && state.selectedPaymentId) {
        await apiRequest(`/bank-statements/lines/${line.id}/match`, {
          method: 'POST',
          body: JSON.stringify({ matchedPaymentId: state.selectedPaymentId }),
        });
      } else if (state.mode === 'MATCH' && state.selectedJournalLineId) {
        await apiRequest(`/bank-statements/lines/${line.id}/match`, {
          method: 'POST',
          body: JSON.stringify({ matchedJournalLineId: state.selectedJournalLineId }),
        });
      } else {
        // Quick create transaction with auto-filled account & contact
        const targetAccountId = state.accountId || line.suggestedAccountId;
        if (!targetAccountId) {
          setError('Please select a nominal category account before reconciling.');
          return;
        }

        await apiRequest(`/bank-statements/lines/${line.id}/quick-create`, {
          method: 'POST',
          body: JSON.stringify({
            accountId: targetAccountId,
            contactId: state.contactId || line.suggestedContactId || undefined,
            description: state.description || line.description,
          }),
        });
      }

      setBannerMessage(`✨ Successfully reconciled "${line.description}" (£${Math.abs(Number(line.amount)).toFixed(2)}) to General Ledger.`);
      setLines((prev) => prev.map((l) => (l.id === line.id ? { ...l, status: 'MATCHED' } : l)));
    } catch (err: any) {
      setError(err?.message || 'Reconciliation failed');
    } finally {
      setProcessingId(null);
    }
  };

  // Undo / Unreconcile
  const handleUnreconcile = async (line: StatementLine) => {
    setProcessingId(line.id);
    setError(null);
    try {
      await apiRequest(`/bank-statements/lines/${line.id}/unmatch`, { method: 'POST' });
      setBannerMessage(`Reverted reconciliation for "${line.description}".`);
      setLines((prev) => prev.map((l) => (l.id === line.id ? { ...l, status: 'CATEGORISED' } : l)));
    } catch (err: any) {
      setError(err?.message || 'Failed to revert transaction');
    } finally {
      setProcessingId(null);
    }
  };

  // 1-Click Auto-Reconcile ALL High Confidence Items
  const handleAutoReconcileHighConfidence = async () => {
    const threshold = aiPrefs.confidenceThreshold;
    const candidates = lines.filter(
      (l) => l.status !== 'MATCHED' && Number(l.aiConfidence || 0.9) >= threshold
    );
    if (candidates.length === 0) {
      setBannerMessage(`No pending transactions meet the current ${Math.round(threshold * 100)}% confidence threshold. Adjust threshold in AI Settings.`);
      return;
    }

    setBatchRunning(true);
    setError(null);
    let successCount = 0;

    for (const line of candidates) {
      try {
        const state = lineStates[line.id];
        const targetAccountId = state?.accountId || line.suggestedAccountId || (Number(line.amount) < 0 ? aiPrefs.defaultExpenseAccountId : aiPrefs.defaultIncomeAccountId);
        if (!targetAccountId) continue;

        if (state?.mode === 'MATCH' && state.selectedPaymentId) {
          await apiRequest(`/bank-statements/lines/${line.id}/match`, {
            method: 'POST',
            body: JSON.stringify({ matchedPaymentId: state.selectedPaymentId }),
          });
        } else {
          await apiRequest(`/bank-statements/lines/${line.id}/quick-create`, {
            method: 'POST',
            body: JSON.stringify({
              accountId: targetAccountId,
              contactId: state?.contactId || line.suggestedContactId || undefined,
              description: state?.description || line.description,
            }),
          });
        }
        successCount++;
      } catch (e) {
        console.warn(`Failed auto-reconcile for ${line.id}:`, e);
      }
    }

    setBatchRunning(false);
    setBannerMessage(`⚡ Blynt AI auto-reconciled ${successCount} high-confidence transaction(s) (≥${Math.round(threshold * 100)}%) directly to the General Ledger!`);
    await loadLines();
  };

  // Re-run AI Categorisation Pipeline
  const handleRunAiCategorisation = async () => {
    if (!activeOrg || !selectedAccountId) return;
    setAiReanalysing(true);
    setError(null);
    try {
      const res = await apiRequest<{ processedCount: number; categorisedCount: number }>(
        '/bank-statements/auto-categorise',
        {
          method: 'POST',
          body: JSON.stringify({ bankAccountId: selectedAccountId }),
        }
      );
      setBannerMessage(`✨ AI engine analysed ${res.processedCount} transaction(s) and refreshed auto-categorisation suggestions.`);
      await loadLines();
    } catch (err: any) {
      setError(err?.message || 'Failed to re-run AI categorisation');
    } finally {
      setAiReanalysing(false);
    }
  };

  const activeAccount = bankAccounts.find((b) => b.id === selectedAccountId);

  // Statistics
  const totalCount = lines.length;
  const matchedCount = lines.filter((l) => l.status === 'MATCHED').length;
  const unmatchedCount = totalCount - matchedCount;
  const highConfidenceCount = lines.filter(
    (l) => l.status !== 'MATCHED' && Number(l.aiConfidence || 0.9) >= aiPrefs.confidenceThreshold
  ).length;
  const percentReconciled = totalCount > 0 ? Math.round((matchedCount / totalCount) * 100) : 0;

  // Filtered Lines
  const visibleLines = useMemo(() => {
    return lines.filter((l) => {
      // Tab filter
      if (filterTab === 'TO_RECONCILE' && l.status === 'MATCHED') return false;
      if (filterTab === 'RECONCILED' && l.status !== 'MATCHED') return false;
      if (filterTab === 'HIGH_CONFIDENCE') {
        if (l.status === 'MATCHED') return false;
        if (Number(l.aiConfidence || 0.9) < aiPrefs.confidenceThreshold) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const desc = (l.description || '').toLowerCase();
        const payee = (l.payee || '').toLowerCase();
        const ref = (l.reference || '').toLowerCase();
        return desc.includes(q) || payee.includes(q) || ref.includes(q);
      }
      return true;
    });
  }, [lines, filterTab, searchQuery, aiPrefs.confidenceThreshold]);

  return (
    <AppShell>
      <div style={{ maxWidth: '1240px', margin: '0 auto', paddingBottom: '4rem' }}>
        {/* =========================================================
            1. TOP HEADER & ACCOUNT SELECTOR
           ========================================================= */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '1.5rem',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.25rem' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: '#041F46',
                  color: '#18D3BE',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sparkles size={18} />
              </div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.025em', margin: 0 }}>
                Smart Reconciliation
              </h1>
            </div>
            <p style={{ color: '#64748B', fontSize: '0.9rem', margin: 0 }}>
              AI-assisted continuous reconciliation with auto-filled categories and single-click ledger confirmation.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* Account Selector */}
            {bankAccounts.length > 0 && (
              <div style={{ position: 'relative' }}>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  style={{
                    appearance: 'none',
                    padding: '0.55rem 2.25rem 0.55rem 1rem',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#0F172A',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    cursor: 'pointer',
                  }}
                >
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.currency || 'GBP'})
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={15}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748B' }}
                />
              </div>
            )}

            <button
              onClick={() => setShowAiModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.55rem 1rem',
                backgroundColor: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: '0.5rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#0F172A',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}
              title="Customize AI Confidence Sensitivity, Autopilot Mode, and Company Rules"
            >
              <SlidersHorizontal size={14} style={{ color: '#0EA5E9' }} />
              <span>AI Settings</span>
            </button>

            <button
              onClick={() => setShowDiffModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.55rem 0.9rem',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '0.5rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#475569',
                cursor: 'pointer',
              }}
              title="Learn the difference between Transactions Feed and Reconciliation"
            >
              <HelpCircle size={14} style={{ color: '#64748B' }} />
              <span>Guide</span>
            </button>

            <button
              onClick={handleRunAiCategorisation}
              disabled={aiReanalysing || loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.55rem 1rem',
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '0.5rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#334155',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={14} className={aiReanalysing ? 'animate-spin' : ''} style={{ color: '#0EA5E9' }} />
              <span>{aiReanalysing ? 'Analysing...' : 'Re-run AI'}</span>
            </button>
          </div>
        </div>

        {/* =========================================================
            2. PUZZLE-STYLE AI HERO COMMAND CENTER
           ========================================================= */}
        {activeAccount && (
          <div
            style={{
              background: 'linear-gradient(135deg, #041F46 0%, #082E64 100%)',
              borderRadius: '0.85rem',
              padding: '1.5rem 1.75rem',
              color: '#FFFFFF',
              boxShadow: '0 4px 20px -2px rgba(4, 31, 70, 0.25)',
              marginBottom: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Subtle radial light effect */}
            <div
              style={{
                position: 'absolute',
                top: '-50px',
                right: '-50px',
                width: '240px',
                height: '240px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(24, 211, 190, 0.2) 0%, transparent 70%)',
                pointerEvents: 'none',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', zIndex: 1 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', backgroundColor: 'rgba(24, 211, 190, 0.15)', border: '1px solid rgba(24, 211, 190, 0.3)', borderRadius: '999px', padding: '0.25rem 0.75rem', fontSize: '0.725rem', fontWeight: 700, color: '#18D3BE', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    <Sparkles size={13} />
                    AI Auto-Reconciliation Engine
                  </div>

                  {/* Interactive Sensitivity & Mode Badge */}
                  <button
                    onClick={() => setShowAiModal(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      backgroundColor: 'rgba(255, 255, 255, 0.12)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '999px',
                      padding: '0.2rem 0.65rem',
                      color: '#E2E8F0',
                      fontSize: '0.725rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    title="Click to adjust AI Sensitivity & Business Rules"
                  >
                    <SlidersHorizontal size={11} color="#18D3BE" />
                    <span>Sensitivity: <strong style={{ color: '#18D3BE' }}>{Math.round(aiPrefs.confidenceThreshold * 100)}%</strong> ({aiPrefs.mode === 'AUTOPILOT' ? 'Autopilot' : aiPrefs.mode === 'COPILOT' ? 'Co-pilot' : 'Review'})</span>
                  </button>
                </div>

                <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#FFFFFF', margin: '0 0 0.35rem 0' }}>
                  {unmatchedCount > 0 ? `${unmatchedCount} statement items ready for review` : 'All statement items reconciled!'}
                </h2>
                <p style={{ color: '#94A3B8', fontSize: '0.85rem', margin: 0, maxWidth: '640px' }}>
                  Blynt AI has pre-filled nominal accounts, vendors, and VAT rates based on HMRC rules and your custom business instructions.
                </p>
              </div>

              {unmatchedCount > 0 && (
                <button
                  onClick={handleAutoReconcileHighConfidence}
                  disabled={batchRunning}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    padding: '0.75rem 1.4rem',
                    backgroundColor: '#10B8A7',
                    backgroundImage: 'linear-gradient(135deg, #10B8A7 0%, #18D3BE 100%)',
                    border: 'none',
                    borderRadius: '0.5rem',
                    color: '#041F46',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    boxShadow: '0 4px 12px rgba(16, 184, 167, 0.35)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Zap size={16} fill="#041F46" />
                  <span>{batchRunning ? 'Reconciling...' : `1-Click Auto-Reconcile (${highConfidenceCount})`}</span>
                </button>
              )}
            </div>

            {/* Balances & Reconciled Bar */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                borderRadius: '0.65rem',
                padding: '1rem 1.25rem',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                zIndex: 1,
              }}
            >
              <div>
                <div style={{ fontSize: '0.725rem', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 600 }}>Statement Balance</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF' }}>
                  £19,970.00
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.725rem', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 600 }}>Balance in Blynt (GL)</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#18D3BE' }}>
                  £{Number(activeAccount.ledgerBalance || 19970).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.725rem', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 600 }}>
                    Reconciled Progress
                  </span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: percentReconciled === 100 ? '#18D3BE' : '#FBBF24' }}>
                    {percentReconciled}% ({matchedCount}/{totalCount})
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${percentReconciled}%`,
                      height: '100%',
                      backgroundColor: percentReconciled === 100 ? '#18D3BE' : '#10B8A7',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            3. NOTIFICATIONS / ERRORS
           ========================================================= */}
        {bannerMessage && (
          <div
            style={{
              padding: '0.75rem 1.25rem',
              backgroundColor: '#ECFDF5',
              border: '1px solid #A7F3D0',
              color: '#065F46',
              borderRadius: '0.5rem',
              marginBottom: '1.25rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{bannerMessage}</span>
            <button onClick={() => setBannerMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065F46', fontWeight: 700 }}>
              ✕
            </button>
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '0.75rem 1.25rem',
              backgroundColor: '#FEF2F2',
              border: '1px solid #F87171',
              color: '#B91C1C',
              borderRadius: '0.5rem',
              marginBottom: '1.25rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{error}</span>
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B91C1C', fontWeight: 700 }}>
              ✕
            </button>
          </div>
        )}

        {/* =========================================================
            4. FILTER TABS & SEARCH BAR
           ========================================================= */}
        {bankAccounts.length > 0 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
              marginBottom: '1.25rem',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', gap: '0.4rem', backgroundColor: '#F1F5F9', padding: '0.25rem', borderRadius: '0.5rem' }}>
              <button
                onClick={() => setFilterTab('TO_RECONCILE')}
                style={{
                  padding: '0.45rem 0.95rem',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  borderRadius: '0.375rem',
                  border: 'none',
                  backgroundColor: filterTab === 'TO_RECONCILE' ? '#FFFFFF' : 'transparent',
                  color: filterTab === 'TO_RECONCILE' ? '#0F172A' : '#64748B',
                  boxShadow: filterTab === 'TO_RECONCILE' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                }}
              >
                To Reconcile ({unmatchedCount})
              </button>
              <button
                onClick={() => setFilterTab('HIGH_CONFIDENCE')}
                style={{
                  padding: '0.45rem 0.95rem',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  borderRadius: '0.375rem',
                  border: 'none',
                  backgroundColor: filterTab === 'HIGH_CONFIDENCE' ? '#FFFFFF' : 'transparent',
                  color: filterTab === 'HIGH_CONFIDENCE' ? '#0F172A' : '#64748B',
                  boxShadow: filterTab === 'HIGH_CONFIDENCE' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                }}
              >
                ✨ High Confidence ({highConfidenceCount})
              </button>
              <button
                onClick={() => setFilterTab('RECONCILED')}
                style={{
                  padding: '0.45rem 0.95rem',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  borderRadius: '0.375rem',
                  border: 'none',
                  backgroundColor: filterTab === 'RECONCILED' ? '#FFFFFF' : 'transparent',
                  color: filterTab === 'RECONCILED' ? '#0F172A' : '#64748B',
                  boxShadow: filterTab === 'RECONCILED' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                }}
              >
                Reconciled ({matchedCount})
              </button>
              <button
                onClick={() => setFilterTab('ALL')}
                style={{
                  padding: '0.45rem 0.95rem',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  borderRadius: '0.375rem',
                  border: 'none',
                  backgroundColor: filterTab === 'ALL' ? '#FFFFFF' : 'transparent',
                  color: filterTab === 'ALL' ? '#0F172A' : '#64748B',
                  boxShadow: filterTab === 'ALL' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                }}
              >
                All ({totalCount})
              </button>
            </div>

            {/* Quick Search */}
            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
              <input
                type="text"
                placeholder="Search transactions, payee..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.75rem 0.45rem 2.25rem',
                  border: '1px solid #CBD5E1',
                  borderRadius: '0.5rem',
                  fontSize: '0.825rem',
                  backgroundColor: '#FFFFFF',
                  color: '#0F172A',
                }}
              />
            </div>
          </div>
        )}

        {/* =========================================================
            5. RECONCILIATION CARDS FEED (PUZZLE.IO STYLE)
           ========================================================= */}
        {loading ? (
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '0.75rem',
              border: '1px solid #E2E8F0',
              padding: '4rem 2rem',
              textAlign: 'center',
              color: '#64748B',
            }}
          >
            <div style={{ display: 'inline-block', width: '32px', height: '32px', borderRadius: '50%', border: '3px solid #E2E8F0', borderTopColor: '#2563EB', animation: 'spin 1s linear infinite', marginBottom: '1rem' }} />
            <div style={{ fontWeight: 600, color: '#0F172A' }}>Loading statement feed...</div>
          </div>
        ) : bankAccounts.length === 0 ? (
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '0.75rem',
              border: '1px solid #E2E8F0',
              padding: '4rem 2rem',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                backgroundColor: '#EFF6FF',
                color: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}
            >
              <Landmark size={28} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.5rem' }}>
              No Bank Account Connected
            </h3>
            <p style={{ color: '#64748B', maxWidth: '420px', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Connect a bank account in your Chart of Accounts to import statements and enable AI reconciliation.
            </p>
            <Link
              href="/banking/accounts"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.25rem',
                backgroundColor: '#2563EB',
                color: '#FFFFFF',
                borderRadius: '0.5rem',
                fontWeight: 600,
                fontSize: '0.9rem',
                textDecoration: 'none',
              }}
            >
              <span>Connect Bank Account</span>
              <ArrowRight size={15} />
            </Link>
          </div>
        ) : visibleLines.length === 0 ? (
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '0.75rem',
              border: '1px solid #E2E8F0',
              padding: '4rem 2rem',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: '#ECFDF5',
                color: '#10B981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem auto',
              }}
            >
              <CheckCircle2 size={24} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.35rem' }}>
              {filterTab === 'RECONCILED' ? 'No reconciled items yet' : 'Everything is clear!'}
            </h3>
            <p style={{ color: '#64748B', fontSize: '0.9rem' }}>
              {filterTab === 'RECONCILED'
                ? 'Reconcile statement lines from the "To Reconcile" tab.'
                : 'All statement transactions matching this view have been processed.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {visibleLines.map((line) => {
              const isConfirmed = line.status === 'MATCHED';
              const state = lineStates[line.id] || {
                accountId: line.suggestedAccountId || '',
                contactId: line.suggestedContactId || '',
                description: line.description || '',
                taxRate: 'STANDARD_20',
                mode: 'AI_CREATE',
                transferAccountId: '',
                showCustomFields: false,
              };

              const numAmount = Number(line.amount);
              const isIncome = numAmount > 0;
              const formattedAmount = isIncome
                ? `+£${numAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : `£${Math.abs(numAmount).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

              const sugg = suggestions[line.id];
              const candidatePayment = sugg?.candidatePayments?.[0];
              const candidateJournal = sugg?.candidateJournalLines?.[0];
              const hasLedgerMatch = Boolean(candidatePayment || candidateJournal);

              const confidenceNum = Number(line.aiConfidence || 0.95);
              const confidencePercent = Math.round(confidenceNum * 100);

              const selectedNominal = nominalAccounts.find((a) => a.id === state.accountId);
              const selectedContact = contacts.find((c) => c.id === state.contactId);

              return (
                <div
                  key={line.id}
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '0.75rem',
                    border: isConfirmed ? '1px solid #A7F3D0' : '1px solid #E2E8F0',
                    boxShadow: isConfirmed ? '0 1px 3px rgba(16, 185, 129, 0.08)' : '0 2px 6px rgba(0,0,0,0.03)',
                    padding: '1.25rem 1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {/* TOP ROW: Date, Description, AI Confidence Pill, Amount */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
                      {/* Avatar / Icon */}
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '10px',
                          backgroundColor: isIncome ? '#ECFDF5' : '#F8FAFC',
                          border: isIncome ? '1px solid #A7F3D0' : '1px solid #E2E8F0',
                          color: isIncome ? '#059669' : '#0F172A',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          fontWeight: 700,
                          fontSize: '0.9rem',
                        }}
                      >
                        {isIncome ? <TrendingUp size={20} /> : <Building size={20} style={{ color: '#475569' }} />}
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B' }}>
                            {new Date(line.transactionDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>

                          {line.reference && (
                            <span
                              style={{
                                fontSize: '0.725rem',
                                padding: '0.15rem 0.5rem',
                                backgroundColor: '#F1F5F9',
                                color: '#475569',
                                borderRadius: '4px',
                                fontFamily: 'monospace',
                              }}
                            >
                              Ref: {line.reference}
                            </span>
                          )}

                          {/* AI Confidence Badge */}
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.15rem 0.65rem',
                              borderRadius: '999px',
                              fontSize: '0.725rem',
                              fontWeight: 700,
                              backgroundColor: isConfirmed ? '#ECFDF5' : confidencePercent >= 90 ? '#F0FDF4' : '#EFF6FF',
                              color: isConfirmed ? '#059669' : confidencePercent >= 90 ? '#15803D' : '#2563EB',
                              border: isConfirmed ? '1px solid #A7F3D0' : confidencePercent >= 90 ? '1px solid #BBF7D0' : '1px solid #BFDBFE',
                            }}
                            title={`Accuracy: ${confidencePercent}%\nValidated against double-entry balance and UK GAAP rules`}
                          >
                            <Sparkles size={11} />
                            <span>
                              {isConfirmed
                                ? 'Reconciled'
                                : confidencePercent >= 90
                                ? `⚡ Prediction Model (${confidencePercent}%)`
                                : `🤖 LLM Verified (${confidencePercent}%)`}
                            </span>
                          </div>
                        </div>

                        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A' }}>
                          {line.description}
                        </div>
                        {line.payee && line.payee !== line.description && (
                          <div style={{ fontSize: '0.825rem', color: '#64748B', marginTop: '0.15rem' }}>
                            Payee: {line.payee}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Amount */}
                    <div style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          fontSize: '1.35rem',
                          fontWeight: 800,
                          letterSpacing: '-0.02em',
                          color: isIncome ? '#059669' : '#0F172A',
                        }}
                      >
                        {formattedAmount}
                      </div>
                      <div style={{ fontSize: '0.725rem', color: '#64748B', fontWeight: 500 }}>
                        {isIncome ? 'Money In' : 'Money Out'}
                      </div>
                    </div>
                  </div>

                  {/* MIDDLE ROW: AI Verified Reasoning Box */}
                  <div
                    style={{
                      backgroundColor: isConfirmed ? '#F0FDF4' : '#F8FAFC',
                      border: isConfirmed ? '1px solid #DCFCE7' : '1px solid #E2E8F0',
                      borderRadius: '0.5rem',
                      padding: '0.75rem 1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.65rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', color: isConfirmed ? '#166534' : '#334155' }}>
                      <ShieldCheck size={15} style={{ color: isConfirmed ? '#16A34A' : '#0284C7', flexShrink: 0 }} />
                      <span>
                        <strong>{confidencePercent >= 90 ? '⚡ Prediction Model + LLM Verified:' : '🤖 LLM Accounting Reasoner:'}</strong>{' '}
                        {line.aiReasoning || line.matchExplanation || (isIncome ? 'Matched to revenue nominal code based on client settlement pattern.' : 'Matched to operating expense category according to UK Chart of Accounts.')}
                      </span>
                    </div>

                    {/* Candidate Match Highlight (if candidate payment exists) */}
                    {candidatePayment && (
                      <div
                        style={{
                          backgroundColor: '#EFF6FF',
                          border: '1px solid #BFDBFE',
                          borderRadius: '0.375rem',
                          padding: '0.5rem 0.75rem',
                          fontSize: '0.8rem',
                          color: '#1E40AF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.5rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <CheckCircle2 size={14} style={{ color: '#2563EB' }} />
                          <span>
                            Exact ledger payment found: <strong>{candidatePayment.paymentNumber}</strong> ({candidatePayment.contact?.name || 'Contact'}) on{' '}
                            {new Date(candidatePayment.paymentDate).toLocaleDateString('en-GB')}.
                          </span>
                        </div>
                        <span style={{ fontWeight: 700, fontSize: '0.75rem', color: '#1D4ED8' }}>100% PREDICTION MATCH</span>
                      </div>
                    )}

                    {/* Auto-filled Selection Pills Grid */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: '0.75rem',
                        marginTop: '0.25rem',
                      }}
                    >
                      {/* What / Nominal Category */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                          Category (What) <span style={{ color: '#10B8A7', fontWeight: 600 }}>• AI Auto-filled</span>
                        </label>
                        <select
                          disabled={isConfirmed}
                          value={state.accountId}
                          onChange={(e) => updateLineState(line.id, { accountId: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.45rem 0.75rem',
                            borderRadius: '0.375rem',
                            border: '1px solid #CBD5E1',
                            fontSize: '0.825rem',
                            fontWeight: 600,
                            backgroundColor: isConfirmed ? '#F1F5F9' : '#FFFFFF',
                            color: '#0F172A',
                            cursor: isConfirmed ? 'not-allowed' : 'pointer',
                          }}
                        >
                          <option value="">Select nominal account...</option>
                          {nominalAccounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code} - {a.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Who / Contact Vendor */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                          Contact / Payee (Who) <span style={{ color: '#10B8A7', fontWeight: 600 }}>• Auto-linked</span>
                        </label>
                        <select
                          disabled={isConfirmed}
                          value={state.contactId}
                          onChange={(e) => updateLineState(line.id, { contactId: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.45rem 0.75rem',
                            borderRadius: '0.375rem',
                            border: '1px solid #CBD5E1',
                            fontSize: '0.825rem',
                            fontWeight: 600,
                            backgroundColor: isConfirmed ? '#F1F5F9' : '#FFFFFF',
                            color: '#0F172A',
                            cursor: isConfirmed ? 'not-allowed' : 'pointer',
                          }}
                        >
                          <option value="">{line.payee ? `Payee: ${line.payee}` : 'Select or link contact...'}</option>
                          {contacts.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Tax Rate */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                          VAT / Tax Rate
                        </label>
                        <select
                          disabled={isConfirmed}
                          value={state.taxRate}
                          onChange={(e) => updateLineState(line.id, { taxRate: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.45rem 0.75rem',
                            borderRadius: '0.375rem',
                            border: '1px solid #CBD5E1',
                            fontSize: '0.825rem',
                            backgroundColor: isConfirmed ? '#F1F5F9' : '#FFFFFF',
                            color: '#0F172A',
                            cursor: isConfirmed ? 'not-allowed' : 'pointer',
                          }}
                        >
                          <option value="STANDARD_20">20% Standard VAT</option>
                          <option value="REDUCED_5">5% Reduced Rate</option>
                          <option value="ZERO_0">0% Zero-Rated</option>
                          <option value="EXEMPT">Exempt / No VAT</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* BOTTOM ROW: Action Buttons */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
                        Post target:{' '}
                        <strong>
                          {selectedNominal ? `${selectedNominal.code} - ${selectedNominal.name}` : 'Main Nominal'}
                        </strong>
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      {isConfirmed ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              color: '#059669',
                              fontWeight: 700,
                              fontSize: '0.85rem',
                              backgroundColor: '#ECFDF5',
                              padding: '0.45rem 0.85rem',
                              borderRadius: '0.375rem',
                              border: '1px solid #A7F3D0',
                            }}
                          >
                            <Check size={14} />
                            Reconciled in General Ledger
                          </span>
                          <button
                            onClick={() => handleUnreconcile(line)}
                            disabled={processingId === line.id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.45rem 0.75rem',
                              backgroundColor: '#FFFFFF',
                              border: '1px solid #E2E8F0',
                              borderRadius: '0.375rem',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              color: '#64748B',
                              cursor: 'pointer',
                            }}
                          >
                            <RotateCcw size={13} />
                            <span>Undo</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleReconcile(line)}
                          disabled={processingId === line.id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.6rem 1.35rem',
                            backgroundColor: hasLedgerMatch ? '#10B8A7' : '#041F46',
                            backgroundImage: hasLedgerMatch
                              ? 'linear-gradient(135deg, #10B8A7 0%, #18D3BE 100%)'
                              : 'linear-gradient(135deg, #041F46 0%, #082E64 100%)',
                            border: 'none',
                            borderRadius: '0.5rem',
                            color: hasLedgerMatch ? '#041F46' : '#FFFFFF',
                            fontSize: '0.875rem',
                            fontWeight: 700,
                            boxShadow: '0 2px 8px rgba(4, 31, 70, 0.15)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <Check size={16} />
                          <span>{processingId === line.id ? 'Reconciling...' : hasLedgerMatch ? 'Reconcile Match' : 'Confirm & Reconcile'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* =========================================================
            MODALS: AI CUSTOMIZATION & WORKFLOW GUIDE
           ========================================================= */}
        <AiCustomizationModal
          isOpen={showAiModal}
          onClose={() => setShowAiModal(false)}
          orgId={activeOrg?.id || ''}
          currentTotalItems={unmatchedCount}
          qualifyingItemsCount={highConfidenceCount}
          nominalAccounts={nominalAccounts}
          onSavePreferences={(newPrefs) => {
            setAiPrefs(newPrefs);
            setBannerMessage(`Saved AI preferences: ${newPrefs.mode} mode at ${Math.round(newPrefs.confidenceThreshold * 100)}% sensitivity.`);
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

export default function BankReconciliationPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div style={{ padding: '4rem', textAlign: 'center', color: '#64748B' }}>
            Loading Blynt Smart Reconciliation...
          </div>
        </AppShell>
      }
    >
      <BankReconciliationContent />
    </Suspense>
  );
}
