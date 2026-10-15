import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import { TokenService } from './token.service';
import { AuditEvents } from '../audit/audit-events';
import type { AppEnv } from '../config/env';

describe('AuthService – session hardening and MFA', () => {
  const config = {
    SESSION_SECRET: 'unit-test-session-secret-at-least-32-chars!!',
    JWT_SECRET: 'unit-test-jwt-secret-at-least-32-characters!!',
    REFRESH_TOKEN_TTL_DAYS: 14,
    ACCESS_TOKEN_TTL_SECONDS: 900,
  } as AppEnv;
  const tokens = new TokenService(config);
  const mfa = new MfaService(config);

  const user = {
    id: 'user-1',
    email: 'owner@example.com',
    firstName: 'O',
    lastName: 'W',
    emailVerified: true,
    isSuperAdmin: false,
    status: 'ACTIVE',
    passwordHash: 'hash',
    failedLoginAttempts: 0,
    lockedUntil: null,
    mfaEnabled: false,
    mfaSecretEncrypted: null as string | null,
    mfaPendingSecretEncrypted: null as string | null,
    mfaLastUsedStep: null as number | null,
  };

  let prisma: any;
  let audit: { record: jest.Mock };
  let service: AuthService;

  const eventTypes = () => audit.record.mock.calls.map((c) => c[2].eventType);

  beforeEach(() => {
    audit = { record: jest.fn() };
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ ...user }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...user }),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...user, ...data })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      session: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'session-1' }),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      mfaRecoveryCode: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
    };
    const jwt = { signAsync: jest.fn().mockResolvedValue('access.jwt') };
    const passwords = { verify: jest.fn().mockResolvedValue(true) };
    service = new AuthService(
      prisma,
      jwt as any,
      passwords as any,
      tokens,
      {} as any,
      audit as any,
      mfa,
      config,
    );
  });

  describe('refresh token rotation', () => {
    it('rotates the refresh token and remembers the previous hash', async () => {
      prisma.session.findUnique.mockResolvedValue({
        id: 'session-1',
        refreshTokenHash: tokens.hash('old'),
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        user: { ...user },
      });

      const result = await service.refreshSession('old', null);

      expect(result.refreshToken).not.toBe('old');
      const call = prisma.session.updateMany.mock.calls[0][0];
      expect(call.where).toEqual({ id: 'session-1', refreshTokenHash: tokens.hash('old'), revokedAt: null });
      expect(call.data.previousRefreshTokenHash).toBe(tokens.hash('old'));
      expect(call.data.refreshTokenHash).toBe(tokens.hash(result.refreshToken));
    });

    it('revokes the session when an already-rotated refresh token is reused', async () => {
      prisma.session.findUnique.mockResolvedValue(null);
      prisma.session.findFirst.mockResolvedValue({ id: 'session-1', userId: 'user-1', revokedAt: null });

      await expect(service.refreshSession('stolen', null)).rejects.toMatchObject({ code: 'AUTH_SESSION_EXPIRED' });

      expect(prisma.session.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { previousRefreshTokenHash: tokens.hash('stolen') } }),
      );
      expect(prisma.session.updateMany).toHaveBeenCalledWith({
        where: { id: 'session-1', revokedAt: null },
        data: expect.objectContaining({ revokedReason: 'REFRESH_TOKEN_REUSE' }),
      });
      expect(eventTypes()).toContain(AuditEvents.REFRESH_TOKEN_REUSE_DETECTED);
    });

    it('treats a lost rotation race as reuse', async () => {
      prisma.session.findUnique.mockResolvedValue({
        id: 'session-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        user: { ...user },
      });
      prisma.session.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.refreshSession('old', null)).rejects.toMatchObject({ code: 'AUTH_SESSION_EXPIRED' });
      expect(eventTypes()).toContain(AuditEvents.REFRESH_TOKEN_REUSE_DETECTED);
    });
  });

  describe('session revocation', () => {
    it('revokes all other sessions and audits it', async () => {
      prisma.session.updateMany.mockResolvedValue({ count: 3 });
      const count = await service.revokeAllSessions('user-1', 'session-1', null);
      expect(count).toBe(3);
      expect(prisma.session.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null, id: { not: 'session-1' } },
        data: expect.objectContaining({ revokedReason: 'REVOKED_ALL_BY_USER' }),
      });
      expect(eventTypes()).toContain(AuditEvents.SESSIONS_REVOKED_ALL);
    });
  });

  describe('login', () => {
    it('reports mfaRequired when the user has MFA enabled', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...user, mfaEnabled: true });
      prisma.user.findUniqueOrThrow.mockResolvedValue({ ...user, mfaEnabled: true });
      const result = await service.login({ email: user.email, password: 'x' } as any, null);
      expect(result.mfaRequired).toBe(true);
      expect(prisma.session.create.mock.calls[0][0].data.mfaVerifiedAt).toBeUndefined();
    });

    it('does not require MFA for users without it', async () => {
      const result = await service.login({ email: user.email, password: 'x' } as any, null);
      expect(result.mfaRequired).toBe(false);
    });
  });

  describe('MFA enrolment and verification', () => {
    it('enables MFA only with a valid code from the pending secret, and returns recovery codes', async () => {
      const secret = mfa.generateSecret();
      prisma.user.findUniqueOrThrow.mockResolvedValue({
        ...user,
        mfaPendingSecretEncrypted: mfa.encryptSecret(secret),
      });

      await expect(service.enableMfa('user-1', 'session-1', '000000', null)).rejects.toMatchObject({
        code: 'AUTH_MFA_INVALID_CODE',
      });

      const codes = await service.enableMfa('user-1', 'session-1', mfa.totp(secret, Date.now()), null);
      expect(codes).toHaveLength(10);
      const stored = prisma.mfaRecoveryCode.createMany.mock.calls[0][0].data;
      expect(stored[0].codeHash).toBe(tokens.hash(mfa.normalizeRecoveryCode(codes[0])));
      expect(JSON.stringify(stored)).not.toContain(codes[0]);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ mfaEnabled: true, mfaPendingSecretEncrypted: null }) }),
      );
      expect(prisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { mfaVerifiedAt: expect.any(Date) },
      });
      expect(eventTypes()).toEqual(expect.arrayContaining([AuditEvents.MFA_ENABLE_FAILED, AuditEvents.MFA_ENABLED]));
    });

    it('marks the session verified on a valid TOTP code', async () => {
      const secret = mfa.generateSecret();
      prisma.user.findUniqueOrThrow.mockResolvedValue({
        ...user,
        mfaEnabled: true,
        mfaSecretEncrypted: mfa.encryptSecret(secret),
      });
      await service.verifyMfa('user-1', 'session-1', mfa.totp(secret, Date.now()), null);
      expect(prisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { mfaVerifiedAt: expect.any(Date) },
      });
      expect(eventTypes()).toContain(AuditEvents.MFA_VERIFIED);
    });

    it('accepts a single-use recovery code', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({
        ...user,
        mfaEnabled: true,
        mfaSecretEncrypted: mfa.encryptSecret(mfa.generateSecret()),
      });
      prisma.mfaRecoveryCode.findFirst.mockResolvedValue({ id: 'rc-1' });
      await service.verifyMfa('user-1', 'session-1', 'ABCDE-12345', null);
      expect(prisma.mfaRecoveryCode.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-1', codeHash: tokens.hash('ABCDE12345'), usedAt: null },
      });
      expect(prisma.mfaRecoveryCode.updateMany).toHaveBeenCalledWith({
        where: { id: 'rc-1', usedAt: null },
        data: { usedAt: expect.any(Date) },
      });
      expect(eventTypes()).toContain(AuditEvents.MFA_RECOVERY_CODE_USED);
    });

    it('counts failed codes towards lockout and audits them', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({
        ...user,
        mfaEnabled: true,
        failedLoginAttempts: 4,
        mfaSecretEncrypted: mfa.encryptSecret(mfa.generateSecret()),
      });
      await expect(service.verifyMfa('user-1', 'session-1', '000000', null)).rejects.toMatchObject({
        code: 'AUTH_MFA_INVALID_CODE',
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { failedLoginAttempts: 5, lockedUntil: expect.any(Date) },
      });
      expect(prisma.session.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: expect.objectContaining({ revokedReason: 'MFA_LOCKOUT' }),
      });
      expect(eventTypes()).toContain(AuditEvents.MFA_FAILED);
    });

    it('refuses verification when MFA is not enabled', async () => {
      await expect(service.verifyMfa('user-1', 'session-1', '123456', null)).rejects.toMatchObject({
        code: 'AUTH_MFA_NOT_ENABLED',
      });
    });
  });
});
