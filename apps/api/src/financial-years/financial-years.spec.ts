import { parseIsoDate, toIsoDate, addDays, daysInMonth, utcDate } from '../common/utils/dates';

describe('Financial Years and Accounting Periods Logic', () => {
  it('correctly parses ISO date into UTC midnight without local timezone shift', () => {
    const d = parseIsoDate('2026-04-01');
    expect(d.toISOString()).toBe('2026-04-01T00:00:00.000Z');
    expect(toIsoDate(d)).toBe('2026-04-01');
  });

  it('rejects invalid calendar dates', () => {
    expect(() => parseIsoDate('2026-02-31')).toThrow();
    expect(() => parseIsoDate('invalid-date')).toThrow();
  });

  it('calculates days in month correctly including leap years', () => {
    // 2024 is leap year -> February has 29 days
    expect(daysInMonth(2024, 1)).toBe(29);
    // 2026 is non-leap year -> February has 28 days
    expect(daysInMonth(2026, 1)).toBe(28);
    // April has 30 days
    expect(daysInMonth(2026, 3)).toBe(30);
  });

  it('advances periods correctly without gaps or overlaps', () => {
    const start = utcDate(2026, 3, 1); // 01 April 2026
    const endOfApril = utcDate(2026, 3, 30); // 30 April 2026
    const startOfMay = addDays(endOfApril, 1);

    expect(toIsoDate(start)).toBe('2026-04-01');
    expect(toIsoDate(endOfApril)).toBe('2026-04-30');
    expect(toIsoDate(startOfMay)).toBe('2026-05-01');
  });
});
