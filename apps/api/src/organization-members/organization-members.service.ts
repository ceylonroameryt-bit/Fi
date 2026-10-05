import { Injectable } from '@nestjs/common';
import { MemberStatus, SystemRoleKey, UserStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { DomainException } from '../common/errors/domain.exception';
import type { Actor } from '../common/types/request-context.types';
import { AuditService } from '../audit/audit.service';
import { AuditEvents } from '../audit/audit-events';
import { MailService } from '../auth/mail.service';
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

    // 2. Find or create user as INVITED
    let user = await this.prisma.user.findUnique({ where: { email: dto.email } });
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

    const member = await this.prisma.transaction(async (tx) => {
      let m;
      if (existingMember) {
        m = await tx.organizationMember.update({
          where: { id: existingMember.id },
          data: {
            roleId: dto.roleId,
            status: MemberStatus.ACTIVE,
            removedAt: null,
            joinedAt: new Date(),
          },
          include: { user: { select: safeUserSelect }, role: { select: safeRoleSelect } },
        });
      } else {
        m = await tx.organizationMember.create({
          data: {
            organizationId,
            userId: user.id,
            roleId: dto.roleId,
            status: MemberStatus.ACTIVE,
            invitedById: actor.userId,
            joinedAt: new Date(),
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

    await this.mail.send({
      to: dto.email,
      subject: 'You have been invited to join an organisation on Warp Ledger',
      text: `You have been added as ${role.name}. Log in to view: /login`,
    });

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
