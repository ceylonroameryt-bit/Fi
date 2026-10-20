import { describe, it, expect } from 'vitest';
import { quarterRange, recentQuarters, vatDueDate } from './vat-quarters';

describe('VAT quarter helpers', () => {
  it('builds calendar quarters with correct month ends, including leap years', () => {
    expect(quarterRange(2026, 7)).toEqual({ from: '2026-07-01', to: '2026-09-30', label: 'Jul – Sep 2026' });
    expect(quarterRange(2028, 12)).toEqual({
      from: '2028-12-01',
      to: '2029-02-28',
      label: 'Dec 2028 – Feb 2029',
    });
    expect(quarterRange(2024, 12).to).toBe('2025-02-28');
    expect(quarterRange(2023, 12).to).toBe('2024-02-29');
  });

  it('lists recent quarters newest first for each HMRC stagger', () => {
    expect(recentQuarters('2026-10-20', 3, 1).map((q) => q.from)).toEqual([
      '2026-10-01',
      '2026-07-01',
      '2026-04-01',
    ]);
    expect(recentQuarters('2026-10-20', 2, 2).map((q) => q.from)).toEqual(['2026-08-01', '2026-05-01']);
    expect(recentQuarters('2026-01-15', 2, 3).map((q) => q.from)).toEqual(['2025-12-01', '2025-09-01']);
  });

  it('gives the due date as one month and seven days after the period ends', () => {
    expect(vatDueDate('2026-09-30')).toBe('2026-11-07');
    expect(vatDueDate('2026-12-31')).toBe('2027-02-07');
    expect(vatDueDate('2027-01-31')).toBe('2027-03-07');
  });
});
