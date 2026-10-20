import { describe, it, expect } from 'vitest';
import { formatMoney, roundDecimalString, isZeroDecimal, isNegativeDecimal } from './money-format';

describe('formatMoney (display only, no floating point)', () => {
  it('formats API decimal strings with thousands separators and 2 dp', () => {
    expect(formatMoney('1234.5000')).toBe('£1,234.50');
    expect(formatMoney('0')).toBe('£0.00');
    expect(formatMoney('1000000')).toBe('£1,000,000.00');
  });

  it('rounds half-up using string arithmetic', () => {
    expect(formatMoney('10.005')).toBe('£10.01');
    expect(formatMoney('10.0049')).toBe('£10.00');
    expect(formatMoney('99.995')).toBe('£100.00');
    expect(formatMoney('999999.999')).toBe('£1,000,000.00');
  });

  it('keeps precision beyond what a float can hold', () => {
    // 2^53 + 1 pence would be corrupted by Number(); string maths keeps it exact.
    expect(formatMoney('90071992547409.93')).toBe('£90,071,992,547,409.93');
  });

  it('shows negatives in brackets (accounting convention) or with a minus', () => {
    expect(formatMoney('-1200')).toBe('(£1,200.00)');
    expect(formatMoney('-1200', { brackets: false })).toBe('-£1,200.00');
    expect(formatMoney('-0.001')).toBe('£0.00');
  });

  it('handles other currencies, no symbol and missing values', () => {
    expect(formatMoney('5', { currency: 'EUR' })).toBe('€5.00');
    expect(formatMoney('5', { currency: 'JPY' })).toBe('JPY 5.00');
    expect(formatMoney('5', { symbol: false })).toBe('5.00');
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney('')).toBe('—');
    expect(formatMoney('abc')).toBe('abc');
  });
});

describe('decimal helpers', () => {
  it('rounds decimal strings', () => {
    expect(roundDecimalString('0.125')).toEqual({ negative: false, whole: '0', fraction: '13' });
    expect(roundDecimalString('.5')).toEqual({ negative: false, whole: '0', fraction: '50' });
    expect(roundDecimalString('x')).toBeNull();
  });

  it('detects zero and negative values', () => {
    expect(isZeroDecimal('0.0000')).toBe(true);
    expect(isZeroDecimal('-0.00')).toBe(true);
    expect(isZeroDecimal('0.01')).toBe(false);
    expect(isZeroDecimal('')).toBe(false);
    expect(isNegativeDecimal('-5.00')).toBe(true);
    expect(isNegativeDecimal('-0.00')).toBe(false);
    expect(isNegativeDecimal('5')).toBe(false);
  });
});
