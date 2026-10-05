import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from './auth.guard';
import type { AppEnv } from '../config/env';

describe('AuthGuard Security Hardening (auth.guard.ts)', () => {
  let guard: AuthGuard;
  let jwt: jest.Mocked<JwtService>;
  let reflector: jest.Mocked<Reflector>;
  let prisma: any;
  let config: AppEnv;

  beforeEach(() => {
    jwt = {
      verifyAsync: jest.fn(),
    } as any;

    reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false), // not public
    } as any;

    prisma = {
      session: {
        findUnique: jest.fn(),
      },
    };

    config = {
      JWT_SECRET: 'test-secret-at-least-32-characters-long',
    } as any;

    guard = new AuthGuard(jwt, reflector, prisma, config);
  });

  function createMockContext(headers: Record<string, string> = {}) {
    const request: any = {
      header: (name: string) => headers[name.toLowerCase()],
      headers,
      cookies: {},
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

  it('rejects unauthenticated requests on protected routes with AUTH_REQUIRED', async () => {
    const ctx = createMockContext();
    await expect(guard.canActivate(ctx as any)).rejects.toThrow(
      expect.objectContaining({ code: 'AUTH_REQUIRED' }),
    );
  });

  it('proves that a token combining one user’s session with another user’s ID is rejected (AUTH_INVALID_TOKEN)', async () => {
    const ctx = createMockContext({ authorization: 'Bearer forged.token' });
    const userAId = 'user-a-uuid';
    const userBId = 'user-b-uuid';
    const sessionAId = 'session-a-uuid';

    // Token claims User B as subject, but session ID belongs to User A
    jwt.verifyAsync.mockResolvedValue({
      sub: userBId, // Claimed user B
      sid: sessionAId,
      email: 'userb@example.com',
    } as any);

    // Database lookup finds Session A belongs to User A
    prisma.session.findUnique.mockResolvedValue({
      id: sessionAId,
      userId: userAId, // Real owner is User A
      expiresAt: new Date(Date.now() + 100000),
      revokedAt: null,
      user: {
        id: userAId,
        email: 'usera@example.com',
        status: 'ACTIVE',
        isSuperAdmin: false,
      },
    });

    await expect(guard.canActivate(ctx as any)).rejects.toThrow(
      expect.objectContaining({ code: 'AUTH_INVALID_TOKEN' }),
    );
    expect(ctx.request.auth).toBeUndefined();
  });

  it('rejects revoked sessions with AUTH_SESSION_EXPIRED', async () => {
    const ctx = createMockContext({ authorization: 'Bearer valid.token' });
    jwt.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      sid: 'session-1',
      email: 'user1@example.com',
    } as any);

    prisma.session.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 100000),
      revokedAt: new Date(), // Revoked
      user: {
        id: 'user-1',
        email: 'user1@example.com',
        status: 'ACTIVE',
      },
    });

    await expect(guard.canActivate(ctx as any)).rejects.toThrow(
      expect.objectContaining({ code: 'AUTH_SESSION_EXPIRED' }),
    );
  });

  it('rejects inactive or suspended users with AUTH_ACCOUNT_DISABLED', async () => {
    const ctx = createMockContext({ authorization: 'Bearer valid.token' });
    jwt.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      sid: 'session-1',
      email: 'user1@example.com',
    } as any);

    prisma.session.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 100000),
      revokedAt: null,
      user: {
        id: 'user-1',
        email: 'user1@example.com',
        status: 'SUSPENDED',
      },
    });

    await expect(guard.canActivate(ctx as any)).rejects.toThrow(
      expect.objectContaining({ code: 'AUTH_ACCOUNT_DISABLED' }),
    );
  });

  it('authenticates valid token matching session and sets authoritative context from DB', async () => {
    const ctx = createMockContext({ authorization: 'Bearer valid.token' });
    jwt.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      sid: 'session-1',
      email: 'client-token-email@example.com',
    } as any);

    prisma.session.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 100000),
      revokedAt: null,
      user: {
        id: 'user-1',
        email: 'authoritative-db-email@example.com',
        status: 'ACTIVE',
        isSuperAdmin: false,
      },
    });

    const result = await guard.canActivate(ctx as any);
    expect(result).toBe(true);
    expect(ctx.request.auth).toEqual({
      userId: 'user-1',
      sessionId: 'session-1',
      email: 'authoritative-db-email@example.com', // Derived from DB, not client token
    });
  });
});
