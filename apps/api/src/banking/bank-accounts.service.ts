import { Injectable } from '@nestjs/common';
import { AccountSubtype, BankAccountStatus, JournalStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditEvents } from '../audit/audit-events';
import { DomainException } from '../common/errors/domain.exception';
import type { Actor } from '../common/types/request-context.types';
import { CreateBankAccountDto, UpdateBankAccountDto } from './dto/create-bank-account.dto';

@Injectable()
export class BankAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createBankAccount(organizationId: string, dto: CreateBankAccountDto, actor: Actor) {
    // 1. Verify nominal account exists, is active and is of subtype BANK or CASH
    const nominal = await this.prisma.account.findFirst({
      where: { id: dto.nominalAccountId, organizationId, isActive: true },
    });

    if (!nominal) {
      throw new DomainException('ACCOUNT_NOT_FOUND', 'Nominal account not found in Chart of Accounts');
    }

    if (nominal.accountSubtype !== AccountSubtype.BANK && nominal.accountSubtype !== AccountSubtype.CASH) {
      throw new DomainException(
        'ACCOUNT_INVALID_TYPE',
        `Nominal account must be of subtype BANK or CASH (current: ${nominal.accountSubtype})`,
      );
    }

    // 2. Check duplicate nominal account link
    const existing = await this.prisma.bankAccount.findFirst({
      where: { organizationId, nominalAccountId: nominal.id },
    });
    if (existing) {
      throw new DomainException(
        'BANK_ACCOUNT_ALREADY_EXISTS',
        `A bank account (${existing.name}) is already linked to nominal account ${nominal.code}`,
      );
    }

    const bankAccount = await this.prisma.bankAccount.create({
      data: {
        organizationId,
        name: dto.name,
        nominalAccountId: nominal.id,
        currency: dto.currency ?? nominal.currency ?? 'GBP',
        sortCode: dto.sortCode ?? null,
        accountNumber: dto.accountNumber ?? null,
        iban: dto.iban ?? null,
        bankName: dto.bankName ?? null,
        status: dto.status ?? BankAccountStatus.ACTIVE,
        createdById: actor.userId,
      },
      include: {
        nominalAccount: {
          select: { id: true, code: true, name: true, accountSubtype: true },
        },
      },
    });

    await this.audit.record(null, actor, {
      organizationId,
      eventType: AuditEvents.BANK_ACCOUNT_CREATED,
      entityType: 'bank_account',
      entityId: bankAccount.id,
      newValues: {
        id: bankAccount.id,
        name: bankAccount.name,
        nominalAccountId: bankAccount.nominalAccountId,
      },
    });

    return bankAccount;
  }

  async listBankAccounts(organizationId: string) {
    const accounts = await this.prisma.bankAccount.findMany({
      where: { organizationId },
      include: {
        nominalAccount: {
          select: { id: true, code: true, name: true, accountSubtype: true },
        },
        _count: {
          select: { lines: true, imports: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Compute ledger balances for all bank accounts from General Ledger
    const nominalIds = accounts.map((a) => a.nominalAccountId);

    const ledgerAggs = await this.prisma.journalLine.groupBy({
      by: ['accountId'],
      where: {
        organizationId,
        accountId: { in: nominalIds },
        journalEntry: { status: JournalStatus.POSTED },
      },
      _sum: {
        debit: true,
        credit: true,
      },
    });

    const ledgerMap = new Map(
      ledgerAggs.map((agg) => {
        const deb = new Prisma.Decimal(agg._sum.debit?.toString() || '0');
        const cred = new Prisma.Decimal(agg._sum.credit?.toString() || '0');
        return [agg.accountId, deb.sub(cred)];
      }),
    );

    // Get latest statement balances and unmatched lines count
    const [latestImports, unmatchedLines] = await Promise.all([
      this.prisma.bankStatementImport.findMany({
        where: { organizationId, bankAccountId: { in: accounts.map((a) => a.id) } },
        orderBy: { importedAt: 'desc' },
        distinct: ['bankAccountId'],
        select: { bankAccountId: true, closingBalance: true, importedAt: true },
      }),
      this.prisma.bankStatementLine.groupBy({
        by: ['bankAccountId'],
        where: {
          organizationId,
          bankAccountId: { in: accounts.map((a) => a.id) },
          status: 'UNMATCHED',
        },
        _count: { id: true },
      }),
    ]);

    const importMap = new Map(latestImports.map((i) => [i.bankAccountId, i]));
    const unmatchedMap = new Map(unmatchedLines.map((u) => [u.bankAccountId, u._count.id]));

    return accounts.map((acc) => {
      const ledgerBalance = ledgerMap.get(acc.nominalAccountId) ?? new Prisma.Decimal('0');
      const latestImport = importMap.get(acc.id);
      const unmatchedCount = unmatchedMap.get(acc.id) ?? 0;

      return {
        ...acc,
        ledgerBalance: ledgerBalance.toString(),
        statementBalance: latestImport?.closingBalance?.toString() ?? null,
        lastImportedAt: latestImport?.importedAt ?? null,
        unmatchedCount,
      };
    });
  }

  async getBankAccount(organizationId: string, id: string) {
    const account = await this.prisma.bankAccount.findFirst({
      where: { id, organizationId },
      include: {
        nominalAccount: {
          select: { id: true, code: true, name: true, accountSubtype: true },
        },
        imports: {
          take: 5,
          orderBy: { importedAt: 'desc' },
          select: {
            id: true,
            fileName: true,
            fileFormat: true,
            lineCount: true,
            closingBalance: true,
            importedAt: true,
            status: true,
          },
        },
      },
    });

    if (!account) {
      throw new DomainException('BANK_ACCOUNT_NOT_FOUND', 'Bank account not found in this organisation');
    }

    // Compute ledger balance
    const agg = await this.prisma.journalLine.aggregate({
      where: {
        organizationId,
        accountId: account.nominalAccountId,
        journalEntry: { status: JournalStatus.POSTED },
      },
      _sum: {
        debit: true,
        credit: true,
      },
    });

    const deb = new Prisma.Decimal(agg._sum.debit?.toString() || '0');
    const cred = new Prisma.Decimal(agg._sum.credit?.toString() || '0');
    const ledgerBalance = deb.sub(cred);

    return {
      ...account,
      ledgerBalance: ledgerBalance.toString(),
    };
  }

  async updateBankAccount(organizationId: string, id: string, dto: UpdateBankAccountDto, actor: Actor) {
    const existing = await this.prisma.bankAccount.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      throw new DomainException('BANK_ACCOUNT_NOT_FOUND', 'Bank account not found in this organisation');
    }

    const updated = await this.prisma.bankAccount.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.nominalAccountId ? { nominalAccountId: dto.nominalAccountId } : {}),
        ...(dto.sortCode !== undefined ? { sortCode: dto.sortCode } : {}),
        ...(dto.accountNumber !== undefined ? { accountNumber: dto.accountNumber } : {}),
        ...(dto.iban !== undefined ? { iban: dto.iban } : {}),
        ...(dto.bankName !== undefined ? { bankName: dto.bankName } : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
    });

    await this.audit.record(null, actor, {
      organizationId,
      eventType: AuditEvents.BANK_ACCOUNT_UPDATED,
      entityType: 'bank_account',
      entityId: id,
      newValues: dto,
    });

    return updated;
  }

  async deleteBankAccount(organizationId: string, id: string, actor: Actor) {
    const existing = await this.prisma.bankAccount.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      throw new DomainException('BANK_ACCOUNT_NOT_FOUND', 'Bank account not found in this organisation');
    }

    // Clean up bank rules, statement lines, statement imports, and bank account in transaction
    await this.prisma.$transaction(async (tx) => {
      await tx.bankRule.deleteMany({
        where: { organizationId, bankAccountId: id },
      });

      await tx.bankStatementLine.deleteMany({
        where: { organizationId, bankAccountId: id },
      });

      await tx.bankStatementImport.deleteMany({
        where: { organizationId, bankAccountId: id },
      });

      await tx.bankAccount.delete({
        where: { id },
      });
    });

    await this.audit.record(null, actor, {
      organizationId,
      eventType: AuditEvents.BANK_ACCOUNT_DELETED,
      entityType: 'bank_account',
      entityId: id,
      oldValues: {
        id: existing.id,
        name: existing.name,
        nominalAccountId: existing.nominalAccountId,
      },
    });

    return { success: true, id, name: existing.name };
  }
}
