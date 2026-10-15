import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { createValidationPipe } from '../src/common/validation/validation.pipe';
import { RolesService } from '../src/roles/roles.service';
import { AI_PROVIDER } from '../src/ai/gateway/ai-provider.interface';
import { FakeAiProvider } from '../src/ai/gateway/providers/fake.provider';

/** Stage 3: AI gateway switch, usage/cost logging, prompt versioning and business profile. */
describe('AI gateway + business profile (Stage 3 E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fake: FakeAiProvider;
  let token: string;
  let orgId: string;
  const previousProvider = process.env.AI_PROVIDER;
  const today = new Date().toISOString().slice(0, 10);

  const http = () => request(app.getHttpServer());
  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`).set('x-organization-id', orgId);
  const url = (p: string) => `/api/v1/organizations/${orgId}/ai${p}`;

  beforeAll(async () => {
    process.env.AI_PROVIDER = 'fake';
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser('test-secret-at-least-32-characters-long'));
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(createValidationPipe());
    await app.get(RolesService).seedGlobalPermissions();
    await app.init();
    prisma = app.get(PrismaService);
    fake = app.get(AI_PROVIDER);

    const login = await http().post('/api/v1/auth/login').send({ email: 'owner@democonsulting.com', password: 'Password1234!' }).expect(200);
    token = login.body.accessToken;
    orgId = (await http().get('/api/v1/organizations').set('Authorization', `Bearer ${token}`).expect(200)).body[0].organization.id;
    await prisma.organization.update({ where: { id: orgId }, data: { aiEnabled: false } });
  });

  afterAll(async () => {
    await prisma.organization.update({ where: { id: orgId }, data: { aiEnabled: false } });
    process.env.AI_PROVIDER = previousProvider;
    await app.close();
  });

  it('starts with AI off and blocks (and logs) model calls', async () => {
    const settings = (await auth(http().get(url('/settings'))).expect(200)).body;
    expect(settings).toEqual({ enabled: false, provider: 'fake', model: 'claude-opus-5-5' });

    const res = await auth(http().post(url('/connection-check'))).expect(403);
    expect(JSON.stringify(res.body)).toContain('AI_DISABLED');
    expect(fake.requests).toHaveLength(0);

    const blocked = await prisma.aiUsageLog.findFirst({
      where: { organizationId: orgId, status: 'BLOCKED', promptKey: 'ai.connection_check' },
      orderBy: { createdAt: 'desc' },
    });
    expect(blocked?.errorCode).toBe('AI_DISABLED');
  });

  it('switches AI on (audited) and runs a versioned prompt with usage and cost logged', async () => {
    await auth(http().put(url('/settings'))).send({ enabled: true }).expect(200);
    const auditRow = await prisma.auditLog.findFirst({
      where: { organizationId: orgId, eventType: 'AI_SETTINGS_UPDATED' },
      orderBy: { createdAt: 'desc' },
    });
    expect(auditRow?.newValues).toEqual({ aiEnabled: true });

    fake.enqueue((req) => ({
      output: { ok: true, token: /([0-9a-f]{12})$/.exec(req.userContent)![1] },
      inputTokens: 1500,
      outputTokens: 20,
    }));
    const check = (await auth(http().post(url('/connection-check'))).expect(200)).body;
    expect(check).toEqual({ ok: true, provider: 'fake', model: 'claude-opus-5-5' });

    const log = await prisma.aiUsageLog.findFirst({
      where: { organizationId: orgId, status: 'SUCCESS', promptKey: 'ai.connection_check' },
      orderBy: { createdAt: 'desc' },
    });
    expect(log).toMatchObject({ promptVersion: 1, inputTokens: 1500, outputTokens: 20, provider: 'fake' });
    expect(log!.promptHash).toHaveLength(64);
    expect(log!.costUsd!.toFixed(6)).toBe('0.006400'); // 1500 * $4/M + 20 * $20/M

    const usage = (await auth(http().get(url(`/usage?from=${today}&to=${today}`))).expect(200)).body;
    const success = usage.rows.find((r: any) => r.feature === 'connection_check' && r.status === 'SUCCESS');
    expect(success.calls).toBeGreaterThanOrEqual(1);
    expect(Number(usage.totalCostUsd)).toBeGreaterThan(0);
  });

  it('stores person-entered profile fields and refreshes derived ones from the ledger', async () => {
    const before = (await auth(http().get(url('/business-profile'))).expect(200)).body;
    expect(before).toHaveProperty('vatScheme');

    const updated = (await auth(http().put(url('/business-profile'))).send({ vatScheme: 'STANDARD' }).expect(200)).body;
    expect(updated.vatScheme).toBe('STANDARD');
    await auth(http().put(url('/business-profile'))).send({ vatScheme: 'MADE_UP' }).expect(400);

    const refreshed = (await auth(http().post(url('/business-profile/refresh'))).expect(200)).body;
    expect(refreshed.profileRefreshedAt).toBeTruthy();
    expect(Array.isArray(refreshed.usualCustomers)).toBe(true);
    // Other suites post sales invoices for the demo org, so customers come from real ledger history.
    for (const c of refreshed.usualCustomers) {
      expect(c).toEqual(
        expect.objectContaining({ contactId: expect.any(String), transactionCount: expect.any(Number), totalAmount: expect.stringMatching(/^\d+\.\d{2}$/) }),
      );
    }
    expect(refreshed.vatScheme).toBe('STANDARD');
  });

  it('switching AI off blocks calls again', async () => {
    await auth(http().put(url('/settings'))).send({ enabled: false }).expect(200);
    await auth(http().post(url('/connection-check'))).expect(403);
  });
});
