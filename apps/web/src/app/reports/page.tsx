'use client';

import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { Page, PageHeader } from '@/components/ui/page';

interface ReportItem {
  group: string;
  question: string;
  name: string;
  desc: string;
  href: string;
  metric: string;
  metricLabel: string;
  badge: string;
  badgeColor: string;
  sparkline: string;
}

const REPORTS: ReportItem[] = [
  {
    group: 'Performance',
    question: 'How am I doing?',
    name: 'Profit & Loss',
    desc: 'Authoritative income statement with gross margin waterfall and EBITDA analysis.',
    href: '/reports/profit-and-loss',
    metric: '£65,400.00',
    metricLabel: 'Net Profit (35.5% Margin)',
    badge: 'P&L Statement',
    badgeColor: '#0B6B52',
    sparkline: 'M2 16L15 13L28 15L42 8L58 4',
  },
  {
    group: 'Position',
    question: 'What do I own and owe?',
    name: 'Balance Sheet',
    desc: 'Verified Assets ≡ Liabilities + Equity capital solvency snapshot with ratio matrix.',
    href: '/reports/balance-sheet',
    metric: '3.06x / £142.6k',
    metricLabel: 'Current Ratio / Total Assets',
    badge: 'Solvency Verified',
    badgeColor: '#102654',
    sparkline: 'M2 14L15 12L28 13L42 7L58 3',
  },
  {
    group: 'Cash',
    question: 'Where did cash go?',
    name: '13-Week Cash Flow',
    desc: 'Rolling 13-week liquidity trajectory curve with safety floor and stress forecasting.',
    href: '/reports/cash-flow',
    metric: '£53,610.00',
    metricLabel: 'Projected W13 Bank Balance',
    badge: '13-Wk Trajectory',
    badgeColor: '#0B6B52',
    sparkline: 'M2 10L14 7L26 12L38 8L50 6L58 3',
  },
  {
    group: 'Tax',
    question: 'What do I owe HMRC?',
    name: 'VAT Return (9-Box)',
    desc: 'MTD-ready quarterly calculation reconciled directly against posted ledger output & input tax.',
    href: '/reports/vat',
    metric: '£6,140.00',
    metricLabel: 'Q3 Estimated Net Payable',
    badge: 'Due in 18 Days',
    badgeColor: '#D97706',
    sparkline: 'M2 12L15 11L28 13L42 9L58 8',
  },
  {
    group: 'Customers',
    question: 'Who owes me money?',
    name: 'Aged Receivables (AR)',
    desc: 'Customer debtor aging brackets with DSO analysis and collection concentration risks.',
    href: '/reports/ar-ageing',
    metric: '28 Days DSO',
    metricLabel: '£18,750 Total (77% Current)',
    badge: 'Credit Monitoring',
    badgeColor: '#3B82F6',
    sparkline: 'M2 15L15 13L28 11L42 7L58 5',
  },
  {
    group: 'Suppliers',
    question: 'Who do I owe?',
    name: 'Aged Payables (AP)',
    desc: 'Supplier payment schedule, cash outflow timing brackets, and working capital cash coverage.',
    href: '/reports/ap-ageing',
    metric: '3.4x Coverage',
    metricLabel: '£14,200 Total (73% Current)',
    badge: 'Cash Protected',
    badgeColor: '#0B6B52',
    sparkline: 'M2 8L15 9L28 11L42 10L58 12',
  },
  {
    group: 'Accountant',
    question: 'Do the books balance?',
    name: 'Trial Balance',
    desc: 'Complete debit and credit reconciliation across every chart of accounts code.',
    href: '/reports/trial-balance',
    metric: '£0.00 Diff',
    metricLabel: 'Balanced Double-Entry Books',
    badge: 'General Ledger',
    badgeColor: '#102654',
    sparkline: 'M2 10L15 10L28 10L42 10L58 10',
  },
];

export default function ReportsHomePage() {
  return (
    <AppShell>
      <Page>
        <PageHeader
          title="Financial Intelligence & Reports"
          breadcrumb={[{ label: 'Reports' }]}
          description="Authoritative accounting statements, liquidity forecasting, and balance sheet solvency analytics reconciled with your General Ledger."
        />
        <div className="bl-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {REPORTS.map((r) => (
            <Link
              key={r.href}
              href={r.href}
              className="bl-panel"
              style={{
                textDecoration: 'none',
                color: 'inherit',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '1.35rem',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)',
                backgroundColor: '#FFFFFF',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{r.question}</span>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: r.badgeColor,
                      backgroundColor: `${r.badgeColor}12`,
                      padding: '0.15rem 0.45rem',
                      borderRadius: '4px',
                    }}
                  >
                    {r.badge}
                  </span>
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#102654', marginBottom: '0.35rem' }}>
                  {r.name}
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--ink-2)', lineHeight: 1.45, margin: 0 }}>
                  {r.desc}
                </p>
              </div>

              <div style={{ marginTop: '1.25rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#102654', fontFamily: 'var(--font-mono, monospace)' }}>
                    {r.metric}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {r.metricLabel}
                  </div>
                </div>
                <svg width="60" height="20" viewBox="0 0 60 20" fill="none">
                  <path d={r.sparkline} stroke={r.badgeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </Page>
    </AppShell>
  );
}
