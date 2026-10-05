import { Injectable } from '@nestjs/common';
import { MemberStatus, OrganizationStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { DomainException } from '../common/errors/domain.exception';
import type { Actor, OrgContext } from '../common/types/request-context.types';
import { AuditService } from '../audit/audit.service';
import { AuditEvents } from '../audit/audit-events';
import { RolesService } from '../roles/roles.service';
import { DEFAULT_CHART_OF_ACCOUNTS } from '../accounts/accounts.constants';
import type { CreateOrganizationDto, UpdateOrganizationDto } from './dto/organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roles: RolesService,
    private readonly audit: AuditService,
  ) {}

  async createOrganization(dto: CreateOrganizationDto, actor: Actor) {
    return this.prisma.transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: dto.name,
          legalName: dto.legalName,
          registrationNumber: dto.registrationNumber,
          country: dto.country,
          baseCurrency: dto.baseCurrency,
          timezone: dto.timezone || 'UTC',
          financialYearStartMonth: dto.financialYearStartMonth ?? 4,
          financialYearStartDay: dto.financialYearStartDay ?? 1,
          taxNumber: dto.taxNumber,
          addressLine1: dto.addressLine1,
          addressLine2: dto.addressLine2,
          city: dto.city,
          postcode: dto.postcode,
          status: OrganizationStatus.ACTIVE,
          createdById: actor.userId!,
        },
      });

      // 1. Seed default roles for this organisation
      const roleMap = await this.roles.createDefaultRolesForOrg(tx, org.id);
      const ownerRoleId = roleMap['OWNER'];

      // 2. Add creator as OWNER member
      await tx.organizationMember.create({
        data: {
          organizationId: org.id,
          userId: actor.userId!,
          roleId: ownerRoleId,
          status: MemberStatus.ACTIVE,
          joinedAt: new Date(),
        },
      });

      // 3. Set active organisation for current session
      if (actor.sessionId) {
        await tx.session.update({
          where: { id: actor.sessionId },
          data: { activeOrganizationId: org.id },
        });
      }

      // 4. Optionally seed default Chart of Accounts
      if (dto.useDefaultChartOfAccounts !== false) {
        const accountsData = DEFAULT_CHART_OF_ACCOUNTS.map((a) => ({
          organizationId: org.id,
          code: a.code,
          name: a.name,
          accountType: a.type,
          accountSubtype: a.subtype,
          normalBalance: a.normalBalance,
          reportGroup: a.reportGroup,
          description: a.description,
          allowManualPosting: a.allowManualPosting,
          isControlAccount: a.isControlAccount ?? false,
          isSystemAccount: false,
          isActive: true,
          createdById: actor.userId,
        }));

        await tx.account.createMany({ data: accountsData });

        await this.audit.record(tx, actor, {
          organizationId: org.id,
          eventType: AuditEvents.CHART_OF_ACCOUNTS_TEMPLATE_APPLIED,
          entityType: 'CHART_OF_ACCOUNTS',
          entityId: org.id,
          newValues: { accountCount: accountsData.length },
        });
      }

      await this.audit.record(tx, actor, {
        organizationId: org.id,
        eventType: AuditEvents.ORGANIZATION_CREATED,
        entityType: 'ORGANIZATION',
        entityId: org.id,
        newValues: { name: org.name, baseCurrency: org.baseCurrency, country: org.country },
      });

      return org;
    });
  }

  async listUserOrganizations(userId: string) {
    const memberships = await this.prisma.organizationMember.findMany({
      where: {
        userId,
        status: MemberStatus.ACTIVE,
        organization: { status: { not: OrganizationStatus.ARCHIVED } },
      },
      include: {
        organization: true,
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
      },
      orderBy: { organization: { name: 'asc' } },
    });

    return memberships.map((m) => ({
      organization: m.organization,
      memberId: m.id,
      role: {
        id: m.role.id,
        name: m.role.name,
        systemKey: m.role.systemKey,
        isSystemRole: m.role.isSystemRole,
        permissions: m.role.permissions.map((p) => p.permission.code),
      },
    }));
  }

  async getOrganization(organizationId: string, userId: string) {
    await this.validateOrganizationAccess(organizationId, userId);
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        _count: {
          select: { members: true, accounts: true, journals: true },
        },
      },
    });
    if (!org) throw new DomainException('ORGANIZATION_ACCESS_DENIED', 'Organisation not found');
    return org;
  }

  async updateOrganization(organizationId: string, dto: UpdateOrganizationDto, actor: Actor) {
    if (actor.userId) {
      await this.validateOrganizationAccess(organizationId, actor.userId);
    }

    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new DomainException('ORGANIZATION_ACCESS_DENIED', 'Organisation not found');

    const updated = await this.prisma.transaction(async (tx) => {
      const res = await tx.organization.update({
        where: { id: organizationId },
        data: dto,
      });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.ORGANIZATION_UPDATED,
        entityType: 'ORGANIZATION',
        entityId: organizationId,
        oldValues: org,
        newValues: res,
      });

      return res;
    });

    return updated;
  }

  async archiveOrganization(organizationId: string, actor: Actor) {
    if (actor.userId) {
      await this.validateOrganizationAccess(organizationId, actor.userId);
    }

    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new DomainException('ORGANIZATION_ACCESS_DENIED', 'Organisation not found');

    await this.prisma.transaction(async (tx) => {
      await tx.organization.update({
        where: { id: organizationId },
        data: { status: OrganizationStatus.ARCHIVED },
      });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.ORGANIZATION_ARCHIVED,
        entityType: 'ORGANIZATION',
        entityId: organizationId,
      });
    });

    return { success: true };
  }

  async switchOrganization(organizationId: string, userId: string, sessionId: string | null, actor: Actor) {
    const member = await this.validateOrganizationAccess(organizationId, userId);

    if (sessionId) {
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { activeOrganizationId: organizationId },
      });
    }

    await this.audit.record(null, actor, {
      organizationId,
      eventType: AuditEvents.ORGANIZATION_SWITCHED,
      entityType: 'ORGANIZATION',
      entityId: organizationId,
    });

    return {
      activeOrganizationId: organizationId,
      organizationName: member.organization.name,
      baseCurrency: member.organization.baseCurrency,
      role: member.role.name,
    };
  }

  /**
   * CRITICAL TENANT ISOLATION CHECK:
   * 1. Finds organisation
   * 2. Checks organisation is active
   * 3. Checks user has active membership
   * 4. Resolves permissions
   * Throws ORGANIZATION_ACCESS_DENIED or ORGANIZATION_INACTIVE on any failure.
   */
  async validateOrganizationAccess(organizationId: string, userId: string): Promise<OrgContext & { organization: unknown; role: unknown }> {
    const member = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
      include: {
        organization: true,
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    if (!member || member.status !== MemberStatus.ACTIVE) {
      throw new DomainException('ORGANIZATION_ACCESS_DENIED', 'You do not have access to this organisation');
    }

    if (member.organization.status !== OrganizationStatus.ACTIVE) {
      throw new DomainException('ORGANIZATION_INACTIVE', 'This organisation is suspended or archived');
    }

    const permissionSet = new Set<string>(
      member.role.permissions.map((rp) => rp.permission.code),
    );

    return {
      organizationId: member.organizationId,
      memberId: member.id,
      roleId: member.roleId,
      roleName: member.role.name,
      systemRoleKey: member.role.systemKey,
      permissions: permissionSet,
      baseCurrency: member.organization.baseCurrency,
      organization: member.organization,
      role: member.role,
    };
  }
}
