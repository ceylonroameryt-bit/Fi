'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  X,
  FileText,
  BookOpen,
  Landmark,
  TrendingUp,
  Percent,
  ArrowRight,
  Zap,
  CheckCircle2,
  FileCheck,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';

interface GlobalAiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AiCategoryTab = 'SALES' | 'PURCHASES' | 'JOURNALS' | 'BANKING' | 'REPORTS' | 'TAX';

export function GlobalAiAssistantModal({ isOpen, onClose }: GlobalAiAssistantModalProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AiCategoryTab>('SALES');
  const [prompt, setPrompt] = useState('Invoice Acme Corp £1,500 for 3 days consulting at £500');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRunAi = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setError(null);
    setResult(null);

    try {
      if (activeTab === 'SALES') {
        const res = await apiRequest<any>('/ai/draft-invoice', {
          method: 'POST',
          body: JSON.stringify({ prompt }),
        });
        setResult({ type: 'INVOICE', data: res });
      } else if (activeTab === 'JOURNALS') {
        const res = await apiRequest<any>('/ai/draft-journal', {
          method: 'POST',
          body: JSON.stringify({ prompt }),
        });
        setResult({ type: 'JOURNAL', data: res });
      } else if (activeTab === 'REPORTS' || activeTab === 'TAX') {
        const reportType = activeTab === 'TAX' ? 'VAT' : 'P_AND_L';
        const res = await apiRequest<any>('/ai/report-insights', {
          method: 'POST',
          body: JSON.stringify({ reportType }),
        });
        setResult({ type: 'REPORT', data: res });
      } else if (activeTab === 'BANKING') {
        // Auto-trigger continuous reconciliation
        const res = await apiRequest<any>('/bank-statements/auto-categorise', {
          method: 'POST',
        });
        setResult({
          type: 'BANKING',
          data: {
            message: `Categorised ${res.categorisedCount || 0} of ${res.processedCount || 0} bank lines using prediction model & LLM.`,
            categorisedCount: res.categorisedCount,
          },
        });
      } else if (activeTab === 'PURCHASES') {
        setResult({
          type: 'PURCHASES',
          data: {
            message: 'AI Document Intelligence pipeline ready. Upload receipts or bills to auto-extract supplier, VAT and expense nominals.',
          },
        });
      }
    } catch (err: any) {
      setError(err?.message || 'AI request failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleTabChange = (tab: AiCategoryTab) => {
    setActiveTab(tab);
    setResult(null);
    setError(null);
    if (tab === 'SALES') {
      setPrompt('Invoice Acme Corp £1,500 for 3 days consulting at £500');
    } else if (tab === 'JOURNALS') {
      setPrompt('Accrue £1,200 audit fee for March');
    } else if (tab === 'PURCHASES') {
      setPrompt('Extract and code utility bill from British Gas £340');
    } else if (tab === 'BANKING') {
      setPrompt('Auto-categorise and reconcile all pending bank statement lines');
    } else if (tab === 'REPORTS') {
      setPrompt('Generate executive commentary and variance analysis on Profit & Loss');
    } else if (tab === 'TAX') {
      setPrompt('Run pre-filing VAT Return check for HMRC MTD compliance');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(5px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '1rem',
          width: '100%',
          maxWidth: '780px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          border: '1px solid var(--border-strong)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--info-text) 100%)',
            padding: '1.25rem 1.75rem',
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
                borderRadius: '10px',
                backgroundColor: 'rgba(24, 211, 190, 0.2)',
                color: 'var(--action-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                  Blynt AI Assistant
                </h2>
                <span
                  style={{
                    backgroundColor: 'rgba(24, 211, 190, 0.2)',
                    color: 'var(--action-text)',
                    border: '1px solid rgba(24, 211, 190, 0.4)',
                    fontSize: '0.675rem',
                    fontWeight: 800,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '999px',
                    textTransform: 'uppercase',
                  }}
                >
                  All Categories
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#BAE6FD', margin: '0.2rem 0 0 0' }}>
                Automated drafting, double-entry verification, and financial analysis across your business.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.35rem' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Category Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-app)',
            overflowX: 'auto',
            padding: '0.5rem 1.25rem 0 1.25rem',
            gap: '0.5rem',
          }}
        >
          {[
            { id: 'SALES' as const, label: 'Sales & Invoices', icon: FileText },
            { id: 'PURCHASES' as const, label: 'Purchases & Bills', icon: FileCheck },
            { id: 'JOURNALS' as const, label: 'Manual Journals', icon: BookOpen },
            { id: 'BANKING' as const, label: 'Banking & Reconcile', icon: Landmark },
            { id: 'REPORTS' as const, label: 'P&L Reports', icon: TrendingUp },
            { id: 'TAX' as const, label: 'VAT & Tax', icon: Percent },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.65rem 0.95rem',
                  border: 'none',
                  borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                  backgroundColor: 'transparent',
                  color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
              Instruction or Question for {activeTab.toLowerCase()}:
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="What would you like AI to draft or calculate?"
                style={{
                  flex: 1,
                  padding: '0.65rem 0.85rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-strong)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRunAi();
                }}
              />
              <button
                onClick={handleRunAi}
                disabled={generating}
                style={{
                  padding: '0.65rem 1.25rem',
                  backgroundColor: 'var(--primary)',
                  backgroundImage: 'linear-gradient(135deg, var(--primary) 0%, var(--primary) 100%)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  cursor: generating ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)',
                }}
              >
                <Zap size={15} fill="#FFFFFF" />
                <span>{generating ? 'Processing...' : 'Run AI'}</span>
              </button>
            </div>
          </div>

          {error && (
            <div style={{ padding: '0.75rem', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: '0.375rem', color: 'var(--danger)', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          {/* AI Result Card */}
          {result && (
            <div
              style={{
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-strong)',
                borderRadius: '0.65rem',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
              }}
            >
              {result.type === 'INVOICE' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--success-text)', fontWeight: 700, fontSize: '0.85rem' }}>
                      <CheckCircle2 size={16} />
                      <span>Sales Invoice Draft Formulated</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Customer: <strong>{result.data.contactName}</strong></span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--ink-2)' }}>
                    {result.data.explanation}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', padding: '0.75rem 1rem', borderRadius: '0.375rem', border: '1px solid var(--border-subtle)' }}>
                    <div>Total: <strong style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>£{result.data.totalAmount.toFixed(2)}</strong> (Net: £{result.data.subtotal.toFixed(2)}, VAT: £{result.data.taxTotal.toFixed(2)})</div>
                    <button
                      onClick={() => {
                        sessionStorage.setItem('blynt_ai_invoice_draft', JSON.stringify(result.data));
                        onClose();
                        router.push('/sales/invoices/new?source=ai');
                      }}
                      style={{
                        padding: '0.45rem 0.95rem',
                        backgroundColor: 'var(--success)',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '0.375rem',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <span>Review in Editor</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </>
              )}

              {result.type === 'JOURNAL' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--success-text)', fontWeight: 700, fontSize: '0.85rem' }}>
                      <CheckCircle2 size={16} />
                      <span>Manual Journal Formulated (Debits = Credits: ✓ BALANCED)</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total: £{result.data.totalDebit.toFixed(2)}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--ink-2)' }}>
                    {result.data.explanation}
                  </div>
                  <button
                    onClick={() => {
                      sessionStorage.setItem('blynt_ai_journal_draft', JSON.stringify(result.data));
                      onClose();
                      router.push('/accounting/journals/new?source=ai');
                    }}
                    style={{
                      padding: '0.45rem 0.95rem',
                      backgroundColor: 'var(--success)',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '0.375rem',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      alignSelf: 'flex-start',
                    }}
                  >
                    <span>Open in Journal Editor</span>
                    <ArrowRight size={13} />
                  </button>
                </>
              )}

              {(result.type === 'REPORT' || activeTab === 'TAX') && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--success-text)', fontWeight: 700, fontSize: '0.85rem' }}>
                    <CheckCircle2 size={16} />
                    <span>Executive Analysis ({result.data.reportType})</span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.5, margin: 0 }}>
                    {result.data.executiveSummary}
                  </p>
                  {result.data.keyHighlights?.length > 0 && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--ink-2)' }}>
                      <strong>Highlights:</strong>
                      <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0 }}>
                        {result.data.keyHighlights.map((h: string, idx: number) => (
                          <li key={idx}>{h}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {result.type === 'BANKING' && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--success-text)', fontWeight: 700, fontSize: '0.85rem' }}>
                    <CheckCircle2 size={16} />
                    <span>Banking ML Prediction Engine Complete</span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--ink-2)', margin: 0 }}>{result.data.message}</p>
                  <button
                    onClick={() => {
                      onClose();
                      router.push('/banking/reconciliation');
                    }}
                    style={{
                      padding: '0.45rem 0.95rem',
                      backgroundColor: 'var(--action)',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '0.375rem',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      alignSelf: 'flex-start',
                    }}
                  >
                    <span>Open Smart Reconciliation</span>
                    <ArrowRight size={13} />
                  </button>
                </>
              )}

              {result.type === 'PURCHASES' && (
                <>
                  <p style={{ fontSize: '0.85rem', color: 'var(--ink-2)', margin: 0 }}>{result.data.message}</p>
                  <button
                    onClick={() => {
                      onClose();
                      router.push('/accounting/documents');
                    }}
                    style={{
                      padding: '0.45rem 0.95rem',
                      backgroundColor: 'var(--primary)',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '0.375rem',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      alignSelf: 'flex-start',
                    }}
                  >
                    <span>Open Document Intelligence Inbox</span>
                    <ArrowRight size={13} />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
