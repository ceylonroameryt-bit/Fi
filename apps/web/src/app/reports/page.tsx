'use client';

import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { Page, PageHeader } from '@/components/ui/page';

/** Reports are labelled by the question they answer; the formal name sits underneath. */
const REPORTS: { question: string; name: string; desc: string; href: string; group: string }[] = [
  {
    group: 'Performance',
    question: 'How am I doing?',
    name: 'Profit & loss',
    desc: 'Income minus costs for any period, with comparison.',
    href: '/reports/profit-and-loss',
  },
  {
    group: 'Position',
    question: 'What do I own and owe?',
    name: 'Balance sheet',
    desc: 'A snapshot of assets, liabilities and equity on any date.',
    href: '/reports/balance-sheet',
  },
  {
    group: 'Cash',
    question: 'Where did cash go?',
    name: 'Cash flow',
    desc: 'Cash in and out, and the weeks ahead.',
    href: '/reports/cash-flow',
  },
  {
    group: 'Tax',
    question: 'What do I owe HMRC?',
    name: 'VAT return',
    desc: 'The nine VAT boxes for a quarter, checked against your ledger.',
    href: '/reports/vat',
  },
  {
    group: 'Customers',
    question: 'Who owes me money?',
    name: 'Aged receivables (AR)',
    desc: 'Unpaid invoices grouped by how late they are.',
    href: '/reports/ar-ageing',
  },
  {
    group: 'Suppliers',
    question: 'Who do I owe?',
    name: 'Aged payables (AP)',
    desc: 'Unpaid bills grouped by due date.',
    href: '/reports/ap-ageing',
  },
  {
    group: 'Accountant',
    question: 'Do the books balance?',
    name: 'Trial balance',
    desc: 'Every account’s debit and credit balance on a date.',
    href: '/reports/trial-balance',
  },
];

export default function ReportsHomePage() {
  return (
    <AppShell>
      <Page>
        <PageHeader
          title="Reports"
          breadcrumb={[{ label: 'Reports' }]}
          description="Pick the question you want answered. Every figure links through to the transactions behind it."
        />
        <div className="bl-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {REPORTS.map((r) => (
            <Link
              key={r.href}
              href={r.href}
              className="bl-panel"
              style={{ textDecoration: 'none', color: 'inherit', gap: 6 }}
            >
              <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>{r.question}</span>
              <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-main)' }}>{r.name}</span>
              <span style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>{r.desc}</span>
            </Link>
          ))}
        </div>
      </Page>
    </AppShell>
  );
}
