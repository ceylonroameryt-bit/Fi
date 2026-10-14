import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MemberStatus, UserStatus, UserTokenType } from '@prisma/client';
import { APP_CONFIG } from '../config/config.module';
import type { AppEnv } from '../config/env';
import { PrismaService } from '../database/prisma.service';
import { DomainException } from '../common/errors/domain.exception';
import type { Actor } from '../common/types/request-context.types';
import { AuditService } from '../audit/audit.service';
import { AuditEvents } from '../audit/audit-events';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { MailService } from './mail.service';
import type { AcceptInvitationDto, LoginDto, RegisterDto, ResetPasswordDto } from './dto/auth.dto';

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  email: string;
}

export interface SessionResult {
  accessToken: string;
  /** Null when the refresh token was not rotated (concurrent-refresh grace path). */
  refreshToken: string | null;
  expiresInSeconds: number;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    emailVerified: boolean;
    isSuperAdmin: boolean;
  };
}

@Injectable()
export class AuthService {
  static readonly MAX_FAILED_LOGINS = 5;
  static readonly LOCKOUT_MS = 15 * 60_000;
  static readonly REFRESH_REUSE_GRACE_MS = 30_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppEnv,
  ) {}

  async register(dto: RegisterDto, actor: Actor | null): Promise<SessionResult> {
    this.passwords.assertStrong(dto.password, { email: dto.email });

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new DomainException('AUTH_EMAIL_IN_USE', 'An account with this email already exists');
    }

    const passwordHash = await this.passwords.hash(dto.password);
    const verificationRaw = this.tokens.generate();
    const verificationHash = this.tokens.hash(verificationRaw);

    const user = await this.prisma.transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          emailVerified: false,
          tokens: {
            create: {
              type: UserTokenType.EMAIL_VERIFICATION,
              tokenHash: verificationHash,
              expiresAt: new Date(Date.now() + 24 * 3600_000),
            },
          },
        },
      });

      await this.audit.record(tx, actor ?? { userId: created.id, sessionId: null, ipAddress: null, userAgent: null, requestId: null }, {
        organizationId: null,
        eventType: AuditEvents.USER_REGISTERED,
        entityType: 'USER',
        entityId: created.id,
        newValues: { email: created.email, firstName: created.firstName, lastName: created.lastName },
      });

      return created;
    });

    try {
      await this.mail.send({
        to: user.email,
        subject: 'Verify your Blynt account',
        text: 'Welcome to Blynt. Open the link to verify your email address.',
        link: `${this.config.FRONTEND_URL}/verify-email?token=${verificationRaw}`,
      });
    } catch {
      // The account exists either way; the user can request a new link from the app.
    }

    return this.createSession(user.id, actor);
  }

  async login(dto: LoginDto, actor: Actor | null): Promise<SessionResult> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user || !user.passwordHash) {
      await this.passwords.verify(dto.password, null);
      throw new DomainException('AUTH_INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const now = Date.now();
    const lockActive = Boolean(user.lockedUntil && user.lockedUntil.getTime() > now);
    const lockExpired = Boolean(user.lockedUntil && user.lockedUntil.getTime() <= now);

    // Always run the hash so timing is the same for every branch.
    const valid = await this.passwords.verify(dto.password, user.passwordHash);

    // While locked, the answer must not depend on the password, or the lock becomes an oracle.
    if (lockActive) {
      throw new DomainException('AUTH_ACCOUNT_LOCKED', 'Account temporarily locked due to failed login attempts. Try again later.');
    }

    if (!valid) {
      // A lock that has run out starts a fresh count; the increment is atomic.
      const updated = await this.prisma.user.update({
        where: { id: user.id },
        data: lockExpired
          ? { failedLoginAttempts: 1, lockedUntil: null }
          : { failedLoginAttempts: { increment: 1 } },
        select: { failedLoginAttempts: true },
      });
      if (updated.failedLoginAttempts >= AuthService.MAX_FAILED_LOGINS) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { lockedUntil: new Date(now + AuthService.LOCKOUT_MS) },
        });
      }

      await this.audit.record(null, actor, {
        organizationId: null,
        eventType: AuditEvents.USER_LOGIN_FAILED,
        entityType: 'USER',
        entityId: user.id,
      });

      throw new DomainException('AUTH_INVALID_CREDENTIALS', 'Invalid email or password');
    }

    // Status is only revealed to someone who knows the password.
    if (user.status === UserStatus.INVITED) {
      throw new DomainException('AUTH_ACCOUNT_DISABLED', 'Please accept your invitation from the email we sent to activate this account.');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new DomainException('AUTH_ACCOUNT_DISABLED', 'Account is suspended or disabled');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    const session = await this.createSession(user.id, actor);

    await this.audit.record(null, {
      userId: user.id,
      sessionId: null,
      ipAddress: actor?.ipAddress ?? null,
      userAgent: actor?.userAgent ?? null,
      requestId: actor?.requestId ?? null,
    }, {
      organizationId: null,
      eventType: AuditEvents.USER_LOGIN,
      entityType: 'USER',
      entityId: user.id,
    });

    return session;
  }

  async refreshSession(rawRefreshToken: string, actor: Actor | null): Promise<SessionResult> {
    const tokenHash = this.tokens.hash(rawRefreshToken);
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: { user: true },
    });

    if (!session) {
      return this.handleRotatedRefreshToken(tokenHash, actor);
    }

    if (session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw new DomainException('AUTH_SESSION_EXPIRED', 'Session has expired or is invalid');
    }

    if (session.user.status !== UserStatus.ACTIVE) {
      throw new DomainException('AUTH_ACCOUNT_DISABLED', 'Account is inactive');
    }

    // Rotate the refresh token with a compare-and-swap so two concurrent refreshes
    // cannot both rotate the same token.
    const newRawRefresh = this.tokens.generate();
    const newRefreshHash = this.tokens.hash(newRawRefresh);
    const expiresAt = new Date(Date.now() + this.config.REFRESH_TOKEN_TTL_DAYS * 86_400_000);

    const swapped = await this.prisma.session.updateMany({
      where: { id: session.id, refreshTokenHash: tokenHash, revokedAt: null },
      data: {
        refreshTokenHash: newRefreshHash,
        previousRefreshTokenHash: tokenHash,
        refreshRotatedAt: new Date(),
        expiresAt,
        lastUsedAt: new Date(),
        ipAddress: actor?.ipAddress ?? session.ipAddress,
        userAgent: actor?.userAgent ?? session.userAgent,
      },
    });
    if (swapped.count === 0) {
      // Another request rotated it first; treat like the grace path.
      return this.handleRotatedRefreshToken(tokenHash, actor);
    }

    return this.sessionResult(session.id, session.user, newRawRefresh);
  }

  /**
   * A refresh token that is no longer current. Within a short grace window after rotation
   * (another tab refreshed at the same moment) we issue a fresh access token only; the browser
   * already holds the newer refresh cookie. Outside the window this is reuse of an old token,
   * which suggests theft, so the whole session is revoked.
   */
  private async handleRotatedRefreshToken(tokenHash: string, actor: Actor | null): Promise<SessionResult> {
    const session = await this.prisma.session.findUnique({
      where: { previousRefreshTokenHash: tokenHash },
      include: { user: true },
    });
    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw new DomainException('AUTH_SESSION_EXPIRED', 'Session has expired or is invalid');
    }

    const rotatedAt = session.refreshRotatedAt?.getTime() ?? 0;
    if (Date.now() - rotatedAt <= AuthService.REFRESH_REUSE_GRACE_MS && session.user.status === UserStatus.ACTIVE) {
      return this.sessionResult(session.id, session.user, null);
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date(), revokedReason: 'REFRESH_TOKEN_REUSE' },
    });
    await this.audit.record(null, actor, {
      organizationId: null,
      eventType: AuditEvents.SESSION_REVOKED,
      entityType: 'SESSION',
      entityId: session.id,
      newValues: { reason: 'REFRESH_TOKEN_REUSE' },
    });
    throw new DomainException('AUTH_SESSION_EXPIRED', 'Session has expired or is invalid');
  }

  private async sessionResult(
    sessionId: string,
    user: { id: string; email: string; firstName: string; lastName: string; emailVerified: boolean; isSuperAdmin: boolean },
    refreshToken: string | null,
  ): Promise<SessionResult> {
    const accessToken = await this.signAccessToken({ sub: user.id, sid: sessionId, email: user.email });
    return {
      accessToken,
      refreshToken,
      expiresInSeconds: this.config.ACCESS_TOKEN_TTL_SECONDS,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        emailVerified: user.emailVerified,
        isSuperAdmin: user.isSuperAdmin,
      },
    };
  }

  async logout(sessionId: string | null, rawRefreshToken: string | null, actor: Actor | null): Promise<void> {
    let targetId = sessionId;
    if (!targetId && rawRefreshToken) {
      const session = await this.prisma.session.findUnique({
        where: { refreshTokenHash: this.tokens.hash(rawRefreshToken) },
        select: { id: true },
      });
      targetId = session?.id ?? null;
    }
    if (!targetId) return;

    await this.prisma.session.updateMany({
      where: { id: targetId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'LOGOUT' },
    });

    await this.audit.record(null, actor, {
      organizationId: null,
      eventType: AuditEvents.USER_LOGOUT,
      entityType: 'SESSION',
      entityId: targetId,
    });
  }

  async revokeSession(sessionId: string, userId: string, actor: Actor | null): Promise<void> {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) return;

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date(), revokedReason: 'REVOKED_BY_USER' },
    });

    await this.audit.record(null, actor, {
      organizationId: null,
      eventType: AuditEvents.SESSION_REVOKED,
      entityType: 'SESSION',
      entityId: sessionId,
    });
  }

  async requestPasswordReset(email: string, actor: Actor | null): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Silent success to prevent account enumeration. Users who never set a password
    // (pending invitations) and disabled accounts don't get reset links.
    if (!user || !user.passwordHash || user.status === UserStatus.DISABLED) return;

    const resetRaw = this.tokens.generate();
    const tokenHash = this.tokens.hash(resetRaw);

    await this.prisma.userToken.create({
      data: {
        userId: user.id,
        type: UserTokenType.PASSWORD_RESET,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60_000), // 1 hour
      },
    });

    await this.mail.send({
      to: user.email,
      subject: 'Reset your Blynt password',
      text: 'Open the link to reset your password. It expires in one hour.',
      link: `${this.config.FRONTEND_URL}/reset-password?token=${resetRaw}`,
    });

    await this.audit.record(null, actor, {
      organizationId: null,
      eventType: AuditEvents.PASSWORD_RESET_REQUESTED,
      entityType: 'USER',
      entityId: user.id,
    });
  }

  async resetPassword(dto: ResetPasswordDto, actor: Actor | null): Promise<void> {
    const tokenHash = this.tokens.hash(dto.token);

    const record = await this.prisma.userToken.findFirst({
      where: {
        type: UserTokenType.PASSWORD_RESET,
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!record) {
      throw new DomainException('AUTH_TOKEN_INVALID', 'Invalid or expired password reset token');
    }
    this.passwords.assertStrong(dto.password, { email: record.user.email });

    const passwordHash = await this.passwords.hash(dto.password);

    await this.prisma.transaction(async (tx) => {
      // Atomic single-use test-and-set to prevent concurrent race conditions
      const updateResult = await tx.userToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      if (updateResult.count === 0) {
        throw new DomainException('AUTH_TOKEN_INVALID', 'Password reset token has already been used');
      }

      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
      });

      // Any other outstanding reset links stop working.
      await tx.userToken.updateMany({
        where: { userId: record.userId, type: UserTokenType.PASSWORD_RESET, usedAt: null },
        data: { usedAt: new Date() },
      });

      // Revoke all existing sessions for security
      await tx.session.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'PASSWORD_RESET' },
      });

      await this.audit.record(tx, actor, {
        organizationId: null,
        eventType: AuditEvents.PASSWORD_RESET,
        entityType: 'USER',
        entityId: record.userId,
      });
    });
  }

  async resendVerificationEmail(userId: string, _actor: Actor | null): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.emailVerified) return;

    const raw = this.tokens.generate();
    await this.prisma.transaction(async (tx) => {
      // Older verification links stop working once a new one is sent.
      await tx.userToken.updateMany({
        where: { userId, type: UserTokenType.EMAIL_VERIFICATION, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.userToken.create({
        data: {
          userId,
          type: UserTokenType.EMAIL_VERIFICATION,
          tokenHash: this.tokens.hash(raw),
          expiresAt: new Date(Date.now() + 24 * 3600_000),
        },
      });
    });

    await this.mail.send({
      to: user.email,
      subject: 'Verify your Blynt account',
      text: 'Open the link to verify your email address.',
      link: `${this.config.FRONTEND_URL}/verify-email?token=${raw}`,
    });
  }

  async verifyEmail(token: string, actor: Actor | null): Promise<void> {
    const tokenHash = this.tokens.hash(token);
    const record = await this.prisma.userToken.findFirst({
      where: {
        type: UserTokenType.EMAIL_VERIFICATION,
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!record) {
      throw new DomainException('AUTH_TOKEN_INVALID', 'Invalid or expired verification token');
    }

    await this.prisma.transaction(async (tx) => {
      // Atomic single-use test-and-set to prevent concurrent race conditions
      const updateResult = await tx.userToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      if (updateResult.count === 0) {
        throw new DomainException('AUTH_TOKEN_INVALID', 'Verification token has already been used');
      }

      await tx.user.update({
        where: { id: record.userId },
        data: { emailVerified: true, emailVerifiedAt: new Date() },
      });

      await this.audit.record(tx, actor, {
        organizationId: null,
        eventType: AuditEvents.EMAIL_VERIFIED,
        entityType: 'USER',
        entityId: record.userId,
      });
    });
  }

  /**
   * Accepts one invitation. A new user sets their password here; an existing user
   * confirms with their current password (it is never overwritten). Only the
   * membership the invitation was issued for is activated.
   */
  async acceptInvitation(dto: AcceptInvitationDto, actor: Actor | null): Promise<SessionResult> {
    const tokenHash = this.tokens.hash(dto.token);

    const record = await this.prisma.userToken.findFirst({
      where: {
        type: UserTokenType.INVITATION,
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!record) {
      throw new DomainException('AUTH_TOKEN_INVALID', 'Invalid or expired invitation token');
    }

    const existingAccount = Boolean(record.user.passwordHash);
    let newPasswordHash: string | null = null;
    if (existingAccount) {
      const valid = await this.passwords.verify(dto.password, record.user.passwordHash);
      if (!valid) {
        throw new DomainException('AUTH_INVALID_CREDENTIALS', 'Enter the password for your existing Blynt account to accept');
      }
      if (record.user.status === UserStatus.DISABLED || record.user.status === UserStatus.SUSPENDED) {
        throw new DomainException('AUTH_ACCOUNT_DISABLED', 'Account is suspended or disabled');
      }
    } else {
      this.passwords.assertStrong(dto.password, { email: record.user.email });
      newPasswordHash = await this.passwords.hash(dto.password);
    }

    await this.prisma.transaction(async (tx) => {
      // Atomic single-use test-and-set to prevent concurrent race conditions
      const updateResult = await tx.userToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      if (updateResult.count === 0) {
        throw new DomainException('AUTH_TOKEN_INVALID', 'Invitation token has already been used');
      }

      if (!existingAccount) {
        await tx.user.update({
          where: { id: record.userId },
          data: {
            passwordHash: newPasswordHash,
            status: UserStatus.ACTIVE,
            emailVerified: true,
            emailVerifiedAt: new Date(),
            firstName: dto.firstName?.trim() || record.user.firstName,
            lastName: dto.lastName?.trim() || record.user.lastName,
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        });
      } else if (!record.user.emailVerified) {
        // Receiving the invitation proves control of the address.
        await tx.user.update({
          where: { id: record.userId },
          data: { emailVerified: true, emailVerifiedAt: new Date() },
        });
      }

      // Activate only the membership this invitation was for (legacy tokens without an
      // organisation fall back to the previous behaviour).
      await tx.organizationMember.updateMany({
        where: {
          userId: record.userId,
          status: MemberStatus.INVITED,
          ...(record.organizationId ? { organizationId: record.organizationId } : {}),
        },
        data: { status: MemberStatus.ACTIVE, joinedAt: new Date() },
      });

      await this.audit.record(tx, actor, {
        organizationId: record.organizationId ?? null,
        eventType: AuditEvents.INVITATION_ACCEPTED,
        entityType: 'USER',
        entityId: record.userId,
      });
    });

    return this.createSession(record.userId, actor);
  }

  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        emailVerified: true,
        status: true,
        isSuperAdmin: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
    if (!user) throw new DomainException('AUTH_REQUIRED', 'User not found');
    return user;
  }

  async getUserSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
      },
      orderBy: { lastUsedAt: 'desc' },
    });
  }

  private async createSession(userId: string, actor: Actor | null): Promise<SessionResult> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const rawRefresh = this.tokens.generate();
    const refreshHash = this.tokens.hash(rawRefresh);
    const expiresAt = new Date(Date.now() + this.config.REFRESH_TOKEN_TTL_DAYS * 86_400_000);

    const session = await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash: refreshHash,
        expiresAt,
        ipAddress: actor?.ipAddress ?? null,
        userAgent: actor?.userAgent ?? null,
      },
    });

    const accessToken = await this.signAccessToken({
      sub: user.id,
      sid: session.id,
      email: user.email,
    });

    return {
      accessToken,
      refreshToken: rawRefresh,
      expiresInSeconds: this.config.ACCESS_TOKEN_TTL_SECONDS,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        emailVerified: user.emailVerified,
        isSuperAdmin: user.isSuperAdmin,
      },
    };
  }

  private signAccessToken(payload: AccessTokenPayload): Promise<string> {
    return this.jwt.signAsync(payload, {
      secret: this.config.JWT_SECRET,
      expiresIn: this.config.ACCESS_TOKEN_TTL_SECONDS,
    });
  }
}
