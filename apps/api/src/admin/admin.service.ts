import { Injectable } from '@nestjs/common';
import { OrganizationStatus, UserStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditEvents } from '../audit/audit-events';
import { PasswordService } from '../auth/password.service';
import { DomainException } from '../common/errors/domain.exception';
import type { Actor } from '../common/types/request-context.types';
import { AdminPaginationQueryDto } from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly passwords: PasswordService,
  ) {}

  /**
   * Platform-wide aggregated metrics and KPI counters.
   */
  async getPlatformStats() {
    const startDb = Date.now();
    await this.prisma.$queryRaw`SELECT 1`;
    const dbLatencyMs = Date.now() - startDb;

    const [
      totalOrgs,
      activeOrgs,
      suspendedOrgs,
      totalUsers,
      activeUsers,
      superAdminCount,
      totalJournals,
      postedJournals,
      totalInvoices,
      ledgerAgg,
    ] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.organization.count({ where: { status: OrganizationStatus.ACTIVE } }),
      this.prisma.organization.count({ where: { status: OrganizationStatus.SUSPENDED } }),
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      this.prisma.user.count({ where: { isSuperAdmin: true } }),
      this.prisma.journalEntry.count(),
      this.prisma.journalEntry.count({ where: { status: 'POSTED' } }),
      this.prisma.invoice.count(),
      this.prisma.journalLine.aggregate({
        _sum: { debit: true },
      }),
    ]);

    const mem = process.memoryUsage();

    return {
      tenants: {
        total: totalOrgs,
        active: activeOrgs,
        suspended: suspendedOrgs,
        archived: totalOrgs - activeOrgs - suspendedOrgs,
      },
      users: {
        total: totalUsers,
        active: activeUsers,
        superAdmins: superAdminCount,
      },
      ledger: {
        totalJournals,
        postedJournals,
        totalInvoices,
        totalVolume: ledgerAgg._sum.debit?.toString() || '0',
      },
      health: {
        status: 'HEALTHY',
        databaseLatencyMs: dbLatencyMs,
        uptimeSeconds: Math.floor(process.uptime()),
        memoryRssMb: Math.round(mem.rss / 1024 / 1024),
        memoryHeapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        nodeVersion: process.version,
        platform: process.platform,
      },
    };
  }

  /**
   * List organizations across the entire platform with pagination and search.
   */
  async listOrganizations(query: AdminPaginationQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.OrganizationWhereInput = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { legalName: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.status && Object.values(OrganizationStatus).includes(query.status as OrganizationStatus)) {
      where.status = query.status as OrganizationStatus;
    }

    const [items, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          _count: {
            select: {
              members: true,
              journals: true,
              invoices: true,
              accounts: true,
            },
          },
        },
      }),
      this.prisma.organization.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  /**
   * Get organization deep details for platform administrators.
   */
  async getOrganizationDetails(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        members: {
          include: {
            user: { select: { id: true, email: true, firstName: true, lastName: true, status: true } },
            role: { select: { id: true, name: true, systemKey: true, isSystemRole: true } },
          },
        },
        _count: {
          select: {
            members: true,
            journals: true,
            invoices: true,
            accounts: true,
            contacts: true,
          },
        },
      },
    });

    if (!org) {
      throw new DomainException('NOT_FOUND', 'Organization not found');
    }

    // Recent 5 journals and 5 invoices
    const [recentJournals, recentInvoices] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where: { organizationId: id },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, journalNumber: true, journalType: true, status: true, journalDate: true, description: true },
      }),
      this.prisma.invoice.findMany({
        where: { organizationId: id },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, invoiceNumber: true, status: true, totalAmount: true, issueDate: true, contact: { select: { name: true } } },
      }),
    ]);

    return { ...org, recentJournals, recentInvoices };
  }

  /**
   * Update tenant organization status (ACTIVE, SUSPENDED, ARCHIVED).
   */
  async updateOrganizationStatus(id: string, status: OrganizationStatus, actor: Actor) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) {
      throw new DomainException('NOT_FOUND', 'Organization not found');
    }

    const updated = await this.prisma.transaction(async (tx) => {
      const result = await tx.organization.update({
        where: { id },
        data: { status },
      });

      await this.audit.record(tx, actor, {
        organizationId: id,
        eventType: AuditEvents.ADMIN_ORG_STATUS_CHANGED,
        entityType: 'ORGANIZATION',
        entityId: id,
        oldValues: { status: org.status },
        newValues: { status },
      });

      return result;
    });

    return updated;
  }

  /**
   * List all global users with pagination and search.
   */
  async listUsers(query: AdminPaginationQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.UserWhereInput = {};
    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.status && Object.values(UserStatus).includes(query.status as UserStatus)) {
      where.status = query.status as UserStatus;
    }
    if (query.superAdminOnly) {
      where.isSuperAdmin = true;
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          isSuperAdmin: true,
          emailVerified: true,
          lastLoginAt: true,
          createdAt: true,
          _count: {
            select: {
              memberships: true,
              organizationsCreated: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  /**
   * Toggle user active/suspended status.
   */
  async updateUserStatus(id: string, status: UserStatus, actor: Actor) {
    if (actor.userId === id && status !== UserStatus.ACTIVE) {
      throw new DomainException('SUPER_ADMIN_CANNOT_DEMOTE_SELF', 'Cannot suspend or disable your own super admin account');
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new DomainException('NOT_FOUND', 'User not found');
    }

    if (user.isSuperAdmin && status !== UserStatus.ACTIVE) {
      const otherActiveSuperAdmins = await this.prisma.user.count({
        where: {
          isSuperAdmin: true,
          status: UserStatus.ACTIVE,
          id: { not: id },
        },
      });
      if (otherActiveSuperAdmins === 0) {
        throw new DomainException(
          'CANNOT_SUSPEND_LAST_SUPER_ADMIN',
          'Cannot suspend or disable the last active platform super administrator',
        );
      }
    }

    const updated = await this.prisma.transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id },
        data: { status },
      });

      if (status !== UserStatus.ACTIVE) {
        await tx.session.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      await this.audit.record(tx, actor, {
        organizationId: null,
        eventType: AuditEvents.ADMIN_USER_STATUS_CHANGED,
        entityType: 'USER',
        entityId: id,
        oldValues: { status: user.status },
        newValues: { status },
      });

      return result;
    });

    return { id: updated.id, email: updated.email, status: updated.status };
  }

  /**
   * Toggle isSuperAdmin flag for a user.
   */
  async toggleSuperAdmin(id: string, isSuperAdmin: boolean, actor: Actor) {
    if (actor.userId === id && !isSuperAdmin) {
      throw new DomainException('SUPER_ADMIN_CANNOT_DEMOTE_SELF', 'Cannot remove super admin privileges from yourself');
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new DomainException('NOT_FOUND', 'User not found');
    }

    if (!isSuperAdmin && user.isSuperAdmin) {
      const otherActiveSuperAdmins = await this.prisma.user.count({
        where: {
          isSuperAdmin: true,
          status: UserStatus.ACTIVE,
          id: { not: id },
        },
      });
      if (otherActiveSuperAdmins === 0) {
        throw new DomainException(
          'CANNOT_REMOVE_LAST_SUPER_ADMIN',
          'Cannot remove platform super administrator privileges from the last active super admin',
        );
      }
    }

    const updated = await this.prisma.transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id },
        data: { isSuperAdmin },
      });

      await this.audit.record(tx, actor, {
        organizationId: null,
        eventType: AuditEvents.ADMIN_USER_SUPER_ADMIN_TOGGLED,
        entityType: 'USER',
        entityId: id,
        oldValues: { isSuperAdmin: user.isSuperAdmin },
        newValues: { isSuperAdmin },
      });

      return result;
    });

    return { id: updated.id, email: updated.email, isSuperAdmin: updated.isSuperAdmin };
  }

  /**
   * Force reset a user's password and invalidate their active sessions.
   */
  async resetUserPassword(id: string, newPassword: string, actor: Actor) {
    this.passwords.assertStrong(newPassword);

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new DomainException('NOT_FOUND', 'User not found');
    }

    const passwordHash = await this.passwords.hash(newPassword);

    await this.prisma.transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
      });

      // Revoke all existing sessions
      await tx.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await this.audit.record(tx, actor, {
        organizationId: null,
        eventType: AuditEvents.ADMIN_USER_PASSWORD_RESET,
        entityType: 'USER',
        entityId: id,
      });
    });

    return { success: true, message: `Password reset successfully for ${user.email}. Active sessions revoked.` };
  }

  /**
   * System-wide audit log query with cross-tenant capability.
   */
  async getAuditLogs(query: AdminPaginationQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 30;
    const skip = (page - 1) * pageSize;

    const where: Prisma.AuditLogWhereInput = {};
    if (query.search) {
      where.OR = [
        { eventType: { contains: query.search, mode: 'insensitive' } },
        { entityType: { contains: query.search, mode: 'insensitive' } },
        { user: { email: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          organization: { select: { id: true, name: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }
}
