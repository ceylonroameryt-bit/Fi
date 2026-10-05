import { Injectable } from '@nestjs/common';
import { JournalStatus } from '@prisma/client';
import { PrismaService, Tx } from '../database/prisma.service';
import { DomainException } from '../common/errors/domain.exception';
import type { Actor, OrgContext } from '../common/types/request-context.types';
import { AuditService } from '../audit/audit.service';
import { AuditEvents } from '../audit/audit-events';
import { JournalValidationService } from './journal-validation.service';
import { FinancialYearsService } from '../financial-years/financial-years.service';

export interface PostingResult {
  journalId: string;
  journalNumber: string;
  status: JournalStatus;
  postedAt: Date | null;
  postedBy: string | null;
  totalDebit: string;
  totalCredit: string;
  difference: string;
}

@Injectable()
export class JournalPostingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly validator: JournalValidationService,
    private readonly fyService: FinancialYearsService,
  ) {}

  /**
   * Primary entry point for posting a journal entry.
   * Atomic, concurrency-safe, with row-level locking and re-validation.
   */
  async postJournal(
    organizationId: string,
    journalId: string,
    orgContext: OrgContext,
    actor: Actor,
    externalTx?: Tx,
  ): Promise<PostingResult> {
    this.checkPostingPermission(orgContext);

    const execute = async (tx: Tx) => {
      // 1. Lock the journal row for posting to prevent concurrent posting races
      await this.lockJournalForPosting(tx, organizationId, journalId);

      // 2. Reload the journal inside the locked transaction
      const journal = await tx.journalEntry.findFirst({
        where: { id: journalId, organizationId },
        include: {
          lines: {
            include: { account: true },
            orderBy: { lineNumber: 'asc' },
          },
        },
      });

      if (!journal) {
        throw new DomainException('JOURNAL_NOT_FOUND', 'Journal entry was not found in this organisation');
      }

      // 3. Consistent lock order: lock period row FOR SHARE
      await this.lockPeriodForPosting(tx, organizationId, journal.postingDate);

      // 4. Verify journal status & idempotency
      this.checkJournalState(journal);

      // 5. Critical financial re-validation immediately before posting
      const valResult = await this.validator.validateJournal(journalId, orgContext, tx);
      if (!valResult.isValid) {
        throw new DomainException(
          'POSTING_VALIDATION_FAILED',
          `Cannot post journal: ${valResult.errors.join('; ')}`,
          { errors: valResult.errors, issues: valResult.issues as any },
        );
      }

      // 6. Accounting period check (ensure period permits posting)
      await this.checkAccountingPeriod(organizationId, journal.postingDate, orgContext.permissions, tx);

      // 7. Transition status to POSTED
      const now = new Date();
      const posted = await tx.journalEntry.update({
        where: { id: journalId },
        data: {
          status: JournalStatus.POSTED,
          periodId: valResult.periodId,
          postedById: actor.userId,
          postedAt: now,
          updatedById: actor.userId,
          version: { increment: 1 },
        },
      });

      // 8. Write audit log
      await this.writePostingAudit(tx, actor, organizationId, posted, valResult);

      return {
        journalId: posted.id,
        journalNumber: posted.journalNumber,
        status: posted.status,
        postedAt: posted.postedAt,
        postedBy: actor.userId,
        totalDebit: valResult.totalDebit,
        totalCredit: valResult.totalCredit,
        difference: valResult.difference,
      };
    };

    return externalTx ? execute(externalTx) : this.prisma.transaction(execute);
  }

  /**
   * Preview posting effects without modifying database state.
   */
  async previewPosting(
    organizationId: string,
    journalId: string,
    orgContext: OrgContext,
  ) {
    this.checkPostingPermission(orgContext);

    const journal = await this.prisma.journalEntry.findFirst({
      where: { id: journalId, organizationId },
      include: {
        lines: {
          include: { account: true },
          orderBy: { lineNumber: 'asc' },
        },
      },
    });

    if (!journal) {
      throw new DomainException('JOURNAL_NOT_FOUND', 'Journal entry was not found in this organisation');
    }

    this.checkJournalState(journal);
    const validation = await this.validator.validateJournal(journalId, orgContext);
    const periodCheck = await this.fyService.validatePostingDate(
      organizationId,
      journal.postingDate,
      orgContext.permissions,
    );

    return {
      journalId: journal.id,
      journalNumber: journal.journalNumber,
      currentStatus: journal.status,
      eligibleToPost: validation.isValid && periodCheck.isValid,
      totalDebit: validation.totalDebit,
      totalCredit: validation.totalCredit,
      difference: validation.difference,
      period: periodCheck.period,
      validation,
      periodCheck,
    };
  }

  checkPostingPermission(orgContext: OrgContext): void {
    if (!orgContext.permissions.has('journal.post')) {
      throw new DomainException('PERMISSION_DENIED', 'Missing required permission: journal.post');
    }
  }

  checkJournalState(journal: { status: JournalStatus; reversedByJournalId?: string | null }): void {
    if (journal.status === JournalStatus.POSTED) {
      throw new DomainException('JOURNAL_ALREADY_POSTED', 'Journal entry has already been posted');
    }

    if (journal.status === JournalStatus.REVERSED || journal.reversedByJournalId) {
      throw new DomainException('JOURNAL_ALREADY_REVERSED', 'Cannot post a reversed journal entry');
    }

    if (journal.status !== JournalStatus.VALIDATED) {
      throw new DomainException(
        'JOURNAL_NOT_VALIDATED',
        `Journal entry must be VALIDATED before posting (current status: ${journal.status})`,
      );
    }
  }

  async checkAccountingPeriod(
    organizationId: string,
    postingDate: Date,
    permissions: ReadonlySet<string>,
    tx?: Tx,
  ) {
    const periodCheck = await this.fyService.validatePostingDate(organizationId, postingDate, permissions, tx);
    if (!periodCheck.isValid) {
      throw new DomainException(
        'POSTING_PERIOD_INVALID',
        periodCheck.error ?? 'Accounting period does not permit posting for this date',
        { errorCode: periodCheck.errorCode },
      );
    }
    return periodCheck.period;
  }

  async lockPeriodForPosting(tx: Tx, organizationId: string, postingDate: Date): Promise<void> {
    await tx.$queryRaw`
      SELECT id, status FROM accounting_periods
      WHERE organization_id = ${organizationId}::uuid
        AND start_date <= ${postingDate}::date
        AND end_date >= ${postingDate}::date
      FOR SHARE
    `;
  }

  async lockJournalForPosting(tx: Tx, organizationId: string, journalId: string): Promise<void> {
    // Acquire PostgreSQL row lock FOR UPDATE
    await tx.$queryRaw`
      SELECT id, status FROM journal_entries
      WHERE id = ${journalId}::uuid AND organization_id = ${organizationId}::uuid
      FOR UPDATE
    `;
  }

  async writePostingAudit(
    tx: Tx,
    actor: Actor,
    organizationId: string,
    postedJournal: { id: string; journalNumber: string; periodId: string | null; postedAt: Date | null },
    valResult: { totalDebit: string; totalCredit: string; difference: string },
  ): Promise<void> {
    await this.audit.record(tx, actor, {
      organizationId,
      eventType: AuditEvents.JOURNAL_POSTED,
      entityType: 'JOURNAL',
      entityId: postedJournal.id,
      newValues: {
        status: JournalStatus.POSTED,
        journalNumber: postedJournal.journalNumber,
        periodId: postedJournal.periodId,
        postedAt: postedJournal.postedAt?.toISOString(),
        totalDebit: valResult.totalDebit,
        totalCredit: valResult.totalCredit,
      },
    });
  }
}
