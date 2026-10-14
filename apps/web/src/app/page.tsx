'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { Landmark, TrendingUp, TrendingDown, FileText, Plus, UserPlus, BookOpen, ArrowRight, Scale, Wallet } from 'lucide-react';

/**
 * Dashboard built only from the organisation's own posted figures.
 * (It previously showed hard-coded sample numbers to every user.)
 */

interface JournalEntry {
  id: string;
  journalNumber?: string;
  journalDate?: string;
  description: string;
  status: string;
  totalDebit: string | number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  contact?: { name: string };
  dueDate: string;
  totalAmount: string | number;
  status: string;
}

interface BsRow {
  accountSubtype: string | null;
  amount: string;
}

interface BalanceSheet {
  currentAssets: { accounts: BsRow[] };
  currentLiabilities: { accounts: BsRow[] };
}

interface ProfitAndLoss {
  startDate: string;
  endDate: string;
  revenue: { total: string };
  costOfSales: { total: string };
  operatingExpenses: { total: string };
  otherExpenses: { total: string };
  netProfit: string;
}

function sumSubtypes(rows: BsRow[], subtypes: string[]): number {
  return rows.filter((r) => r.accountSubtype && subtypes.includes(r.accountSubtype)).reduce((s, r) => s + Number(r.amount), 0);
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const { user, activeOrg } = useAuth();
  const currency = activeOrg?.baseCurrency ?? 'GBP';
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [bs, setBs] = useState<BalanceSheet | null>(null);
  const [pnl, setPnl] = useState<ProfitAndLoss | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!activeOrg) return;
      setLoading(true);
      try {
        // Each request is independent: a role without report access still sees its lists.
        const [journalsRes, invoicesRes, bsRes, pnlRes] = await Promise.allSettled([
          apiRequest<any>('/journals?pageSize=5'),
          apiRequest<any>('/invoices?pageSize=5'),
          apiRequest<BalanceSheet>('/reports/balance-sheet'),
          apiRequest<ProfitAndLoss>('/reports/profit-and-loss'),
        ]);
        setJournals(journalsRes.status === 'fulfilled' ? journalsRes.value?.items ?? [] : []);
        setInvoices(invoicesRes.status === 'fulfilled' ? invoicesRes.value?.items ?? [] : []);
        setBs(bsRes.status === 'fulfilled' ? bsRes.value : null);
        setPnl(pnlRes.status === 'fulfilled' ? pnlRes.value : null);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [activeOrg]);

  const cash = bs ? sumSubtypes(bs.currentAssets.accounts, ['BANK', 'CASH']) : null;
  const receivables = bs ? sumSubtypes(bs.currentAssets.accounts, ['ACCOUNTS_RECEIVABLE']) : null;
  const payables = bs ? sumSubtypes(bs.currentLiabilities.accounts, ['ACCOUNTS_PAYABLE']) : null;
  const income = pnl ? Number(pnl.revenue.total) : null;
  const expenses = pnl
    ? Number(pnl.costOfSales.total) + Number(pnl.operatingExpenses.total) + Number(pnl.otherExpenses.total)
    : null;
  const netProfit = pnl ? Number(pnl.netProfit) : null;

  const kpis = [
    { label: 'Cash & Bank', value: cash, icon: <Landmark size={15} />, bg: '#EFF6FF', fg: '#2563EB' },
    { label: 'Income (period)', value: income, icon: <TrendingUp size={15} />, bg: '#ECFDF5', fg: '#10B981' },
    { label: 'Expenses (period)', value: expenses, icon: <TrendingDown size={15} />, bg: '#FEF2F2', fg: '#EF4444' },
    { label: 'Net Profit (period)', value: netProfit, icon: <Scale size={15} />, bg: '#F5F3FF', fg: '#7C3AED' },
    { label: 'Owed to You', value: receivables, icon: <FileText size={15} />, bg: '#FFF7ED', fg: '#EA580C' },
    { label: 'You Owe', value: payables, icon: <Wallet size={15} />, bg: '#F0FDFA', fg: '#0D9488' },
  ];

  return (
    <AppShell>
      <div className="dashboard-canvas">
        <section className="hero-greeting-card">
          <div className="hero-wave-bg" />
          <div style={{ zIndex: 2 }}>
            <div className="hero-greeting-sub">
              {greeting()}
              {user?.firstName ? `, ${user.firstName}` : ''}
            </div>
            <h1 className="hero-greeting-title">Here&apos;s how your business is doing</h1>
            <p className="hero-greeting-desc">
              {pnl ? `Figures from posted entries, ${pnl.startDate} to ${pnl.endDate}.` : 'Figures from posted entries.'}
            </p>
          </div>

          <div className="hero-actions-grid">
            <Link href="/sales/invoices/new" className="btn-hero-primary">
              <Plus size={15} />
              <span>New Invoice</span>
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

        <section className="kpi-metrics-row">
          {kpis.map((k) => (
            <div className="kpi-metric-card" key={k.label}>
              <div className="kpi-header">
                <div className="kpi-icon-box" style={{ backgroundColor: k.bg, color: k.fg }}>
                  {k.icon}
                </div>
                <span className="kpi-label">{k.label}</span>
              </div>
              <div className="kpi-amount">
                {loading ? '…' : k.value === null ? '—' : formatMoney(k.value, currency)}
              </div>
            </div>
          ))}
        </section>

        <section className="dashboard-data-grid">
          <div className="data-panel-card">
            <div className="panel-header">
              <h3 className="panel-title">Recent Invoices</h3>
              <Link href="/sales/invoices" className="panel-link">
                View all <ArrowRight size={13} />
              </Link>
            </div>
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Due</th>
                  <th className="text-right">Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center" style={{ color: '#64748B', padding: '1.25rem' }}>
                      {loading ? 'Loading…' : 'No invoices yet.'}
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>
                        <Link href={`/sales/invoices/${inv.id}`}>{inv.invoiceNumber}</Link>
                      </td>
                      <td>{inv.contact?.name ?? '—'}</td>
                      <td>{inv.dueDate?.slice(0, 10)}</td>
                      <td className="text-right">{formatMoney(inv.totalAmount, currency)}</td>
                      <td>
                        <span className={`badge badge-${inv.status.toLowerCase()}`}>{inv.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="data-panel-card">
            <div className="panel-header">
              <h3 className="panel-title">Recent Journals</h3>
              <Link href="/accounting/journals" className="panel-link">
                View all <ArrowRight size={13} />
              </Link>
            </div>
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Journal</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th className="text-right">Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {journals.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center" style={{ color: '#64748B', padding: '1.25rem' }}>
                      {loading ? 'Loading…' : 'No journals yet.'}
                    </td>
                  </tr>
                ) : (
                  journals.map((j) => (
                    <tr key={j.id}>
                      <td>
                        <Link href={`/accounting/journals/${j.id}`}>{j.journalNumber ?? '—'}</Link>
                      </td>
                      <td>{j.journalDate?.slice(0, 10)}</td>
                      <td>{j.description}</td>
                      <td className="text-right">{formatMoney(j.totalDebit, currency)}</td>
                      <td>
                        <span className={`badge badge-${j.status.toLowerCase()}`}>{j.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
