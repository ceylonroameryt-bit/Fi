'use client';

import { AppShell } from '@/components/app-shell';
import { PlannedFeature } from '@/components/ui/planned-feature';

export default function CashFlowPage() {
  return (
    <AppShell>
      <PlannedFeature
        title="Cash flow"
        breadcrumb={[{ label: 'Reports', href: '/reports' }, { label: 'Cash flow' }]}
        purpose="Where did cash go, and what will the bank balance look like over the next 13 weeks?"
        willDo={[
          'Cash in and out by month, from posted bank transactions',
          '13-week forecast from invoices and bills due',
          'Highlight the lowest week ahead (e.g. when VAT and PAYE leave together)',
        ]}
        today={[
          { label: 'Who owes you', href: '/reports/ar-ageing', note: 'money coming in' },
          { label: 'Who you owe', href: '/reports/ap-ageing', note: 'money going out' },
          { label: 'Bank accounts', href: '/banking/accounts', note: 'current balances' },
        ]}
      />
    </AppShell>
  );
}
