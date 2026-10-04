import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt as scryptCb, timingSafeEqual, ScryptOptions } from 'node:crypto';
import { DomainException } from '../common/errors/domain.exception';

function scrypt(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAX_MEM = 64 * 1024 * 1024;

/**
 * Password hashing with scrypt (memory-hard KDF from Node's crypto module).
 * Stored format: scrypt$N$r$p$saltB64$hashB64 so parameters can be raised later.
 */
@Injectable()
export class PasswordService {
  static readonly MIN_LENGTH = 10;
  static readonly MAX_LENGTH = 128;

  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await scrypt(password.normalize('NFKC'), salt, KEYLEN, { N, r: R, p: P, maxmem: MAX_MEM });
    return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
  }

  async verify(password: string, stored: string | null): Promise<boolean> {
    // Always perform a hash computation so timing does not reveal whether a user exists.
    const parts = (stored ?? DUMMY_HASH).split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const [, n, r, p, saltB64, hashB64] = parts;
    const expected = Buffer.from(hashB64, 'base64');
    const key = await scrypt(password.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: MAX_MEM,
    });
    return stored !== null && key.length === expected.length && timingSafeEqual(key, expected);
  }

  /** Server-side password policy (the UI mirrors it for UX only). */
  assertStrong(password: string, context: { email?: string } = {}): void {
    const problems: string[] = [];
    if (password.length < PasswordService.MIN_LENGTH) problems.push(`must be at least ${PasswordService.MIN_LENGTH} characters`);
    if (password.length > PasswordService.MAX_LENGTH) problems.push(`must be at most ${PasswordService.MAX_LENGTH} characters`);
    if (!/[A-Za-z]/.test(password)) problems.push('must contain a letter');
    if (!/[0-9]/.test(password)) problems.push('must contain a number');
    if (context.email && password.toLowerCase().includes(context.email.split('@')[0].toLowerCase()) && context.email.split('@')[0].length >= 4) {
      problems.push('must not contain your email name');
    }
    if (problems.length) {
      throw new DomainException('AUTH_WEAK_PASSWORD', `Password ${problems.join(', ')}`, { fields: { password: problems } });
    }
  }
}

// Valid-format hash of a random value, used to equalise timing for unknown users.
const DUMMY_HASH =
  'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64, 7).toString('base64');
