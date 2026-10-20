'use client';

import React from 'react';
import {
  SlidersHorizontal,
  Check,
  X,
  RotateCcw,
  Sparkles,
  Landmark,
  TrendingUp,
  TrendingDown,
  BarChart3,
  FileText,
  Calendar,
  CheckCircle2,
  PieChart,
  ArrowRightLeft,
  Zap,
} from 'lucide-react';

export interface DashboardPreferences {
  quickActions: boolean;
  kpiCash: boolean;
  kpiIncome: boolean;
  kpiExpenses: boolean;
  kpiProfit: boolean;
  kpiInvoices: boolean;
  kpiBills: boolean;
  chartCashFlow: boolean;
  chartIncomeExpenses: boolean;
  tableTransactions: boolean;
  tableInvoices: boolean;
  tableBills: boolean;
}

export const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferences = {
  quickActions: true,
  kpiCash: true,
  kpiIncome: true,
  kpiExpenses: true,
  kpiProfit: true,
  kpiInvoices: true,
  kpiBills: true,
  chartCashFlow: true,
  chartIncomeExpenses: true,
  tableTransactions: true,
  tableInvoices: true,
  tableBills: true,
};

interface DashboardCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: DashboardPreferences;
  onChangePreferences: (prefs: DashboardPreferences) => void;
}

export function DashboardCustomizerModal({
  isOpen,
  onClose,
  preferences,
  onChangePreferences,
}: DashboardCustomizerModalProps) {
  if (!isOpen) return null;

  const toggleKey = (key: keyof DashboardPreferences) => {
    onChangePreferences({
      ...preferences,
      [key]: !preferences[key],
    });
  };

  const applyPreset = (preset: 'ALL' | 'EXECUTIVE' | 'OPERATIONS' | 'MINIMAL') => {
    if (preset === 'ALL') {
      onChangePreferences(DEFAULT_DASHBOARD_PREFERENCES);
    } else if (preset === 'EXECUTIVE') {
      onChangePreferences({
        quickActions: true,
        kpiCash: true,
        kpiIncome: true,
        kpiExpenses: true,
        kpiProfit: true,
        kpiInvoices: false,
        kpiBills: false,
        chartCashFlow: true,
        chartIncomeExpenses: true,
        tableTransactions: false,
        tableInvoices: false,
        tableBills: false,
      });
    } else if (preset === 'OPERATIONS') {
      onChangePreferences({
        quickActions: true,
        kpiCash: true,
        kpiIncome: false,
        kpiExpenses: false,
        kpiProfit: false,
        kpiInvoices: true,
        kpiBills: true,
        chartCashFlow: false,
        chartIncomeExpenses: false,
        tableTransactions: true,
        tableInvoices: true,
        tableBills: true,
      });
    } else if (preset === 'MINIMAL') {
      onChangePreferences({
        quickActions: false,
        kpiCash: true,
        kpiIncome: true,
        kpiExpenses: true,
        kpiProfit: true,
        kpiInvoices: false,
        kpiBills: false,
        chartCashFlow: false,
        chartIncomeExpenses: false,
        tableTransactions: false,
        tableInvoices: false,
        tableBills: false,
      });
    }
  };

  const totalWidgets = Object.keys(preferences).length;
  const activeCount = Object.values(preferences).filter(Boolean).length;

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
          maxWidth: '720px',
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
              <SlidersHorizontal size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                Customize Your Dashboard
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.15rem 0 0 0' }}>
                Tick or untick cards to customize what displays on your finance home screen.
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

        {/* Preset Bar */}
        <div
          style={{
            padding: '0.75rem 1.75rem',
            backgroundColor: 'var(--bg-app)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--ink-2)', fontWeight: 600 }}>
            Active Widgets: <strong style={{ color: 'var(--text-main)' }}>{activeCount}</strong> of {totalWidgets}
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', alignSelf: 'center', marginRight: '0.25rem' }}>
              Presets:
            </span>
            <button
              onClick={() => applyPreset('ALL')}
              style={{
                padding: '0.25rem 0.65rem',
                backgroundColor: activeCount === totalWidgets ? 'var(--nav-bg)' : '#FFFFFF',
                color: activeCount === totalWidgets ? '#FFFFFF' : 'var(--ink-2)',
                border: '1px solid var(--border-strong)',
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Everything
            </button>
            <button
              onClick={() => applyPreset('EXECUTIVE')}
              style={{
                padding: '0.25rem 0.65rem',
                backgroundColor: '#FFFFFF',
                color: 'var(--ink-2)',
                border: '1px solid var(--border-strong)',
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Executive
            </button>
            <button
              onClick={() => applyPreset('OPERATIONS')}
              style={{
                padding: '0.25rem 0.65rem',
                backgroundColor: '#FFFFFF',
                color: 'var(--ink-2)',
                border: '1px solid var(--border-strong)',
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Invoices & Bills
            </button>
            <button
              onClick={() => applyPreset('MINIMAL')}
              style={{
                padding: '0.25rem 0.65rem',
                backgroundColor: '#FFFFFF',
                color: 'var(--ink-2)',
                border: '1px solid var(--border-strong)',
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Minimal
            </button>
          </div>
        </div>

        {/* Scrollable Checkbox Sections */}
        <div
          style={{
            padding: '1.5rem 1.75rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
          }}
        >
          {/* Section 1: Header & Quick Actions */}
          <div>
            <div style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.65rem' }}>
              Header Actions
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.65rem' }}>
              <ItemToggle
                label="Quick Action Buttons"
                desc="New Invoice, Record Payment, New Bill, New Expense, Add Contact, New Journal"
                icon={<Zap size={15} color="#102654" />}
                checked={preferences.quickActions}
                onToggle={() => toggleKey('quickActions')}
              />
            </div>
          </div>

          {/* Section 2: Six Core KPI Metric Cards */}
          <div>
            <div style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.65rem' }}>
              Financial KPI Cards
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.65rem' }}>
              <ItemToggle
                label="Cash Balance"
                desc="Total cash across all corporate bank accounts"
                icon={<Landmark size={15} color="#102654" />}
                checked={preferences.kpiCash}
                onToggle={() => toggleKey('kpiCash')}
              />
              <ItemToggle
                label="Income"
                desc="Revenue generated this month with month-over-month trend"
                icon={<TrendingUp size={15} color="#0B6B52" />}
                checked={preferences.kpiIncome}
                onToggle={() => toggleKey('kpiIncome')}
              />
              <ItemToggle
                label="Expenses"
                desc="Operating expenditures and overheads with trend"
                icon={<TrendingDown size={15} color="#B42318" />}
                checked={preferences.kpiExpenses}
                onToggle={() => toggleKey('kpiExpenses')}
              />
              <ItemToggle
                label="Net Profit"
                desc="Net margin (Income minus Expenses) for the period"
                icon={<BarChart3 size={15} color="#102654" />}
                checked={preferences.kpiProfit}
                onToggle={() => toggleKey('kpiProfit')}
              />
              <ItemToggle
                label="Outstanding Invoices"
                desc="Unpaid customer invoices awaiting collection"
                icon={<FileText size={15} color="#F97316" />}
                checked={preferences.kpiInvoices}
                onToggle={() => toggleKey('kpiInvoices')}
              />
              <ItemToggle
                label="Bills Due"
                desc="Supplier liabilities due for payment"
                icon={<Calendar size={15} color="#B42318" />}
                checked={preferences.kpiBills}
                onToggle={() => toggleKey('kpiBills')}
              />
            </div>
          </div>

          {/* Section 3: Dual Charts */}
          <div>
            <div style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.65rem' }}>
              Analytics & Visualizations
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.65rem' }}>
              <ItemToggle
                label="Cash Flow (12 Months)"
                desc="Interactive monthly bar & net cash trend spline"
                icon={<BarChart3 size={15} color="#102654" />}
                checked={preferences.chartCashFlow}
                onToggle={() => toggleKey('chartCashFlow')}
              />
              <ItemToggle
                label="Income vs Expenses (Donut)"
                desc="Financial year breakdown with percentage distribution"
                icon={<PieChart size={15} color="#0B6B52" />}
                checked={preferences.chartIncomeExpenses}
                onToggle={() => toggleKey('chartIncomeExpenses')}
              />
            </div>
          </div>

          {/* Section 4: Data Tables */}
          <div>
            <div style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.65rem' }}>
              Activity Tables & Feeds
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.65rem' }}>
              <ItemToggle
                label="Recent Transactions"
                desc="Latest posted general ledger bank activities"
                icon={<ArrowRightLeft size={15} color="#102654" />}
                checked={preferences.tableTransactions}
                onToggle={() => toggleKey('tableTransactions')}
              />
              <ItemToggle
                label="Outstanding Invoices Table"
                desc="Pending client invoices with due dates and statuses"
                icon={<FileText size={15} color="#F97316" />}
                checked={preferences.tableInvoices}
                onToggle={() => toggleKey('tableInvoices')}
              />
              <ItemToggle
                label="Bills Due Table"
                desc="Supplier liabilities and impending payment due dates"
                icon={<Calendar size={15} color="#B42318" />}
                checked={preferences.tableBills}
                onToggle={() => toggleKey('tableBills')}
              />
            </div>
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
            onClick={() => onChangePreferences(DEFAULT_DASHBOARD_PREFERENCES)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.825rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <RotateCcw size={14} />
            <span>Reset to Default</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.55rem 1.5rem',
              backgroundColor: 'var(--nav-bg)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(4, 31, 70, 0.2)',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function ItemToggle({
  label,
  desc,
  icon,
  checked,
  onToggle,
}: {
  label: string;
  desc: string;
  icon: React.ReactNode;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '0.85rem',
        borderRadius: '0.625rem',
        border: checked ? '1.5px solid var(--primary)' : '1px solid var(--border-subtle)',
        backgroundColor: checked ? 'var(--info-bg)' : '#FFFFFF',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        userSelect: 'none',
      }}
    >
      {/* Tick Checkbox Box */}
      <div
        style={{
          width: '20px',
          height: '20px',
          borderRadius: '5px',
          border: checked ? '2px solid var(--primary)' : '2px solid var(--border-strong)',
          backgroundColor: checked ? 'var(--primary)' : '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: '2px',
          flexShrink: 0,
          transition: 'all 0.15s ease',
        }}
      >
        {checked && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.15rem' }}>
          {icon}
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>{label}</span>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.35 }}>{desc}</p>
      </div>
    </div>
  );
}
