import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { DomainException } from '../common/errors/domain.exception';
import type { Actor } from '../common/types/request-context.types';
import { AuditService } from '../audit/audit.service';
import { AuditEvents } from '../audit/audit-events';
import { getExpectedNormalBalance } from './accounts.constants';
import type { CreateAccountDto, UpdateAccountDto, AccountFilterQueryDto } from './dto/account.dto';

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listAccounts(organizationId: string, filter: AccountFilterQueryDto) {
    const where: Prisma.AccountWhereInput = {
      organizationId,
      ...(filter.accountType ? { accountType: filter.accountType } : {}),
      ...(filter.isActive !== undefined ? { isActive: filter.isActive } : {}),
      ...(filter.search
        ? {
            OR: [
              { code: { contains: filter.search, mode: 'insensitive' } },
              { name: { contains: filter.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return this.prisma.account.findMany({
      where,
      orderBy: [{ code: 'asc' }],
      include: {
        parentAccount: { select: { id: true, code: true, name: true } },
        _count: { select: { journalLines: true, childAccounts: true } },
      },
    });
  }

  async getAccount(organizationId: string, accountId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, organizationId },
      include: {
        parentAccount: { select: { id: true, code: true, name: true } },
        childAccounts: { select: { id: true, code: true, name: true, isActive: true } },
        _count: { select: { journalLines: true } },
      },
    });
    if (!account) {
      throw new DomainException('ACCOUNT_NOT_FOUND', 'Account not found');
    }
    return account;
  }

  async createAccount(organizationId: string, dto: CreateAccountDto, actor: Actor) {
    // 1. Check duplicate code within organization
    const existing = await this.prisma.account.findUnique({
      where: {
        organizationId_code: {
          organizationId,
          code: dto.code,
        },
      },
    });
    if (existing) {
      throw new DomainException(
        'DUPLICATE_ACCOUNT_CODE',
        `An account with code "${dto.code}" already exists in this organisation`,
      );
    }

    // 2. Validate parent account if provided (must belong to same organization)
    if (dto.parentAccountId) {
      const parent = await this.prisma.account.findFirst({
        where: { id: dto.parentAccountId, organizationId },
      });
      if (!parent) {
        throw new DomainException('ACCOUNT_INVALID_PARENT', 'Parent account not found in this organisation');
      }
    }

    const normalBalance = getExpectedNormalBalance(dto.accountType);

    const account = await this.prisma.transaction(async (tx) => {
      const created = await tx.account.create({
        data: {
          organizationId,
          code: dto.code,
          name: dto.name,
          accountType: dto.accountType,
          accountSubtype: dto.accountSubtype,
          parentAccountId: dto.parentAccountId,
          normalBalance,
          reportGroup: dto.reportGroup,
          description: dto.description,
          currency: dto.currency,
          allowManualPosting: dto.allowManualPosting ?? true,
          isControlAccount: dto.isControlAccount ?? false,
          isActive: true,
          createdById: actor.userId,
        },
      });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.ACCOUNT_CREATED,
        entityType: 'ACCOUNT',
        entityId: created.id,
        newValues: { code: created.code, name: created.name, type: created.accountType },
      });

      return created;
    });

    return account;
  }

  async updateAccount(organizationId: string, accountId: string, dto: UpdateAccountDto, actor: Actor) {
    const account = await this.getAccount(organizationId, accountId);

    if (account.isSystemAccount) {
      throw new DomainException('ACCOUNT_PROTECTED', 'System accounts cannot be modified');
    }

    if (dto.parentAccountId) {
      if (dto.parentAccountId === accountId) {
        throw new DomainException('ACCOUNT_INVALID_PARENT', 'An account cannot be its own parent');
      }
      const parent = await this.prisma.account.findFirst({
        where: { id: dto.parentAccountId, organizationId },
      });
      if (!parent) {
        throw new DomainException('ACCOUNT_INVALID_PARENT', 'Parent account not found in this organisation');
      }
    }

    const updated = await this.prisma.transaction(async (tx) => {
      const res = await tx.account.update({
        where: { id: accountId },
        data: {
          name: dto.name,
          parentAccountId: dto.parentAccountId,
          reportGroup: dto.reportGroup,
          description: dto.description,
          allowManualPosting: dto.allowManualPosting,
          accountSubtype: dto.accountSubtype,
          updatedById: actor.userId,
        },
      });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.ACCOUNT_UPDATED,
        entityType: 'ACCOUNT',
        entityId: accountId,
        oldValues: account,
        newValues: res,
      });

      return res;
    });

    return updated;
  }

  async archiveAccount(organizationId: string, accountId: string, actor: Actor) {
    const account = await this.getAccount(organizationId, accountId);

    if (account.isSystemAccount) {
      throw new DomainException('ACCOUNT_PROTECTED', 'System accounts cannot be archived');
    }
    if (!account.isActive) {
      return account; // already archived
    }

    const updated = await this.prisma.transaction(async (tx) => {
      const res = await tx.account.update({
        where: { id: accountId },
        data: {
          isActive: false,
          archivedAt: new Date(),
          updatedById: actor.userId,
        },
      });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.ACCOUNT_ARCHIVED,
        entityType: 'ACCOUNT',
        entityId: accountId,
      });

      return res;
    });

    return updated;
  }

  async restoreAccount(organizationId: string, accountId: string, actor: Actor) {
    const account = await this.getAccount(organizationId, accountId);
    if (account.isActive) {
      return account;
    }

    const updated = await this.prisma.transaction(async (tx) => {
      const res = await tx.account.update({
        where: { id: accountId },
        data: {
          isActive: true,
          archivedAt: null,
          updatedById: actor.userId,
        },
      });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.ACCOUNT_RESTORED,
        entityType: 'ACCOUNT',
        entityId: accountId,
      });

      return res;
    });

    return updated;
  }

  async getAccountHierarchy(organizationId: string) {
    const accounts = await this.prisma.account.findMany({
      where: { organizationId, isActive: true },
      orderBy: [{ code: 'asc' }],
    });

    // Build tree
    type AccountNode = (typeof accounts)[number] & { children: AccountNode[] };
    const map = new Map<string, AccountNode>();
    accounts.forEach((a) => map.set(a.id, { ...a, children: [] }));

    const roots: AccountNode[] = [];
    accounts.forEach((a) => {
      const node = map.get(a.id);
      if (!node) return;
      if (a.parentAccountId && map.has(a.parentAccountId)) {
        map.get(a.parentAccountId)?.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }
}
