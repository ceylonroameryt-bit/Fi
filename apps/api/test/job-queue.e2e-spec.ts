import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Job } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { JobQueueService } from '../src/jobs/job-queue.service';
import { JobFailure, JobHandler, JobWorkerService, PermanentJobError } from '../src/jobs/job-worker.service';

/** Stage 6 (Phase 44): Postgres job queue semantics against a real database. */
describe('Job queue & worker (Stage 6 E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let queue: JobQueueService;
  let worker: JobWorkerService;
  let orgId: string;
  const run = Date.now();
  const type = (name: string) => `test.${name}.${run}`;
  const enqueue = (t: string, key: string, extra: Record<string, unknown> = {}) =>
    queue.enqueue({ organizationId: orgId, type: t, payload: {}, idempotencyKey: `${t}:${key}`, ...extra });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    queue = app.get(JobQueueService);
    worker = app.get(JobWorkerService);
    orgId = (await prisma.organization.findFirstOrThrow({ orderBy: { createdAt: 'asc' } })).id;
  });

  afterAll(async () => {
    await prisma.job.deleteMany({ where: { type: { startsWith: 'test.' } } });
    await app.close();
  });

  it('enqueue is idempotent by key', async () => {
    const t = type('idem');
    expect(await enqueue(t, 'a')).toBe(true);
    expect(await enqueue(t, 'a')).toBe(false);
    expect(await prisma.job.count({ where: { type: t } })).toBe(1);
  });

  it('concurrent workers never claim the same job (FOR UPDATE SKIP LOCKED)', async () => {
    const t = type('claim');
    await Promise.all(['1', '2', '3'].map((k) => enqueue(t, k)));
    const claims = await Promise.all(Array.from({ length: 6 }, (_, i) => queue.claim(`w${i}`, [t])));
    const ids = claims.filter((j): j is Job => !!j).map((j) => j.id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) {
      const job = await prisma.job.findUniqueOrThrow({ where: { id } });
      expect(job).toMatchObject({ status: 'RUNNING', attempts: 1 });
      // Raw-SQL timestamps must be UTC like Prisma's, whatever the database session time zone.
      expect(Math.abs(job.startedAt!.getTime() - Date.now())).toBeLessThan(60_000);
    }
  });

  it('does not hand out jobs before their run time', async () => {
    const t = type('later');
    await enqueue(t, 'x', { runAt: new Date(Date.now() + 60_000) });
    expect(await queue.claim('w', [t])).toBeNull();
  });

  it('retries with exponential backoff, then dead-letters when attempts are used up', async () => {
    const t = type('retry');
    await enqueue(t, 'x', { maxAttempts: 2 });
    let job = (await queue.claim('w', [t]))!;
    expect(await queue.retryOrBury(job, 'boom 1')).toBe('retrying');
    const queued = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(queued.status).toBe('QUEUED');
    expect(queued.lastError).toBe('boom 1');
    const prod = new JobQueueService(prisma, { JOB_RETRY_BASE_MS: 5000, JOB_RETRY_MAX_MS: 600_000, JOB_LOCK_TIMEOUT_MS: 300_000 });
    expect([1, 2, 3, 10].map((a) => prod.backoffMs(a))).toEqual([5000, 10000, 20000, 600_000]);

    await prisma.job.update({ where: { id: job.id }, data: { runAt: new Date() } });
    job = (await queue.claim('w', [t]))!;
    expect(job.attempts).toBe(2);
    expect(await queue.retryOrBury(job, 'boom 2')).toBe('dead');
    expect(await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).toMatchObject({ status: 'DEAD', lastError: 'boom 2' });
    expect((await queue.listDead(orgId)).map((j) => j.id)).toContain(job.id);
  });

  it('defer puts a job back without spending an attempt', async () => {
    const t = type('defer');
    await enqueue(t, 'x');
    const job = (await queue.claim('w', [t]))!;
    await queue.defer(job, 0);
    expect(await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).toMatchObject({ status: 'QUEUED', attempts: 0 });
  });

  it('recovers jobs whose worker died mid-run', async () => {
    const t = type('stale');
    await enqueue(t, 'x');
    const job = (await queue.claim('w', [t]))!;
    await prisma.job.update({ where: { id: job.id }, data: { lockedAt: new Date(Date.now() - 24 * 3600_000) } });
    expect(await queue.recoverStale()).toBeGreaterThanOrEqual(1);
    expect(await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).toMatchObject({ status: 'QUEUED', lockedBy: null });
  });

  describe('worker', () => {
    const calls: string[] = [];
    const dead: JobFailure[] = [];
    let failuresLeft = 2;

    const flaky: JobHandler = {
      type: type('flaky'),
      handle: async () => {
        calls.push('flaky');
        if (failuresLeft-- > 0) throw new Error('temporary outage');
      },
      onDead: async (_j, f) => void dead.push(f),
    };
    const broken: JobHandler = {
      type: type('broken'),
      handle: async () => {
        calls.push('broken');
        throw new PermanentJobError('BAD_INPUT', 'cannot ever work');
      },
      onDead: async (_j, f) => void dead.push(f),
    };
    const limited: JobHandler = { type: type('limited'), rateLimited: true, handle: async () => void calls.push('limited') };

    beforeAll(() => [flaky, broken].forEach((h) => worker.register(h)));

    it('retries transient failures until the job succeeds', async () => {
      await enqueue(flaky.type, 'x', { maxAttempts: 5 });
      for (let i = 0; i < 5; i++) {
        await worker.runOnce();
        await prisma.job.updateMany({ where: { type: flaky.type, status: 'QUEUED' }, data: { runAt: new Date() } });
      }
      expect(calls.filter((c) => c === 'flaky')).toHaveLength(3);
      expect(await prisma.job.findFirstOrThrow({ where: { type: flaky.type } })).toMatchObject({ status: 'SUCCEEDED', attempts: 3 });
      expect(dead).toHaveLength(0);
    });

    it('dead-letters permanent failures immediately and notifies the handler', async () => {
      await enqueue(broken.type, 'x', { maxAttempts: 5 });
      await worker.drain();
      expect(calls.filter((c) => c === 'broken')).toHaveLength(1);
      expect(await prisma.job.findFirstOrThrow({ where: { type: broken.type } })).toMatchObject({ status: 'DEAD', attempts: 1 });
      expect(dead).toEqual([{ code: 'BAD_INPUT', message: 'cannot ever work' }]);
    });

    it('defers jobs over the per-organisation rate limit instead of running them', async () => {
      // A worker with a small limit, so the test does not depend on the environment's setting.
      const limitedWorker = new JobWorkerService(queue, { JOB_WORKER_ENABLED: false, JOB_POLL_INTERVAL_MS: 1000, DOCUMENT_JOBS_PER_ORG_PER_MINUTE: 3 });
      limitedWorker.register(limited);
      await prisma.job.createMany({
        data: Array.from({ length: 3 }, (_, i) => ({
          organizationId: orgId,
          type: limited.type,
          idempotencyKey: `${limited.type}:past-${i}`,
          status: 'SUCCEEDED' as const,
          startedAt: new Date(),
        })),
      });
      await enqueue(limited.type, 'now');
      await limitedWorker.runOnce();
      expect(calls).not.toContain('limited');
      const job = await prisma.job.findUniqueOrThrow({ where: { idempotencyKey: `${limited.type}:now` } });
      expect(job).toMatchObject({ status: 'QUEUED', attempts: 0 });
      expect(job.runAt.getTime()).toBeGreaterThan(Date.now());
    });
  });
});
