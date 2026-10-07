'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';
import {
  Landmark,
  TrendingUp,
  TrendingDown,
  BarChart3,
  FileText,
  Calendar,
  Plus,
  CreditCard,
  Receipt,
  UserPlus,
  BookOpen,
  ArrowRight,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Info,
  Building,
  Monitor,
  Share2,
  Code,
} from 'lucide-react';

interface JournalEntry {
  id: string;
  journalNumber?: string;
  journalDate?: string;
  description: string;
  status: string;
  totalDebit: string | number;
  totalCredit: string | number;
  reference?: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  contact?: { name: string };
  dueDate: string;
  totalAmount: string | number;
  status: string;
}

// Cash Flow 12-month data points for interactive SVG chart
const CASH_FLOW_MONTHS = [
  { month: 'Jan', income: 5.2, expense: 2.1, net: 3.1 },
  { month: 'Feb', income: 6.8, expense: 2.3, net: 4.5 },
  { month: 'Mar', income: 8.5, expense: 2.8, net: 5.7 },
  { month: 'Apr', income: 7.9, expense: 3.1, net: 4.8 },
  { month: 'May', income: 9.4, expense: 3.4, net: 6.0 },
  { month: 'Jun', income: 10.2, expense: 4.2, net: 6.0 },
  { month: 'Jul', income: 11.5, expense: 4.8, net: 6.7 },
  { month: 'Aug', income: 12.1, expense: 5.3, net: 6.8 },
  { month: 'Sep', income: 13.0, expense: 6.0, net: 7.0 },
  { month: 'Oct', income: 12.8, expense: 6.5, net: 6.3 },
  { month: 'Nov', income: 14.2, expense: 7.4, net: 6.8 },
  { month: 'Dec', income: 15.6, expense: 8.2, net: 7.4 },
];

export default function DashboardPage() {
  const { user, activeOrg } = useAuth();
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState('This Year');

  const greetingName = user?.firstName || 'John';

  useEffect(() => {
    async function loadData() {
      if (!activeOrg) return;
      try {
        setLoading(true);
        const [journalsRes, invoicesRes] = await Promise.allSettled([
          apiRequest<any>('/journals'),
          apiRequest<any>('/invoices'),
        ]);

        if (journalsRes.status === 'fulfilled') {
          const list = Array.isArray(journalsRes.value) ? journalsRes.value : journalsRes.value?.items || [];
          setJournals(list);
        }
        if (invoicesRes.status === 'fulfilled') {
          const list = Array.isArray(invoicesRes.value) ? invoicesRes.value : invoicesRes.value?.items || [];
          setInvoices(list);
        }
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [activeOrg]);

  // SVG Chart Dimensions
  const chartHeight = 160;
  const chartWidth = 560;
  const maxVal = 18; // scale up to 18k

  const getY = (val: number) => chartHeight - (val / maxVal) * chartHeight;

  // Build smooth SVG path for the Net Cash line
  const netLinePath = useMemo(() => {
    return CASH_FLOW_MONTHS
      .map((m, idx) => {
        const x = 20 + idx * 46;
        const y = getY(m.net + 4); // offset for balance baseline
        return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  }, []);

  return (
    <AppShell>
      <div className="dashboard-canvas">
        {/* =========================================================
            1. HERO GREETING BANNER WITH QUICK ACTION BUTTONS
           ========================================================= */}
        <section className="hero-greeting-card">
          <div className="hero-wave-bg" />
          <div style={{ zIndex: 2 }}>
            <div className="hero-greeting-sub">Good morning, {greetingName}</div>
            <h1 className="hero-greeting-title">Here&apos;s how your business is doing</h1>
            <p className="hero-greeting-desc">
              A clear view of your finances, with everything you need in one place.
            </p>
          </div>

          {/* Quick Action Buttons Grid */}
          <div className="hero-actions-grid">
            <Link href="/sales/invoices/new" className="btn-hero-primary">
              <Plus size={15} />
              <span>New Invoice</span>
            </Link>
            <Link href="/sales/payments" className="btn-hero-white">
              <CreditCard size={14} style={{ color: '#2563EB' }} />
              <span>Record Payment</span>
            </Link>
            <Link href="/purchases/bills" className="btn-hero-white">
              <FileText size={14} style={{ color: '#2563EB' }} />
              <span>New Bill</span>
            </Link>
            <Link href="/purchases/expenses" className="btn-hero-white">
              <Receipt size={14} style={{ color: '#2563EB' }} />
              <span>New Expense</span>
            </Link>
            <Link href="/sales/contacts" className="btn-hero-white">
              <UserPlus size={14} style={{ color: '#2563EB' }} />
              <span>Add Contact</span>
            </Link>
            <Link href="/accounting/journals/new" className="btn-hero-white">
              <BookOpen size={14} style={{ color: '#2563EB' }} />
              <span>New Journal</span>
            </Link>
          </div>
        </section>

        {/* =========================================================
            2. SIX KPI METRIC CARDS ROW
           ========================================================= */}
        <section className="kpi-metrics-row">
          {/* Card 1: Cash Balance */}
          <div className="kpi-metric-card">
            <div className="kpi-header">
              <div className="kpi-icon-box" style={{ backgroundColor: '#EFF6FF', color: '#2563EB' }}>
                <Landmark size={15} />
              </div>
              <span className="kpi-label">Cash Balance</span>
            </div>
            <div className="kpi-amount">£24,320.50</div>
            <div className="kpi-trend up">
              <span>▲ +12%</span>
              <span className="kpi-trend-sub">vs last month</span>
            </div>
          </div>

          {/* Card 2: Income */}
          <div className="kpi-metric-card">
            <div className="kpi-header">
              <div className="kpi-icon-box" style={{ backgroundColor: '#ECFDF5', color: '#10B981' }}>
                <TrendingUp size={15} />
              </div>
              <span className="kpi-label">Income</span>
            </div>
            <div className="kpi-amount">£12,480.00</div>
            <div className="kpi-trend up">
              <span>▲ +8%</span>
              <span className="kpi-trend-sub">vs last month</span>
            </div>
          </div>

          {/* Card 3: Expenses */}
          <div className="kpi-metric-card">
            <div className="kpi-header">
              <div className="kpi-icon-box" style={{ backgroundColor: '#FEF2F2', color: '#EF4444' }}>
                <TrendingDown size={15} />
              </div>
              <span className="kpi-label">Expenses</span>
            </div>
            <div className="kpi-amount">£8,230.00</div>
            <div className="kpi-trend down-red">
              <span>▼ +5%</span>
              <span className="kpi-trend-sub">vs last month</span>
            </div>
          </div>

          {/* Card 4: Net Profit */}
          <div className="kpi-metric-card">
            <div className="kpi-header">
              <div className="kpi-icon-box" style={{ backgroundColor: '#EEF2FF', color: '#6366F1' }}>
                <BarChart3 size={15} />
              </div>
              <span className="kpi-label">Net Profit</span>
            </div>
            <div className="kpi-amount">£4,250.00</div>
            <div className="kpi-trend up">
              <span>▲ +18%</span>
              <span className="kpi-trend-sub">vs last month</span>
            </div>
          </div>

          {/* Card 5: Outstanding Invoices */}
          <div className="kpi-metric-card">
            <div className="kpi-header">
              <div className="kpi-icon-box" style={{ backgroundColor: '#FFF7ED', color: '#F97316' }}>
                <FileText size={15} />
              </div>
              <span className="kpi-label">Outstanding Invoices</span>
            </div>
            <div className="kpi-amount">£6,430.00</div>
            <div className="kpi-trend down-red">
              <span>▼ +15%</span>
              <span className="kpi-trend-sub">vs last month</span>
            </div>
          </div>

          {/* Card 6: Bills Due */}
          <div className="kpi-metric-card">
            <div className="kpi-header">
              <div className="kpi-icon-box" style={{ backgroundColor: '#FEF2F2', color: '#EF4444' }}>
                <Calendar size={15} />
              </div>
              <span className="kpi-label">Bills Due</span>
            </div>
            <div className="kpi-amount">£3,210.00</div>
            <div className="kpi-trend down-red">
              <span>▼ +22%</span>
              <span className="kpi-trend-sub">vs last month</span>
            </div>
          </div>
        </section>

        {/* =========================================================
            3. DUAL CHARTS GRID: CASH FLOW & INCOME VS EXPENSES
           ========================================================= */}
        <section className="dashboard-charts-grid">
          {/* Chart 1: Cash Flow (12 Months) */}
          <div className="chart-card-shell">
            <div className="chart-header">
              <div>
                <h2 className="chart-title">Cash Flow</h2>
                <div className="chart-subtitle">Money in and out over the last 12 months</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem', fontWeight: 600 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                  Income
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#FF705B' }} />
                  Expenses
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0D2357' }} />
                  Net Cash
                </span>
              </div>
            </div>

            {/* Cash Flow SVG Chart */}
            <div style={{ position: 'relative', width: '100%', height: '200px', marginTop: '0.5rem' }}>
              <svg width="100%" height="100%" viewBox="0 0 570 190" fill="none" style={{ overflow: 'visible' }}>
                {/* Horizontal grid lines */}
                {[0, 40, 80, 120, 160].map((y, i) => (
                  <g key={y}>
                    <line x1="30" y1={y} x2="560" y2={y} stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
                    <text x="22" y={y + 4} fill="#94A3B8" fontSize="9" textAnchor="end" fontFamily="sans-serif">
                      {['£15k', '£10k', '£5k', '£0', '-£5k'][i]}
                    </text>
                  </g>
                ))}

                {/* Vertical Bar Pairs (Income green, Expense coral) */}
                {CASH_FLOW_MONTHS.map((m, idx) => {
                  const x = 40 + idx * 43;
                  const incomeH = (m.income / maxVal) * 120;
                  const expenseH = (m.expense / maxVal) * 120;
                  const baseZero = 120;

                  return (
                    <g key={m.month}>
                      {/* Income Bar (Green) */}
                      <rect
                        x={x - 8}
                        y={baseZero - incomeH}
                        width="7"
                        height={incomeH}
                        rx="3"
                        fill="#10B981"
                      />
                      {/* Expense Bar (Coral) */}
                      <rect
                        x={x + 1}
                        y={baseZero - expenseH}
                        width="7"
                        height={expenseH}
                        rx="3"
                        fill="#FF705B"
                      />
                      {/* Month Label */}
                      <text x={x} y="180" fill="#64748B" fontSize="10" textAnchor="middle" fontWeight="500">
                        {m.month}
                      </text>
                    </g>
                  );
                })}

                {/* Spline line for Net Cash */}
                <path
                  d={netLinePath}
                  fill="none"
                  stroke="#0D2357"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Spline circle points */}
                {CASH_FLOW_MONTHS.map((m, idx) => {
                  const x = 20 + idx * 46;
                  const y = getY(m.net + 4);
                  return (
                    <circle
                      key={`pt-${idx}`}
                      cx={x}
                      cy={y}
                      r="3.5"
                      fill="#FFFFFF"
                      stroke="#0D2357"
                      strokeWidth="2"
                    />
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Chart 2: Income vs Expenses (Donut Chart) */}
          <div className="chart-card-shell">
            <div className="chart-header">
              <div>
                <h2 className="chart-title">Income vs Expenses</h2>
                <div className="chart-subtitle">This financial year</div>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#475569',
                  border: '1px solid #E2E8F0',
                  padding: '0.25rem 0.6rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                <span>{yearFilter}</span>
                <ChevronDown size={13} style={{ color: '#94A3B8' }} />
              </div>
            </div>

            {/* Donut Chart SVG */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', height: '170px' }}>
              <svg width="150" height="150" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                {/* Background Ring */}
                <circle cx="50" cy="50" r="38" fill="transparent" stroke="#F1F5F9" strokeWidth="13" />
                {/* Green Segment (60% Income) */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#10B981"
                  strokeWidth="13"
                  strokeDasharray="143 238"
                  strokeDashoffset="0"
                  strokeLinecap="round"
                />
                {/* Coral Segment (40% Expenses) */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#FF705B"
                  strokeWidth="13"
                  strokeDasharray="95 238"
                  strokeDashoffset="-143"
                  strokeLinecap="round"
                />
              </svg>

              {/* Inside Donut Center Hole */}
              <div
                style={{
                  position: 'absolute',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                }}
              >
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.03em' }}>
                  £4,250
                </span>
                <span style={{ fontSize: '0.675rem', fontWeight: 600, color: '#64748B' }}>
                  Net Profit
                </span>
              </div>
            </div>

            {/* Donut Legend */}
            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '0.5rem', borderTop: '1px solid #F8FAFC', paddingTop: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                <div>
                  <div style={{ fontSize: '0.725rem', color: '#64748B' }}>Income</div>
                  <div style={{ fontSize: '0.825rem', fontWeight: 700, color: '#0F172A' }}>£12,480 <span style={{ color: '#94A3B8', fontWeight: 400 }}>60%</span></div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#FF705B' }} />
                <div>
                  <div style={{ fontSize: '0.725rem', color: '#64748B' }}>Expenses</div>
                  <div style={{ fontSize: '0.825rem', fontWeight: 700, color: '#0F172A' }}>£8,230 <span style={{ color: '#94A3B8', fontWeight: 400 }}>40%</span></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            4. THREE BOTTOM DATA COLUMNS
           ========================================================= */}
        <section className="dashboard-data-grid">
          {/* Column 1: Recent Transactions */}
          <div className="data-panel-card">
            <div className="panel-header">
              <h3 className="panel-title">Recent Transactions</h3>
              <Link href="/accounting/journals" className="panel-link">
                View all <ArrowRight size={12} />
              </Link>
            </div>
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ color: '#64748B' }}>12 Dec 2024</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600 }}>
                      <span style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#ECFDF5', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CheckCircle2 size={11} />
                      </span>
                      Payment from ABC Ltd
                    </div>
                  </td>
                  <td style={{ color: '#64748B' }}>Payment</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#10B981' }}>+£1,200.00</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="pill-status pill-received">Received</span>
                  </td>
                </tr>
                <tr>
                  <td style={{ color: '#64748B' }}>11 Dec 2024</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600 }}>
                      <span style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#FEF2F2', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Receipt size={11} />
                      </span>
                      Office Supplies
                    </div>
                  </td>
                  <td style={{ color: '#64748B' }}>Expense</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#EF4444' }}>-£85.00</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="pill-status pill-posted">Posted</span>
                  </td>
                </tr>
                <tr>
                  <td style={{ color: '#64748B' }}>10 Dec 2024</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600 }}>
                      <span style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FileText size={11} />
                      </span>
                      Invoice INV-2024-015
                    </div>
                  </td>
                  <td style={{ color: '#64748B' }}>Invoice</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#10B981' }}>+£2,400.00</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="pill-status pill-sent">Sent</span>
                  </td>
                </tr>
                <tr>
                  <td style={{ color: '#64748B' }}>09 Dec 2024</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600 }}>
                      <span style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#EEF2FF', color: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Building size={11} />
                      </span>
                      Supplier Bill - TechCo
                    </div>
                  </td>
                  <td style={{ color: '#64748B' }}>Bill</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#EF4444' }}>-£640.00</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="pill-status pill-posted">Posted</span>
                  </td>
                </tr>
                <tr>
                  <td style={{ color: '#64748B' }}>08 Dec 2024</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600 }}>
                      <span style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#E0F2FE', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CreditCard size={11} />
                      </span>
                      Bank Transfer
                    </div>
                  </td>
                  <td style={{ color: '#64748B' }}>Transfer</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#EF4444' }}>-£500.00</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="pill-status pill-posted">Posted</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Column 2: Outstanding Invoices */}
          <div className="data-panel-card">
            <div className="panel-header">
              <h3 className="panel-title">Outstanding Invoices</h3>
              <Link href="/sales/invoices" className="panel-link">
                View all <ArrowRight size={12} />
              </Link>
            </div>
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Due Date</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 600, color: '#2563EB' }}>INV-2024-015</td>
                  <td style={{ color: '#475569' }}>ABC Ltd</td>
                  <td style={{ color: '#64748B' }}>18 Dec 2024</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>£2,400.00</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="pill-status pill-overdue">Overdue</span>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600, color: '#2563EB' }}>INV-2024-014</td>
                  <td style={{ color: '#475569' }}>Smith &amp; Co</td>
                  <td style={{ color: '#64748B' }}>22 Dec 2024</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>£1,200.00</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="pill-status pill-duesoon">Due Soon</span>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600, color: '#2563EB' }}>INV-2024-013</td>
                  <td style={{ color: '#475569' }}>Global Media</td>
                  <td style={{ color: '#64748B' }}>28 Dec 2024</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>£850.00</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="pill-status pill-sent">Sent</span>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600, color: '#2563EB' }}>INV-2024-012</td>
                  <td style={{ color: '#475569' }}>Tech Solutions</td>
                  <td style={{ color: '#64748B' }}>02 Jan 2025</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>£1,980.00</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="pill-status pill-sent">Sent</span>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600, color: '#2563EB' }}>INV-2024-011</td>
                  <td style={{ color: '#475569' }}>Bright Ideas</td>
                  <td style={{ color: '#64748B' }}>05 Jan 2025</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>£2,500.00</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="pill-status pill-sent">Sent</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Column 3: Bills Due */}
          <div className="data-panel-card">
            <div className="panel-header">
              <h3 className="panel-title">Bills Due</h3>
              <Link href="/purchases/bills" className="panel-link">
                View all <ArrowRight size={12} />
              </Link>
            </div>
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Due Date</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600 }}>
                      <span style={{ width: '18px', height: '18px', borderRadius: '4px', backgroundColor: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Monitor size={11} />
                      </span>
                      TechCo
                    </div>
                  </td>
                  <td style={{ color: '#64748B' }}>15 Dec 2024</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>£640.00</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="pill-status pill-overdue">Overdue</span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600 }}>
                      <span style={{ width: '18px', height: '18px', borderRadius: '4px', backgroundColor: '#F8FAFC', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Building size={11} />
                      </span>
                      OfficeMart
                    </div>
                  </td>
                  <td style={{ color: '#64748B' }}>20 Dec 2024</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>£120.00</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="pill-status pill-duesoon">Due Soon</span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600 }}>
                      <span style={{ width: '18px', height: '18px', borderRadius: '4px', backgroundColor: '#FEF2F2', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Share2 size={11} />
                      </span>
                      Cloud Services
                    </div>
                  </td>
                  <td style={{ color: '#64748B' }}>25 Dec 2024</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>£250.00</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="pill-status pill-duesoon">Due Soon</span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600 }}>
                      <span style={{ width: '18px', height: '18px', borderRadius: '4px', backgroundColor: '#EEF2FF', color: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Share2 size={11} />
                      </span>
                      Marketing Hub
                    </div>
                  </td>
                  <td style={{ color: '#64748B' }}>02 Jan 2025</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>£480.00</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="pill-status pill-upcoming">Upcoming</span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600 }}>
                      <span style={{ width: '18px', height: '18px', borderRadius: '4px', backgroundColor: '#F1F5F9', color: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Code size={11} />
                      </span>
                      Software Ltd
                    </div>
                  </td>
                  <td style={{ color: '#64748B' }}>05 Jan 2025</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>£960.00</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="pill-status pill-upcoming">Upcoming</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* =========================================================
            5. FINANCIAL ALERTS FOOTER BANNER
           ========================================================= */}
        <section className="financial-alerts-card">
          <div className="alerts-header">
            <div className="alerts-title-wrap">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#FEF2F2', color: '#FF5A43' }}>
                <AlertTriangle size={15} />
              </div>
              <h3 className="alerts-title">Financial Alerts</h3>
              <span className="alerts-count-badge">3</span>
            </div>
            <Link href="/reports/trial-balance" className="panel-link">
              View all alerts <ArrowRight size={12} />
            </Link>
          </div>

          <div className="alerts-grid">
            {/* Alert 1 */}
            <Link href="/sales/invoices" className="alert-item-box">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#FEF2F2', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingDown size={16} />
                </span>
                <div>
                  <div style={{ fontSize: '0.825rem', fontWeight: 700, color: '#0F172A' }}>
                    3 invoices are overdue
                  </div>
                  <div style={{ fontSize: '0.725rem', color: '#64748B' }}>
                    Total value £4,320.00
                  </div>
                </div>
              </div>
              <ArrowRight size={14} style={{ color: '#94A3B8' }} />
            </Link>

            {/* Alert 2 */}
            <Link href="/purchases/bills" className="alert-item-box">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#FFFBEB', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Calendar size={16} />
                </span>
                <div>
                  <div style={{ fontSize: '0.825rem', fontWeight: 700, color: '#0F172A' }}>
                    2 bills due within 7 days
                  </div>
                  <div style={{ fontSize: '0.725rem', color: '#64748B' }}>
                    Total value £760.00
                  </div>
                </div>
              </div>
              <ArrowRight size={14} style={{ color: '#94A3B8' }} />
            </Link>

            {/* Alert 3 */}
            <Link href="/reports/vat" className="alert-item-box">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Info size={16} />
                </span>
                <div>
                  <div style={{ fontSize: '0.825rem', fontWeight: 700, color: '#0F172A' }}>
                    VAT return due in 14 days
                  </div>
                  <div style={{ fontSize: '0.725rem', color: '#64748B' }}>
                    Period ends 31 Dec 2024
                  </div>
                </div>
              </div>
              <ArrowRight size={14} style={{ color: '#94A3B8' }} />
            </Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
