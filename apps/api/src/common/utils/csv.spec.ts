import { escapeCsvField, toCsvRow } from './csv';

describe('CSV Utility (RFC 4180 & CWE-1236 Formula Neutralization)', () => {
  it('escapes quotes by doubling them per RFC 4180', () => {
    expect(escapeCsvField('Hello "World"')).toBe('"Hello ""World"""');
  });

  it('quotes cells containing commas and newlines', () => {
    expect(escapeCsvField('Line 1\nLine 2, and more')).toBe('"Line 1\nLine 2, and more"');
  });

  it('neutralizes spreadsheet formula injection (=, +, -, @, \\t, \\r)', () => {
    // Dangerous formulas must be prepended with a single quote
    expect(escapeCsvField('=cmd|" /C calc"!A0')).toBe('"\'=cmd|"" /C calc""!A0"');
    expect(escapeCsvField('@SUM(A1:A10)')).toBe('"\'@SUM(A1:A10)"');
    expect(escapeCsvField('+malicious_payload')).toBe('"\'+malicious_payload"');
    expect(escapeCsvField('-malicious_calc')).toBe('"\'-malicious_calc"');
    expect(escapeCsvField('\tleading_tab')).toBe('"\'\tleading_tab"');
  });

  it('preserves valid signed numbers without formula escaping', () => {
    expect(escapeCsvField('-123.45', true)).toBe('"-123.45"');
    expect(escapeCsvField('+99.99', true)).toBe('"+99.99"');
    expect(escapeCsvField('100.00', true)).toBe('"100.00"');
  });

  it('formats entire rows correctly with toCsvRow', () => {
    const row = toCsvRow([
      '2026-04-01',
      'INV-001',
      '=SUM(A1)',
      '150.00',
      null,
    ]);
    expect(row).toBe('"2026-04-01","INV-001","\'=SUM(A1)","150.00",""');
  });
});
