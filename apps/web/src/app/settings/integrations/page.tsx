'use client';

import { AppShell } from '@/components/app-shell';
import { PlannedFeature } from '@/components/ui/planned-feature';

export default function IntegrationsPage() {
  return (
    <AppShell>
      <PlannedFeature
        title="Integrations"
        breadcrumb={[{ label: 'Settings', href: '/settings/organization' }, { label: 'Integrations' }]}
        purpose="Connect your bank, HMRC and payment apps so data arrives without typing."
        willDo={[
          'Live bank feeds via Open Banking, with re-approval reminders every 90 days',
          'HMRC Making Tax Digital connection for VAT submission',
          'Card payments on invoices',
          'Forward-to-email address for bills and receipts',
        ]}
        today={[
          { label: 'Import a bank statement', href: '/banking/accounts', note: 'CSV, OFX or QIF' },
          { label: 'Upload bills and receipts', href: '/accounting/documents' },
          { label: 'Prepare your VAT return', href: '/reports/vat' },
        ]}
      />
    </AppShell>
  );
}
