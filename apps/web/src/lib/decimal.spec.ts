import { describe, it, expect } from 'vitest';
import {
  addDecimals,
  subtractDecimals,
  compareDecimals,
  toUnits,
  fromUnits,
  isPositiveDecimal,
} from './decimal';

describe('exact decimal helpers', () => {
  it('adds without floating-point drift', () => {
    // 0.1 + 0.2 = 0.30000000000000004 in floats
    expect(addDecimals('0.1', '0.2')).toBe('0.3000');
    expect(addDecimals('48210.4400', '-1284.6000', '0')).toBe('46925.8400');
    expect(addDecimals()).toBe('0.0000');
    expect(addDecimals(null, undefined, '5')).toBe('5.0000');
  });

  it('subtracts and compares', () => {
    expect(subtractDecimals('100', '100.0001')).toBe('-0.0001');
    expect(compareDecimals('1.00', '1')).toBe(0);
    expect(compareDecimals('-1', '0')).toBe(-1);
    expect(compareDecimals('2', '1.9999')).toBe(1);
    expect(isPositiveDecimal('0.0000')).toBe(false);
    expect(isPositiveDecimal('0.0001')).toBe(true);
  });

  it('round-trips ledger precision and rounds the 5th decimal half-up', () => {
    expect(fromUnits(toUnits('123456789012345.6789'))).toBe('123456789012345.6789');
    expect(fromUnits(toUnits('1.00005'))).toBe('1.0001');
    expect(fromUnits(toUnits('-1.00005'))).toBe('-1.0001');
    expect(fromUnits(toUnits('.5'))).toBe('0.5000');
  });

  it('rejects things that are not numbers', () => {
    expect(() => toUnits('12abc')).toThrow();
    expect(() => toUnits('-')).toThrow();
  });
});
