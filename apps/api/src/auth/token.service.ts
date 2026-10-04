import { Inject, Injectable } from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';
import { APP_CONFIG } from '../config/config.module';
import type { AppEnv } from '../config/env';

/**
 * Opaque secret tokens (refresh tokens, reset/verification tokens).
 * Only an HMAC of a token is stored, so a database leak does not expose usable tokens.
 */
@Injectable()
export class TokenService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppEnv) {}

  generate(bytes = 32): string {
    return randomBytes(bytes).toString('base64url');
  }

  hash(token: string): string {
    return createHmac('sha256', this.config.SESSION_SECRET).update(token).digest('hex');
  }
}
