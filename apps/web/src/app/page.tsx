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
  Shield,
  Briefcase,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Scale,
  Calendar,
  BarChart3,
  PieChart,
  Activity,
  Layers,
  Percent,
} from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';
import { formatMoney } from '@/lib/money-format';
import {
  DashboardCustomizerModal,
  DashboardPreferences,
  DEFAULT_DASHBOARD_PREFERENCES,
} from '@/components/dashboard/dashboard-customizer-modal';
import { AddCompanyModal } from '@/components/organization/add-company-modal';

interface AttentionItem {
  id: string;
  tone: 'ai' | 'danger' | 'warning' | 'info';
  title: string;
  detail: string;
  action: string;
  href: string;
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

  const [prefs, setPrefs] = useState<DashboardPreferences>(DEFAULT_DASHBOARD_PREFERENCES);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [chartRange, setChartRange] = useState<'30d' | '90d' | '6m' | '12m'>('6m');
  const [activeBarHover, setActiveBarHover] = useState<number | null>(null);

  // Dynamic user greeting
  const firstName = user?.firstName?.trim() || 'Alice';
  const hour = new Date().getHours();
  const greetingText = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateLine = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  // 4 Priority Attention Workflows
  const attentionItems: AttentionItem[] = [
    {
      id: 'ai-bills',
      tone: 'ai',
      title: '5 bills drafted by AI are ready to check',
      detail: 'Nothing posts until you approve · 4 high confidence, 1 needs a look',
      action: 'Review 5',
      href: '/purchases/review',
    },
    {
      id: 'overdue-invoices',
      tone: 'danger',
      title: '2 invoices are overdue — £4,320.00',
      detail: 'Northwind Ltd (12 days) · Acme Corp (4 days)',
      action: 'Send reminders',
      href: '/sales/invoices',
    },
    {
      id: 'bank-lines',
      tone: 'info',
      title: '12 bank lines to confirm',
      detail: '10 already matched — one tap each',
      action: 'Confirm',
      href: '/banking/transactions',
    },
    {
      id: 'vat-return',
      tone: 'warning',
      title: 'VAT return due in 18 days',
      detail: 'Q3 · estimate £6,140.00 · already set aside below',
      action: 'Prepare',
      href: '/reports/vat',
    },
  ];

  // 6-Month Real Trend Figures with Margin and Net Delta
  const trendData = [
    { month: 'May', in: 18.5, out: 12.0, margin: 35, net: 6.5, balance: 34.2 },
    { month: 'Jun', in: 22.0, out: 13.5, margin: 38, net: 8.5, balance: 38.6 },
    { month: 'Jul', in: 19.5, out: 11.0, margin: 43, net: 8.5, balance: 41.2 },
    { month: 'Aug', in: 23.5, out: 14.2, margin: 39, net: 9.3, balance: 44.5 },
    { month: 'Sep', in: 25.0, out: 14.8, margin: 41, net: 10.2, balance: 46.8 },
    { month: 'Oct', in: 24.86, out: 11.42, margin: 54, net: 13.44, balance: 48.21 },
  ];

  // Aging distribution for Accounts Receivable & Accounts Payable
  const arAging = [
    { label: 'Current', amount: 12430, pct: 66, color: '#102654' },
    { label: '1-30d', amount: 2000, pct: 11, color: '#2563EB' },
    { label: '31-60d', amount: 1850, pct: 10, color: '#F59E0B' },
    { label: '61-90d', amount: 1150, pct: 6, color: '#EF4444' },
    { label: '90d+', amount: 1320, pct: 7, color: '#B91C1C' },
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
                    4 action items
                  </span>
                </div>
                <span style={{ color: '#5B6478', fontSize: '0.8rem', fontWeight: 500 }}>
                  9 of 13 done this week
                </span>
              </div>

              {/* Items List */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {attentionItems.map((item, idx) => {
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
                        borderBottom: idx === attentionItems.length - 1 ? 'none' : '1px solid #F1F5F9',
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

              {/* Liquidity Waterfall Bridge */}
              <div
                style={{
                  marginTop: '1.15rem',
                  paddingTop: '0.9rem',
                  borderTop: '1px solid rgba(255, 255, 255, 0.12)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
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
                marginTop: '1.15rem',
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

        {/* ROW 2: 4 EXECUTIVE KPI CARDS WITH FINANCIAL SPARKLINE CHARTS */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1rem',
          }}
        >
          {/* Card 1: Revenue with Sparkline */}
          <div
            className="kpi-card"
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E3E7EF',
              borderRadius: '12px',
              padding: '1.15rem 1.25rem',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#5B6478' }}>
                  Income · Oct to date
                </span>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#12B76A', backgroundColor: '#EDFDF5', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                  +12%
                </span>
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
            </div>

            {/* SVG Sparkline (Upward Revenue Curve) */}
            <div style={{ marginTop: '0.65rem' }}>
              <svg viewBox="0 0 100 24" style={{ width: '100%', height: '24px', overflow: 'visible' }}>
                <polyline
                  fill="none"
                  stroke="#12B76A"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points="0,18 20,16 40,17 60,11 80,8 100,2"
                />
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.725rem', color: '#5B6478', marginTop: '0.2rem' }}>
                <span>May: £18.5k</span>
                <span style={{ fontWeight: 700, color: '#12B76A' }}>Oct: £24.86k</span>
              </div>
            </div>
          </div>

          {/* Card 2: Spending with Controlled Cost Curve */}
          <div
            className="kpi-card"
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E3E7EF',
              borderRadius: '12px',
              padding: '1.15rem 1.25rem',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#5B6478' }}>
                  Spending · Oct to date
                </span>
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#5B6478', backgroundColor: '#F1F5F9', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                  Controlled
                </span>
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
            </div>

            {/* SVG Sparkline (Flat / Controlled Spending Curve) */}
            <div style={{ marginTop: '0.65rem' }}>
              <svg viewBox="0 0 100 24" style={{ width: '100%', height: '24px', overflow: 'visible' }}>
                <polyline
                  fill="none"
                  stroke="#64748B"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points="0,12 20,10 40,14 60,9 80,7 100,10"
                />
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.725rem', color: '#5B6478', marginTop: '0.2rem' }}>
                <span>Avg: £12.8k/mo</span>
                <span style={{ fontWeight: 600 }}>Burn: Low</span>
              </div>
            </div>
          </div>

          {/* Card 3: Operating Profit & Margin Gauge */}
          <div
            className="kpi-card"
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E3E7EF',
              borderRadius: '12px',
              padding: '1.15rem 1.25rem',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#5B6478' }}>
                  Profit · Oct to date
                </span>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#102654', backgroundColor: '#EFF4FC', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                  54% margin
                </span>
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
            </div>

            {/* SVG Sparkline (Net Margin Expansion) */}
            <div style={{ marginTop: '0.65rem' }}>
              <svg viewBox="0 0 100 24" style={{ width: '100%', height: '24px', overflow: 'visible' }}>
                <polyline
                  fill="none"
                  stroke="#FF7D6B"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points="0,19 20,14 40,13 60,10 80,7 100,2"
                />
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.725rem', color: '#5B6478', marginTop: '0.2rem' }}>
                <span>EBITDA: £14.2k</span>
                <span style={{ fontWeight: 700, color: '#FF7D6B' }}>54.1% Net</span>
              </div>
            </div>
          </div>

          {/* Card 4: Customers Owe You with Aging Breakdown */}
          <div
            className="kpi-card"
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E3E7EF',
              borderRadius: '12px',
              padding: '1.15rem 1.25rem',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#5B6478' }}>
                  Customers owe you (AR)
                </span>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#D92D20', backgroundColor: '#FEE4E2', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                  ! £4.32k late
                </span>
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
            </div>

            {/* Mini Segmented Aging Bar */}
            <div style={{ marginTop: '0.65rem' }}>
              <div style={{ height: '7px', display: 'flex', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: '66%', backgroundColor: '#102654' }} title="Current: £12,430 (66%)" />
                <div style={{ width: '11%', backgroundColor: '#2563EB' }} title="1-30d: £2,000 (11%)" />
                <div style={{ width: '10%', backgroundColor: '#F59E0B' }} title="31-60d: £1,850 (10%)" />
                <div style={{ width: '13%', backgroundColor: '#EF4444' }} title="60d+: £2,470 (13%)" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.725rem', color: '#5B6478', marginTop: '0.35rem' }}>
                <span>66% current</span>
                <span style={{ color: '#D92D20', fontWeight: 700 }}>DSO: 28 days</span>
              </div>
            </div>
          </div>
        </div>

        {/* ROW 3: DUAL INTERACTIVE VISUAL CHARTS (Cash Flow Trend + Balance Sheet Liquidity) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.85fr) minmax(320px, 1.15fr)',
            gap: '1.5rem',
            alignItems: 'stretch',
          }}
        >
          {/* Chart 1: Money in vs money out (Interactive SVG Dual Bar & Trend Curve) */}
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
                    Monthly Cash Flow & Operating Margin
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#5B6478' }}>
                    Revenue (Money in) vs Expenses (Money out) with cash balance trajectory
                  </span>
                </div>

                {/* Range Selector & Legend */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', fontSize: '0.785rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#102654' }} />
                      <span style={{ color: '#5B6478', fontWeight: 600 }}>Money in</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#FF7D6B' }} />
                      <span style={{ color: '#5B6478', fontWeight: 600 }}>Money out</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ width: '14px', height: '2px', backgroundColor: '#12B76A' }} />
                      <span style={{ color: '#5B6478', fontWeight: 600 }}>Net Cash</span>
                    </div>
                  </div>

                  <div style={{ display: 'inline-flex', backgroundColor: '#F1F5F9', padding: '2px', borderRadius: '6px' }}>
                    {(['30d', '90d', '6m', '12m'] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setChartRange(r)}
                        style={{
                          padding: '0.2rem 0.5rem',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '0.725rem',
                          fontWeight: chartRange === r ? 700 : 500,
                          backgroundColor: chartRange === r ? '#FFFFFF' : 'transparent',
                          color: chartRange === r ? '#102654' : '#64748B',
                          boxShadow: chartRange === r ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                          cursor: 'pointer',
                        }}
                      >
                        {r.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Chart Visual Surface with Dual Bars & Axis */}
              <div
                style={{
                  height: '210px',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'space-between',
                  gap: '1.25rem',
                  paddingTop: '1.25rem',
                  borderBottom: '1px solid #E3E7EF',
                  position: 'relative',
                }}
              >
                {/* Horizontal Guide Lines */}
                <div style={{ position: 'absolute', top: '25%', left: 0, right: 0, borderTop: '1px dashed #F1F5F9' }} />
                <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, borderTop: '1px dashed #F1F5F9' }} />
                <div style={{ position: 'absolute', top: '75%', left: 0, right: 0, borderTop: '1px dashed #F1F5F9' }} />

                {trendData.map((d, i) => {
                  const isHovered = activeBarHover === i;
                  return (
                    <div
                      key={d.month}
                      onMouseEnter={() => setActiveBarHover(i)}
                      onMouseLeave={() => setActiveBarHover(null)}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.45rem',
                        height: '100%',
                        justifyContent: 'flex-end',
                        cursor: 'pointer',
                        position: 'relative',
                      }}
                    >
                      {/* Floating Tooltip on Hover */}
                      {isHovered && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '105%',
                            backgroundColor: '#0B1B3D',
                            color: '#FFFFFF',
                            padding: '0.45rem 0.65rem',
                            borderRadius: '6px',
                            fontSize: '0.725rem',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
                            zIndex: 10,
                            pointerEvents: 'none',
                          }}
                        >
                          <div style={{ fontWeight: 700, marginBottom: '2px' }}>{d.month} 2026</div>
                          <div style={{ color: '#C9D2E6' }}>In: £{d.in}k · Out: £{d.out}k</div>
                          <div style={{ color: '#4ADE80', fontWeight: 700 }}>Net: +£{d.net}k ({d.margin}% margin)</div>
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '160px' }}>
                        {/* Bar In */}
                        <div
                          style={{
                            width: '20px',
                            height: `${(d.in / 30) * 100}%`,
                            backgroundColor: isHovered ? '#1E3A8A' : '#102654',
                            borderRadius: '4px 4px 0 0',
                            transition: 'all 0.15s ease',
                          }}
                        />
                        {/* Bar Out */}
                        <div
                          style={{
                            width: '20px',
                            height: `${(d.out / 30) * 100}%`,
                            backgroundColor: isHovered ? '#FF947F' : '#FF7D6B',
                            borderRadius: '4px 4px 0 0',
                            transition: 'all 0.15s ease',
                          }}
                        />
                      </div>

                      <span style={{ fontSize: '0.775rem', fontWeight: isHovered ? 800 : 600, color: isHovered ? '#102654' : '#5B6478' }}>
                        {d.month}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              style={{
                marginTop: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.8rem',
                color: '#5B6478',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <span>
                Net operating cash surplus: <strong style={{ color: '#102654', fontFamily: 'JetBrains Mono, monospace' }}>+£13,440.00</strong> (54.1% EBITDA margin)
              </span>
              <Link href="/reports/profit-and-loss" style={{ color: '#B8432F', fontWeight: 700, textDecoration: 'none' }}>
                Full P&L Report →
              </Link>
            </div>
          </div>

          {/* Chart 2: Working Capital & Liquidity Ratios (Accountant Grade) */}
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#102654', margin: 0 }}>
                    Liquidity & Working Capital
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#5B6478' }}>
                    Solvency health & balance sheet ratios
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    backgroundColor: '#EDFDF5',
                    color: '#12B76A',
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                    border: '1px solid #A6F4C5',
                  }}
                >
                  Grade: A+ Strong
                </span>
              </div>

              {/* Ratios Matrix */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.75rem',
                  padding: '0.85rem',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.725rem', color: '#64748B', fontWeight: 600 }}>Current Ratio</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#102654', fontFamily: 'JetBrains Mono, monospace' }}>
                    2.42x
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#12B76A', fontWeight: 600 }}>Target: &gt; 1.5x</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.725rem', color: '#64748B', fontWeight: 600 }}>Quick Ratio (Acid)</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#102654', fontFamily: 'JetBrains Mono, monospace' }}>
                    1.85x
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#12B76A', fontWeight: 600 }}>Target: &gt; 1.0x</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.725rem', color: '#64748B', fontWeight: 600 }}>Days Sales Out (DSO)</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#102654', fontFamily: 'JetBrains Mono, monospace' }}>
                    28 days
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#12B76A', fontWeight: 600 }}>-3 days vs Q2</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.725rem', color: '#64748B', fontWeight: 600 }}>Working Capital</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#102654', fontFamily: 'JetBrains Mono, monospace' }}>
                    £38.3k
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#12B76A', fontWeight: 600 }}>Surplus buffer</div>
                </div>
              </div>

              {/* Accounts Receivable Aging Breakdown Bar */}
              <div style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: '#102654', marginBottom: '0.35rem' }}>
                  <span>AR Aging Distribution (£18,750)</span>
                  <span style={{ color: '#B8432F' }}>77% within 30d</span>
                </div>
                <div style={{ height: '8px', display: 'flex', borderRadius: '4px', overflow: 'hidden' }}>
                  {arAging.map((tier) => (
                    <div
                      key={tier.label}
                      style={{ width: `${tier.pct}%`, backgroundColor: tier.color }}
                      title={`${tier.label}: £${tier.amount.toLocaleString()} (${tier.pct}%)`}
                    />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.675rem', color: '#64748B', marginTop: '0.35rem' }}>
                  <span>Current: £12.4k</span>
                  <span>1-30d: £2.0k</span>
                  <span>31-60d: £1.8k</span>
                  <span style={{ color: '#D92D20', fontWeight: 700 }}>60d+: £2.5k</span>
                </div>
              </div>
            </div>

            <Link
              href="/reports/balance-sheet"
              className="btn-v2-secondary"
              style={{ width: '100%', height: '36px', borderRadius: '8px', marginTop: '1rem', justifyContent: 'center' }}
            >
              <span>View Balance Sheet Statement →</span>
            </Link>
          </div>
        </div>

        {/* ROW 4: CLOSE SEPTEMBER COMPLIANCE & VAT RESERVE MODULE */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.5rem',
            alignItems: 'stretch',
          }}
        >
          {/* Close September Period Lock Checklist */}
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', margin: '0.85rem 0' }}>
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

          {/* Tax & HMRC VAT Reserve Projection */}
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#102654', margin: 0 }}>
                    Tax & VAT Provision
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#5B6478' }}>
                    Q3 MTD return due in 18 days
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    backgroundColor: '#FEF8EC',
                    color: '#8A5A00',
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                  }}
                >
                  Estimate: £6,140
                </span>
              </div>

              {/* Tax Provision Status */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', margin: '0.85rem 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem' }}>
                  <span style={{ color: '#5B6478' }}>Output VAT (Collected on sales)</span>
                  <span style={{ fontWeight: 700, color: '#102654', fontFamily: 'JetBrains Mono, monospace' }}>£8,420.00</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem' }}>
                  <span style={{ color: '#5B6478' }}>Input VAT (Reclaimable on expenses)</span>
                  <span style={{ fontWeight: 700, color: '#12B76A', fontFamily: 'JetBrains Mono, monospace' }}>-£2,280.00</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', paddingTop: '0.5rem', borderTop: '1px solid #F1F5F9' }}>
                  <span style={{ fontWeight: 700, color: '#102654' }}>Net Payable to HMRC</span>
                  <span style={{ fontWeight: 800, color: '#B8432F', fontFamily: 'JetBrains Mono, monospace' }}>£6,140.00</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.785rem', color: '#12B76A', fontWeight: 600 }}>
                  <span>✓ Covered in Tax Reserve Account</span>
                  <span>£7,500.00 set aside</span>
                </div>
              </div>
            </div>

            <Link
              href="/reports/vat"
              className="btn-v2-secondary"
              style={{ width: '100%', height: '40px', borderRadius: '8px', textAlign: 'center', justifyContent: 'center' }}
            >
              <span>View 9-Box VAT Return →</span>
            </Link>
          </div>
        </div>

        {/* ROW 5: RECENT ACTIVITY LEDGER */}
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
