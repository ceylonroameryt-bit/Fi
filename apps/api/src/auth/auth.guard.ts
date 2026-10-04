import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { APP_CONFIG } from '../config/config.module';
import type { AppEnv } from '../config/env';
import { DomainException } from '../common/errors/domain.exception';
import { IS_PUBLIC_KEY } from '../common/decorators';
import type { AppRequest, AuthContext } from '../common/types/request-context.types';
import type { AccessTokenPayload } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    @Inject(APP_CONFIG) private readonly config: AppEnv,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<AppRequest>();
    const token = this.extractToken(request);

    if (!token) {
      if (isPublic) return true;
      throw new DomainException('AUTH_REQUIRED', 'Authentication token required');
    }

    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.JWT_SECRET,
      });

      const authContext: AuthContext = {
        userId: payload.sub,
        sessionId: payload.sid,
        email: payload.email,
      };

      request.auth = authContext;
      return true;
    } catch {
      if (isPublic) return true;
      throw new DomainException('AUTH_SESSION_EXPIRED', 'Token is expired or invalid');
    }
  }

  private extractToken(request: AppRequest): string | null {
    const authHeader = request.header('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7).trim();
    }
    const cookieToken = request.cookies?.['access_token'];
    if (typeof cookieToken === 'string' && cookieToken.length > 0) {
      return cookieToken;
    }
    return null;
  }
}
