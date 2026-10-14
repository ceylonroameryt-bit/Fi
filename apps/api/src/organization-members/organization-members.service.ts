import { Inject, Injectable, Optional } from '@nestjs/common';
import { MemberStatus, SystemRoleKey, UserStatus, UserTokenType } from '@prisma/client';
import { PrismaService, Tx } from '../database/prisma.service';
import { DomainException } from '../common/errors/domain.exception';
import type { Actor, OrgContext } from '../common/types/request-context.types';
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

const INVITATION_TTL_MS = 7 * 86_400_000;

type RoleWithPermissions = {
  id: string;
  name: string;
  systemKey: SystemRoleKey | null;
  permissions?: Array<{ permission: { code: string } }>;
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
        user: { select: safeUserSelect },
        role: { select: safeRoleSelect },
      },
      orderBy: [{ role: { name: 'asc' } }, { createdAt: 'asc' }],
    });
  }

  /**
   * Invites a user to the organisation. Every invite (new or existing user) creates a
   * pending INVITED membership plus a single-use token scoped to this organisation.
   * Existing users are never added without accepting.
   */
  async inviteMember(organizationId: string, dto: InviteMemberDto, actor: Actor, actorContext?: OrgContext) {
    const role = await this.prisma.role.findFirst({
      where: { id: dto.roleId, organizationId },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) {
      throw new DomainException('ROLE_NOT_FOUND', 'The specified role does not exist in this organisation');
    }
    this.assertCanAssignRole(actorContext, role);

    let user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      user = await this.prisma.user.create({
        data: { email: dto.email, status: UserStatus.INVITED, emailVerified: false },
      });
    }

    const existingMember = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: user.id } },
    });
    if (existingMember && existingMember.status === MemberStatus.ACTIVE) {
      throw new DomainException('MEMBER_ALREADY_EXISTS', 'This user is already an active member of this organisation');
    }

    const tokenService = this.requireTokens();
    const invitationRaw = tokenService.generate();
    const tokenHash = tokenService.hash(invitationRaw);
    const userId = user.id;

    const member = await this.prisma.transaction(async (tx) => {
      const data = {
        roleId: dto.roleId,
        status: MemberStatus.INVITED,
        removedAt: null,
        joinedAt: null,
        invitedById: actor.userId,
      };
      const m = existingMember
        ? await tx.organizationMember.update({
            where: { id: existingMember.id },
            data,
            include: { user: { select: safeUserSelect }, role: { select: safeRoleSelect } },
          })
        : await tx.organizationMember.create({
            data: { organizationId, userId, ...data },
            include: { user: { select: safeUserSelect }, role: { select: safeRoleSelect } },
          });

      await tx.userToken.create({
        data: {
          userId,
          organizationId,
          type: UserTokenType.INVITATION,
          tokenHash,
          expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
        },
      });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.USER_INVITED,
        entityType: 'ORGANIZATION_MEMBER',
        entityId: m.id,
        newValues: { email: dto.email, role: role.name },
      });

      return m;
    });

    const frontendUrl = this.config?.FRONTEND_URL || 'http://localhost:3000';
    await this.mail.send({
      to: dto.email,
      subject: 'You have been invited to join an organisation on Blynt',
      text: `You have been invited as ${role.name}. Open the link to accept the invitation.`,
      link: `${frontendUrl}/accept-invitation?token=${invitationRaw}`,
    });

    return member;
  }

  async updateMemberRole(
    organizationId: string,
    memberId: string,
    dto: UpdateMemberRoleDto,
    actor: Actor,
    actorContext?: OrgContext,
  ) {
    const member = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId, status: { in: [MemberStatus.ACTIVE, MemberStatus.INVITED] } },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
    if (!member) throw new DomainException('MEMBER_NOT_FOUND', 'Member not found');

    const newRole = await this.prisma.role.findFirst({
      where: { id: dto.roleId, organizationId },
      include: { permissions: { include: { permission: true } } },
    });
    if (!newRole) throw new DomainException('ROLE_NOT_FOUND', 'Role not found');

    // The actor must be allowed to manage the member's current role and to grant the new one.
    this.assertCanManageMember(actorContext, member.role, member.id);
    this.assertCanAssignRole(actorContext, newRole);

    const updated = await this.prisma.transaction(async (tx) => {
      if (member.role.systemKey === SystemRoleKey.OWNER && newRole.systemKey !== SystemRoleKey.OWNER) {
        await this.assertNotLastOwner(tx, organizationId);
      }

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

  async removeMember(organizationId: string, memberId: string, actor: Actor, actorContext?: OrgContext) {
    const member = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId, status: { in: [MemberStatus.ACTIVE, MemberStatus.INVITED] } },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
    if (!member) throw new DomainException('MEMBER_NOT_FOUND', 'Member not found');

    this.assertCanManageMember(actorContext, member.role, member.id, { allowSelf: true });

    await this.prisma.transaction(async (tx) => {
      if (member.role.systemKey === SystemRoleKey.OWNER && member.status === MemberStatus.ACTIVE) {
        await this.assertNotLastOwner(tx, organizationId);
      }

      await tx.organizationMember.update({
        where: { id: memberId },
        data: { status: MemberStatus.REMOVED, removedAt: new Date() },
      });

      // Pending invitations to this organisation can no longer be used.
      await tx.userToken.updateMany({
        where: { userId: member.userId, organizationId, type: UserTokenType.INVITATION, usedAt: null },
        data: { usedAt: new Date() },
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

  // ─────────────────────────── Authorisation helpers ───────────────────────────

  /**
   * Prevents privilege escalation: only Owners may grant the Owner role, and nobody may
   * grant a role carrying permissions they do not hold themselves.
   */
  private assertCanAssignRole(actorContext: OrgContext | undefined, role: RoleWithPermissions): void {
    if (!actorContext) return;
    const actorIsOwner = actorContext.systemRoleKey === SystemRoleKey.OWNER;
    if (role.systemKey === SystemRoleKey.OWNER && !actorIsOwner) {
      throw new DomainException('PERMISSION_DENIED', 'Only an Owner can grant the Owner role');
    }
    if (actorIsOwner) return;
    const missing = this.permissionCodes(role).filter((code) => !actorContext.permissions.has(code));
    if (missing.length > 0) {
      throw new DomainException(
        'PERMISSION_DENIED',
        `You cannot grant the role "${role.name}" because it includes permissions you do not have`,
        { missingPermissions: missing },
      );
    }
  }

  /** Non-owners may only manage members whose role is no more powerful than their own. */
  private assertCanManageMember(
    actorContext: OrgContext | undefined,
    currentRole: RoleWithPermissions,
    memberId: string,
    opts: { allowSelf?: boolean } = {},
  ): void {
    if (!actorContext) return;
    if (memberId === actorContext.memberId) {
      if (opts.allowSelf) return;
      throw new DomainException('PERMISSION_DENIED', 'You cannot change your own role');
    }
    if (actorContext.systemRoleKey === SystemRoleKey.OWNER) return;
    if (currentRole.systemKey === SystemRoleKey.OWNER) {
      throw new DomainException('PERMISSION_DENIED', 'Only an Owner can change or remove another Owner');
    }
    const missing = this.permissionCodes(currentRole).filter((code) => !actorContext.permissions.has(code));
    if (missing.length > 0) {
      throw new DomainException('PERMISSION_DENIED', 'You cannot manage a member whose role has permissions you do not have');
    }
  }

  private permissionCodes(role: RoleWithPermissions): string[] {
    return (role.permissions ?? []).map((rp) => rp.permission.code);
  }

  private async assertNotLastOwner(tx: Tx, organizationId: string): Promise<void> {
    const ownerCount = await tx.organizationMember.count({
      where: { organizationId, status: MemberStatus.ACTIVE, role: { systemKey: SystemRoleKey.OWNER } },
    });
    if (ownerCount <= 1) {
      throw new DomainException('LAST_OWNER', 'Organisation must have at least one Owner');
    }
  }

  private requireTokens(): TokenService {
    if (!this.tokens) {
      throw new DomainException('SERVICE_UNAVAILABLE', 'Invitation tokens are not configured');
    }
    return this.tokens;
  }
}
