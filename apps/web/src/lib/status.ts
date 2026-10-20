/**
 * One status vocabulary for every record type: plain words + a tone the UI turns into
 * colour and a symbol (never colour alone).
 */
import type { StatusTone } from '@/components/ui/page';
import { isPositiveDecimal, subtractDecimals } from './decimal';

export interface StatusLabel {
  label: string;
  tone: StatusTone;
}

const INVOICE: Record<string, StatusLabel> = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  APPROVED: { label: 'Approved', tone: 'info' },
  POSTED: { label: 'Awaiting payment', tone: 'warning' },
  PARTIALLY_PAID: { label: 'Part-paid', tone: 'info' },
  PAID: { label: 'Paid', tone: 'success' },
  VOIDED: { label: 'Void', tone: 'neutral' },
};

const BILL: Record<string, StatusLabel> = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  APPROVED: { label: 'Approved', tone: 'info' },
  POSTED: { label: 'Posted', tone: 'strong' },
  VOIDED: { label: 'Void', tone: 'neutral' },
};

const JOURNAL: Record<string, StatusLabel> = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  VALIDATED: { label: 'Validated', tone: 'info' },
  POSTED: { label: 'Posted', tone: 'strong' },
  REVERSED: { label: 'Reversed', tone: 'neutral' },
};

const SIMPLE: Record<string, StatusLabel> = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  POSTED: { label: 'Posted', tone: 'strong' },
  VOIDED: { label: 'Void', tone: 'neutral' },
};

export type RecordKind = 'invoice' | 'bill' | 'journal' | 'credit-note' | 'payment';

export function statusLabel(kind: RecordKind, status: string): StatusLabel {
  const table = kind === 'invoice' ? INVOICE : kind === 'bill' ? BILL : kind === 'journal' ? JOURNAL : SIMPLE;
  return (
    table[status] ?? {
      label: status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' '),
      tone: 'neutral',
    }
  );
}

/** Whole days from `dueIso` to `todayIso`; positive = late. */
export function daysLate(dueIso: string, todayIso: string): number {
  const toUtc = (s: string) => {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(todayIso) - toUtc(dueIso)) / 86_400_000);
}

export interface InvoiceLike {
  status: string;
  dueDate: string;
  totalAmount: string;
  amountPaid?: string | null;
}

/** Amount still owed on an open invoice/bill, exact. Drafts and voids owe nothing yet. */
export function amountOutstanding(inv: InvoiceLike): string {
  if (inv.status === 'DRAFT' || inv.status === 'VOIDED' || inv.status === 'PAID') return '0.0000';
  return subtractDecimals(inv.totalAmount, inv.amountPaid ?? '0');
}

/** Late = something is still owed and the due date has passed. */
export function isOverdue(inv: InvoiceLike, todayIso: string): boolean {
  return isPositiveDecimal(amountOutstanding(inv)) && daysLate(inv.dueDate, todayIso) > 0;
}
