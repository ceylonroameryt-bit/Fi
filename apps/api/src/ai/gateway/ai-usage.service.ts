import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { DomainException } from '../../common/errors/domain.exception';
import { parseIsoDate, toIsoDate, addDays } from '../../common/utils/dates';

export interface AiUsageRow {
  feature: string;
  status: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: string;
}

/** Per-organisation AI usage and cost summary over a date range (inclusive). */
@Injectable()
export class AiUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(organizationId: string, from: string, to: string) {
    if (!from || !to) throw new DomainException('VALIDATION_FAILED', 'from and to dates (YYYY-MM-DD) are required');
    const start = parseIsoDate(from, 'from');
    const endExclusive = addDays(parseIsoDate(to, 'to'), 1);
    if (start >= endExclusive) throw new DomainException('VALIDATION_FAILED', 'from must be on or before to');

    const groups = await this.prisma.aiUsageLog.groupBy({
      by: ['feature', 'status'],
      where: { organizationId, createdAt: { gte: start, lt: endExclusive } },
      _count: { _all: true },
      _sum: { inputTokens: true, outputTokens: true, costUsd: true },
      orderBy: [{ feature: 'asc' }, { status: 'asc' }],
    });
    const unpriced = await this.prisma.aiUsageLog.count({
      where: { organizationId, createdAt: { gte: start, lt: endExclusive }, costUsd: null, model: { not: null } },
    });

    const rows: AiUsageRow[] = groups.map((g) => ({
      feature: g.feature,
      status: g.status,
      calls: g._count._all,
      inputTokens: g._sum.inputTokens ?? 0,
      outputTokens: g._sum.outputTokens ?? 0,
      costUsd: new Prisma.Decimal(g._sum.costUsd ?? 0).toFixed(6),
    }));
    const totalCost = rows.reduce((a, r) => a.plus(r.costUsd), new Prisma.Decimal(0));
    return {
      organizationId,
      from: toIsoDate(start),
      to: to,
      rows,
      totalCostUsd: totalCost.toFixed(6),
      /** Calls whose model had no known price; their cost is excluded from the total. */
      unpricedCalls: unpriced,
    };
  }
}
