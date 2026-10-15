import { Inject, Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { APP_CONFIG } from '../config/config.module';
import type { AppEnv } from '../config/env';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PERIOD_SECONDS = 30;
const DIGITS = 6;
/** Accept codes from one step either side to tolerate clock drift. */
const DRIFT_STEPS = 1;
const RECOVERY_CODE_COUNT = 10;
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, '').replace(/\s/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error('Invalid base32 character');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/**
 * Time-based one-time passwords (RFC 6238, HMAC-SHA1, 6 digits, 30s) plus
 * encryption of the shared secret at rest and recovery-code generation.
 */
@Injectable()
export class MfaService {
  private readonly key: Buffer;

  constructor(@Inject(APP_CONFIG) config: AppEnv) {
    this.key = createHash('sha256').update(`blynt-mfa-secret:${config.SESSION_SECRET}`).digest();
  }

  generateSecret(): string {
    return base32Encode(randomBytes(20));
  }

  otpauthUrl(email: string, secret: string): string {
    const label = encodeURIComponent(`Blynt:${email}`).replace('%3A', ':');
    return `otpauth://totp/${label}?secret=${secret}&issuer=Blynt&algorithm=SHA1&digits=${DIGITS}&period=${PERIOD_SECONDS}`;
  }

  totp(secret: string, timeMs: number): string {
    return this.codeForStep(base32Decode(secret), Math.floor(timeMs / 1000 / PERIOD_SECONDS));
  }

  /**
   * Returns the matched time step, or null. A step at or before `lastUsedStep`
   * is rejected so a code cannot be replayed.
   */
  verifyTotp(secret: string, code: string, timeMs: number, lastUsedStep?: number | null): number | null {
    if (!/^\d{6}$/.test(code)) return null;
    const key = base32Decode(secret);
    const current = Math.floor(timeMs / 1000 / PERIOD_SECONDS);
    for (let offset = -DRIFT_STEPS; offset <= DRIFT_STEPS; offset++) {
      const step = current + offset;
      if (lastUsedStep !== null && lastUsedStep !== undefined && step <= lastUsedStep) continue;
      const expected = Buffer.from(this.codeForStep(key, step));
      if (timingSafeEqual(expected, Buffer.from(code))) return step;
    }
    return null;
  }

  /** AES-256-GCM; output is `iv.tag.ciphertext` (base64url). */
  encryptSecret(secret: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64url')).join('.');
  }

  decryptSecret(encrypted: string): string {
    const [iv, tag, data] = encrypted.split('.').map((p) => Buffer.from(p, 'base64url'));
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }

  /** Codes formatted `XXXXX-XXXXX`; store only the hash of the normalised form. */
  generateRecoveryCodes(): string[] {
    const codes = new Set<string>();
    while (codes.size < RECOVERY_CODE_COUNT) {
      const bytes = randomBytes(10);
      const raw = Array.from(bytes, (b) => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length]).join('');
      codes.add(`${raw.slice(0, 5)}-${raw.slice(5)}`);
    }
    return [...codes];
  }

  normalizeRecoveryCode(code: string): string {
    return code.replace(/[\s-]/g, '').toUpperCase();
  }

  isTotpFormat(code: string): boolean {
    return /^\d{6}$/.test(code.trim());
  }

  private codeForStep(key: Buffer, step: number): string {
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(step));
    const hmac = createHmac('sha1', key).update(counter).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS;
    return binary.toString().padStart(DIGITS, '0');
  }
}
