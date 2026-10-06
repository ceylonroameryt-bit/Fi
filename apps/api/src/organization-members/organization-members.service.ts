import { Inject, Injectable, Optional } from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';
import { MemberStatus, SystemRoleKey, UserStatus, UserTokenType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { DomainException } from '../common/errors/domain.exception';
import type { Actor } from '../common/types/request-context.types';
import { AuditService } from '../audit/audit.service';
import { AuditEvents } from '../audit/audit-events';
import { MailService } from '../auth/mail.service';
import { TokenService } from '../auth/token.service';
import { APP_CONFIG } from '../config/config.module';
import type { AppEnv } from '../config/env';
import type { InviteMemberDto, UpdateMemberRoleDto } from './dto/member.dto';

const safeUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  status: true,
  lastLoginAt: true,
};

const safeRoleSelect = {
  id: true,
  name: true,
  systemKey: true,
  isSystemRole: true,
};

@Injectable()
export class OrganizationMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    @Optional() private readonly tokens?: TokenService,
    @Optional() @Inject(APP_CONFIG) private readonly config?: AppEnv,
  ) {}

  async listMembers(organizationId: string) {
    return this.prisma.organizationMember.findMany({
      where: {
        organizationId,
        status: { in: [MemberStatus.ACTIVE, MemberStatus.INVITED] },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            status: true,
            lastLoginAt: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
            systemKey: true,
            isSystemRole: true,
          },
        },
      },
      orderBy: [{ role: { name: 'asc' } }, { createdAt: 'asc' }],
    });
  }

  async inviteMember(organizationId: string, dto: InviteMemberDto, actor: Actor) {
    // 1. Validate role exists within the organisation
    const role = await this.prisma.role.findFirst({
      where: { id: dto.roleId, organizationId },
    });
    if (!role) {
      throw new DomainException('ROLE_NOT_FOUND', 'The specified role does not exist in this organisation');
    }

    // 2. Find or create user
    let user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const isNewUser = !user || user.status === UserStatus.INVITED || !user.passwordHash;
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: dto.email,
          status: UserStatus.INVITED,
          emailVerified: false,
        },
      });
    }

    // 3. Check existing membership
    const existingMember = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: user.id,
        },
      },
    });

    if (existingMember && existingMember.status === MemberStatus.ACTIVE) {
      throw new DomainException('MEMBER_ALREADY_EXISTS', 'This user is already an active member of this organisation');
    }

    const memberStatus = isNewUser ? MemberStatus.INVITED : MemberStatus.ACTIVE;

    const member = await this.prisma.transaction(async (tx) => {
      let m;
      if (existingMember) {
        m = await tx.organizationMember.update({
          where: { id: existingMember.id },
          data: {
            roleId: dto.roleId,
            status: memberStatus,
            removedAt: null,
            joinedAt: isNewUser ? null : new Date(),
          },
          include: { user: { select: safeUserSelect }, role: { select: safeRoleSelect } },
        });
      } else {
        m = await tx.organizationMember.create({
          data: {
            organizationId,
            userId: user.id,
            roleId: dto.roleId,
            status: memberStatus,
            invitedById: actor.userId,
            joinedAt: isNewUser ? null : new Date(),
          },
          include: { user: { select: safeUserSelect }, role: { select: safeRoleSelect } },
        });
      }

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.USER_INVITED,
        entityType: 'ORGANIZATION_MEMBER',
        entityId: m.id,
        newValues: { email: dto.email, role: role.name },
      });

      return m;
    });

    const tokenService = this.tokens || {
      generate: () => randomBytes(32).toString('base64url'),
      hash: (tok: string) => createHmac('sha256', this.config?.SESSION_SECRET || 'fallback-session-secret-32-chars-long').update(tok).digest('hex'),
    };
    const frontendUrl = this.config?.FRONTEND_URL || 'http://localhost:3000';

    if (isNewUser) {
      const invitationRaw = tokenService.generate();
      const tokenHash = tokenService.hash(invitationRaw);

      if (this.prisma.userToken?.create) {
        await this.prisma.userToken.create({
          data: {
            userId: user.id,
            type: UserTokenType.INVITATION,
            tokenHash,
            expiresAt: new Date(Date.now() + 7 * 86_400_000),
          },
        });
      }

      await this.mail.send({
        to: dto.email,
        subject: 'You have been invited to join an organisation on Blynt',
        text: `You have been invited as ${role.name}. Click the link to complete account setup:`,
        link: `${frontendUrl}/accept-invitation?token=${invitationRaw}`,
      });
    } else {
      await this.mail.send({
        to: dto.email,
        subject: 'You have been invited to join an organisation on Blynt',
        text: `You have been added to the organisation as ${role.name}. Log in to view: ${frontendUrl}/login`,
        link: `${frontendUrl}/login`,
      });
    }

    return member;
  }

  async updateMemberRole(organizationId: string, memberId: string, dto: UpdateMemberRoleDto, actor: Actor) {
    const member = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId, status: MemberStatus.ACTIVE },
      include: { role: true },
    });
    if (!member) throw new DomainException('MEMBER_NOT_FOUND', 'Member not found');

    const newRole = await this.prisma.role.findFirst({
      where: { id: dto.roleId, organizationId },
    });
    if (!newRole) throw new DomainException('ROLE_NOT_FOUND', 'Role not found');

    // Protect last OWNER
    if (member.role.systemKey === SystemRoleKey.OWNER && newRole.systemKey !== SystemRoleKey.OWNER) {
      const ownerCount = await this.prisma.organizationMember.count({
        where: {
          organizationId,
          status: MemberStatus.ACTIVE,
          role: { systemKey: SystemRoleKey.OWNER },
        },
      });
      if (ownerCount <= 1) {
        throw new DomainException('LAST_OWNER', 'Cannot change role: Organisation must have at least one Owner');
      }
    }

    const updated = await this.prisma.transaction(async (tx) => {
      const m = await tx.organizationMember.update({
        where: { id: memberId },
        data: { roleId: dto.roleId },
        include: { user: { select: safeUserSelect }, role: { select: safeRoleSelect } },
      });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.ROLE_CHANGED,
        entityType: 'ORGANIZATION_MEMBER',
        entityId: memberId,
        oldValues: { role: member.role.name },
        newValues: { role: newRole.name },
      });

      return m;
    });

    return updated;
  }

  async removeMember(organizationId: string, memberId: string, actor: Actor) {
    const member = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId, status: MemberStatus.ACTIVE },
      include: { role: true },
    });
    if (!member) throw new DomainException('MEMBER_NOT_FOUND', 'Member not found');

    // Protect last OWNER
    if (member.role.systemKey === SystemRoleKey.OWNER) {
      const ownerCount = await this.prisma.organizationMember.count({
        where: {
          organizationId,
          status: MemberStatus.ACTIVE,
          role: { systemKey: SystemRoleKey.OWNER },
        },
      });
      if (ownerCount <= 1) {
        throw new DomainException('LAST_OWNER', 'Cannot remove the last Owner of an organisation');
      }
    }

    await this.prisma.transaction(async (tx) => {
      await tx.organizationMember.update({
        where: { id: memberId },
        data: {
          status: MemberStatus.REMOVED,
          removedAt: new Date(),
        },
      });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.MEMBER_REMOVED,
        entityType: 'ORGANIZATION_MEMBER',
        entityId: memberId,
      });
    });

    return { success: true };
  }
}
