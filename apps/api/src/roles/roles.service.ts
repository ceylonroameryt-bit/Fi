import { Injectable } from '@nestjs/common';
import { PrismaService, Tx } from '../database/prisma.service';
import { DomainException } from '../common/errors/domain.exception';
import type { Actor } from '../common/types/request-context.types';
import { AuditService } from '../audit/audit.service';
import { AuditEvents } from '../audit/audit-events';
import { SYSTEM_PERMISSIONS, SYSTEM_ROLE_PERMISSIONS } from './roles.constants';
import { SystemRoleKey } from '@prisma/client';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async seedGlobalPermissions(): Promise<void> {
    for (const perm of SYSTEM_PERMISSIONS) {
      await this.prisma.permission.upsert({
        where: { code: perm.code },
        create: {
          code: perm.code,
          description: perm.description,
          category: perm.category,
        },
        update: {
          description: perm.description,
          category: perm.category,
        },
      });
    }
  }

  async createDefaultRolesForOrg(tx: Tx, organizationId: string): Promise<Record<SystemRoleKey, string>> {
    const permissions = await tx.permission.findMany();
    const permMap = new Map(permissions.map((p) => [p.code, p.id]));
    const roleIdMap: Partial<Record<SystemRoleKey, string>> = {};

    const rolesDef: Array<{ key: SystemRoleKey; name: string; description: string }> = [
      { key: 'OWNER', name: 'Owner', description: 'Full access to organization and financial settings' },
      { key: 'ADMINISTRATOR', name: 'Administrator', description: 'Administrative and accounting management' },
      { key: 'ACCOUNTANT', name: 'Accountant', description: 'Full access to accounting books and periods' },
      { key: 'BOOKKEEPER', name: 'Bookkeeper', description: 'Draft journal entry, validation, and viewing' },
      { key: 'VIEWER', name: 'Viewer', description: 'Read-only access to accounts and journals' },
    ];

    for (const def of rolesDef) {
      const role = await tx.role.create({
        data: {
          organizationId,
          name: def.name,
          description: def.description,
          systemKey: def.key,
          isSystemRole: true,
        },
      });

      roleIdMap[def.key] = role.id;

      const permCodes = SYSTEM_ROLE_PERMISSIONS[def.key] ?? [];
      const rolePermsData = permCodes
        .map((code) => permMap.get(code))
        .filter((id): id is string => Boolean(id))
        .map((permissionId) => ({
          roleId: role.id,
          permissionId,
        }));

      if (rolePermsData.length > 0) {
        await tx.rolePermission.createMany({
          data: rolePermsData,
        });
      }
    }

    return roleIdMap as Record<SystemRoleKey, string>;
  }

  async listRoles(organizationId: string) {
    return this.prisma.role.findMany({
      where: { organizationId },
      include: {
        permissions: {
          include: { permission: true },
        },
        _count: { select: { members: true } },
      },
      orderBy: [{ isSystemRole: 'desc' }, { name: 'asc' }],
    });
  }

  async listPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [{ category: 'asc' }, { code: 'asc' }],
    });
  }

  async getRole(organizationId: string, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organizationId },
      include: {
        permissions: { include: { permission: true } },
      },
    });
    if (!role) throw new DomainException('ROLE_NOT_FOUND', 'Role not found');
    return role;
  }

  async createRole(
    organizationId: string,
    dto: { name: string; description?: string; permissionCodes: string[] },
    actor: Actor,
  ) {
    const existing = await this.prisma.role.findFirst({
      where: { organizationId, name: { equals: dto.name, mode: 'insensitive' } },
    });
    if (existing) {
      throw new DomainException('DUPLICATE_ROLE_NAME', `A role named "${dto.name}" already exists`);
    }

    const permissions = await this.prisma.permission.findMany({
      where: { code: { in: dto.permissionCodes } },
    });
    if (permissions.length !== dto.permissionCodes.length) {
      throw new DomainException('PERMISSION_NOT_FOUND', 'One or more invalid permission codes provided');
    }

    const role = await this.prisma.transaction(async (tx) => {
      const created = await tx.role.create({
        data: {
          organizationId,
          name: dto.name,
          description: dto.description,
          isSystemRole: false,
          permissions: {
            create: permissions.map((p) => ({ permissionId: p.id })),
          },
        },
        include: { permissions: { include: { permission: true } } },
      });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.ROLE_CREATED,
        entityType: 'ROLE',
        entityId: created.id,
        newValues: { name: created.name, permissions: dto.permissionCodes },
      });

      return created;
    });

    return role;
  }

  async updateRole(
    organizationId: string,
    roleId: string,
    dto: { name?: string; description?: string; permissionCodes?: string[] },
    actor: Actor,
  ) {
    const role = await this.getRole(organizationId, roleId);
    if (role.isSystemRole) {
      throw new DomainException('ROLE_PROTECTED', 'System roles cannot be modified');
    }

    if (dto.name && dto.name !== role.name) {
      const existing = await this.prisma.role.findFirst({
        where: { organizationId, name: { equals: dto.name, mode: 'insensitive' }, id: { not: roleId } },
      });
      if (existing) throw new DomainException('DUPLICATE_ROLE_NAME', `A role named "${dto.name}" already exists`);
    }

    const updated = await this.prisma.transaction(async (tx) => {
      if (dto.permissionCodes) {
        const perms = await tx.permission.findMany({ where: { code: { in: dto.permissionCodes } } });
        if (perms.length !== dto.permissionCodes.length) {
          throw new DomainException('PERMISSION_NOT_FOUND', 'One or more invalid permission codes');
        }
        await tx.rolePermission.deleteMany({ where: { roleId } });
        await tx.rolePermission.createMany({
          data: perms.map((p) => ({ roleId, permissionId: p.id })),
        });
      }

      const res = await tx.role.update({
        where: { id: roleId },
        data: {
          name: dto.name,
          description: dto.description,
        },
        include: { permissions: { include: { permission: true } } },
      });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.ROLE_UPDATED,
        entityType: 'ROLE',
        entityId: roleId,
        newValues: dto,
      });

      return res;
    });

    return updated;
  }
}
