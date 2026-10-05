import { Injectable } from '@nestjs/common';
import { JournalSourceType, JournalStatus, Prisma } from '@prisma/client';
import { PrismaService, Tx } from '../database/prisma.service';
import { DomainException } from '../common/errors/domain.exception';
import type { Actor, OrgContext } from '../common/types/request-context.types';
import { AuditService } from '../audit/audit.service';
import { AuditEvents } from '../audit/audit-events';
import { MoneyService } from './money.service';
import { FinancialYearsService } from '../financial-years/financial-years.service';
import { parseIsoDate, toIsoDate } from '../common/utils/dates';

export interface ReverseJournalDto {
  reversalDate?: string;
  reason?: string;
}

export interface ReversalResult {
  originalJournal: {
    id: string;
    journalNumber: string;
    status: JournalStatus;
    reversedByJournalId: string | null;
  };
  reversalJournal: {
    id: string;
    journalNumber: string;
    status: JournalStatus;
    reversalOfJournalId: string | null;
    postingDate: string;
    totalDebit: string;
    totalCredit: string;
  };
}

@Injectable()
export class JournalReversalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly money: MoneyService,
    private readonly fyService: FinancialYearsService,
  ) {}

  /**
   * Reverses a posted journal entry by creating an exact offsetting opposite journal
   * and updating the original journal to REVERSED status.
   */
  async reverseJournal(
    organizationId: string,
    journalId: string,
    dto: ReverseJournalDto,
    orgContext: OrgContext,
    actor: Actor,
    externalTx?: Tx,
  ): Promise<ReversalResult> {
    this.validateReversalPermission(orgContext);

    const execute = async (tx: Tx) => {
      // 1. Determine effective reversal date
      const effectiveReversalDate = dto.reversalDate
        ? parseIsoDate(dto.reversalDate, 'reversalDate')
        : new Date();

      // 2. Consistent lock order: lock period row FOR SHARE
      await this.lockPeriodForReversal(tx, organizationId, effectiveReversalDate);

      // 3. Lock original journal row to prevent race conditions
      await tx.$queryRaw`
        SELECT id, status FROM journal_entries
        WHERE id = ${journalId}::uuid AND organization_id = ${organizationId}::uuid
        FOR UPDATE
      `;

      // 4. Fetch original journal with all lines & accounts
      const original = await tx.journalEntry.findFirst({
        where: { id: journalId, organizationId },
        include: {
          lines: {
            include: { account: true },
            orderBy: { lineNumber: 'asc' },
          },
        },
      });

      if (!original) {
        throw new DomainException('JOURNAL_NOT_FOUND', 'Original journal entry was not found');
      }

      this.validateOriginalJournal(original);

      // 5. Validate reversal date & accounting period
      const period = await this.validateReversalDate(
        organizationId,
        effectiveReversalDate,
        orgContext.permissions,
        tx,
      );

      // 6. Validate accounts exist and belong strictly to this organisation.
      // ACCOUNTING ARCHITECTURE RULE:
      // A historical transaction must remain reversible even if an account used by the original
      // posted journal was archived after posting. Normal NEW manual postings block archived
      // accounts, but an exact historical REVERSAL of an existing posted journal is ALLOWED
      // to maintain double-entry auditability and allow correcting historical errors.
      for (const line of original.lines) {
        if (!line.account) {
          throw new DomainException(
            'ACCOUNT_NOT_FOUND',
            `Account reference for line ${line.lineNumber} is missing or corrupted`,
          );
        }
        if (line.account.organizationId !== organizationId) {
          throw new DomainException(
            'ORGANIZATION_ACCESS_DENIED',
            `Account ${line.account.code} belongs to another organisation`,
          );
        }
      }

      // 5. Generate opposite reversal lines
      const reversalReason = dto.reason?.trim() || `Reversal of ${original.journalNumber}`;
      const reversalLines = this.generateReversalLines(original.lines, reversalReason);

      // 6. Allocate unique journal number for reversal journal
      const reversalYear = effectiveReversalDate.getFullYear();
      const reversalNumber = await this.allocateJournalNumber(tx, organizationId, reversalYear);

      // 7. Create reversal journal in DRAFT status with lines, then transition to POSTED
      const now = new Date();
      const reversalJournal = await tx.journalEntry.create({
        data: {
          organizationId,
          journalNumber: reversalNumber,
          journalType: original.journalType,
          sourceType: JournalSourceType.MANUAL,
          status: JournalStatus.DRAFT,
          journalDate: effectiveReversalDate,
          postingDate: effectiveReversalDate,
          periodId: period?.id ?? null,
          currency: original.currency,
          description: reversalReason,
          reference: `REV:${original.journalNumber}`,
          reversalOfJournalId: original.id,
          createdById: actor.userId!,
          updatedById: actor.userId,
          validatedById: actor.userId,
          validatedAt: now,
          lines: {
            create: reversalLines.map((line) => ({
              lineNumber: line.lineNumber,
              accountId: line.accountId,
              description: line.description,
              currency: original.currency,
              debit: line.debit,
              credit: line.credit,
            })),
          },
        },
      });

      // Transition to POSTED status (deferred balance constraint verifies double-entry balance)
      const postedReversal = await tx.journalEntry.update({
        where: { id: reversalJournal.id },
        data: {
          status: JournalStatus.POSTED,
          postedById: actor.userId,
          postedAt: now,
        },
      });

      // 8. Mark original journal as REVERSED and link to reversal
      const updatedOriginal = await tx.journalEntry.update({
        where: { id: original.id },
        data: {
          status: JournalStatus.REVERSED,
          reversedByJournalId: postedReversal.id,
          updatedById: actor.userId,
          version: { increment: 1 },
        },
      });

      // 9. Compute totals for audit & response
      let totalDr = this.money.ZERO;
      let totalCr = this.money.ZERO;
      for (const l of reversalLines) {
        totalDr = totalDr.add(this.money.toDecimal(l.debit));
        totalCr = totalCr.add(this.money.toDecimal(l.credit));
      }

      // 10. Record audit events
      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.JOURNAL_REVERSAL_CREATED,
        entityType: 'JOURNAL',
        entityId: postedReversal.id,
        newValues: {
          journalNumber: postedReversal.journalNumber,
          reversalOfJournalId: original.id,
          reversalOfJournalNumber: original.journalNumber,
          totalDebit: totalDr.toFixed(4),
          totalCredit: totalCr.toFixed(4),
          reversalDate: toIsoDate(effectiveReversalDate),
        },
      });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.JOURNAL_REVERSED,
        entityType: 'JOURNAL',
        entityId: original.id,
        oldValues: { status: original.status },
        newValues: {
          status: JournalStatus.REVERSED,
          reversedByJournalId: postedReversal.id,
          reversedByJournalNumber: postedReversal.journalNumber,
        },
      });

      return {
        originalJournal: {
          id: updatedOriginal.id,
          journalNumber: updatedOriginal.journalNumber,
          status: updatedOriginal.status,
          reversedByJournalId: updatedOriginal.reversedByJournalId,
        },
        reversalJournal: {
          id: postedReversal.id,
          journalNumber: postedReversal.journalNumber,
          status: postedReversal.status,
          reversalOfJournalId: postedReversal.reversalOfJournalId,
          postingDate: toIsoDate(postedReversal.postingDate ?? effectiveReversalDate),
          totalDebit: totalDr.toFixed(4),
          totalCredit: totalCr.toFixed(4),
        },
      };
    };

    return externalTx ? execute(externalTx) : this.prisma.transaction(execute);
  }

  /**
   * Preview a proposed reversal before execution.
   */
  async previewReversal(
    organizationId: string,
    journalId: string,
    dto: ReverseJournalDto,
    orgContext: OrgContext,
  ) {
    this.validateReversalPermission(orgContext);

    const original = await this.prisma.journalEntry.findFirst({
      where: { id: journalId, organizationId },
      include: {
        lines: {
          include: { account: true },
          orderBy: { lineNumber: 'asc' },
        },
      },
    });

    if (!original) {
      throw new DomainException('JOURNAL_NOT_FOUND', 'Original journal entry was not found');
    }

    this.validateOriginalJournal(original);

    const effectiveDate = dto.reversalDate
      ? parseIsoDate(dto.reversalDate, 'reversalDate')
      : new Date();

    const period = await this.validateReversalDate(
      organizationId,
      effectiveDate,
      orgContext.permissions,
    );

    const reason = dto.reason?.trim() || `Reversal of ${original.journalNumber}`;
    const previewLines = this.generateReversalLines(original.lines, reason);

    let totalDr = this.money.ZERO;
    let totalCr = this.money.ZERO;
    for (const l of previewLines) {
      totalDr = totalDr.add(this.money.toDecimal(l.debit));
      totalCr = totalCr.add(this.money.toDecimal(l.credit));
    }

    return {
      originalJournalId: original.id,
      originalJournalNumber: original.journalNumber,
      reversalDate: toIsoDate(effectiveDate),
      period,
      reason,
      lines: previewLines.map((l) => ({
        ...l,
        account: original.lines.find((ol) => ol.accountId === l.accountId)?.account,
      })),
      totalDebit: totalDr.toFixed(4),
      totalCredit: totalCr.toFixed(4),
      isBalanced: totalDr.eq(totalCr),
    };
  }

  validateReversalPermission(orgContext: OrgContext): void {
    if (!orgContext.permissions.has('journal.reverse')) {
      throw new DomainException('PERMISSION_DENIED', 'Missing required permission: journal.reverse');
    }
  }

  validateOriginalJournal(journal: { status: JournalStatus; reversedByJournalId?: string | null; journalNumber: string; lines: Array<{ lineNumber: number; accountId: string; description: string | null; debit: Prisma.Decimal; credit: Prisma.Decimal }> }): void {
    if (journal.reversedByJournalId || journal.status === JournalStatus.REVERSED) {
      throw new DomainException(
        'JOURNAL_ALREADY_REVERSED',
        `Journal entry ${journal.journalNumber} has already been reversed`,
      );
    }

    if (journal.status !== JournalStatus.POSTED) {
      throw new DomainException(
        'JOURNAL_INVALID_STATUS_FOR_REVERSAL',
        `Cannot reverse journal with status ${journal.status}. Only POSTED journals can be reversed`,
      );
    }

    if (!journal.lines || journal.lines.length < 2) {
      throw new DomainException('JOURNAL_INSUFFICIENT_LINES', 'Original journal does not contain valid lines to reverse');
    }
  }

  async lockPeriodForReversal(tx: Tx, organizationId: string, reversalDate: Date): Promise<void> {
    await tx.$queryRaw`
      SELECT id, status FROM accounting_periods
      WHERE organization_id = ${organizationId}::uuid
        AND start_date <= ${reversalDate}::date
        AND end_date >= ${reversalDate}::date
      FOR SHARE
    `;
  }

  async validateReversalDate(
    organizationId: string,
    date: Date,
    permissions: ReadonlySet<string>,
    tx?: Tx,
  ) {
    const periodCheck = await this.fyService.validatePostingDate(organizationId, date, permissions, tx);
    if (!periodCheck.isValid) {
      throw new DomainException(
        'REVERSAL_PERIOD_INVALID',
        periodCheck.error ?? 'Reversal date falls in an invalid or hard-locked accounting period',
        { errorCode: periodCheck.errorCode },
      );
    }
    return periodCheck.period;
  }

  /**
   * Generates opposite lines: Original Debit -> Reversal Credit, Original Credit -> Reversal Debit.
   */
  generateReversalLines(
    originalLines: Array<{ lineNumber: number; accountId: string; description: string | null; debit: Prisma.Decimal; credit: Prisma.Decimal }>,
    reason: string,
  ) {
    return originalLines.map((line) => ({
      lineNumber: line.lineNumber,
      accountId: line.accountId,
      description: line.description ? `${reason} (${line.description})` : reason,
      // Invert debit and credit
      debit: line.credit,
      credit: line.debit,
    }));
  }

  private async allocateJournalNumber(tx: Tx, organizationId: string, year: number): Promise<string> {
    const sequenceKey = `JOURNAL_${year}`;

    const sequence = await tx.organizationSequence.upsert({
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

    const padded = sequence.currentValue.toString().padStart(6, '0');
    return `JE-${year}-${padded}`;
  }
}
