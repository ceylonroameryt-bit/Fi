import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService, Tx } from '../database/prisma.service';
import type { Actor } from '../common/types/request-context.types';
import { AuditEventType } from './audit-events';

export interface AuditEntry {
  organizationId: string | null;
  eventType: AuditEventType;
  entityType: string;
  entityId?: string | null;
  oldValues?: unknown;
  newValues?: unknown;
}

const NEVER_AUDIT = new Set(['passwordHash', 'refreshTokenHash', 'tokenHash']);

/** Converts values (Decimal, Date, nested objects) into JSON safe for audit storage. */
export function toAuditJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) return Prisma.JsonNull;
  return JSON.parse(
    JSON.stringify(value, (key, v: unknown) => (NEVER_AUDIT.has(key) ? undefined : v)),
  ) as Prisma.InputJsonValue;
}

/** Returns only keys whose values differ, as { old, new } snapshots. */
export function diffValues<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): { oldValues: Partial<T>; newValues: Partial<T> } {
  const oldValues: Partial<T> = {};
  const newValues: Partial<T> = {};
  for (const key of Object.keys(after) as (keyof T)[]) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      oldValues[key] = before[key];
      newValues[key] = after[key] as T[keyof T];
    }
  }
  return { oldValues, newValues };
}

/**
 * Append-only audit trail. Entries are written inside the caller's
 * transaction so an audited change and its audit record commit together.
 * There is deliberately no update/delete API; the database also rejects
 * UPDATE/DELETE on audit_logs via trigger.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(tx: Tx | null, actor: Actor | null, entry: AuditEntry): Promise<void> {
    const client = tx ?? this.prisma;
    await client.auditLog.create({
      data: {
        organizationId: entry.organizationId,
        userId: actor?.userId ?? null,
        eventType: entry.eventType,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        oldValues: toAuditJson(entry.oldValues),
        newValues: toAuditJson(entry.newValues),
        ipAddress: actor?.ipAddress ?? null,
        userAgent: actor?.userAgent ?? null,
        sessionId: actor?.sessionId ?? null,
        requestId: actor?.requestId ?? null,
      },
    });
  }

  async list(
    organizationId: string,
    filter: { entityType?: string; entityId?: string; eventType?: string; page: number; pageSize: number },
  ) {
    const where: Prisma.AuditLogWhereInput = {
      organizationId,
      ...(filter.entityType ? { entityType: filter.entityType } : {}),
      ...(filter.entityId ? { entityId: filter.entityId } : {}),
      ...(filter.eventType ? { eventType: filter.eventType } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
        select: {
          id: true,
          eventType: true,
          entityType: true,
          entityId: true,
          oldValues: true,
          newValues: true,
          ipAddress: true,
          createdAt: true,
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, page: filter.page, pageSize: filter.pageSize };
  }
}
