'use client';

import { AppShell } from '@/components/app-shell';
import { PlannedFeature } from '@/components/ui/planned-feature';

export default function ExpensesPage() {
  return (
    <AppShell>
      <PlannedFeature
        title="Expenses"
        breadcrumb={[{ label: 'Money out' }, { label: 'Expenses' }]}
        purpose="Snap a receipt, claim mileage and see what the business owes you or your team."
        willDo={[
          'Photo-first receipt cards you can scan by eye',
          'Mileage claims at HMRC rates',
          'Flag card payments that are missing a receipt',
          'Group out-of-pocket spend into one reimbursement',
        ]}
        today={[
          {
            label: 'Upload receipts',
            href: '/accounting/documents',
            note: 'AI drafts them as bills for you to approve',
          },
          { label: 'Review AI drafts', href: '/purchases/review' },
          { label: 'Confirm card spend on the bank feed', href: '/banking/transactions' },
        ]}
      />
    </AppShell>
  );
}
