import { MfaService, base32Encode } from './mfa.service';
import type { AppEnv } from '../config/env';

describe('MfaService (TOTP, RFC 6238)', () => {
  const config = { SESSION_SECRET: 'unit-test-session-secret-at-least-32-chars!!' } as AppEnv;
  const mfa = new MfaService(config);
  // RFC 6238 Appendix B SHA-1 seed
  const rfcSecret = base32Encode(Buffer.from('12345678901234567890', 'ascii'));

  it.each([
    [59, '287082'],
    [1111111109, '081804'],
    [1234567890, '005924'],
    [2000000000, '279037'],
  ])('matches RFC 6238 vector at T=%i', (seconds, expected) => {
    expect(mfa.totp(rfcSecret, seconds * 1000)).toBe(expected);
  });

  it('accepts the adjacent time step (clock drift) but not two steps away', () => {
    const now = 1_700_000_000_000;
    const prev = mfa.totp(rfcSecret, now - 30_000);
    const old = mfa.totp(rfcSecret, now - 90_000);
    expect(mfa.verifyTotp(rfcSecret, prev, now)).not.toBeNull();
    expect(mfa.verifyTotp(rfcSecret, old, now)).toBeNull();
  });

  it('rejects a code whose step was already used (replay)', () => {
    const now = 1_700_000_000_000;
    const code = mfa.totp(rfcSecret, now);
    const step = mfa.verifyTotp(rfcSecret, code, now);
    expect(step).not.toBeNull();
    expect(mfa.verifyTotp(rfcSecret, code, now, step)).toBeNull();
  });

  it('rejects malformed codes', () => {
    expect(mfa.verifyTotp(rfcSecret, '12345', Date.now())).toBeNull();
    expect(mfa.verifyTotp(rfcSecret, 'abcdef', Date.now())).toBeNull();
  });

  it('encrypts secrets reversibly and never stores plaintext', () => {
    const secret = mfa.generateSecret();
    const enc = mfa.encryptSecret(secret);
    expect(enc).not.toContain(secret);
    expect(mfa.decryptSecret(enc)).toBe(secret);
    expect(mfa.encryptSecret(secret)).not.toBe(enc); // random IV
  });

  it('rejects tampered ciphertext', () => {
    const enc = mfa.encryptSecret(mfa.generateSecret());
    const parts = enc.split('.');
    parts[2] = Buffer.from('tampered-data').toString('base64url');
    expect(() => mfa.decryptSecret(parts.join('.'))).toThrow();
  });

  it('generates unique, normalisable recovery codes', () => {
    const codes = mfa.generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    expect(mfa.normalizeRecoveryCode(codes[0].toLowerCase())).toBe(codes[0].replace('-', ''));
  });

  it('builds an otpauth URL', () => {
    expect(mfa.otpauthUrl('a@b.com', 'ABC')).toBe(
      'otpauth://totp/Blynt:a%40b.com?secret=ABC&issuer=Blynt&algorithm=SHA1&digits=6&period=30',
    );
  });
});
