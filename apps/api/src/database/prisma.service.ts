import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { appLogger } from '../common/logging/app-logger';

export type Tx = Prisma.TransactionClient;

export interface TransactionOptions {
  isolationLevel?: Prisma.TransactionIsolationLevel;
  /** Retries on serialization failures / deadlocks (Postgres 40001 / 40P01). */
  maxRetries?: number;
  timeoutMs?: number;
}

function isRetryable(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2034') return true;
    const meta = JSON.stringify(error.meta ?? {});
    return meta.includes('40001') || meta.includes('40P01');
  }
  return false;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Reusable atomic unit of work: BEGIN → work → COMMIT, or ROLLBACK on any
   * thrown error. All multi-record financial changes must go through here so
   * no partial accounting data can ever be persisted.
   */
  async transaction<T>(work: (tx: Tx) => Promise<T>, options: TransactionOptions = {}): Promise<T> {
    const { isolationLevel = Prisma.TransactionIsolationLevel.ReadCommitted, maxRetries = 3, timeoutMs = 15_000 } = options;
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.$transaction(work, { isolationLevel, timeout: timeoutMs, maxWait: 5_000 });
      } catch (error) {
        if (attempt < maxRetries && isRetryable(error)) {
          appLogger.event('warn', 'transaction_retry', { attempt });
          continue;
        }
        throw error;
      }
    }
  }

  /** Serialises concurrent operations for one organisation + scope within the current transaction. */
  async advisoryLock(tx: Tx, organizationId: string, scope: string): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}::text), hashtext(${scope}::text))`;
  }

  async ping(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
