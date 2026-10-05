import { Injectable } from '@nestjs/common';
import { JournalSourceType, JournalStatus, JournalType, Prisma } from '@prisma/client';
import { PrismaService, Tx } from '../database/prisma.service';
import { DomainException } from '../common/errors/domain.exception';
import type { Actor, OrgContext } from '../common/types/request-context.types';
import { AuditService } from '../audit/audit.service';
import { AuditEvents } from '../audit/audit-events';
import { MoneyService } from '../accounting-engine/money.service';
import { JournalValidationService, JournalValidationResult } from '../accounting-engine/journal-validation.service';
import { parseIsoDate, toIsoDate } from '../common/utils/dates';
import type { CreateJournalDto, UpdateJournalDto } from './dto/journal.dto';

@Injectable()
export class JournalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly money: MoneyService,
    private readonly validator: JournalValidationService,
  ) {}

  async listJournals(
    organizationId: string,
    filter: { status?: JournalStatus; search?: string; page?: number; pageSize?: number },
  ) {
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 50;

    const where: Prisma.JournalEntryWhereInput = {
      organizationId,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.search
        ? {
            OR: [
              { journalNumber: { contains: filter.search, mode: 'insensitive' } },
              { description: { contains: filter.search, mode: 'insensitive' } },
              { reference: { contains: filter.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ journalDate: 'desc' }, { journalNumber: 'desc' }],
        include: {
          period: { select: { id: true, name: true, status: true } },
          createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
          lines: {
            include: { account: { select: { id: true, code: true, name: true, accountType: true } } },
            orderBy: { lineNumber: 'asc' },
          },
        },
      }),
      this.prisma.journalEntry.count({ where }),
    ]);

    const formatted = items.map((j) => {
      const totals = this.calculateJournalTotals(j.lines);
      return {
        ...j,
        ...totals,
      };
    });

    return { items: formatted, total, page, pageSize };
  }

  async getJournal(organizationId: string, id: string) {
    const journal = await this.prisma.journalEntry.findFirst({
      where: { id, organizationId },
      include: {
        period: { select: { id: true, name: true, status: true } },
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        validatedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        lines: {
          include: { account: true },
          orderBy: { lineNumber: 'asc' },
        },
      },
    });

    if (!journal) {
      throw new DomainException('JOURNAL_NOT_FOUND', 'Journal not found');
    }

    const totals = this.calculateJournalTotals(journal.lines);

    return {
      ...journal,
      ...totals,
    };
  }

  async createDraftJournal(organizationId: string, dto: CreateJournalDto, orgContext: OrgContext, actor: Actor) {
    const journalDate = parseIsoDate(dto.journalDate, 'journalDate');
    const postingDate = dto.postingDate ? parseIsoDate(dto.postingDate, 'postingDate') : journalDate;
    const currency = dto.currency || orgContext.baseCurrency;

    // Currency check
    if (currency !== orgContext.baseCurrency) {
      throw new DomainException(
        'UNSUPPORTED_CURRENCY',
        `Journal currency (${currency}) does not match organisation base currency (${orgContext.baseCurrency}). Multi-currency and FX conversion are not enabled.`,
      );
    }

    // Check duplicate idempotency key if provided
    if (dto.idempotencyKey) {
      const existing = await this.prisma.journalEntry.findUnique({
        where: {
          organizationId_idempotencyKey: {
            organizationId,
            idempotencyKey: dto.idempotencyKey,
          },
        },
      });
      if (existing) {
        throw new DomainException(
          'JOURNAL_DUPLICATE_IDEMPOTENCY_KEY',
          'A journal with this idempotency key already exists',
        );
      }
    }

    const journal = await this.prisma.transaction(async (tx) => {
      // 1. Generate sequence-safe journal number (e.g. JE-2026-000001)
      const year = journalDate.getUTCFullYear();
      const journalNumber = await this.allocateJournalNumber(tx, organizationId, year);

      // 2. Create Journal Entry
      const entry = await tx.journalEntry.create({
        data: {
          organizationId,
          journalNumber,
          journalType: dto.journalType ?? JournalType.GENERAL,
          journalDate,
          postingDate,
          description: dto.description,
          reference: dto.reference,
          sourceType: JournalSourceType.MANUAL,
          currency,
          status: JournalStatus.DRAFT,
          idempotencyKey: dto.idempotencyKey,
          createdById: actor.userId!,
          lines: {
            create: dto.lines.map((l, idx) => ({
              lineNumber: idx + 1,
              accountId: l.accountId,
              description: l.description,
              debit: new Prisma.Decimal(l.debit.toString()),
              credit: new Prisma.Decimal(l.credit.toString()),
              currency,
            })),
          },
        },
        include: {
          lines: { include: { account: true } },
        },
      });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.JOURNAL_CREATED,
        entityType: 'JOURNAL',
        entityId: entry.id,
        newValues: {
          journalNumber: entry.journalNumber,
          description: entry.description,
          status: entry.status,
          linesCount: dto.lines.length,
        },
      });

      return entry;
    });

    return this.getJournal(organizationId, journal.id);
  }

  async updateDraftJournal(
    organizationId: string,
    journalId: string,
    dto: UpdateJournalDto,
    _orgContext: OrgContext,
    actor: Actor,
  ) {
    await this.prisma.transaction(async (tx) => {
      // 1. Lock row FOR UPDATE first before checking state
      await tx.$queryRaw`
        SELECT id, status, version FROM journal_entries
        WHERE id = ${journalId}::uuid AND organization_id = ${organizationId}::uuid
        FOR UPDATE
      `;

      const existing = await tx.journalEntry.findFirst({
        where: { id: journalId, organizationId },
        include: {
          lines: {
            include: { account: true },
            orderBy: { lineNumber: 'asc' },
          },
        },
      });

      if (!existing) {
        throw new DomainException('JOURNAL_NOT_FOUND', 'Journal not found');
      }

      // Check if system managed (e.g. from Invoice)
      if (existing.sourceType === JournalSourceType.INVOICE) {
        throw new DomainException(
          'JOURNAL_SYSTEM_MANAGED',
          'Invoice-generated journals cannot be modified directly. Modify the invoice instead.',
        );
      }

      // Only DRAFT or VALIDATED journals can be edited
      if (existing.status !== JournalStatus.DRAFT && existing.status !== JournalStatus.VALIDATED) {
        throw new DomainException(
          'JOURNAL_INVALID_STATE',
          `Cannot edit journal in status ${existing.status}`,
        );
      }

      // Genuine optimistic version check
      if (dto.version !== undefined && dto.version !== existing.version) {
        throw new DomainException(
          'CONCURRENT_MODIFICATION',
          `Journal has been modified concurrently (expected version ${dto.version}, found ${existing.version})`,
          { expectedVersion: dto.version, currentVersion: existing.version },
        );
      }

      const journalDate = dto.journalDate ? parseIsoDate(dto.journalDate, 'journalDate') : existing.journalDate;
      const postingDate = dto.postingDate
        ? parseIsoDate(dto.postingDate, 'postingDate')
        : dto.journalDate
          ? journalDate
          : existing.postingDate;

      // If lines are updated, delete existing lines and re-create them
      if (dto.lines) {
        await tx.journalLine.deleteMany({
          where: { journalEntryId: journalId, organizationId },
        });

        await tx.journalLine.createMany({
          data: dto.lines.map((l, idx) => ({
            journalEntryId: journalId,
            organizationId,
            lineNumber: idx + 1,
            accountId: l.accountId,
            description: l.description,
            debit: new Prisma.Decimal(l.debit.toString()),
            credit: new Prisma.Decimal(l.credit.toString()),
            currency: existing.currency,
          })),
        });
      }

      // CRITICAL ACCOUNTING RULE:
      // If a VALIDATED journal is modified, it reverts to DRAFT and requires validation again.
      const res = await tx.journalEntry.update({
        where: { id: journalId },
        data: {
          journalDate,
          postingDate,
          description: dto.description,
          reference: dto.reference,
          status: JournalStatus.DRAFT, // Stale validation reset!
          validatedById: null,
          validatedAt: null,
          periodId: null,
          updatedById: actor.userId,
          version: { increment: 1 },
        },
      });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.JOURNAL_UPDATED,
        entityType: 'JOURNAL',
        entityId: journalId,
        oldValues: { status: existing.status, description: existing.description, version: existing.version },
        newValues: { status: res.status, description: res.description, version: res.version },
      });

      return res;
    });

    return this.getJournal(organizationId, journalId);
  }

  async deleteDraftJournal(organizationId: string, journalId: string, actor: Actor) {
    return this.prisma.transaction(async (tx) => {
      // 1. Lock row FOR UPDATE first before checking state
      await tx.$queryRaw`
        SELECT id, status FROM journal_entries
        WHERE id = ${journalId}::uuid AND organization_id = ${organizationId}::uuid
        FOR UPDATE
      `;

      const existing = await tx.journalEntry.findFirst({
        where: { id: journalId, organizationId },
      });

      if (!existing) {
        throw new DomainException('JOURNAL_NOT_FOUND', 'Journal not found');
      }

      if (existing.sourceType === JournalSourceType.INVOICE) {
        throw new DomainException(
          'JOURNAL_SYSTEM_MANAGED',
          'Invoice-generated journals cannot be deleted directly.',
        );
      }

      // Only DRAFT (or VALIDATED) journals can be deleted; POSTED journals cannot be deleted.
      if (existing.status !== JournalStatus.DRAFT && existing.status !== JournalStatus.VALIDATED) {
        throw new DomainException(
          'JOURNAL_INVALID_STATE',
          `Cannot delete journal in status ${existing.status}`,
        );
      }

      await tx.journalLine.deleteMany({ where: { journalEntryId: journalId, organizationId } });
      await tx.journalEntry.delete({ where: { id: journalId } });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.JOURNAL_DELETED_DRAFT,
        entityType: 'JOURNAL',
        entityId: journalId,
        oldValues: { journalNumber: existing.journalNumber, description: existing.description },
      });

      return { success: true };
    });
  }

  async duplicateDraftJournal(organizationId: string, journalId: string, orgContext: OrgContext, actor: Actor) {
    const original = await this.getJournal(organizationId, journalId);

    const dto: CreateJournalDto = {
      journalType: original.journalType,
      journalDate: toIsoDate(new Date()),
      postingDate: toIsoDate(new Date()),
      description: `Copy of ${original.description}`,
      reference: original.reference ?? undefined,
      currency: original.currency,
      lines: original.lines.map((l) => ({
        accountId: l.accountId,
        description: l.description ?? undefined,
        debit: new Prisma.Decimal(l.debit).toNumber(),
        credit: new Prisma.Decimal(l.credit).toNumber(),
      })),
    };

    return this.createDraftJournal(organizationId, dto, orgContext, actor);
  }

  /**
   * Runs Journal Validation Engine.
   * On validation success:
   * Transitions status DRAFT -> VALIDATED
   * Assigns resolved periodId, validatedById, validatedAt
   * Returns structured accounting result
   */
  async validateJournal(
    organizationId: string,
    journalId: string,
    orgContext: OrgContext,
    actor: Actor,
  ): Promise<JournalValidationResult & { journal?: unknown }> {
    return this.prisma.transaction(async (tx) => {
      // 1. Lock row FOR UPDATE first before checking state
      await tx.$queryRaw`
        SELECT id, status FROM journal_entries
        WHERE id = ${journalId}::uuid AND organization_id = ${organizationId}::uuid
        FOR UPDATE
      `;

      const existing = await tx.journalEntry.findFirst({
        where: { id: journalId, organizationId },
      });

      if (!existing) {
        throw new DomainException('JOURNAL_NOT_FOUND', 'Journal not found');
      }

      if (existing.status !== JournalStatus.DRAFT && existing.status !== JournalStatus.VALIDATED) {
        throw new DomainException(
          'JOURNAL_INVALID_STATE',
          `Cannot validate journal in status ${existing.status}`,
        );
      }

      const validationResult = await this.validator.validateJournal(journalId, orgContext, tx);

      if (!validationResult.isValid) {
        await this.audit.record(tx, actor, {
          organizationId,
          eventType: AuditEvents.JOURNAL_VALIDATION_FAILED,
          entityType: 'JOURNAL',
          entityId: journalId,
          newValues: { errors: validationResult.errors, difference: validationResult.difference },
        });

        return validationResult;
      }

      // Validation succeeded: Update journal state to VALIDATED
      const updatedJournal = await tx.journalEntry.update({
        where: { id: journalId },
        data: {
          status: JournalStatus.VALIDATED,
          periodId: validationResult.periodId,
          validatedById: actor.userId,
          validatedAt: new Date(),
          updatedById: actor.userId,
          version: { increment: 1 },
        },
      });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.JOURNAL_VALIDATED,
        entityType: 'JOURNAL',
        entityId: journalId,
        newValues: {
          status: JournalStatus.VALIDATED,
          totalDebit: validationResult.totalDebit,
          totalCredit: validationResult.totalCredit,
          periodId: validationResult.periodId,
        },
      });

      return {
        ...validationResult,
        journal: updatedJournal,
      };
    });
  }

  calculateJournalTotals(lines: Array<{ debit: Prisma.Decimal | number | string; credit: Prisma.Decimal | number | string }>) {
    let debit = this.money.ZERO;
    let credit = this.money.ZERO;

    for (const l of lines) {
      debit = debit.add(this.money.toDecimal(l.debit));
      credit = credit.add(this.money.toDecimal(l.credit));
    }

    const difference = debit.sub(credit);
    const isBalanced = difference.isZero();

    return {
      totalDebit: debit.toFixed(4),
      totalCredit: credit.toFixed(4),
      difference: difference.toFixed(4),
      isBalanced,
    };
  }

  /**
   * Concurrency-safe sequence number generator.
   * Format: JE-YYYY-XXXXXX (e.g. JE-2026-000001)
   */
  async allocateJournalNumber(tx: Tx, organizationId: string, year: number): Promise<string> {
    const sequenceKey = `JOURNAL_${year}`;

    let sequence = await tx.organizationSequence.upsert({
      where: {
        organizationId_sequenceKey: {
          organizationId,
          sequenceKey,
        },
      },
      create: {
        organizationId,
        sequenceKey,
        currentValue: 1,
      },
      update: {
        currentValue: { increment: 1 },
      },
    });

    let candidateNumber = `JE-${year}-${sequence.currentValue.toString().padStart(6, '0')}`;
    let exists = await tx.journalEntry.findUnique({
      where: {
        organizationId_journalNumber: {
          organizationId,
          journalNumber: candidateNumber,
        },
      },
    });

    while (exists) {
      sequence = await tx.organizationSequence.update({
        where: {
          organizationId_sequenceKey: {
            organizationId,
            sequenceKey,
          },
        },
        data: {
          currentValue: { increment: 1 },
        },
      });
      candidateNumber = `JE-${year}-${sequence.currentValue.toString().padStart(6, '0')}`;
      exists = await tx.journalEntry.findUnique({
        where: {
          organizationId_journalNumber: {
            organizationId,
            journalNumber: candidateNumber,
          },
        },
      });
    }

    return candidateNumber;
  }
}
