import { CanActivate, ExecutionContext, Inject, Injectable, Optional } from '@nestjs/common';
import { SystemRoleKey } from '@prisma/client';
import { Reflector } from '@nestjs/core';
import { DomainException } from '../errors/domain.exception';
import { REQUIRED_PERMISSIONS_KEY, IS_PUBLIC_KEY } from '../decorators';
import type { AppRequest } from '../types/request-context.types';
import { OrganizationsService } from '../../organizations/organizations.service';
import { APP_CONFIG } from '../../config/config.module';
import type { AppEnv } from '../../config/env';

/** Roles that can move money or sign off the books; they must use MFA. */
export const MFA_REQUIRED_ROLES: ReadonlySet<SystemRoleKey> = new Set([SystemRoleKey.OWNER, SystemRoleKey.ACCOUNTANT]);

/**
 * Tenant Isolation & Authorization Guard:
 * 1. Checks that the user is authenticated.
 * 2. Extracts `orgId` from the route params (or header `x-organization-id`).
 * 3. Enforces that the user has an ACTIVE membership in that organisation.
 * 4. Checks that the organisation itself is ACTIVE.
 * 5. Loads the user's role and permissions into `req.org`.
 * 6. Requires a verified MFA session for OWNER / ACCOUNTANT roles.
 * 7. Validates that the user has all required permissions declared via @RequirePermission(...).
 *
 * Direct ID guessing or accessing another company's data is rejected here.
 */
@Injectable()
export class OrganizationAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly organizations: OrganizationsService,
    @Optional() @Inject(APP_CONFIG) private readonly config?: Pick<AppEnv, 'MFA_REQUIRED_FOR_PRIVILEGED_ROLES'>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AppRequest>();
    if (!request.auth) {
      throw new DomainException('AUTH_REQUIRED', 'Authentication required');
    }

    const headerOrg = request.headers['x-organization-id'];
    const headerOrgId =
      typeof headerOrg === 'string'
        ? headerOrg.trim()
        : Array.isArray(headerOrg)
          ? headerOrg[0]?.trim()
          : undefined;

    const paramOrg = request.params?.orgId;
    const paramOrgId =
      typeof paramOrg === 'string'
        ? paramOrg.trim()
        : Array.isArray(paramOrg)
          ? paramOrg[0]?.trim()
          : undefined;

    // Security Rule: Prevent tenant confusion / header spoofing
    // If BOTH URL parameter and header are provided, they MUST be identical.
    if (paramOrgId && headerOrgId && paramOrgId !== headerOrgId) {
      throw new DomainException(
        'CONFLICTING_ORGANIZATION_CONTEXT',
        'Target organization in URL does not match x-organization-id header',
      );
    }

    // Target organisation is URL parameter if present, otherwise header
    const orgId = paramOrgId || headerOrgId;

    // Check required permissions metadata
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!orgId) {
      // Fail closed: If a route requires permissions, it MUST have tenant context
      if (requiredPermissions && requiredPermissions.length > 0) {
        throw new DomainException(
          'ORGANIZATION_CONTEXT_REQUIRED',
          'Organization context is required for permission-protected operations',
        );
      }
      return true;
    }

    // Validate membership and tenant isolation authoritatively
    const orgContext = await this.organizations.validateOrganizationAccess(
      orgId,
      request.auth.userId,
    );

    request.org = orgContext;

    const mfaEnforced = this.config?.MFA_REQUIRED_FOR_PRIVILEGED_ROLES ?? true;
    if (
      mfaEnforced &&
      orgContext.systemRoleKey &&
      MFA_REQUIRED_ROLES.has(orgContext.systemRoleKey) &&
      !request.auth.mfaVerified
    ) {
      throw new DomainException(
        'AUTH_MFA_REQUIRED',
        'Multi-factor authentication is required for owners and accountants',
        { mfaEnrolmentRequired: true },
      );
    }

    // Verify all required permissions.
    // Tenant OWNER possesses root organisation authority across all features.
    if (requiredPermissions && requiredPermissions.length > 0) {
      if (orgContext.systemRoleKey !== SystemRoleKey.OWNER) {
        for (const perm of requiredPermissions) {
          if (!orgContext.permissions.has(perm)) {
            throw new DomainException(
              'PERMISSION_DENIED',
              `You do not have the required permission: ${perm}`,
              { requiredPermission: perm },
            );
          }
        }
      }
    }

    return true;
  }
}
