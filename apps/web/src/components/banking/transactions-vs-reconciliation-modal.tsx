'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowRightLeft,
  CheckCheck,
  CheckCircle2,
  HelpCircle,
  X,
  ArrowRight,
  ShieldCheck,
  Scale,
  Sparkles,
  FileCheck,
} from 'lucide-react';

interface TransactionsVsReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  bankAccountId?: string;
}

export function TransactionsVsReconciliationModal({
  isOpen,
  onClose,
  bankAccountId,
}: TransactionsVsReconciliationModalProps) {
  if (!isOpen) return null;

  const txUrl = bankAccountId
    ? `/banking/transactions?bankAccountId=${bankAccountId}`
    : '/banking/transactions';
  const reconUrl = bankAccountId
    ? `/banking/reconciliation?bankAccountId=${bankAccountId}`
    : '/banking/reconciliation';

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
          maxWidth: '820px',
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
            padding: '1.5rem 2rem',
            background: 'linear-gradient(135deg, var(--nav-bg) 0%, #0B3B7B 100%)',
            color: '#FFFFFF',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: 'rgba(24, 211, 190, 0.18)',
                color: 'var(--action-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Scale size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
                Transactions vs. Reconciliation
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                Understand the core difference and when to use each in your business workflow.
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
              padding: '0.35rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '0.375rem',
            }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.75rem 2rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Side by side comparison cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem' }}>
            {/* Transactions Card */}
            <div
              style={{
                border: '1px solid var(--border-subtle)',
                borderRadius: '0.75rem',
                padding: '1.25rem',
                backgroundColor: 'var(--bg-app)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--info-bg)',
                      color: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ArrowRightLeft size={16} />
                  </div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                    1. Transactions Feed
                  </h3>
                </div>

                <div
                  style={{
                    display: 'inline-block',
                    backgroundColor: 'var(--info-border)',
                    color: 'var(--info-text)',
                    fontSize: '0.725rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.6rem',
                    borderRadius: '999px',
                    marginBottom: '0.85rem',
                  }}
                >
                  THE RAW BANK ACTIVITY
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--ink-2)', lineHeight: 1.5, margin: '0 0 1rem 0' }}>
                  The direct stream of bank statements imported via open banking or CSV. Here you inspect each row, see what was bought or sold, and categorize it.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--ink-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem' }}>
                    <CheckCircle2 size={15} color="#102654" style={{ marginTop: '2px', flexShrink: 0 }} />
                    <span><strong>What happens here:</strong> Tagging expenses (e.g. 6300 IT Software) and tagging customers/vendors.</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem' }}>
                    <CheckCircle2 size={15} color="#102654" style={{ marginTop: '2px', flexShrink: 0 }} />
                    <span><strong>Analogy:</strong> Sorting all your physical receipts into categorized piles on your desk.</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem' }}>
                    <CheckCircle2 size={15} color="#102654" style={{ marginTop: '2px', flexShrink: 0 }} />
                    <span><strong>Goal:</strong> Make sure no bank line is uncategorised.</span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                <Link
                  href={txUrl}
                  onClick={onClose}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    width: '100%',
                    padding: '0.5rem',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--border-strong)',
                    borderRadius: '0.375rem',
                    color: 'var(--primary)',
                    fontSize: '0.825rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  <span>Go to Bank Transactions</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>

            {/* Reconciliation Card */}
            <div
              style={{
                border: '2px solid var(--action)',
                borderRadius: '0.75rem',
                padding: '1.25rem',
                backgroundColor: 'var(--action-soft)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--action-soft)',
                      color: 'var(--action-text)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <CheckCheck size={18} />
                  </div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                    2. Smart Reconciliation
                  </h3>
                </div>

                <div
                  style={{
                    display: 'inline-block',
                    backgroundColor: 'var(--action-soft)',
                    color: '#115E59',
                    fontSize: '0.725rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.6rem',
                    borderRadius: '999px',
                    marginBottom: '0.85rem',
                  }}
                >
                  THE AUDIT & LEDGER MATCH
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--ink-2)', lineHeight: 1.5, margin: '0 0 1rem 0' }}>
                  The formal accounting process that matches your bank statements against your official General Ledger and unpaid sales invoices or supplier bills.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--ink-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem' }}>
                    <CheckCircle2 size={15} color="#B8432F" style={{ marginTop: '2px', flexShrink: 0 }} />
                    <span><strong>What happens here:</strong> Proving that <em>Statement Balance == General Ledger Balance</em> with £0.00 difference.</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem' }}>
                    <CheckCircle2 size={15} color="#B8432F" style={{ marginTop: '2px', flexShrink: 0 }} />
                    <span><strong>Analogy:</strong> Balancing your company checkbook to ensure HMRC and tax returns are 100% audit-proof.</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem' }}>
                    <CheckCircle2 size={15} color="#B8432F" style={{ marginTop: '2px', flexShrink: 0 }} />
                    <span><strong>AI Power:</strong> 1-click auto-matching and posting to the General Ledger.</span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--action-soft)' }}>
                <Link
                  href={reconUrl}
                  onClick={onClose}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    width: '100%',
                    padding: '0.5rem',
                    backgroundColor: 'var(--action)',
                    borderRadius: '0.375rem',
                    color: '#FFFFFF',
                    fontSize: '0.825rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                    boxShadow: '0 2px 6px rgba(13, 148, 136, 0.25)',
                  }}
                >
                  <Sparkles size={14} />
                  <span>Go to Smart Reconciliation</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Quick Summary Comparison Table */}
          <div style={{ backgroundColor: 'var(--bg-app)', borderRadius: '0.75rem', border: '1px solid var(--border-subtle)', padding: '1rem 1.25rem' }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 0.75rem 0' }}>
              Quick Comparison Cheat-Sheet
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 2fr', gap: '0.5rem', fontSize: '0.775rem' }}>
              <div style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Feature</div>
              <div style={{ fontWeight: 700, color: 'var(--primary)' }}>Transactions Feed</div>
              <div style={{ fontWeight: 700, color: 'var(--action-text)' }}>Reconciliation</div>

              <div style={{ color: 'var(--ink-2)', fontWeight: 600 }}>Primary Question</div>
              <div style={{ color: 'var(--ink-2)' }}>&ldquo;What was this £50 spent on?&rdquo;</div>
              <div style={{ color: 'var(--ink-2)' }}>&ldquo;Does this £50 match an invoice or journal in our books?&rdquo;</div>

              <div style={{ color: 'var(--ink-2)', fontWeight: 600 }}>Accounting Result</div>
              <div style={{ color: 'var(--ink-2)' }}>Categorised Bank Statement Line</div>
              <div style={{ color: 'var(--ink-2)' }}>Posted General Ledger Journal & Marked Paid</div>

              <div style={{ color: 'var(--ink-2)', fontWeight: 600 }}>HMRC Compliance</div>
              <div style={{ color: 'var(--ink-2)' }}>Preliminary Record</div>
              <div style={{ color: 'var(--ink-2)' }}>Official Audit Proof & VAT Return Source</div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 2rem',
            backgroundColor: 'var(--bg-app)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.55rem 1.35rem',
              border: 'none',
              borderRadius: '0.5rem',
              backgroundColor: 'var(--nav-bg)',
              color: '#FFFFFF',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
}
