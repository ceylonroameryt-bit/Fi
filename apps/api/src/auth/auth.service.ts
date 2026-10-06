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
  refreshToken: string;
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

    await this.mail.send({
      to: user.email,
      subject: 'Verify your Blynt account',
      text: `Welcome to Blynt. Verify your email with token: ${verificationRaw}`,
      link: `${this.config.FRONTEND_URL}/verify-email?token=${verificationRaw}`,
    });

    return this.createSession(user.id, actor);
  }

  async login(dto: LoginDto, actor: Actor | null): Promise<SessionResult> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user || !user.passwordHash) {
      await this.passwords.verify(dto.password, null);
      throw new DomainException('AUTH_INVALID_CREDENTIALS', 'Invalid email or password');
    }

    if (user.status === UserStatus.DISABLED || user.status === UserStatus.SUSPENDED) {
      throw new DomainException('AUTH_ACCOUNT_DISABLED', 'Account is suspended or disabled');
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new DomainException('AUTH_ACCOUNT_LOCKED', 'Account temporarily locked due to failed login attempts. Try again later.');
    }

    const valid = await this.passwords.verify(dto.password, user.passwordHash);
    if (!valid) {
      const attempts = user.failedLoginAttempts + 1;
      const lock = attempts >= 5;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          lockedUntil: lock ? new Date(Date.now() + 15 * 60_000) : null,
        },
      });

      await this.audit.record(null, actor, {
        organizationId: null,
        eventType: AuditEvents.USER_LOGIN_FAILED,
        entityType: 'USER',
        entityId: user.id,
      });

      throw new DomainException('AUTH_INVALID_CREDENTIALS', 'Invalid email or password');
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

    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw new DomainException('AUTH_SESSION_EXPIRED', 'Session has expired or is invalid');
    }

    if (session.user.status === UserStatus.DISABLED || session.user.status === UserStatus.SUSPENDED) {
      throw new DomainException('AUTH_ACCOUNT_DISABLED', 'Account is inactive');
    }

    // Rotate refresh token
    const newRawRefresh = this.tokens.generate();
    const newRefreshHash = this.tokens.hash(newRawRefresh);
    const expiresAt = new Date(Date.now() + this.config.REFRESH_TOKEN_TTL_DAYS * 86_400_000);

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: newRefreshHash,
        expiresAt,
        lastUsedAt: new Date(),
        ipAddress: actor?.ipAddress ?? session.ipAddress,
        userAgent: actor?.userAgent ?? session.userAgent,
      },
    });

    const accessToken = await this.signAccessToken({
      sub: session.user.id,
      sid: session.id,
      email: session.user.email,
    });

    return {
      accessToken,
      refreshToken: newRawRefresh,
      expiresInSeconds: this.config.ACCESS_TOKEN_TTL_SECONDS,
      user: {
        id: session.user.id,
        email: session.user.email,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        emailVerified: session.user.emailVerified,
        isSuperAdmin: session.user.isSuperAdmin,
      },
    };
  }

  async logout(sessionId: string, actor: Actor | null): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'LOGOUT' },
    });

    await this.audit.record(null, actor, {
      organizationId: null,
      eventType: AuditEvents.USER_LOGOUT,
      entityType: 'SESSION',
      entityId: sessionId,
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
    if (!user) return; // Silent success to prevent account enumeration

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
      text: `Reset token: ${resetRaw}`,
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
    this.passwords.assertStrong(dto.password);
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

  async acceptInvitation(dto: AcceptInvitationDto, actor: Actor | null): Promise<SessionResult> {
    this.passwords.assertStrong(dto.password);
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

    const passwordHash = await this.passwords.hash(dto.password);

    await this.prisma.transaction(async (tx) => {
      // Atomic single-use test-and-set to prevent concurrent race conditions
      const updateResult = await tx.userToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      if (updateResult.count === 0) {
        throw new DomainException('AUTH_TOKEN_INVALID', 'Invitation token has already been used');
      }

      await tx.user.update({
        where: { id: record.userId },
        data: {
          passwordHash,
          status: UserStatus.ACTIVE,
          emailVerified: true,
          emailVerifiedAt: new Date(),
          firstName: dto.firstName?.trim() || record.user.firstName,
          lastName: dto.lastName?.trim() || record.user.lastName,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      // Activate all pending memberships for this user
      await tx.organizationMember.updateMany({
        where: { userId: record.userId, status: MemberStatus.INVITED },
        data: { status: MemberStatus.ACTIVE, joinedAt: new Date() },
      });

      await this.audit.record(tx, actor, {
        organizationId: null,
        eventType: AuditEvents.USER_INVITED,
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
