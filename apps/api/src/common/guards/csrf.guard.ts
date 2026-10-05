import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators';
import { DomainException } from '../errors/domain.exception';
import type { AppRequest } from '../types/request-context.types';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AppRequest>();
    const method = request.method.toUpperCase();

    // 1. Safe HTTP methods do not change state -> Always allow
    if (!STATE_CHANGING_METHODS.has(method)) {
      return true;
    }

    // 2. Public endpoints (e.g. initial login, register) are exempt
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    // 3. If request is authenticated via Bearer token in Authorization header,
    // ambient browser credentials are not involved -> Allow API/CLI clients.
    const authHeader = request.header('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return true;
    }

    // 4. If request relies on ambient browser cookies (access_token), enforce Double-Submit CSRF
    const hasCookieAuth = Boolean(request.cookies?.['access_token']);
    if (hasCookieAuth) {
      const csrfCookie = request.cookies?.['csrf_token'] || request.cookies?.['XSRF-TOKEN'];
      const csrfHeader =
        (request.header('x-csrf-token') as string) ||
        (request.header('x-xsrf-token') as string);

      if (!csrfHeader) {
        throw new DomainException('CSRF_TOKEN_MISSING', 'CSRF token missing in x-csrf-token header');
      }

      if (!csrfCookie || csrfHeader !== csrfCookie) {
        throw new DomainException('CSRF_TOKEN_INVALID', 'CSRF token verification failed');
      }
    }

    return true;
  }
}
