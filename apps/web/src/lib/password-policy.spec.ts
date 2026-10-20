import { describe, it, expect } from 'vitest';
import { passwordAcceptable, passwordRules, passwordStrength } from './password-policy';

describe('password policy (mirrors the API)', () => {
  it('requires 10+ characters, a letter and a number', () => {
    expect(passwordAcceptable('short1')).toBe(false);
    expect(passwordAcceptable('abcdefghij')).toBe(false);
    expect(passwordAcceptable('1234567890')).toBe(false);
    expect(passwordAcceptable('abcdefghi1')).toBe(true);
    expect(passwordAcceptable('a1' + 'x'.repeat(127))).toBe(false);
  });

  it('rejects passwords containing the email name when it is 4+ characters', () => {
    expect(passwordAcceptable('sarahsecret1', 'sarah@demo.com')).toBe(false);
    expect(passwordAcceptable('jo-secret-12', 'jo@demo.com')).toBe(true);
    expect(passwordRules('x', 'jo@demo.com').map((r) => r.id)).toEqual(['length', 'letter', 'number']);
    expect(passwordRules('x', 'sarah@demo.com').map((r) => r.id)).toEqual([
      'length',
      'letter',
      'number',
      'email',
    ]);
  });

  it('scores strength for the meter', () => {
    expect(passwordStrength('')).toBe(0);
    expect(passwordStrength('abc')).toBe(1);
    expect(passwordStrength('abcdefghi1')).toBe(2);
    expect(passwordStrength('abcdefghijklm1')).toBe(3);
    expect(passwordStrength('Abcdefghijklm1!')).toBe(4);
  });
});
