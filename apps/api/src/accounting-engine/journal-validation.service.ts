import { Injectable } from '@nestjs/common';
import { JournalSourceType, JournalStatus } from '@prisma/client';
import { PrismaService, Tx } from '../database/prisma.service';
import { MoneyService } from './money.service';
import { FinancialYearsService } from '../financial-years/financial-years.service';
import type { OrgContext } from '../common/types/request-context.types';

export interface ValidationIssue {
  field?: string;
  lineIndex?: number;
  accountId?: string;
  message: string;
  code: string;
}

export interface JournalValidationResult {
  isValid: boolean;
  errors: string[];
  issues: ValidationIssue[];
  warnings: string[];
  totalDebit: string;
  totalCredit: string;
  difference: string;
  periodId: string | null;
  periodName: string | null;
}

@Injectable()
export class JournalValidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly money: MoneyService,
    private readonly fyService: FinancialYearsService,
  ) {}

  /**
   * Primary validation engine method:
   * Performs rigorous accounting checks on a journal entry against tenant rules.
   */
  async validateJournal(
    journalId: string,
    orgContext: OrgContext,
    tx?: Tx,
  ): Promise<JournalValidationResult> {
    const client = tx ?? this.prisma;
    const journal = await client.journalEntry.findFirst({
      where: {
        id: journalId,
        organizationId: orgContext.organizationId,
      },
      include: {
        organization: true,
        lines: {
          include: {
            account: true,
          },
          orderBy: { lineNumber: 'asc' },
        },
      },
    });

    const issues: ValidationIssue[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!journal) {
      return {
        isValid: false,
        errors: ['Journal entry was not found in this organisation'],
        issues: [{ message: 'Journal not found', code: 'JOURNAL_NOT_FOUND' }],
        warnings: [],
        totalDebit: '0.0000',
        totalCredit: '0.0000',
        difference: '0.0000',
        periodId: null,
        periodName: null,
      };
    }

    // Rule 1: Tenant Isolation
    if (journal.organizationId !== orgContext.organizationId) {
      errors.push('Tenant isolation violation: Journal belongs to a different organisation');
      issues.push({ message: 'Tenant mismatch', code: 'TENANT_MISMATCH' });
    }

    // Rule 2: Permission requirement
    if (!orgContext.permissions.has('journal.validate')) {
      errors.push('Permission denied: journal.validate required');
      issues.push({ message: 'Missing permission journal.validate', code: 'PERMISSION_DENIED' });
    }

    // Rule 3: Journal status
    if (journal.status !== JournalStatus.DRAFT && journal.status !== JournalStatus.VALIDATED) {
      errors.push(`Cannot validate journal in status ${journal.status}`);
      issues.push({ message: `Invalid status ${journal.status}`, code: 'INVALID_STATUS' });
    }

    // Rule 14: Description
    if (!journal.description || journal.description.trim().length === 0) {
      errors.push('Journal description is required');
      issues.push({ field: 'description', message: 'Description cannot be empty', code: 'MISSING_DESCRIPTION' });
    }

    // Rule 12: Currency
    if (journal.currency !== orgContext.baseCurrency) {
      errors.push(`Journal currency (${journal.currency}) must match organisation base currency (${orgContext.baseCurrency})`);
      issues.push({ field: 'currency', message: 'Currency mismatch', code: 'CURRENCY_MISMATCH' });
    }

    // Rule 4: Minimum Lines
    if (!journal.lines || journal.lines.length < 2) {
      errors.push('A valid journal must contain at least 2 lines (debit and credit)');
      issues.push({ message: 'A journal requires at least 2 lines', code: 'INSUFFICIENT_LINES' });
    }

    let sumDebit = this.money.ZERO;
    let sumCredit = this.money.ZERO;

    // Check each line
    journal.lines.forEach((line, index) => {
      const debitDec = this.money.toDecimal(line.debit);
      const creditDec = this.money.toDecimal(line.credit);

      // Rule 6: Positive values only (no negative debit or credit)
      if (debitDec.lessThan(0)) {
        errors.push(`Line ${line.lineNumber}: Debit amount cannot be negative`);
        issues.push({ lineIndex: index, accountId: line.accountId, message: 'Debit cannot be negative', code: 'NEGATIVE_AMOUNT' });
      }
      if (creditDec.lessThan(0)) {
        errors.push(`Line ${line.lineNumber}: Credit amount cannot be negative`);
        issues.push({ lineIndex: index, accountId: line.accountId, message: 'Credit cannot be negative', code: 'NEGATIVE_AMOUNT' });
      }

      // Rule 5: Debit or Credit, not both, not both zero
      const isDebitZero = debitDec.isZero();
      const isCreditZero = creditDec.isZero();

      if (isDebitZero && isCreditZero) {
        errors.push(`Line ${line.lineNumber}: Line must specify either a debit or a credit amount greater than 0`);
        issues.push({ lineIndex: index, accountId: line.accountId, message: 'Line amount is zero', code: 'ZERO_AMOUNT_LINE' });
      } else if (!isDebitZero && !isCreditZero) {
        errors.push(`Line ${line.lineNumber}: Line cannot specify both debit and credit amounts`);
        issues.push({ lineIndex: index, accountId: line.accountId, message: 'Line specifies both debit and credit', code: 'DUAL_AMOUNT_LINE' });
      }

      sumDebit = sumDebit.add(debitDec);
      sumCredit = sumCredit.add(creditDec);

      // Rule 8: Account exists
      if (!line.account) {
        errors.push(`Line ${line.lineNumber}: Account was not found`);
        issues.push({ lineIndex: index, accountId: line.accountId, message: 'Account not found', code: 'ACCOUNT_NOT_FOUND' });
        return;
      }

      // Rule 1: Account belongs to organisation
      if (line.account.organizationId !== orgContext.organizationId) {
        errors.push(`Line ${line.lineNumber}: Account ${line.account.code} belongs to another organisation`);
        issues.push({ lineIndex: index, accountId: line.accountId, message: 'Cross-tenant account reference', code: 'CROSS_TENANT_ACCOUNT' });
      }

      // Rule 9: Account is active
      if (!line.account.isActive) {
        errors.push(`Line ${line.lineNumber}: Account ${line.account.code} (${line.account.name}) is archived and cannot be used`);
        issues.push({ lineIndex: index, accountId: line.accountId, message: `Account ${line.account.code} is archived`, code: 'ACCOUNT_ARCHIVED' });
      }

      // Rule 10: Manual posting allowed (only applies to manual journals; system journals like invoices may post to AR/Tax nominals)
      const isManualJournal = !journal.sourceType || journal.sourceType === JournalSourceType.MANUAL;
      if (isManualJournal && !line.account.allowManualPosting) {
        errors.push(`Line ${line.lineNumber}: Account ${line.account.code} (${line.account.name}) does not allow manual postings`);
        issues.push({ lineIndex: index, accountId: line.accountId, message: `Account ${line.account.code} manual posting disabled`, code: 'ACCOUNT_MANUAL_POSTING_DISABLED' });
      }
    });

    // Rule 7: Double Entry Balance
    const diff = sumDebit.sub(sumCredit);
    if (!diff.isZero()) {
      errors.push(`Journal is unbalanced: Total Debit (${sumDebit.toFixed(2)}) does not equal Total Credit (${sumCredit.toFixed(2)}). Difference: ${diff.abs().toFixed(2)}`);
      issues.push({
        message: `Unbalanced journal by ${diff.abs().toFixed(2)}`,
        code: 'JOURNAL_UNBALANCED',
      });
    }

    // Rule 11: Accounting Period & Posting Date
    let periodId: string | null = null;
    let periodName: string | null = null;

    const periodCheck = await this.fyService.validatePostingDate(
      orgContext.organizationId,
      journal.postingDate,
      orgContext.permissions,
      tx,
    );

    if (!periodCheck.isValid) {
      errors.push(periodCheck.error ?? 'Invalid posting date period');
      issues.push({
        field: 'postingDate',
        message: periodCheck.error ?? 'Period locked or missing',
        code: periodCheck.errorCode ?? 'PERIOD_INVALID',
      });
    } else if (periodCheck.period) {
      periodId = periodCheck.period.id;
      periodName = periodCheck.period.name;
    }

    const isValid = errors.length === 0;

    return {
      isValid,
      errors,
      issues,
      warnings,
      totalDebit: sumDebit.toFixed(4),
      totalCredit: sumCredit.toFixed(4),
      difference: diff.toFixed(4),
      periodId,
      periodName,
    };
  }
}
