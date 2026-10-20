import { describe, it, expect } from 'vitest';
import { friendlyAuthError } from './auth-messages';

describe('friendlyAuthError', () => {
  it('turns API codes into next-step guidance', () => {
    expect(friendlyAuthError({ code: 'AUTH_INVALID_CREDENTIALS', status: 401 })).toMatch(/don’t match/);
    expect(friendlyAuthError({ code: 'AUTH_TOKEN_INVALID', status: 400 })).toMatch(/Request a new one/);
    expect(friendlyAuthError({ code: 'AUTH_MFA_INVALID_CODE', status: 401 })).toMatch(/newest one/);
  });

  it('passes the server’s weak-password reason through', () => {
    expect(friendlyAuthError({ code: 'AUTH_WEAK_PASSWORD', message: 'Password must contain a number' })).toBe(
      'Password must contain a number.',
    );
  });

  it('handles throttling, outages and offline', () => {
    expect(friendlyAuthError({ status: 429 })).toMatch(/Too many attempts/);
    expect(friendlyAuthError({ status: 503, code: 'X' })).toMatch(/data is safe/);
    expect(friendlyAuthError(new TypeError('Failed to fetch'))).toMatch(/offline/);
  });

  it('falls back safely for unknown errors', () => {
    expect(friendlyAuthError(undefined)).toMatch(/Nothing was changed/);
    expect(friendlyAuthError({ message: 'raw' })).toMatch(/Nothing was changed/);
    expect(friendlyAuthError({ code: 'OTHER', message: 'Readable server message' })).toBe(
      'Readable server message',
    );
  });
});
