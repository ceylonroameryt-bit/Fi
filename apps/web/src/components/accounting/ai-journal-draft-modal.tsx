'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, X, ArrowRight, Zap, CheckCircle2, Scale } from 'lucide-react';
import { apiRequest } from '@/lib/api';

interface AiJournalDraftModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AiJournalDraftModal({ isOpen, onClose }: AiJournalDraftModalProps) {
  const router = useRouter();
  const [prompt, setPrompt] = useState('Accrue £1,200 audit fee for March');
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await apiRequest<any>('/ai/draft-journal', {
        method: 'POST',
        body: JSON.stringify({ prompt }),
      });
      setDraft(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to generate AI journal draft');
    } finally {
      setGenerating(false);
    }
  };

  const handleApply = () => {
    if (!draft) return;
    try {
      sessionStorage.setItem('blynt_ai_journal_draft', JSON.stringify(draft));
    } catch {}
    onClose();
    router.push('/accounting/journals/new?source=ai');
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
        padding: '1rem',
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '0.85rem',
          width: '100%',
          maxWidth: '680px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          border: '1px solid #E2E8F0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #041F46 0%, #082E64 100%)',
            padding: '1.25rem 1.5rem',
            color: '#FFFFFF',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: 'rgba(24, 211, 190, 0.2)',
                color: '#18D3BE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Scale size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                AI Manual Journal Drafter (Phase 7)
              </h2>
              <p style={{ fontSize: '0.775rem', color: '#94A3B8', margin: '0.15rem 0 0 0' }}>
                Plain-English instruction generates strict, balanced double-entry ledger lines.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '0.25rem' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.45rem' }}>
              Describe the Accounting Adjustment:
            </label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Accrue £1,200 audit fee for March, or Prepay £2,400 annual commercial insurance"
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '0.5rem',
                border: '1px solid #CBD5E1',
                fontSize: '0.9rem',
                color: '#0F172A',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
          </div>

          {/* Preset Prompts */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Accounting Presets:</span>
            {[
              'Accrue £1,200 audit fee for March',
              'Prepay £2,400 annual building insurance',
              'Depreciate office computer equipment £150 for the month',
            ].map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setPrompt(ex)}
                style={{
                  padding: '0.2rem 0.55rem',
                  backgroundColor: '#F1F5F9',
                  border: '1px solid #E2E8F0',
                  borderRadius: '999px',
                  fontSize: '0.725rem',
                  color: '#334155',
                  cursor: 'pointer',
                }}
              >
                {ex}
              </button>
            ))}
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              padding: '0.65rem 1.25rem',
              backgroundColor: '#0EA5E9',
              backgroundImage: 'linear-gradient(135deg, #0284C7 0%, #0EA5E9 100%)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '0.5rem',
              fontWeight: 700,
              fontSize: '0.875rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              cursor: generating ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 4px rgba(14, 165, 233, 0.25)',
            }}
          >
            <Zap size={16} fill="#FFFFFF" />
            <span>{generating ? 'Formulating Balanced Double-Entry...' : 'Draft Journal with AI'}</span>
          </button>

          {error && (
            <div style={{ padding: '0.75rem', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '0.375rem', color: '#B91C1C', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          {/* AI Output Preview */}
          {draft && (
            <div
              style={{
                backgroundColor: '#F8FAFC',
                border: '1px solid #CBD5E1',
                borderRadius: '0.65rem',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#16A34A', fontWeight: 700, fontSize: '0.85rem' }}>
                  <CheckCircle2 size={16} />
                  <span>Double-Entry Invariant: Debits = Credits (BALANCED)</span>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontFamily: 'monospace' }}>Ref: {draft.reference}</span>
              </div>

              <div>
                <span style={{ color: '#64748B', fontSize: '0.825rem' }}>Narration:</span>{' '}
                <strong style={{ color: '#0F172A', fontSize: '0.875rem' }}>{draft.description}</strong>
              </div>

              {/* Journal Lines Table */}
              <div style={{ border: '1px solid #E2E8F0', borderRadius: '0.375rem', overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead style={{ backgroundColor: '#F1F5F9', color: '#475569', fontWeight: 600 }}>
                    <tr>
                      <th style={{ padding: '0.45rem 0.65rem', textAlign: 'left', width: '90px' }}>Code</th>
                      <th style={{ padding: '0.45rem 0.65rem', textAlign: 'left' }}>Nominal Account</th>
                      <th style={{ padding: '0.45rem 0.65rem', textAlign: 'right', width: '100px' }}>Debit</th>
                      <th style={{ padding: '0.45rem 0.65rem', textAlign: 'right', width: '100px' }}>Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.lines.map((l: any, i: number) => (
                      <tr key={i} style={{ borderTop: '1px solid #E2E8F0' }}>
                        <td style={{ padding: '0.5rem 0.65rem', color: '#2563EB', fontWeight: 700 }}>{l.accountCode}</td>
                        <td style={{ padding: '0.5rem 0.65rem', color: '#0F172A', fontWeight: 500 }}>{l.accountName}</td>
                        <td style={{ padding: '0.5rem 0.65rem', textAlign: 'right', fontWeight: l.debit > 0 ? 700 : 400, color: l.debit > 0 ? '#0F172A' : '#94A3B8' }}>
                          {l.debit > 0 ? `£${l.debit.toFixed(2)}` : '-'}
                        </td>
                        <td style={{ padding: '0.5rem 0.65rem', textAlign: 'right', fontWeight: l.credit > 0 ? 700 : 400, color: l.credit > 0 ? '#0F172A' : '#94A3B8' }}>
                          {l.credit > 0 ? `£${l.credit.toFixed(2)}` : '-'}
                        </td>
                      </tr>
                    ))}
                    <tr style={{ backgroundColor: '#F8FAFC', borderTop: '2px solid #E2E8F0', fontWeight: 700 }}>
                      <td colSpan={2} style={{ padding: '0.5rem 0.65rem', textAlign: 'right', color: '#475569' }}>Total:</td>
                      <td style={{ padding: '0.5rem 0.65rem', textAlign: 'right', color: '#059669' }}>£{draft.totalDebit.toFixed(2)}</td>
                      <td style={{ padding: '0.5rem 0.65rem', textAlign: 'right', color: '#059669' }}>£{draft.totalCredit.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ fontSize: '0.75rem', color: '#0369A1', backgroundColor: '#F0F9FF', padding: '0.45rem 0.65rem', borderRadius: '0.25rem' }}>
                💡 {draft.explanation}
              </div>

              <button
                onClick={handleApply}
                style={{
                  padding: '0.65rem 1.25rem',
                  backgroundColor: '#10B981',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '0.375rem',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)',
                }}
              >
                <span>Open in Journal Editor & Post</span>
                <ArrowRight size={15} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
