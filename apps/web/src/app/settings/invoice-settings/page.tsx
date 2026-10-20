'use client';

import { AppShell } from '@/components/app-shell';
import { PlannedFeature } from '@/components/ui/planned-feature';

export default function InvoiceSettingsPage() {
  return (
    <AppShell>
      <PlannedFeature
        title="Invoice settings"
        breadcrumb={[{ label: 'Settings', href: '/settings/organization' }, { label: 'Invoice settings' }]}
        purpose="Make invoices look like your business and get paid with fewer questions."
        willDo={[
          'Logo and accent colour, with a live preview of what customers see',
          'Invoice numbering format and default payment terms',
          'Bank details and payment instructions in the footer',
        ]}
        today={[
          {
            label: 'Organisation details',
            href: '/settings/organization',
            note: 'legal name, address, VAT number',
          },
          { label: 'Taxes & VAT', href: '/settings/taxes' },
          { label: 'Create an invoice', href: '/sales/invoices/new' },
        ]}
      />
    </AppShell>
  );
}
