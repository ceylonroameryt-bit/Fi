import { describe, it, expect } from 'vitest';
import { amountOutstanding, daysLate, isOverdue, statusLabel } from './status';

describe('status vocabulary', () => {
  it('uses plain words per record type', () => {
    expect(statusLabel('invoice', 'POSTED')).toEqual({ label: 'Awaiting payment', tone: 'warning' });
    expect(statusLabel('invoice', 'PARTIALLY_PAID').label).toBe('Part-paid');
    expect(statusLabel('bill', 'POSTED')).toEqual({ label: 'Posted', tone: 'strong' });
    expect(statusLabel('journal', 'REVERSED').label).toBe('Reversed');
    expect(statusLabel('credit-note', 'VOIDED').label).toBe('Void');
    expect(statusLabel('journal', 'SOMETHING_NEW')).toEqual({ label: 'Something new', tone: 'neutral' });
  });
});

describe('what is owed and late', () => {
  const today = '2026-10-20';

  it('counts days late from the due date', () => {
    expect(daysLate('2026-10-16', today)).toBe(4);
    expect(daysLate('2026-10-20T00:00:00.000Z', today)).toBe(0);
    expect(daysLate('2026-11-19', today)).toBe(-30);
  });

  it('works out what is still owed exactly', () => {
    expect(
      amountOutstanding({
        status: 'PARTIALLY_PAID',
        dueDate: today,
        totalAmount: '5000.0000',
        amountPaid: '2500.0000',
      }),
    ).toBe('2500.0000');
    expect(
      amountOutstanding({ status: 'POSTED', dueDate: today, totalAmount: '0.30', amountPaid: '0.10' }),
    ).toBe('0.2000');
    expect(amountOutstanding({ status: 'DRAFT', dueDate: today, totalAmount: '100' })).toBe('0.0000');
    expect(amountOutstanding({ status: 'PAID', dueDate: today, totalAmount: '100', amountPaid: '100' })).toBe(
      '0.0000',
    );
  });

  it('flags only open, past-due items as overdue', () => {
    expect(isOverdue({ status: 'POSTED', dueDate: '2026-10-16', totalAmount: '2400' }, today)).toBe(true);
    expect(isOverdue({ status: 'POSTED', dueDate: '2026-10-20', totalAmount: '2400' }, today)).toBe(false);
    expect(
      isOverdue({ status: 'PAID', dueDate: '2026-09-01', totalAmount: '2400', amountPaid: '2400' }, today),
    ).toBe(false);
    expect(isOverdue({ status: 'DRAFT', dueDate: '2026-09-01', totalAmount: '2400' }, today)).toBe(false);
  });
});
