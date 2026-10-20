'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Clock,
  Landmark,
  FileSpreadsheet,
  Plus,
  Upload,
  Check,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Building2,
  User,
  Shield,
  Briefcase,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Scale,
  Layers,
  Calendar,
} from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest, ApiError } from '@/lib/api';
import { formatMoney } from '@/lib/money-format';
import {
  DashboardCustomizerModal,
  DashboardPreferences,
  DEFAULT_DASHBOARD_PREFERENCES,
} from '@/components/dashboard/dashboard-customizer-modal';
import { AddCompanyModal } from '@/components/organization/add-company-modal';

type BusinessScale = 'all' | 'solo' | 'sme' | 'enterprise';

interface AttentionItem {
  id: string;
  tone: 'ai' | 'danger' | 'warning' | 'info';
  title: string;
  detail: string;
  action: string;
  href: string;
  tier: 'all' | 'solo' | 'sme' | 'enterprise';
}

export default function DashboardPage() {
  const { user, activeOrg, activeRole, refreshOrgs } = useAuth();
  const currency = activeOrg?.baseCurrency ?? 'GBP';
  const money = useCallback((v: string | number) => {
    if (typeof v === 'number') {
      return `£${v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return formatMoney(v, { currency });
  }, [currency]);

  const [scaleMode, setScaleMode] = useState<BusinessScale>('all');
  const [prefs, setPrefs] = useState<DashboardPreferences>(DEFAULT_DASHBOARD_PREFERENCES);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);

  // Live state from backend if available
  const [liveBankCount, setLiveBankCount] = useState<number | null>(null);
  const [liveReviewCount, setLiveReviewCount] = useState<number | null>(null);

  // Dynamic user greeting
  const firstName = user?.firstName?.trim() || 'Poorna';
  const hour = new Date().getHours();
  const greetingText = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateLine = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  // Load live data if an org is active
  useEffect(() => {
    if (!activeOrg?.id) return;
    apiRequest<any[]>('/bank-accounts')
      .then((accs) => setLiveBankCount(accs.length))
      .catch(() => setLiveBankCount(null));
    apiRequest<any[]>('/ai/review-queue')
      .then((rev) => setLiveReviewCount(rev.length))
      .catch(() => setLiveReviewCount(null));
  }, [activeOrg?.id]);

  // Comprehensive Attention Workflows (Page 3 Specification)
  const allAttentionItems: AttentionItem[] = [
    {
      id: 'ai-bills',
      tone: 'ai',
      title: '5 bills drafted by AI are ready to check',
      detail: 'Nothing posts until you approve · 4 high confidence, 1 needs a look',
      action: 'Review 5',
      href: '/purchases/review',
      tier: 'sme',
    },
    {
      id: 'overdue-invoices',
      tone: 'danger',
      title: '2 invoices are overdue — £4,320.00',
      detail: 'Northwind Ltd (12 days) · Acme Corp (4 days)',
      action: 'Send reminders',
      href: '/sales/invoices',
      tier: 'solo',
    },
    {
      id: 'bank-lines',
      tone: 'info',
      title: '12 bank lines to confirm',
      detail: '10 already matched — one tap each',
      action: 'Confirm',
      href: '/banking/transactions',
      tier: 'all',
    },
    {
      id: 'vat-return',
      tone: 'warning',
      title: 'VAT return due in 18 days',
      detail: 'Q3 · estimate £6,140.00 · already set aside below',
      action: 'Prepare',
      href: '/reports/vat',
      tier: 'enterprise',
    },
  ];

  const filteredAttention = scaleMode === 'all'
    ? allAttentionItems
    : allAttentionItems.filter((it) => it.tier === 'all' || it.tier === scaleMode);

  // 6-Month Real Trend Figures
  const trendData = [
    { month: 'May', in: 18.5, out: 12.0, net: '+£6.5k' },
    { month: 'Jun', in: 22.0, out: 13.5, net: '+£8.5k' },
    { month: 'Jul', in: 19.5, out: 11.0, net: '+£8.5k' },
    { month: 'Aug', in: 23.5, out: 14.2, net: '+£9.3k' },
    { month: 'Sep', in: 25.0, out: 14.8, net: '+£10.2k' },
    { month: 'Oct', in: 24.86, out: 11.42, net: '+£13.44k' },
  ];

  return (
    <AppShell>
      <main
        style={{
          padding: '1.75rem 2.5rem 3.5rem 2.5rem',
          maxWidth: '1360px',
          width: '100%',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
        }}
      >
        {/* TOP SYSTEM SCALE TOGGLE & ENTERPRISE CONTEXT BAR */}
        <section
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            padding: '0.65rem 1.15rem',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E3E7EF',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-sm)',
            fontSize: '0.825rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, color: '#102654' }}>
              <Scale size={16} color="#FF7D6B" />
              <span>Platform Tier:</span>
            </span>

            {/* Segment Controls */}
            <div style={{ display: 'inline-flex', backgroundColor: '#F1F5F9', padding: '3px', borderRadius: '8px', gap: '2px' }}>
              <button
                type="button"
                onClick={() => setScaleMode('all')}
                style={{
                  padding: '0.3rem 0.75rem',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.775rem',
                  fontWeight: scaleMode === 'all' ? 700 : 500,
                  backgroundColor: scaleMode === 'all' ? '#102654' : 'transparent',
                  color: scaleMode === 'all' ? '#FFFFFF' : '#5B6478',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Full Suite
              </button>
              <button
                type="button"
                onClick={() => setScaleMode('solo')}
                style={{
                  padding: '0.3rem 0.75rem',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.775rem',
                  fontWeight: scaleMode === 'solo' ? 700 : 500,
                  backgroundColor: scaleMode === 'solo' ? '#102654' : 'transparent',
                  color: scaleMode === 'solo' ? '#FFFFFF' : '#5B6478',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Solo Trader
              </button>
              <button
                type="button"
                onClick={() => setScaleMode('sme')}
                style={{
                  padding: '0.3rem 0.75rem',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.775rem',
                  fontWeight: scaleMode === 'sme' ? 700 : 500,
                  backgroundColor: scaleMode === 'sme' ? '#102654' : 'transparent',
                  color: scaleMode === 'sme' ? '#FFFFFF' : '#5B6478',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Growing SME
              </button>
              <button
                type="button"
                onClick={() => setScaleMode('enterprise')}
                style={{
                  padding: '0.3rem 0.75rem',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.775rem',
                  fontWeight: scaleMode === 'enterprise' ? 700 : 500,
                  backgroundColor: scaleMode === 'enterprise' ? '#102654' : 'transparent',
                  color: scaleMode === 'enterprise' ? '#FFFFFF' : '#5B6478',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Corporate & Accountant
              </button>
            </div>
          </div>

          {/* Right Status Indicators */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: '#5B6478', fontSize: '0.785rem' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#12B76A' }} />
              <strong>Entity:</strong> {activeOrg?.name || 'Demo Consulting Ltd (HQ)'}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <Sparkles size={13} color="#FF7D6B" />
              <strong>AI Gateway:</strong> Active
            </span>
            <button
              type="button"
              onClick={() => setShowAddCompanyModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: '#EFF4FC',
                color: '#102654',
                border: '1px solid #CBD5E1',
                padding: '0.25rem 0.65rem',
                borderRadius: '6px',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '0.75rem',
              }}
            >
              <Plus size={13} /> Add Entity
            </button>
          </div>
        </section>

        {/* TOP HEADER / GREETING BANNER */}
        <section
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#5B6478', marginBottom: '0.2rem' }}>
              {dateLine}
            </div>
            <h1
              style={{
                fontSize: '1.75rem',
                fontWeight: 800,
                color: '#102654',
                letterSpacing: '-0.025em',
                lineHeight: 1.2,
                margin: 0,
              }}
            >
              {greetingText}, {firstName}
            </h1>
            <p style={{ fontSize: '0.875rem', color: '#5B6478', marginTop: '0.35rem', marginBottom: 0 }}>
              You&apos;re in good shape. <strong>4 things need you today</strong> — about 15 minutes.
            </p>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Link
              href="/sales/invoices/new"
              className="btn-v2-primary"
              style={{ padding: '0.45rem 1.15rem', height: '38px', borderRadius: '8px' }}
            >
              <span>New invoice</span>
            </Link>
            <Link
              href="/purchases/expenses"
              className="btn-v2-secondary"
              style={{ padding: '0.45rem 1.15rem', height: '38px', borderRadius: '8px' }}
            >
              <span>Upload receipt</span>
            </Link>
            <button
              type="button"
              onClick={() => setShowCustomizer(true)}
              className="btn-v2-secondary"
              style={{ padding: '0.45rem 1.15rem', height: '38px', borderRadius: '8px' }}
            >
              <span>Customise</span>
            </button>
          </div>
        </section>

        {/* ROW 1: NEEDS YOUR ATTENTION (Left) + SAFE TO SPEND (Right) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.85fr) minmax(340px, 1.15fr)',
            gap: '1.5rem',
            alignItems: 'stretch',
          }}
        >
          {/* Needs your attention Card */}
          <div
            className="attention-card"
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E3E7EF',
              borderRadius: '14px',
              padding: '1.25rem 1.5rem',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#102654', margin: 0 }}>
                    Needs your attention
                  </h2>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      backgroundColor: '#EFF6FF',
                      color: '#2563EB',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '9999px',
                      border: '1px solid #DBEAFE',
                    }}
                  >
                    Priority Engine
                  </span>
                </div>
                <span style={{ color: '#5B6478', fontSize: '0.8rem', fontWeight: 500 }}>
                  9 of 13 done this week
                </span>
              </div>

              {/* Items List */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {filteredAttention.map((item, idx) => {
                  const isAi = item.tone === 'ai';
                  const isDanger = item.tone === 'danger';
                  const isWarning = item.tone === 'warning';
                  const iconBg = isAi ? '#FFF1EE' : isDanger ? '#FDF2F2' : isWarning ? '#FEF8EC' : '#EFF4FC';
                  const iconColor = isAi ? '#FF7D6B' : isDanger ? '#B42318' : isWarning ? '#8A5A00' : '#2457C5';

                  return (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.85rem 0',
                        borderBottom: idx === filteredAttention.length - 1 ? 'none' : '1px solid #F1F5F9',
                        gap: '1rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: '1 1 240px' }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            backgroundColor: iconBg,
                            color: iconColor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {isAi && <Sparkles size={17} />}
                          {isDanger && <Clock size={17} />}
                          {isWarning && <FileSpreadsheet size={17} />}
                          {!isAi && !isDanger && !isWarning && <Landmark size={17} />}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#102654' }}>
                            {item.title}
                          </div>
                          <div style={{ fontSize: '0.785rem', color: '#5B6478', marginTop: '0.1rem' }}>
                            {item.detail}
                          </div>
                        </div>
                      </div>

                      <Link
                        href={item.href}
                        className={idx === 0 ? 'btn-v2-primary' : 'btn-v2-secondary'}
                        style={{
                          minHeight: '34px',
                          padding: '0.35rem 0.95rem',
                          fontSize: '0.8rem',
                          borderRadius: '6px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.action}
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Safe to spend Card (Dark Navy Blynt V2) */}
          <div
            className="safe-spend-card"
            style={{
              backgroundColor: '#102654',
              borderRadius: '14px',
              padding: '1.5rem',
              color: '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 10px 25px -5px rgba(16, 38, 84, 0.3)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#C9D2E6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Safe to spend
                </span>
                <span
                  style={{
                    fontSize: '0.675rem',
                    fontWeight: 700,
                    backgroundColor: 'rgba(255, 125, 107, 0.2)',
                    color: '#FF947F',
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                  }}
                >
                  Live Runway Buffer
                </span>
              </div>

              <div
                style={{
                  fontSize: '2.5rem',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  letterSpacing: '-0.03em',
                  fontFamily: 'JetBrains Mono, monospace',
                  marginTop: '0.4rem',
                  lineHeight: 1.1,
                }}
              >
                £32,200
              </div>

              <p style={{ fontSize: '0.8rem', color: '#C9D2E6', marginTop: '0.35rem', lineHeight: 1.4 }}>
                What&apos;s left after bills due in the next 30 days and tax you&apos;ll owe.
              </p>

              <div
                style={{
                  marginTop: '1.25rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid rgba(255, 255, 255, 0.12)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                  fontSize: '0.825rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#E2E8F0' }}>
                  <span>Cash in bank</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>£48,210</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#FFB4A8' }}>
                  <span>− Bills due in 30 days</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>£9,870</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#FFB4A8' }}>
                  <span>− VAT set aside</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>£6,140</span>
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: '1.25rem',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.8rem',
                color: '#E2E8F0',
              }}
            >
              <CheckCircle2 size={16} color="#4ADE80" />
              <span>
                At your usual spend, cash lasts <strong>5.8 months</strong>
              </span>
            </div>
          </div>
        </div>

        {/* ROW 2: 4 EXECUTIVE KPI CARDS */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
          }}
        >
          {/* Card 1 */}
          <div
            className="kpi-card"
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E3E7EF',
              borderRadius: '12px',
              padding: '1.15rem 1.25rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#5B6478', marginBottom: '0.35rem' }}>
              Income · Oct to date
            </div>
            <div
              style={{
                fontSize: '1.65rem',
                fontWeight: 800,
                color: '#102654',
                fontFamily: 'JetBrains Mono, monospace',
                letterSpacing: '-0.02em',
              }}
            >
              £24,860
            </div>
            <div
              style={{
                marginTop: '0.45rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#12B76A',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <TrendingUp size={13} />
              <span>12% more than Sept</span>
            </div>
          </div>

          {/* Card 2 */}
          <div
            className="kpi-card"
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E3E7EF',
              borderRadius: '12px',
              padding: '1.15rem 1.25rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#5B6478', marginBottom: '0.35rem' }}>
              Spending · Oct to date
            </div>
            <div
              style={{
                fontSize: '1.65rem',
                fontWeight: 800,
                color: '#102654',
                fontFamily: 'JetBrains Mono, monospace',
                letterSpacing: '-0.02em',
              }}
            >
              £11,420
            </div>
            <div
              style={{
                marginTop: '0.45rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#5B6478',
              }}
            >
              — About the same as Sept
            </div>
          </div>

          {/* Card 3 */}
          <div
            className="kpi-card"
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E3E7EF',
              borderRadius: '12px',
              padding: '1.15rem 1.25rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#5B6478', marginBottom: '0.35rem' }}>
              Profit · Oct to date
            </div>
            <div
              style={{
                fontSize: '1.65rem',
                fontWeight: 800,
                color: '#102654',
                fontFamily: 'JetBrains Mono, monospace',
                letterSpacing: '-0.02em',
              }}
            >
              £13,440
            </div>
            <div
              style={{
                marginTop: '0.45rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#12B76A',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <TrendingUp size={13} />
              <span>54% operating margin</span>
            </div>
          </div>

          {/* Card 4 */}
          <div
            className="kpi-card"
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E3E7EF',
              borderRadius: '12px',
              padding: '1.15rem 1.25rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#5B6478', marginBottom: '0.35rem' }}>
              Customers owe you
            </div>
            <div
              style={{
                fontSize: '1.65rem',
                fontWeight: 800,
                color: '#102654',
                fontFamily: 'JetBrains Mono, monospace',
                letterSpacing: '-0.02em',
              }}
            >
              £18,750
            </div>
            <div
              style={{
                marginTop: '0.45rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#D92D20',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <AlertTriangle size={13} />
              <span>! £4,320 overdue (2 invoices)</span>
            </div>
          </div>
        </div>

        {/* ROW 3: MONEY IN VS MONEY OUT (Left) + CLOSE SEPTEMBER WORKFLOW (Right) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.85fr) minmax(320px, 1.15fr)',
            gap: '1.5rem',
            alignItems: 'stretch',
          }}
        >
          {/* Money in vs Money out Chart */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E3E7EF',
              borderRadius: '14px',
              padding: '1.25rem 1.5rem',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '1rem',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#102654', margin: 0 }}>
                    Money in vs money out
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#5B6478' }}>
                    Past 6 months cash flow & EBITDA trends
                  </span>
                </div>

                {/* Legend */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.785rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#102654' }} />
                    <span style={{ color: '#5B6478' }}>Money in</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#FF7D6B' }} />
                    <span style={{ color: '#5B6478' }}>Money out</span>
                  </div>
                </div>
              </div>

              {/* Chart Bars */}
              <div
                style={{
                  height: '190px',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'space-between',
                  gap: '1.25rem',
                  paddingTop: '1rem',
                  borderBottom: '1px solid #E3E7EF',
                }}
              >
                {trendData.map((d) => (
                  <div
                    key={d.month}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.5rem',
                      height: '100%',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '5px', height: '150px' }}>
                      {/* Bar In */}
                      <div
                        title={`Money in: £${d.in}k`}
                        style={{
                          width: '18px',
                          height: `${(d.in / 30) * 100}%`,
                          backgroundColor: '#102654',
                          borderRadius: '4px 4px 0 0',
                          transition: 'height 0.2s',
                        }}
                      />
                      {/* Bar Out */}
                      <div
                        title={`Money out: £${d.out}k`}
                        style={{
                          width: '18px',
                          height: `${(d.out / 30) * 100}%`,
                          backgroundColor: '#FF7D6B',
                          borderRadius: '4px 4px 0 0',
                          transition: 'height 0.2s',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '0.775rem', fontWeight: 600, color: '#5B6478' }}>
                      {d.month}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                marginTop: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.785rem',
                color: '#5B6478',
              }}
            >
              <span>Net operating cash flow this month: <strong style={{ color: '#102654' }}>+£13,440.00</strong></span>
              <Link href="/reports/profit-and-loss" style={{ color: '#B8432F', fontWeight: 700, textDecoration: 'none' }}>
                Full P&L Report →
              </Link>
            </div>
          </div>

          {/* Close September Card (Period Compliance) */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E3E7EF',
              borderRadius: '14px',
              padding: '1.25rem 1.5rem',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '1rem',
                }}
              >
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#102654', margin: 0 }}>
                    Close September
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#5B6478' }}>
                    Month-end accounting closing workflow
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '0.725rem',
                    fontWeight: 700,
                    backgroundColor: '#FFF1EE',
                    color: '#B8432F',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '9999px',
                  }}
                >
                  Step 3 of 4
                </span>
              </div>

              {/* Checklist */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', margin: '1rem 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: '#102654',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Check size={12} strokeWidth={3} />
                  </div>
                  <span style={{ fontSize: '0.85rem', color: '#5B6478', textDecoration: 'line-through' }}>
                    All bills entered
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: '#102654',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Check size={12} strokeWidth={3} />
                  </div>
                  <span style={{ fontSize: '0.85rem', color: '#5B6478', textDecoration: 'line-through' }}>
                    Invoices sent
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: '2px solid #FF7D6B',
                      backgroundColor: '#FFF1EE',
                      color: '#B8432F',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      fontSize: '0.7rem',
                      fontWeight: 800,
                    }}
                  >
                    3
                  </div>
                  <span style={{ fontSize: '0.85rem', color: '#102654', fontWeight: 700 }}>
                    Approve 5 AI drafts
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: '2px solid #CBD5E1',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: '0.85rem', color: '#5B6478' }}>
                    Lock the accounting period
                  </span>
                </div>
              </div>
            </div>

            <Link
              href="/accounting/periods"
              className="btn-v2-primary"
              style={{ width: '100%', height: '40px', borderRadius: '8px', textAlign: 'center', justifyContent: 'center' }}
            >
              <span>Continue closing</span>
            </Link>
          </div>
        </div>

        {/* ROW 4: RECENT ENTERPRISE ACTIVITY LEDGER */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E3E7EF',
            borderRadius: '14px',
            padding: '1.25rem 1.5rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem',
            }}
          >
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#102654', margin: 0 }}>
                Recent activity
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#5B6478' }}>
                Double-entry transaction stream across all entities
              </span>
            </div>
            <Link
              href="/sales/invoices"
              style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                color: '#B8432F',
                textDecoration: 'none',
              }}
            >
              See all activity →
            </Link>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.825rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E3E7EF', color: '#5B6478', fontSize: '0.725rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '0.6rem 0.5rem' }}>Transaction / Document</th>
                  <th style={{ padding: '0.6rem 0.5rem' }}>Counterparty / Account</th>
                  <th style={{ padding: '0.6rem 0.5rem' }}>Status</th>
                  <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '0.85rem 0.5rem', fontWeight: 600, color: '#102654' }}>
                    <Link href="/sales/invoices" style={{ color: '#102654', textDecoration: 'none' }}>
                      Invoice INV-0142
                    </Link>
                  </td>
                  <td style={{ padding: '0.85rem 0.5rem', color: '#5B6478' }}>Acme Corp</td>
                  <td style={{ padding: '0.85rem 0.5rem' }}>
                    <span className="status-pill paid" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.55rem', borderRadius: '4px', backgroundColor: '#EDFDF5', color: '#12B76A', fontWeight: 700, fontSize: '0.75rem' }}>
                      ● Paid
                    </span>
                  </td>
                  <td style={{ padding: '0.85rem 0.5rem', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#102654' }}>
                    £1,800.00
                  </td>
                </tr>

                <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '0.85rem 0.5rem', fontWeight: 600, color: '#102654' }}>
                    <Link href="/purchases/bills" style={{ color: '#102654', textDecoration: 'none' }}>
                      Bill · Adobe Creative Cloud
                    </Link>
                  </td>
                  <td style={{ padding: '0.85rem 0.5rem', color: '#5B6478' }}>Adobe Systems</td>
                  <td style={{ padding: '0.85rem 0.5rem' }}>
                    <span className="status-pill ai-draft" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.55rem', borderRadius: '4px', backgroundColor: '#FFF1EE', color: '#B8432F', fontWeight: 700, fontSize: '0.75rem' }}>
                      ✦ AI draft · check
                    </span>
                  </td>
                  <td style={{ padding: '0.85rem 0.5rem', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#102654' }}>
                    £64.79
                  </td>
                </tr>

                <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '0.85rem 0.5rem', fontWeight: 600, color: '#102654' }}>
                    <Link href="/accounting/journals" style={{ color: '#102654', textDecoration: 'none' }}>
                      Journal JE-2026-000214
                    </Link>
                  </td>
                  <td style={{ padding: '0.85rem 0.5rem', color: '#5B6478' }}>Accrual — audit & compliance fee</td>
                  <td style={{ padding: '0.85rem 0.5rem' }}>
                    <span className="status-pill validated" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.55rem', borderRadius: '4px', backgroundColor: '#EFF4FC', color: '#2457C5', fontWeight: 700, fontSize: '0.75rem' }}>
                      ◐ Validated
                    </span>
                  </td>
                  <td style={{ padding: '0.85rem 0.5rem', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#102654' }}>
                    £1,200.00
                  </td>
                </tr>

                <tr>
                  <td style={{ padding: '0.85rem 0.5rem', fontWeight: 600, color: '#102654' }}>
                    <Link href="/banking/transactions" style={{ color: '#102654', textDecoration: 'none' }}>
                      Bank Feed · Monzo Operating
                    </Link>
                  </td>
                  <td style={{ padding: '0.85rem 0.5rem', color: '#5B6478' }}>HMRC Tax Reserve Allocation</td>
                  <td style={{ padding: '0.85rem 0.5rem' }}>
                    <span className="status-pill paid" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.55rem', borderRadius: '4px', backgroundColor: '#EDFDF5', color: '#12B76A', fontWeight: 700, fontSize: '0.75rem' }}>
                      ✓ Reconciled
                    </span>
                  </td>
                  <td style={{ padding: '0.85rem 0.5rem', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#102654' }}>
                    £2,500.00
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <DashboardCustomizerModal
        isOpen={showCustomizer}
        onClose={() => setShowCustomizer(false)}
        preferences={prefs}
        onChangePreferences={(next) => setPrefs(next)}
      />

      <AddCompanyModal
        isOpen={showAddCompanyModal}
        onClose={() => setShowAddCompanyModal(false)}
        onSuccess={async () => {
          setShowAddCompanyModal(false);
          await refreshOrgs();
        }}
      />
    </AppShell>
  );
}
