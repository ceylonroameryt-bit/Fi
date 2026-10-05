import { Reflector } from '@nestjs/core';
import { OrganizationAccessGuard } from './organization-access.guard';
import { DomainException } from '../errors/domain.exception';

describe('OrganizationAccessGuard Security & Tenant Isolation (organization-access.guard.ts)', () => {
  let guard: OrganizationAccessGuard;
  let reflector: jest.Mocked<Reflector>;
  let organizations: any;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn().mockImplementation((key) => {
        if (key === 'isPublic') return false;
        if (key === 'requiredPermissions') return ['organization.edit'];
        return undefined;
      }),
    } as any;

    organizations = {
      validateOrganizationAccess: jest.fn(),
    };

    guard = new OrganizationAccessGuard(reflector, organizations);
  });

  function createMockContext({
    headers = {},
    params = {},
    userId = 'user-1',
  }: {
    headers?: Record<string, string>;
    params?: Record<string, string>;
    userId?: string;
  }) {
    const request: any = {
      auth: { userId, sessionId: 'session-1', email: 'user1@example.com' },
      headers,
      params,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
      request,
    };
  }

  it('fails closed when a permission-protected tenant route lacks tenant context (no param, no header)', async () => {
    const ctx = createMockContext({ headers: {}, params: {} });

    await expect(guard.canActivate(ctx as any)).rejects.toThrow(
      expect.objectContaining({ code: 'ORGANIZATION_CONTEXT_REQUIRED' }),
    );
  });

  it('rejects conflicting tenant identifiers (different org in header vs URL param) with CONFLICTING_ORGANIZATION_CONTEXT', async () => {
    const ctx = createMockContext({
      headers: { 'x-organization-id': 'org-tenant-a' },
      params: { orgId: 'org-tenant-b' },
    });

    await expect(guard.canActivate(ctx as any)).rejects.toThrow(
      expect.objectContaining({ code: 'CONFLICTING_ORGANIZATION_CONTEXT' }),
    );
    expect(organizations.validateOrganizationAccess).not.toHaveBeenCalled();
  });

  it('rejects foreign organisation IDs if user is not an active member', async () => {
    const ctx = createMockContext({
      params: { orgId: 'foreign-org-id' },
    });

    organizations.validateOrganizationAccess.mockRejectedValue(
      new DomainException('ORGANIZATION_ACCESS_DENIED', 'You do not have access to this organisation'),
    );

    await expect(guard.canActivate(ctx as any)).rejects.toThrow(
      expect.objectContaining({ code: 'ORGANIZATION_ACCESS_DENIED' }),
    );
  });

  it('rejects removed members when validateOrganizationAccess throws MEMBER_NOT_FOUND', async () => {
    const ctx = createMockContext({
      params: { orgId: 'org-1' },
    });

    organizations.validateOrganizationAccess.mockRejectedValue(
      new DomainException('ORGANIZATION_ACCESS_DENIED', 'You do not have access to this organisation'),
    );

    await expect(guard.canActivate(ctx as any)).rejects.toThrow(
      expect.objectContaining({ code: 'ORGANIZATION_ACCESS_DENIED' }),
    );
  });

  it('rejects suspended organizations with ORGANIZATION_INACTIVE', async () => {
    const ctx = createMockContext({
      params: { orgId: 'suspended-org' },
    });

    organizations.validateOrganizationAccess.mockRejectedValue(
      new DomainException('ORGANIZATION_INACTIVE', 'This organisation is suspended or archived'),
    );

    await expect(guard.canActivate(ctx as any)).rejects.toThrow(
      expect.objectContaining({ code: 'ORGANIZATION_INACTIVE' }),
    );
  });

  it('rejects viewers attempting edits when they lack required permissions', async () => {
    const ctx = createMockContext({
      params: { orgId: 'org-1' },
    });

    organizations.validateOrganizationAccess.mockResolvedValue({
      organizationId: 'org-1',
      userId: 'user-1',
      role: 'VIEWER',
      permissions: new Set(['organization.view', 'reports.view']), // missing organization.edit
    });

    await expect(guard.canActivate(ctx as any)).rejects.toThrow(
      expect.objectContaining({ code: 'PERMISSION_DENIED' }),
    );
  });

  it('authorizes successfully when user has membership and required permission', async () => {
    const ctx = createMockContext({
      headers: { 'x-organization-id': 'org-1' },
      params: { orgId: 'org-1' },
    });

    organizations.validateOrganizationAccess.mockResolvedValue({
      organizationId: 'org-1',
      userId: 'user-1',
      role: 'OWNER',
      permissions: new Set(['organization.edit', 'organization.archive']),
    });

    const result = await guard.canActivate(ctx as any);
    expect(result).toBe(true);
    expect(ctx.request.org).toBeDefined();
    expect(ctx.request.org.organizationId).toBe('org-1');
  });
});
