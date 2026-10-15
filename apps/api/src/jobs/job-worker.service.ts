import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { Job } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { DomainException } from '../common/errors/domain.exception';
import { APP_CONFIG } from '../config/config.module';
import type { AppEnv } from '../config/env';
import { JobQueueService } from './job-queue.service';

/** Thrown by a handler for failures that retrying cannot fix. DomainExceptions are treated the same. */
export class PermanentJobError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface JobFailure {
  code: string;
  message: string;
}

export interface JobHandler {
  readonly type: string;
  /** Must be idempotent: it may run more than once for the same job. */
  handle(job: Job): Promise<void>;
  /** Called once when the job is dead-lettered (permanent failure or retries exhausted). */
  onDead?(job: Job, failure: JobFailure): Promise<void>;
  /** Job types sharing a per-organisation start-rate limit (per minute). */
  readonly rateLimited?: boolean;
}

type WorkerConfig = Pick<AppEnv, 'JOB_WORKER_ENABLED' | 'JOB_POLL_INTERVAL_MS' | 'DOCUMENT_JOBS_PER_ORG_PER_MINUTE'>;

const RATE_WINDOW_MS = 60_000;

@Injectable()
export class JobWorkerService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(JobWorkerService.name);
  private readonly handlers = new Map<string, JobHandler>();
  private readonly workerId = `${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;
  private timer: NodeJS.Timeout | null = null;
  private busy = false;

  constructor(
    private readonly queue: JobQueueService,
    @Inject(APP_CONFIG) private readonly config: WorkerConfig,
  ) {}

  register(handler: JobHandler): void {
    if (this.handlers.has(handler.type)) throw new Error(`Duplicate job handler for ${handler.type}`);
    this.handlers.set(handler.type, handler);
  }

  onApplicationBootstrap(): void {
    if (!this.config.JOB_WORKER_ENABLED) return;
    this.timer = setInterval(() => void this.tick(), this.config.JOB_POLL_INTERVAL_MS);
    this.timer.unref();
    this.logger.log(`Job worker ${this.workerId} polling every ${this.config.JOB_POLL_INTERVAL_MS} ms`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      // Work through everything currently due, then wait for the next tick.
      while (await this.runOnce()) {
        /* keep draining */
      }
    } catch (err) {
      this.logger.error(`Job worker tick failed: ${(err as Error).message}`);
    } finally {
      this.busy = false;
    }
  }

  /** Processes at most one job. Returns false when nothing was due. */
  async runOnce(): Promise<boolean> {
    await this.queue.recoverStale();
    const job = await this.queue.claim(this.workerId, [...this.handlers.keys()]);
    if (!job) return false;
    const handler = this.handlers.get(job.type)!;

    if (handler.rateLimited) {
      const rateTypes = [...this.handlers.values()].filter((h) => h.rateLimited).map((h) => h.type);
      const recent = await this.queue.countRecentStarts(job.organizationId, rateTypes, RATE_WINDOW_MS, job.id);
      if (recent >= this.config.DOCUMENT_JOBS_PER_ORG_PER_MINUTE) {
        await this.queue.defer(job, RATE_WINDOW_MS / 4);
        return true;
      }
    }

    try {
      await handler.handle(job);
      await this.queue.complete(job);
    } catch (err) {
      const failure = toFailure(err);
      const permanent = err instanceof PermanentJobError || err instanceof DomainException;
      const outcome = permanent ? (await this.queue.bury(job, `${failure.code}: ${failure.message}`), 'dead') : await this.queue.retryOrBury(job, failure.message);
      if (outcome === 'dead') {
        this.logger.warn(`Job ${job.id} (${job.type}) dead-lettered: ${failure.code} ${failure.message}`);
        const reason = permanent ? failure : { code: 'RETRIES_EXHAUSTED', message: failure.message };
        await handler.onDead?.(job, reason).catch((e: Error) => this.logger.error(`onDead failed for ${job.id}: ${e.message}`));
      }
    }
    return true;
  }

  /** Runs jobs until none are due (tests and one-off scripts). */
  async drain(maxJobs = 100): Promise<number> {
    let n = 0;
    while (n < maxJobs && (await this.runOnce())) n++;
    return n;
  }
}

function toFailure(err: unknown): JobFailure {
  if (err instanceof PermanentJobError) return { code: err.code, message: err.message };
  if (err instanceof DomainException) return { code: err.code, message: err.message };
  return { code: 'ERROR', message: err instanceof Error ? err.message : String(err) };
}
