import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { DomainException } from '../errors/domain.exception';
import type { Actor, AppRequest, AuthContext, OrgContext } from '../types/request-context.types';

export const IS_PUBLIC_KEY = 'isPublic';
/** Marks a route as not requiring authentication. */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';
/**
 * Declares the permission(s) required for an organisation-scoped route.
 * Enforced server-side by OrganizationAccessGuard; all listed codes are required.
 */
export const RequirePermission = (...codes: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, codes);

export const CurrentAuth = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthContext => {
  const req = ctx.switchToHttp().getRequest<AppRequest>();
  if (!req.auth) throw new DomainException('AUTH_REQUIRED', 'Authentication required');
  return req.auth;
});

export const CurrentOrg = createParamDecorator((_: unknown, ctx: ExecutionContext): OrgContext => {
  const req = ctx.switchToHttp().getRequest<AppRequest>();
  if (!req.org) throw new DomainException('ORGANIZATION_ACCESS_DENIED', 'Organisation context missing');
  return req.org;
});

export function actorFromRequest(req: AppRequest): Actor {
  return {
    userId: req.auth?.userId ?? null,
    sessionId: req.auth?.sessionId ?? null,
    ipAddress: clientIp(req),
    userAgent: req.header('user-agent')?.slice(0, 512) ?? null,
    requestId: req.requestId ?? null,
  };
}

export function clientIp(req: AppRequest): string | null {
  return (req.ip ?? req.socket?.remoteAddress ?? null)?.slice(0, 64) ?? null;
}

export const CurrentActor = createParamDecorator((_: unknown, ctx: ExecutionContext): Actor =>
  actorFromRequest(ctx.switchToHttp().getRequest<AppRequest>()),
);
