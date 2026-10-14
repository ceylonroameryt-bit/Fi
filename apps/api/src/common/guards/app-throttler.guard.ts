import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { createHash } from 'node:crypto';

/**
 * Rate-limit bucket per client rather than per IP alone.
 *
 * Browser traffic reaches the API through the Next.js proxy, so many users can
 * share one source IP. Keying only on IP turned the limits into a single global
 * bucket (ten failed logins anywhere blocked login for everyone). The tracker
 * now combines the client IP with a hash of whatever identifies the caller:
 * the session cookie, the bearer token, or the email being signed in with.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const ip: string = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    const identity = this.identityOf(req);
    return identity ? `${ip}|${identity}` : ip;
  }

  private identityOf(req: Record<string, any>): string | null {
    const auth = typeof req.headers?.authorization === 'string' ? req.headers.authorization : '';
    const candidate: unknown =
      req.cookies?.['refresh_token'] ||
      req.cookies?.['access_token'] ||
      (auth.startsWith('Bearer ') ? auth.slice(7) : '') ||
      (typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '');
    if (typeof candidate !== 'string' || candidate.length === 0) return null;
    return createHash('sha256').update(candidate).digest('hex').slice(0, 32);
  }
}
