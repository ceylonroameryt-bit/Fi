'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  SlidersHorizontal,
  Zap,
  CheckCircle2,
  ShieldCheck,
  Bot,
  HelpCircle,
  X,
  RefreshCw,
  Building,
  Save,
  Check,
} from 'lucide-react';

export interface AiPreferences {
  mode: 'COPILOT' | 'AUTOPILOT' | 'REVIEW';
  confidenceThreshold: number; // e.g. 0.85
  customRules: string;
  defaultExpenseAccountId: string;
  defaultIncomeAccountId: string;
  defaultTaxRate: string;
  showAiReasoning: boolean;
}

export const DEFAULT_AI_PREFERENCES: AiPreferences = {
  mode: 'COPILOT',
  confidenceThreshold: 0.85,
  customRules: 'Software and SaaS (AWS, Figma, GitHub, Adobe) -> 6300 IT Software & Subscriptions\nPret and coffee meetings -> 6200 Travel & Entertainment (Zero-rated VAT)\nBank fees and merchant charges -> 6400 Bank Charges',
  defaultExpenseAccountId: '',
  defaultIncomeAccountId: '',
  defaultTaxRate: 'STANDARD_20',
  showAiReasoning: true,
};

interface AiCustomizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  onSavePreferences: (prefs: AiPreferences) => void;
  currentTotalItems?: number;
  qualifyingItemsCount?: number;
  nominalAccounts?: Array<{ id: string; code: string; name: string; accountType: string }>;
}

export function AiCustomizationModal({
  isOpen,
  onClose,
  orgId,
  onSavePreferences,
  currentTotalItems = 0,
  qualifyingItemsCount = 0,
  nominalAccounts = [],
}: AiCustomizationModalProps) {
  const [prefs, setPrefs] = useState<AiPreferences>(DEFAULT_AI_PREFERENCES);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Load saved preferences from localStorage on mount/orgId change
  useEffect(() => {
    if (!orgId) return;
    try {
      const stored = localStorage.getItem(`blynt_ai_prefs_${orgId}`);
      if (stored) {
        setPrefs((prev) => ({ ...prev, ...JSON.parse(stored) }));
      }
    } catch (e) {
      console.warn('Failed to read AI preferences from localStorage', e);
    }
  }, [orgId]);

  if (!isOpen) return null;

  const handleSave = () => {
    try {
      localStorage.setItem(`blynt_ai_prefs_${orgId}`, JSON.stringify(prefs));
      onSavePreferences(prefs);
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 700);
    } catch (e) {
      console.error('Failed to save AI preferences', e);
    }
  };

  const setConfidencePreset = (val: number) => {
    setPrefs((p) => ({ ...p, confidenceThreshold: val }));
  };

  const expenseAccounts = nominalAccounts.filter(
    (a) => a.accountType === 'EXPENSE' || a.accountType === 'OVERHEAD' || a.accountType === 'COST_OF_SALES'
  );
  const revenueAccounts = nominalAccounts.filter((a) => a.accountType === 'REVENUE' || a.accountType === 'INCOME');

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
          maxWidth: '680px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          border: '1px solid var(--border-subtle)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.75rem',
            background: 'linear-gradient(135deg, var(--nav-bg) 0%, var(--nav-bg) 100%)',
            color: '#FFFFFF',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
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
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#FFFFFF' }}>
                AI Bookkeeping & Reconciliation Settings
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                Customize Blynt AI intelligence, auto-pilot strictness, and specific business rules.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '0.375rem',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: '1.5rem 1.75rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Section 1: Automation Mode */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
              Automation & Workflow Mode
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
              {/* Co-Pilot */}
              <div
                onClick={() => setPrefs((p) => ({ ...p, mode: 'COPILOT' }))}
                style={{
                  border: prefs.mode === 'COPILOT' ? '2px solid var(--primary)' : '1px solid var(--border-subtle)',
                  backgroundColor: prefs.mode === 'COPILOT' ? 'var(--info-bg)' : '#FFFFFF',
                  borderRadius: '0.625rem',
                  padding: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                  <Zap size={16} color={prefs.mode === 'COPILOT' ? '#102654' : '#5B6478'} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>Co-Pilot</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.35 }}>
                  AI pre-fills nominals & VAT. You confirm with 1 click. Recommended.
                </p>
                {prefs.mode === 'COPILOT' && (
                  <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem' }}>
                    <CheckCircle2 size={15} color="#102654" />
                  </div>
                )}
              </div>

              {/* Autopilot */}
              <div
                onClick={() => setPrefs((p) => ({ ...p, mode: 'AUTOPILOT' }))}
                style={{
                  border: prefs.mode === 'AUTOPILOT' ? '2px solid var(--action)' : '1px solid var(--border-subtle)',
                  backgroundColor: prefs.mode === 'AUTOPILOT' ? 'var(--success-bg)' : '#FFFFFF',
                  borderRadius: '0.625rem',
                  padding: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                  <Bot size={16} color={prefs.mode === 'AUTOPILOT' ? '#B8432F' : '#5B6478'} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>Autopilot</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.35 }}>
                  Instantly reconciles all transactions above your confidence threshold.
                </p>
                {prefs.mode === 'AUTOPILOT' && (
                  <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem' }}>
                    <CheckCircle2 size={15} color="#B8432F" />
                  </div>
                )}
              </div>

              {/* Review Only */}
              <div
                onClick={() => setPrefs((p) => ({ ...p, mode: 'REVIEW' }))}
                style={{
                  border: prefs.mode === 'REVIEW' ? '2px solid var(--primary)' : '1px solid var(--border-subtle)',
                  backgroundColor: prefs.mode === 'REVIEW' ? 'var(--info-bg)' : '#FFFFFF',
                  borderRadius: '0.625rem',
                  padding: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                  <ShieldCheck size={16} color={prefs.mode === 'REVIEW' ? '#102654' : '#5B6478'} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>Manual Review</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.35 }}>
                  Only suggests existing unpaid invoices/bills. No auto-fill.
                </p>
                {prefs.mode === 'REVIEW' && (
                  <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem' }}>
                    <CheckCircle2 size={15} color="#102654" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Confidence Threshold Slider */}
          <div style={{ backgroundColor: 'var(--bg-app)', borderRadius: '0.75rem', padding: '1rem 1.25rem', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <SlidersHorizontal size={15} color="#102654" />
                  AI Confidence Sensitivity
                </label>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Only transactions meeting or exceeding this threshold qualify for 1-click Auto-Reconcile.
                </span>
              </div>
              <span
                style={{
                  fontSize: '1rem',
                  fontWeight: 800,
                  color: prefs.confidenceThreshold >= 0.9 ? 'var(--action-text)' : prefs.confidenceThreshold >= 0.8 ? 'var(--primary)' : 'var(--warning-text)',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--border-strong)',
                  borderRadius: '0.375rem',
                  padding: '0.2rem 0.6rem',
                }}
              >
                {Math.round(prefs.confidenceThreshold * 100)}%
              </span>
            </div>

            {/* Range Slider */}
            <input
              type="range"
              min="50"
              max="99"
              value={Math.round(prefs.confidenceThreshold * 100)}
              onChange={(e) => setPrefs((p) => ({ ...p, confidenceThreshold: Number(e.target.value) / 100 }))}
              style={{ width: '100%', accentColor: 'var(--action-text)', cursor: 'pointer', marginBottom: '0.75rem' }}
            />

            {/* Presets */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {[
                { label: '🎯 Strict (95%)', val: 0.95, desc: 'Recurring only' },
                { label: '⚡ Balanced (85%)', val: 0.85, desc: 'Recommended' },
                { label: '🚀 Speed (75%)', val: 0.75, desc: 'Fast clearing' },
              ].map((preset) => {
                const isActive = Math.round(prefs.confidenceThreshold * 100) === Math.round(preset.val * 100);
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setConfidencePreset(preset.val)}
                    style={{
                      flex: 1,
                      padding: '0.4rem 0.5rem',
                      borderRadius: '0.375rem',
                      border: isActive ? '1px solid var(--action)' : '1px solid var(--border-strong)',
                      backgroundColor: isActive ? '#E6FFFA' : '#FFFFFF',
                      fontSize: '0.75rem',
                      fontWeight: isActive ? 700 : 500,
                      color: isActive ? 'var(--action-text)' : 'var(--ink-2)',
                      cursor: 'pointer',
                    }}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {currentTotalItems > 0 && (
              <div style={{ marginTop: '0.75rem', fontSize: '0.775rem', color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Check size={14} color="#B8432F" />
                <span>
                  <strong>{qualifyingItemsCount}</strong> of <strong>{currentTotalItems}</strong> pending statement items qualify for 1-click Auto-Reconcile at {Math.round(prefs.confidenceThreshold * 100)}% sensitivity.
                </span>
              </div>
            )}
          </div>

          {/* Section 3: Custom Business Rules (Natural Language Prompt) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Custom Business Instructions & Memory
              </label>
              <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Blynt AI applies these rules first</span>
            </div>
            <textarea
              rows={3}
              value={prefs.customRules}
              onChange={(e) => setPrefs((p) => ({ ...p, customRules: e.target.value }))}
              placeholder="e.g. Treat all payments from Acme Corp as 4000 Sales Revenue. Treat all Uber charges as 6200 Travel."
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                border: '1px solid var(--border-strong)',
                borderRadius: '0.5rem',
                fontSize: '0.825rem',
                color: 'var(--text-main)',
                fontFamily: 'inherit',
                resize: 'vertical',
                lineHeight: 1.4,
              }}
            />
            <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
              Tell Blynt AI how your company classifies specific suppliers, client retainers, or VAT expectations.
            </p>
          </div>

          {/* Section 4: Fallback Defaults */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink-2)', marginBottom: '0.3rem' }}>
                Default Expense Category
              </label>
              <select
                value={prefs.defaultExpenseAccountId}
                onChange={(e) => setPrefs((p) => ({ ...p, defaultExpenseAccountId: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: '0.375rem',
                  fontSize: '0.825rem',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <option value="">AI Automatic Match (Recommended)</option>
                {expenseAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} - {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink-2)', marginBottom: '0.3rem' }}>
                Default VAT Rate
              </label>
              <select
                value={prefs.defaultTaxRate}
                onChange={(e) => setPrefs((p) => ({ ...p, defaultTaxRate: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: '0.375rem',
                  fontSize: '0.825rem',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <option value="STANDARD_20">UK Standard 20%</option>
                <option value="ZERO_RATED">Zero Rated 0%</option>
                <option value="EXEMPT">Exempt 0%</option>
                <option value="REDUCED_5">Reduced 5%</option>
              </select>
            </div>
          </div>

          {/* Section 5: Reasoning Visibility Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid var(--bg-soft)' }}>
            <div>
              <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-main)' }}>Display AI Reasoning Badge</span>
              <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)', margin: 0 }}>Show why Blynt AI picked a specific nominal code and tax treatment</p>
            </div>
            <input
              type="checkbox"
              checked={prefs.showAiReasoning}
              onChange={(e) => setPrefs((p) => ({ ...p, showAiReasoning: e.target.checked }))}
              style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
          </div>

        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.75rem',
            backgroundColor: 'var(--bg-app)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            onClick={() => setPrefs(DEFAULT_AI_PREFERENCES)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Reset to Defaults
          </button>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.55rem 1.15rem',
                border: '1px solid var(--border-strong)',
                borderRadius: '0.5rem',
                backgroundColor: '#FFFFFF',
                color: 'var(--ink-2)',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.55rem 1.35rem',
                border: 'none',
                borderRadius: '0.5rem',
                backgroundColor: savedSuccess ? 'var(--success)' : 'var(--nav-bg)',
                color: '#FFFFFF',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background-color 0.2s ease',
              }}
            >
              {savedSuccess ? <CheckCircle2 size={16} /> : <Save size={16} />}
              <span>{savedSuccess ? 'Saved Preferences!' : 'Save & Apply'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
