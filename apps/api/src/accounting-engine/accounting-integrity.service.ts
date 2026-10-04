import { Injectable } from '@nestjs/common';
import { JournalStatus, PeriodStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { MoneyService } from './money.service';
import { AuditService } from '../audit/audit.service';
import { AuditEvents } from '../audit/audit-events';
import type { Actor } from '../common/types/request-context.types';

export interface IntegrityCheckResult {
  checkName: string;
  passed: boolean;
  severity: 'CRITICAL' | 'WARNING';
  message: string;
  details?: any;
}

export interface AccountingIntegritySummary {
  organizationId: string;
  checkedAt: string;
  allPassed: boolean;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  checks: IntegrityCheckResult[];
}

@Injectable()
export class AccountingIntegrityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly money: MoneyService,
    private readonly audit: AuditService,
  ) {}

  async runIntegrityChecks(
    organizationId: string,
    actor?: Actor,
  ): Promise<AccountingIntegritySummary> {
    const checks: IntegrityCheckResult[] = await Promise.all([
      this.checkPostedJournalBalance(organizationId),
      this.checkTrialBalance(organizationId),
      this.checkCrossTenantReferences(organizationId),
      this.checkDuplicateJournalNumbers(organizationId),
      this.checkOrphanJournalLines(organizationId),
      this.checkLockedPeriodViolations(organizationId),
      this.checkReversalIntegrity(organizationId),
    ]);

    const passedChecks = checks.filter((c) => c.passed).length;
    const failedChecks = checks.length - passedChecks;
    const allPassed = failedChecks === 0;

    const summary: AccountingIntegritySummary = {
      organizationId,
      checkedAt: new Date().toISOString(),
      allPassed,
      totalChecks: checks.length,
      passedChecks,
      failedChecks,
      checks,
    };

    if (actor) {
      await this.audit.record(null, actor, {
        organizationId,
        eventType: AuditEvents.ACCOUNTING_INTEGRITY_CHECK_RUN,
        entityType: 'ORGANIZATION',
        entityId: organizationId,
        newValues: {
          allPassed,
          totalChecks: checks.length,
          failedChecks,
        },
      });
    }

    return summary;
  }

  /**
   * Control 1: Every posted or reversed journal must have sum(debit) == sum(credit).
   */
  async checkPostedJournalBalance(organizationId: string): Promise<IntegrityCheckResult> {
    const postedJournals = await this.prisma.journalEntry.findMany({
      where: {
        organizationId,
        status: { in: [JournalStatus.POSTED, JournalStatus.REVERSED] },
      },
      include: {
        lines: true,
      },
    });

    const unbalanced: Array<{ id: string; journalNumber: string; debit: string; credit: string; diff: string }> = [];

    for (const j of postedJournals) {
      let sumDr = this.money.ZERO;
      let sumCr = this.money.ZERO;
      for (const l of j.lines) {
        sumDr = sumDr.add(this.money.toDecimal(l.debit));
        sumCr = sumCr.add(this.money.toDecimal(l.credit));
      }
      const diff = sumDr.sub(sumCr);
      if (!diff.isZero()) {
        unbalanced.push({
          id: j.id,
          journalNumber: j.journalNumber,
          debit: sumDr.toFixed(4),
          credit: sumCr.toFixed(4),
          diff: diff.toFixed(4),
        });
      }
    }

    return {
      checkName: 'Posted Journals Balanced',
      passed: unbalanced.length === 0,
      severity: 'CRITICAL',
      message:
        unbalanced.length === 0
          ? `All ${postedJournals.length} posted/reversed journals are perfectly balanced`
          : `Found ${unbalanced.length} unbalanced posted journals!`,
      details: unbalanced.length > 0 ? unbalanced : undefined,
    };
  }

  /**
   * Control 2: Global Trial Balance verification - total debits == total credits.
   */
  async checkTrialBalance(organizationId: string): Promise<IntegrityCheckResult> {
    const lines = await this.prisma.journalLine.findMany({
      where: {
        organizationId,
        journalEntry: {
          status: { in: [JournalStatus.POSTED, JournalStatus.REVERSED] },
        },
      },
      select: { debit: true, credit: true },
    });

    let totalDr = this.money.ZERO;
    let totalCr = this.money.ZERO;

    for (const l of lines) {
      totalDr = totalDr.add(this.money.toDecimal(l.debit));
      totalCr = totalCr.add(this.money.toDecimal(l.credit));
    }

    const diff = totalDr.sub(totalCr);
    const passed = diff.isZero();

    return {
      checkName: 'Trial Balance Equation',
      passed,
      severity: 'CRITICAL',
      message: passed
        ? `Trial Balance is in exact balance (Debit: £${totalDr.toFixed(2)}, Credit: £${totalCr.toFixed(2)})`
        : `Trial Balance mismatch! Total Dr: £${totalDr.toFixed(2)}, Total Cr: £${totalCr.toFixed(2)}, Diff: £${diff.toFixed(2)}`,
      details: {
        totalDebit: totalDr.toFixed(4),
        totalCredit: totalCr.toFixed(4),
        difference: diff.toFixed(4),
      },
    };
  }

  /**
   * Control 3: Multi-tenant boundary isolation.
   */
  async checkCrossTenantReferences(organizationId: string): Promise<IntegrityCheckResult> {
    const invalidLines = await this.prisma.journalLine.findMany({
      where: {
        organizationId,
        account: {
          organizationId: { not: organizationId },
        },
      },
      select: {
        id: true,
        journalEntryId: true,
        accountId: true,
      },
    });

    const passed = invalidLines.length === 0;

    return {
      checkName: 'Tenant Boundary Isolation',
      passed,
      severity: 'CRITICAL',
      message: passed
        ? 'No cross-tenant account references detected'
        : `Found ${invalidLines.length} cross-tenant journal line references!`,
      details: passed ? undefined : invalidLines,
    };
  }

  /**
   * Control 4: Duplicate journal numbers within organisation.
   */
  async checkDuplicateJournalNumbers(organizationId: string): Promise<IntegrityCheckResult> {
    const duplicates = await this.prisma.$queryRaw<Array<{ journal_number: string; count: bigint }>>`
      SELECT journal_number, COUNT(*) as count
      FROM journal_entries
      WHERE organization_id = ${organizationId}::uuid
      GROUP BY journal_number
      HAVING COUNT(*) > 1
    `;

    const passed = duplicates.length === 0;

    return {
      checkName: 'Duplicate Journal Numbers',
      passed,
      severity: 'CRITICAL',
      message: passed
        ? 'All journal numbers are strictly unique within the organisation'
        : `Found duplicate journal numbers: ${duplicates.map((d) => d.journal_number).join(', ')}`,
      details: passed ? undefined : duplicates,
    };
  }

  /**
   * Control 5: Orphan journal lines without journal or account.
   */
  async checkOrphanJournalLines(organizationId: string): Promise<IntegrityCheckResult> {
    const orphanLines = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT jl.id
      FROM journal_lines jl
      LEFT JOIN journal_entries je ON jl.journal_entry_id = je.id
      LEFT JOIN accounts a ON jl.account_id = a.id
      WHERE jl.organization_id = ${organizationId}::uuid
        AND (je.id IS NULL OR a.id IS NULL)
    `;

    const passed = orphanLines.length === 0;

    return {
      checkName: 'Orphaned Accounting Records',
      passed,
      severity: 'CRITICAL',
      message: passed
        ? 'No orphaned journal lines or broken relational records found'
        : `Found ${orphanLines.length} orphaned journal lines!`,
      details: passed ? undefined : orphanLines,
    };
  }

  /**
   * Control 6: Locked period violations.
   */
  async checkLockedPeriodViolations(organizationId: string): Promise<IntegrityCheckResult> {
    const lockedPeriods = await this.prisma.accountingPeriod.findMany({
      where: {
        organizationId,
        status: PeriodStatus.HARD_LOCKED,
      },
    });

    const violations: Array<{ journalNumber: string; postingDate: Date; periodName: string }> = [];

    for (const period of lockedPeriods) {
      const journalsInLockedPeriod = await this.prisma.journalEntry.findMany({
        where: {
          organizationId,
          status: { in: [JournalStatus.POSTED, JournalStatus.REVERSED] },
          postingDate: {
            gte: period.startDate,
            lte: period.endDate,
          },
          postedAt: {
            gt: period.lockedAt ?? period.endDate,
          },
        },
        select: { journalNumber: true, postingDate: true },
      });

      for (const j of journalsInLockedPeriod) {
        violations.push({
          journalNumber: j.journalNumber,
          postingDate: j.postingDate,
          periodName: period.name,
        });
      }
    }

    const passed = violations.length === 0;

    return {
      checkName: 'Period Lock Enforcement',
      passed,
      severity: 'CRITICAL',
      message: passed
        ? 'No postings violated hard-locked accounting periods'
        : `Found ${violations.length} postings into hard-locked periods!`,
      details: passed ? undefined : violations,
    };
  }

  /**
   * Control 7: Reversal symmetry and link integrity.
   */
  async checkReversalIntegrity(organizationId: string): Promise<IntegrityCheckResult> {
    const reversedJournals = await this.prisma.journalEntry.findMany({
      where: {
        organizationId,
        status: JournalStatus.REVERSED,
      },
      include: {
        reversedByJournal: {
          include: { lines: true },
        },
        lines: true,
      },
    });

    const brokenReversals: Array<{ originalNumber: string; issue: string }> = [];

    for (const orig of reversedJournals) {
      if (!orig.reversedByJournal) {
        brokenReversals.push({
          originalNumber: orig.journalNumber,
          issue: 'Missing reversal journal link (reversedByJournal is null)',
        });
        continue;
      }

      if (orig.reversedByJournal.organizationId !== organizationId) {
        brokenReversals.push({
          originalNumber: orig.journalNumber,
          issue: 'Reversal journal belongs to another organisation',
        });
        continue;
      }

      let origDr = this.money.ZERO;
      let origCr = this.money.ZERO;
      for (const l of orig.lines) {
        origDr = origDr.add(this.money.toDecimal(l.debit));
        origCr = origCr.add(this.money.toDecimal(l.credit));
      }

      let revDr = this.money.ZERO;
      let revCr = this.money.ZERO;
      for (const l of orig.reversedByJournal.lines) {
        revDr = revDr.add(this.money.toDecimal(l.debit));
        revCr = revCr.add(this.money.toDecimal(l.credit));
      }

      // Reversal debit must equal original credit, reversal credit must equal original debit
      if (!revDr.eq(origCr) || !revCr.eq(origDr)) {
        brokenReversals.push({
          originalNumber: orig.journalNumber,
          issue: `Reversal amounts not symmetrical: Orig (Dr:${origDr.toFixed(2)}, Cr:${origCr.toFixed(2)}) vs Rev (Dr:${revDr.toFixed(2)}, Cr:${revCr.toFixed(2)})`,
        });
      }
    }

    const passed = brokenReversals.length === 0;

    return {
      checkName: 'Reversal Symmetrical Integrity',
      passed,
      severity: 'CRITICAL',
      message: passed
        ? `All ${reversedJournals.length} reversals have verified bilateral integrity and symmetrical amounts`
        : `Found ${brokenReversals.length} broken or asymmetrical reversals!`,
      details: passed ? undefined : brokenReversals,
    };
  }
}
