import { Inject, Injectable } from '@nestjs/common';
import { Job, JobStatus, Prisma } from '@prisma/client';
import { PrismaService, Tx } from '../database/prisma.service';
import { APP_CONFIG } from '../config/config.module';
import type { AppEnv } from '../config/env';

export interface EnqueueInput {
  organizationId: string;
  type: string;
  payload: Record<string, unknown>;
  /** Unique per logical piece of work; enqueuing the same key again does nothing. */
  idempotencyKey: string;
  runAt?: Date;
  maxAttempts?: number;
}

export type JobQueueConfig = Pick<AppEnv, 'JOB_RETRY_BASE_MS' | 'JOB_RETRY_MAX_MS' | 'JOB_LOCK_TIMEOUT_MS'>;

/**
 * Postgres-backed queue. Workers claim with FOR UPDATE SKIP LOCKED, so any number of API/worker
 * processes can share it. Failed attempts are retried with exponential backoff; jobs that keep
 * failing (or fail permanently) end in DEAD, which is the dead-letter queue.
 */
@Injectable()
export class JobQueueService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: JobQueueConfig,
  ) {}

  /** Returns true if a new job was created, false if the idempotency key already existed. */
  async enqueue(input: EnqueueInput, tx?: Tx): Promise<boolean> {
    const result = await (tx ?? this.prisma).job.createMany({
      data: [
        {
          organizationId: input.organizationId,
          type: input.type,
          payload: input.payload as Prisma.InputJsonValue,
          idempotencyKey: input.idempotencyKey,
          runAt: input.runAt ?? new Date(),
          maxAttempts: input.maxAttempts ?? 5,
        },
      ],
      skipDuplicates: true,
    });
    return result.count === 1;
  }

  /** Atomically takes the next due job (optionally of given types) and marks it RUNNING. */
  async claim(workerId: string, types?: string[]): Promise<Job | null> {
    const typeFilter = types?.length ? Prisma.sql`AND type IN (${Prisma.join(types)})` : Prisma.empty;
    // Columns are "timestamp without time zone" holding UTC (Prisma convention), so compare with
    // UTC now, not the session's local now().
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      WITH next AS (
        SELECT id FROM jobs
        WHERE status = 'QUEUED' AND run_at <= timezone('UTC', now()) ${typeFilter}
        ORDER BY run_at, created_at
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE jobs j
      SET status = 'RUNNING', attempts = j.attempts + 1, started_at = timezone('UTC', now()),
          locked_at = timezone('UTC', now()), locked_by = ${workerId}, updated_at = timezone('UTC', now())
      FROM next WHERE j.id = next.id
      RETURNING j.id`;
    if (rows.length === 0) return null;
    return this.prisma.job.findUniqueOrThrow({ where: { id: rows[0].id } });
  }

  async complete(job: Job): Promise<void> {
    await this.prisma.job.update({
      where: { id: job.id },
      data: { status: JobStatus.SUCCEEDED, finishedAt: new Date(), lockedAt: null, lockedBy: null },
    });
  }

  /** Transient failure: schedule another attempt with backoff, or dead-letter when attempts are used up. */
  async retryOrBury(job: Job, error: string): Promise<'retrying' | 'dead'> {
    if (job.attempts >= job.maxAttempts) {
      await this.bury(job, error);
      return 'dead';
    }
    await this.prisma.job.update({
      where: { id: job.id },
      data: {
        status: JobStatus.QUEUED,
        runAt: new Date(Date.now() + this.backoffMs(job.attempts)),
        lastError: error.slice(0, 1000),
        lockedAt: null,
        lockedBy: null,
      },
    });
    return 'retrying';
  }

  /** Permanent failure (or retries exhausted): move to the dead-letter state. */
  async bury(job: Job, error: string): Promise<void> {
    await this.prisma.job.update({
      where: { id: job.id },
      data: { status: JobStatus.DEAD, finishedAt: new Date(), lastError: error.slice(0, 1000), lockedAt: null, lockedBy: null },
    });
  }

  /** Put a claimed job back without counting the attempt (e.g. organisation rate limit). */
  async defer(job: Job, delayMs: number): Promise<void> {
    await this.prisma.job.update({
      where: { id: job.id },
      data: {
        status: JobStatus.QUEUED,
        attempts: { decrement: 1 },
        runAt: new Date(Date.now() + delayMs),
        startedAt: null,
        lockedAt: null,
        lockedBy: null,
      },
    });
  }

  /** Jobs whose worker died mid-run are made available again (the attempt still counts). */
  async recoverStale(): Promise<number> {
    const cutoff = new Date(Date.now() - this.config.JOB_LOCK_TIMEOUT_MS);
    const result = await this.prisma.job.updateMany({
      where: { status: JobStatus.RUNNING, lockedAt: { lt: cutoff } },
      data: { status: JobStatus.QUEUED, runAt: new Date(), lockedAt: null, lockedBy: null, lastError: 'Worker lock expired' },
    });
    return result.count;
  }

  /** Jobs started for this organisation in the last `windowMs` (for rate limiting). */
  countRecentStarts(organizationId: string, types: string[], windowMs: number, excludeJobId: string): Promise<number> {
    return this.prisma.job.count({
      where: {
        organizationId,
        type: { in: types },
        id: { not: excludeJobId },
        startedAt: { gte: new Date(Date.now() - windowMs) },
      },
    });
  }

  listDead(organizationId: string) {
    return this.prisma.job.findMany({
      where: { organizationId, status: JobStatus.DEAD },
      orderBy: { finishedAt: 'desc' },
      take: 200,
    });
  }

  /** Manual requeue from the dead-letter queue; returns false if the job is not dead (or not this org's). */
  async requeue(organizationId: string, jobId: string): Promise<boolean> {
    const result = await this.prisma.job.updateMany({
      where: { id: jobId, organizationId, status: JobStatus.DEAD },
      data: { status: JobStatus.QUEUED, attempts: 0, runAt: new Date(), finishedAt: null, lastError: null },
    });
    return result.count === 1;
  }

  backoffMs(attempt: number): number {
    return Math.min(this.config.JOB_RETRY_BASE_MS * 2 ** Math.max(0, attempt - 1), this.config.JOB_RETRY_MAX_MS);
  }
}
