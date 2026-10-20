'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, X, CheckCircle2, TrendingUp, AlertTriangle, Lightbulb } from 'lucide-react';
import { apiRequest } from '@/lib/api';

interface AiReportInsightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportType: 'P_AND_L' | 'TRIAL_BALANCE' | 'VAT';
  reportData?: any;
}

export function AiReportInsightsModal({ isOpen, onClose, reportType, reportData }: AiReportInsightsModalProps) {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const fetchInsights = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiRequest<any>('/ai/report-insights', {
          method: 'POST',
          body: JSON.stringify({ reportType, data: reportData }),
        });
        setInsights(res);
      } catch (err: any) {
        setError(err?.message || 'Failed to generate financial commentary');
      } finally {
        setLoading(false);
      }
    };
    fetchInsights();
  }, [isOpen, reportType, reportData]);

  if (!isOpen) return null;

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
          maxWidth: '720px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          border: '1px solid var(--border-subtle)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #064E3B 0%, var(--success-text) 100%)',
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
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TrendingUp size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                AI Financial Commentary & Insights (Phase 14)
              </h2>
              <p style={{ fontSize: '0.775rem', color: '#D1FAE5', margin: '0.15rem 0 0 0' }}>
                Automated executive summary, margin drivers and variance explanation.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--success-border)', cursor: 'pointer', padding: '0.25rem' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Sparkles size={28} className="animate-spin" style={{ color: 'var(--success-text)', margin: '0 auto 0.75rem auto' }} />
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>Analyzing Ledger Postings & Trends...</div>
              <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Comparing current period against operating benchmarks</div>
            </div>
          ) : error ? (
            <div style={{ padding: '1rem', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: '0.375rem', color: 'var(--danger)', fontSize: '0.85rem' }}>
              {error}
            </div>
          ) : insights ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Executive Summary Box */}
              <div
                style={{
                  backgroundColor: 'var(--success-bg)',
                  border: '1px solid var(--success-border)',
                  borderRadius: '0.65rem',
                  padding: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--success-text)', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                  <CheckCircle2 size={16} />
                  <span>Executive Commentary ({insights.reportType})</span>
                </div>
                <p style={{ fontSize: '0.9rem', color: 'var(--success-text)', lineHeight: 1.6, margin: 0 }}>
                  {insights.executiveSummary}
                </p>
              </div>

              {/* Key Highlights */}
              <div>
                <h4 style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.65rem' }}>
                  Key Performance Drivers
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {insights.keyHighlights?.map((hl: string, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        padding: '0.65rem 0.85rem',
                        backgroundColor: 'var(--bg-app)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '0.45rem',
                        fontSize: '0.85rem',
                        color: 'var(--text-main)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.55rem',
                      }}
                    >
                      <span style={{ color: 'var(--success-text)', fontWeight: 800 }}>•</span>
                      <span>{hl}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommendations */}
              <div>
                <h4 style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.65rem' }}>
                  Actionable Recommendations
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {insights.recommendations?.map((rec: string, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        padding: '0.65rem 0.85rem',
                        backgroundColor: 'var(--info-bg)',
                        border: '1px solid var(--info-border)',
                        borderRadius: '0.45rem',
                        fontSize: '0.85rem',
                        color: 'var(--info-text)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.55rem',
                      }}
                    >
                      <Lightbulb size={16} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Anomalies / Discrepancy Checks */}
              {insights.anomaliesOrRisks?.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--danger-text)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.65rem' }}>
                    Audit & Variance Alerts
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {insights.anomaliesOrRisks.map((anom: string, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          padding: '0.65rem 0.85rem',
                          backgroundColor: 'var(--warning-bg)',
                          border: '1px solid var(--warning-border)',
                          borderRadius: '0.45rem',
                          fontSize: '0.85rem',
                          color: 'var(--warning-text)',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.55rem',
                        }}
                      >
                        <AlertTriangle size={16} style={{ color: 'var(--warning-text)', flexShrink: 0, marginTop: '2px' }} />
                        <span>{anom}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
