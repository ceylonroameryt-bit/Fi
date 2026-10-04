import { Injectable } from '@nestjs/common';
import { FinancialYearStatus, PeriodStatus } from '@prisma/client';
import { PrismaService, Tx } from '../database/prisma.service';
import { DomainException } from '../common/errors/domain.exception';
import type { Actor } from '../common/types/request-context.types';
import { AuditService } from '../audit/audit.service';
import { AuditEvents } from '../audit/audit-events';
import {
  parseIsoDate,
  toIsoDate,
  addDays,
  monthName,
  daysInMonth,
  utcDate,
} from '../common/utils/dates';
import type { CreateFinancialYearDto, UpdateFinancialYearDto } from './dto/financial-year.dto';

@Injectable()
export class FinancialYearsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listFinancialYears(organizationId: string) {
    return this.prisma.financialYear.findMany({
      where: { organizationId },
      include: {
        periods: {
          orderBy: { periodNumber: 'asc' },
          select: {
            id: true,
            periodNumber: true,
            name: true,
            startDate: true,
            endDate: true,
            status: true,
            lockedAt: true,
          },
        },
        _count: { select: { periods: true } },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async getFinancialYear(organizationId: string, id: string) {
    const fy = await this.prisma.financialYear.findFirst({
      where: { id, organizationId },
      include: {
        periods: {
          orderBy: { periodNumber: 'asc' },
          include: {
            lockedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
            _count: { select: { journals: true } },
          },
        },
      },
    });
    if (!fy) {
      throw new DomainException('FINANCIAL_YEAR_NOT_FOUND', 'Financial year not found');
    }
    return fy;
  }

  async createFinancialYear(organizationId: string, dto: CreateFinancialYearDto, actor: Actor) {
    const startDate = parseIsoDate(dto.startDate, 'startDate');
    const endDate = parseIsoDate(dto.endDate, 'endDate');

    if (startDate.getTime() >= endDate.getTime()) {
      throw new DomainException(
        'FINANCIAL_YEAR_INVALID_RANGE',
        'Financial year start date must be before end date',
      );
    }

    // Check overlap with existing financial years for this organisation
    const overlapping = await this.prisma.financialYear.findFirst({
      where: {
        organizationId,
        OR: [
          {
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
        ],
      },
    });

    if (overlapping) {
      throw new DomainException(
        'FINANCIAL_YEAR_OVERLAP',
        `Financial year dates overlap with existing year "${overlapping.name}" (${toIsoDate(overlapping.startDate)} to ${toIsoDate(overlapping.endDate)})`,
      );
    }

    const fy = await this.prisma.transaction(async (tx) => {
      const created = await tx.financialYear.create({
        data: {
          organizationId,
          name: dto.name,
          startDate,
          endDate,
          status: FinancialYearStatus.OPEN,
          createdById: actor.userId,
        },
      });

      if (dto.generatePeriods !== false) {
        await this.generateAccountingPeriods(tx, organizationId, created.id, startDate, endDate);
      }

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.FINANCIAL_YEAR_CREATED,
        entityType: 'FINANCIAL_YEAR',
        entityId: created.id,
        newValues: { name: created.name, startDate: dto.startDate, endDate: dto.endDate },
      });

      return created;
    });

    return this.getFinancialYear(organizationId, fy.id);
  }

  async updateFinancialYear(organizationId: string, id: string, dto: UpdateFinancialYearDto, actor: Actor) {
    const fy = await this.getFinancialYear(organizationId, id);

    const updated = await this.prisma.transaction(async (tx) => {
      const res = await tx.financialYear.update({
        where: { id },
        data: { name: dto.name },
      });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.FINANCIAL_YEAR_UPDATED,
        entityType: 'FINANCIAL_YEAR',
        entityId: id,
        oldValues: { name: fy.name },
        newValues: { name: res.name },
      });

      return res;
    });

    return updated;
  }

  /**
   * Generates monthly accounting periods across the financial year.
   * Example: 2026-04-01 to 2027-03-31 -> 12 monthly periods (April 2026 ... March 2027)
   */
  async generateAccountingPeriods(
    tx: Tx,
    organizationId: string,
    financialYearId: string,
    startDate: Date,
    endDate: Date,
  ) {
    let currentStart = new Date(startDate.getTime());
    let periodNumber = 1;
    const periodsToCreate: Array<{
      organizationId: string;
      financialYearId: string;
      periodNumber: number;
      name: string;
      startDate: Date;
      endDate: Date;
      status: PeriodStatus;
    }> = [];

    while (currentStart.getTime() <= endDate.getTime()) {
      // Find end of month for currentStart
      const y = currentStart.getUTCFullYear();
      const m = currentStart.getUTCMonth();
      const lastDayOfMonth = daysInMonth(y, m);
      let periodEnd = utcDate(y, m, lastDayOfMonth);

      // If periodEnd exceeds financial year endDate, clamp to endDate
      if (periodEnd.getTime() > endDate.getTime()) {
        periodEnd = new Date(endDate.getTime());
      }

      const pName = `${monthName(currentStart)} ${y}`;

      periodsToCreate.push({
        organizationId,
        financialYearId,
        periodNumber,
        name: pName,
        startDate: new Date(currentStart.getTime()),
        endDate: periodEnd,
        status: PeriodStatus.OPEN,
      });

      periodNumber++;
      // Next period starts on day after current periodEnd
      currentStart = addDays(periodEnd, 1);
    }

    if (periodsToCreate.length > 0) {
      await tx.accountingPeriod.createMany({
        data: periodsToCreate,
      });
    }
  }

  async listPeriods(organizationId: string, financialYearId?: string) {
    return this.prisma.accountingPeriod.findMany({
      where: {
        organizationId,
        ...(financialYearId ? { financialYearId } : {}),
      },
      include: {
        financialYear: { select: { id: true, name: true, status: true } },
        lockedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
      orderBy: [{ startDate: 'asc' }],
    });
  }

  async softLockPeriod(organizationId: string, periodId: string, actor: Actor) {
    const period = await this.prisma.accountingPeriod.findFirst({
      where: { id: periodId, organizationId },
    });
    if (!period) throw new DomainException('PERIOD_NOT_FOUND', 'Accounting period not found');

    const updated = await this.prisma.transaction(async (tx) => {
      const res = await tx.accountingPeriod.update({
        where: { id: periodId },
        data: {
          status: PeriodStatus.SOFT_LOCKED,
          lockedById: actor.userId,
          lockedAt: new Date(),
        },
      });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.PERIOD_LOCKED,
        entityType: 'ACCOUNTING_PERIOD',
        entityId: periodId,
        oldValues: { status: period.status },
        newValues: { status: res.status, lockType: 'SOFT_LOCKED' },
      });

      return res;
    });

    return updated;
  }

  async hardLockPeriod(organizationId: string, periodId: string, actor: Actor) {
    const period = await this.prisma.accountingPeriod.findFirst({
      where: { id: periodId, organizationId },
    });
    if (!period) throw new DomainException('PERIOD_NOT_FOUND', 'Accounting period not found');

    const updated = await this.prisma.transaction(async (tx) => {
      const res = await tx.accountingPeriod.update({
        where: { id: periodId },
        data: {
          status: PeriodStatus.HARD_LOCKED,
          lockedById: actor.userId,
          lockedAt: new Date(),
        },
      });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.PERIOD_LOCKED,
        entityType: 'ACCOUNTING_PERIOD',
        entityId: periodId,
        oldValues: { status: period.status },
        newValues: { status: res.status, lockType: 'HARD_LOCKED' },
      });

      return res;
    });

    return updated;
  }

  async unlockPeriod(organizationId: string, periodId: string, actor: Actor) {
    const period = await this.prisma.accountingPeriod.findFirst({
      where: { id: periodId, organizationId },
    });
    if (!period) throw new DomainException('PERIOD_NOT_FOUND', 'Accounting period not found');

    const updated = await this.prisma.transaction(async (tx) => {
      const res = await tx.accountingPeriod.update({
        where: { id: periodId },
        data: {
          status: PeriodStatus.OPEN,
          lockedById: null,
          lockedAt: null,
        },
      });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.PERIOD_UNLOCKED,
        entityType: 'ACCOUNTING_PERIOD',
        entityId: periodId,
        oldValues: { status: period.status },
        newValues: { status: res.status },
      });

      return res;
    });

    return updated;
  }

  /**
   * Finds the period matching a given calendar date for an organisation.
   */
  async getPeriodForDate(organizationId: string, date: Date) {
    return this.prisma.accountingPeriod.findFirst({
      where: {
        organizationId,
        startDate: { lte: date },
        endDate: { gte: date },
      },
      include: { financialYear: true },
    });
  }

  /**
   * Validates posting date rules:
   * - Must match an existing accounting period
   * - If OPEN -> ok
   * - If SOFT_LOCKED -> requires user to have 'period.lock' permission (accounting supervisor/accountant)
   * - If HARD_LOCKED -> always rejected
   */
  async validatePostingDate(organizationId: string, postingDate: Date, userPermissions?: ReadonlySet<string>) {
    const period = await this.getPeriodForDate(organizationId, postingDate);
    if (!period) {
      return {
        isValid: false,
        error: `Posting date ${toIsoDate(postingDate)} does not belong to any accounting period`,
        errorCode: 'PERIOD_NOT_FOUND' as const,
        period: null,
      };
    }

    if (period.status === PeriodStatus.HARD_LOCKED) {
      return {
        isValid: false,
        error: `Accounting period "${period.name}" is hard-locked. No posting or journal modifications are permitted.`,
        errorCode: 'PERIOD_HARD_LOCKED' as const,
        period,
      };
    }

    if (period.status === PeriodStatus.SOFT_LOCKED) {
      const hasElevatedAuth = userPermissions && userPermissions.has('period.lock');
      if (!hasElevatedAuth) {
        return {
          isValid: false,
          error: `Accounting period "${period.name}" is soft-locked. Requires elevated accounting authority to post into.`,
          errorCode: 'PERIOD_SOFT_LOCKED' as const,
          period,
        };
      }
    }

    return {
      isValid: true,
      error: null,
      errorCode: null,
      period,
    };
  }
}
