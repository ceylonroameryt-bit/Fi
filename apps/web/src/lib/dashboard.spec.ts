import { describe, it, expect } from 'vitest';
import {
  attentionItems,
  cashPosition,
  greeting,
  monthRanges,
  overdueSummary,
  periodToClose,
  safeToSpend,
  type AgeingReportLite,
} from './dashboard';
import { formatMoney } from './money-format';

const ar: AgeingReportLite = {
  summaryTotals: {
    current: '14430.00',
    days1To30: '2400.00',
    days31To60: '1920.00',
    days61To90: '0',
    days90Plus: '0',
    total: '18750.00',
  },
  groups: [
    { contactName: 'Acme Corp', items: [{ daysOverdue: 4, amountDue: '2400.00' }] },
    { contactName: 'Northwind Ltd', items: [{ daysOverdue: 42, amountDue: '1920.00' }] },
    { contactName: 'Initech', items: [{ daysOverdue: 0, amountDue: '14430.00' }] },
  ],
};

describe('dashboard figures', () => {
  it('adds bank balances exactly and skips archived accounts', () => {
    expect(
      cashPosition([
        { id: '1', name: 'Barclays', ledgerBalance: '48210.4400', unmatchedCount: 12 },
        { id: '2', name: 'Amex', ledgerBalance: '-1284.6000', unmatchedCount: 0 },
        { id: '3', name: 'Old', ledgerBalance: '999', unmatchedCount: 5, status: 'ARCHIVED' },
      ]),
    ).toEqual({ total: '46925.8400', unmatched: 12, count: 2 });
  });

  it('summarises overdue receivables from the ageing report, worst first', () => {
    expect(overdueSummary(ar)).toEqual({
      total: '18750.00',
      overdueAmount: '4320.0000',
      overdueCount: 2,
      worst: ['Northwind Ltd', 'Acme Corp'],
    });
    expect(overdueSummary(null)).toBeNull();
  });

  it('safe to spend = cash minus supplier balances', () => {
    expect(safeToSpend('46925.8400', '5280.00')).toBe('41645.8400');
    expect(safeToSpend('100', null)).toBe('100.0000');
  });

  it('finds the most recent ended month that is still open', () => {
    const periods = [
      {
        id: 'a',
        name: 'August 2026',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        status: 'HARD_LOCKED' as const,
      },
      {
        id: 'b',
        name: 'September 2026',
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        status: 'OPEN' as const,
      },
      {
        id: 'c',
        name: 'October 2026',
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        status: 'OPEN' as const,
      },
    ];
    expect(periodToClose(periods, '2026-10-20')?.name).toBe('September 2026');
    expect(periodToClose(periods.slice(0, 1), '2026-10-20')).toBeNull();
  });
});

describe('needs-attention list', () => {
  it('orders by consequence and only includes things that need doing', () => {
    const items = attentionItems({
      reviewCount: 5,
      receivables: overdueSummary(ar),
      payables: null,
      unmatchedBankLines: 12,
      closePeriod: null,
      formatMoney: (v) => formatMoney(v),
    });
    expect(items.map((i) => i.id)).toEqual(['ar', 'review', 'bank']);
    expect(items[0].title).toBe('2 invoices overdue — £4,320.00');
    expect(items[0].detail).toBe('Longest waiting: Northwind Ltd, Acme Corp');
    expect(items[1].title).toBe('5 AI drafts ready to check');
  });

  it('is empty when everything is done', () => {
    expect(
      attentionItems({
        reviewCount: 0,
        receivables: null,
        payables: null,
        unmatchedBankLines: 0,
        closePeriod: null,
        formatMoney,
      }),
    ).toEqual([]);
  });

  it('uses singular wording for one item', () => {
    const items = attentionItems({
      reviewCount: 1,
      receivables: null,
      payables: null,
      unmatchedBankLines: 1,
      closePeriod: null,
      formatMoney,
    });
    expect(items.map((i) => i.title)).toEqual(['1 AI draft ready to check', '1 bank line to confirm']);
  });
});

describe('dates and greeting', () => {
  it('builds this-month-to-date and the whole previous month, across a year boundary', () => {
    expect(monthRanges('2026-10-20')).toEqual({
      thisMonth: { from: '2026-10-01', to: '2026-10-20' },
      lastMonth: { from: '2026-09-01', to: '2026-09-30' },
    });
    expect(monthRanges('2027-01-05').lastMonth).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });

  it('greets by time of day', () => {
    expect(greeting(8)).toBe('Good morning');
    expect(greeting(14)).toBe('Good afternoon');
    expect(greeting(20)).toBe('Good evening');
  });
});
