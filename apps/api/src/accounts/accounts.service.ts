import { auditDiff } from '../audit/audit-diff';
import { Injectable } from '@nestjs/common';
import { AccountSubtype, AccountType, JournalStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { DomainException } from '../common/errors/domain.exception';
import type { Actor } from '../common/types/request-context.types';
import { AuditService } from '../audit/audit.service';
import { AuditEvents } from '../audit/audit-events';
import { getExpectedNormalBalance, DEFAULT_CHART_OF_ACCOUNTS, SUBTYPE_ACCOUNT_TYPE } from './accounts.constants';
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

    this.assertSubtypeMatchesType(dto.accountType, dto.accountSubtype);

    // 2. Validate parent account if provided (must belong to same organization and type)
    if (dto.parentAccountId) {
      const parent = await this.prisma.account.findFirst({
        where: { id: dto.parentAccountId, organizationId },
      });
      if (!parent) {
        throw new DomainException('ACCOUNT_INVALID_PARENT', 'Parent account not found in this organisation');
      }
      if (parent.accountType !== dto.accountType) {
        throw new DomainException('ACCOUNT_INVALID_PARENT', 'A parent account must have the same account type');
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

    if (dto.accountSubtype !== undefined) {
      this.assertSubtypeMatchesType(account.accountType, dto.accountSubtype);
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
      if (parent.accountType !== account.accountType) {
        throw new DomainException('ACCOUNT_INVALID_PARENT', 'A parent account must have the same account type');
      }
      await this.assertNoHierarchyCycle(organizationId, accountId, dto.parentAccountId);
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
        ...auditDiff(account as unknown as Record<string, unknown>, res as unknown as Record<string, unknown>),
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

    await this.assertArchivable(organizationId, account);

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

  async applyTemplate(organizationId: string, actor: Actor) {
    const existingAccounts = await this.prisma.account.findMany({
      where: { organizationId },
      select: { code: true },
    });
    const existingCodes = new Set(existingAccounts.map((a) => a.code));

    const toCreate = DEFAULT_CHART_OF_ACCOUNTS.filter((a) => !existingCodes.has(a.code));

    if (toCreate.length > 0) {
      await this.prisma.account.createMany({
        data: toCreate.map((a) => ({
          organizationId,
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
        })),
      });

      await this.audit.record(null, actor, {
        organizationId,
        eventType: AuditEvents.CHART_OF_ACCOUNTS_TEMPLATE_APPLIED,
        entityType: 'CHART_OF_ACCOUNTS',
        entityId: organizationId,
        newValues: { addedAccounts: toCreate.length },
      });
    }

    return { createdCount: toCreate.length, totalTemplateCount: DEFAULT_CHART_OF_ACCOUNTS.length };
  }

  private assertSubtypeMatchesType(type: AccountType, subtype?: AccountSubtype | null): void {
    if (subtype && SUBTYPE_ACCOUNT_TYPE[subtype] !== type) {
      throw new DomainException(
        'VALIDATION_FAILED',
        `Subtype ${subtype} belongs to ${SUBTYPE_ACCOUNT_TYPE[subtype]} accounts, not ${type}`,
        { fields: { accountSubtype: ['does not match the account type'] } },
      );
    }
  }

  /** Walks up from the proposed parent; reaching this account again would create a loop. */
  private async assertNoHierarchyCycle(organizationId: string, accountId: string, parentId: string): Promise<void> {
    let current: string | null = parentId;
    for (let depth = 0; current && depth < 50; depth++) {
      if (current === accountId) {
        throw new DomainException('ACCOUNT_INVALID_PARENT', 'That parent would create a loop in the account hierarchy');
      }
      const next: { parentAccountId: string | null } | null = await this.prisma.account.findFirst({
        where: { id: current, organizationId },
        select: { parentAccountId: true },
      });
      current = next?.parentAccountId ?? null;
    }
  }

  /**
   * An account can be archived only when nothing depends on it: no balance, no active
   * sub-accounts, no customer/supplier using it as a control account, and it is not the
   * last active receivables or VAT account (invoice posting needs those).
   */
  private async assertArchivable(
    organizationId: string,
    account: { id: string; code: string; accountSubtype: AccountSubtype | null },
  ): Promise<void> {
    const totals = await this.prisma.journalLine.aggregate({
      where: {
        organizationId,
        accountId: account.id,
        journalEntry: { status: { in: [JournalStatus.POSTED, JournalStatus.REVERSED] } },
      },
      _sum: { debit: true, credit: true },
    });
    const balance = new Prisma.Decimal(totals._sum.debit ?? 0).sub(new Prisma.Decimal(totals._sum.credit ?? 0));
    if (!balance.isZero()) {
      throw new DomainException('ACCOUNT_HAS_BALANCE', `Account ${account.code} has a balance of ${balance.toFixed(2)}; clear it before archiving`);
    }

    const activeChildren = await this.prisma.account.count({
      where: { organizationId, parentAccountId: account.id, isActive: true },
    });
    if (activeChildren > 0) {
      throw new DomainException('ACCOUNT_HAS_CHILDREN', `Account ${account.code} has active sub-accounts; archive those first`);
    }

    const contactsUsing = await this.prisma.contact.count({
      where: {
        organizationId,
        OR: [{ receivableAccountId: account.id }, { payableAccountId: account.id }],
      },
    });
    if (contactsUsing > 0) {
      throw new DomainException('ACCOUNT_IN_USE', `Account ${account.code} is the control account for ${contactsUsing} contact(s)`);
    }

    if (
      account.accountSubtype === AccountSubtype.ACCOUNTS_RECEIVABLE ||
      account.accountSubtype === AccountSubtype.TAX_PAYABLE
    ) {
      const others = await this.prisma.account.count({
        where: { organizationId, accountSubtype: account.accountSubtype, isActive: true, id: { not: account.id } },
      });
      if (others === 0) {
        throw new DomainException(
          'ACCOUNT_IN_USE',
          `Account ${account.code} is the only active ${account.accountSubtype === AccountSubtype.TAX_PAYABLE ? 'VAT' : 'receivables'} account; invoices need it`,
        );
      }
    }
  }
}
