/**
 * Pure helpers behind the Home dashboard. Every figure comes from the API;
 * these only combine and label it (exact decimals, no floats, no sample data).
 */
import { addDecimals, isPositiveDecimal, subtractDecimals } from './decimal';

export interface BankAccountSummary {
  id: string;
  name: string;
  ledgerBalance?: string | null;
  unmatchedCount?: number;
  status?: string;
}

export interface AgeingBucketTotals {
  current: string;
  days1To30: string;
  days31To60: string;
  days61To90: string;
  days90Plus: string;
  total: string;
}

export interface AgeingReportLite {
  summaryTotals: AgeingBucketTotals;
  groups: { contactName: string; items: { daysOverdue: number; amountDue: string }[] }[];
}

export interface PeriodLite {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'SOFT_LOCKED' | 'HARD_LOCKED';
}

export function cashPosition(accounts: BankAccountSummary[]): {
  total: string;
  unmatched: number;
  count: number;
} {
  const active = accounts.filter((a) => a.status !== 'ARCHIVED' && a.status !== 'CLOSED');
  return {
    total: addDecimals(...active.map((a) => a.ledgerBalance ?? '0')),
    unmatched: active.reduce((n, a) => n + (a.unmatchedCount ?? 0), 0),
    count: active.length,
  };
}

export interface OverdueSummary {
  total: string;
  overdueAmount: string;
  overdueCount: number;
  /** Names of the most overdue contacts, worst first (max 2) — for the to-do line. */
  worst: string[];
}

export function overdueSummary(report: AgeingReportLite | null): OverdueSummary | null {
  if (!report) return null;
  const t = report.summaryTotals;
  const overdueItems = report.groups.flatMap((g) =>
    g.items
      .filter((i) => i.daysOverdue > 0 && isPositiveDecimal(i.amountDue))
      .map((i) => ({ name: g.contactName, days: i.daysOverdue })),
  );
  const worst = [...overdueItems]
    .sort((a, b) => b.days - a.days)
    .map((i) => i.name)
    .filter((n, idx, arr) => arr.indexOf(n) === idx)
    .slice(0, 2);
  return {
    total: t.total,
    overdueAmount: subtractDecimals(t.total, t.current),
    overdueCount: overdueItems.length,
    worst,
  };
}

/** Cash in bank minus everything owed to suppliers. Deliberately conservative and explainable. */
export function safeToSpend(cashTotal: string, payablesTotal: string | null | undefined): string {
  return subtractDecimals(cashTotal, payablesTotal ?? '0');
}

/** The most recent month that has ended but is still open — the one to close next. */
export function periodToClose(periods: PeriodLite[], today: string): PeriodLite | null {
  const ended = periods.filter((p) => p.endDate.slice(0, 10) < today && p.status === 'OPEN');
  if (ended.length === 0) return null;
  return ended.sort((a, b) => (a.endDate < b.endDate ? 1 : -1))[0];
}

export type AttentionTone = 'ai' | 'danger' | 'info' | 'warning';

export interface AttentionItem {
  id: string;
  tone: AttentionTone;
  title: string;
  detail: string;
  href: string;
  action: string;
}

export interface AttentionInput {
  reviewCount: number | null;
  receivables: OverdueSummary | null;
  payables: OverdueSummary | null;
  unmatchedBankLines: number | null;
  closePeriod: PeriodLite | null;
  formatMoney: (v: string) => string;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Ordered by consequence: money you're owed, money you owe late, AI drafts, bank, month end. */
export function attentionItems(input: AttentionInput): AttentionItem[] {
  const items: AttentionItem[] = [];
  const { receivables: ar, payables: ap, formatMoney } = input;

  if (ar && ar.overdueCount > 0) {
    items.push({
      id: 'ar',
      tone: 'danger',
      title: `${plural(ar.overdueCount, 'invoice')} overdue — ${formatMoney(ar.overdueAmount)}`,
      detail: ar.worst.length ? `Longest waiting: ${ar.worst.join(', ')}` : 'Customers are late paying',
      href: '/reports/ar-ageing',
      action: 'Chase',
    });
  }
  if (ap && ap.overdueCount > 0) {
    items.push({
      id: 'ap',
      tone: 'warning',
      title: `${plural(ap.overdueCount, 'bill')} past due — ${formatMoney(ap.overdueAmount)}`,
      detail: ap.worst.length ? `To ${ap.worst.join(', ')}` : 'Pay or agree new dates with suppliers',
      href: '/purchases/bills',
      action: 'Review bills',
    });
  }
  if (input.reviewCount && input.reviewCount > 0) {
    items.push({
      id: 'review',
      tone: 'ai',
      title: `${plural(input.reviewCount, 'AI draft')} ready to check`,
      detail: 'Nothing posts until you approve',
      href: '/purchases/review',
      action: 'Review',
    });
  }
  if (input.unmatchedBankLines && input.unmatchedBankLines > 0) {
    items.push({
      id: 'bank',
      tone: 'info',
      title: `${plural(input.unmatchedBankLines, 'bank line')} to confirm`,
      detail: 'Confirming keeps your reports accurate',
      href: '/banking/transactions',
      action: 'Confirm',
    });
  }
  if (input.closePeriod) {
    items.push({
      id: 'close',
      tone: 'info',
      title: `${input.closePeriod.name} has ended but is still open`,
      detail: 'Lock it once everything is in, so figures can’t change',
      href: '/accounting/periods',
      action: 'Close month',
    });
  }
  return items;
}

export function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** First and last day of the month containing `today` (ISO), plus the previous month. */
export function monthRanges(today: string): {
  thisMonth: { from: string; to: string };
  lastMonth: { from: string; to: string };
} {
  const [y, m] = today.split('-').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  const lastDay = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  return {
    thisMonth: { from: `${y}-${pad(m)}-01`, to: today },
    lastMonth: { from: `${py}-${pad(pm)}-01`, to: `${py}-${pad(pm)}-${pad(lastDay(py, pm))}` },
  };
}
