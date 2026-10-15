import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { createValidationPipe } from '../src/common/validation/validation.pipe';
import { RolesService } from '../src/roles/roles.service';
import { MfaService } from '../src/auth/mfa.service';

/** Stage 1 (Phase 2): MFA enforcement for privileged roles and refresh-token reuse detection. */
describe('Auth hardening (Stage 1 E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mfa: MfaService;
  const previousFlag = process.env.MFA_REQUIRED_FOR_PRIVILEGED_ROLES;
  const email = `mfa-owner-${Date.now()}@example.com`;
  const password = 'Very-Strong-Passw0rd-2026!';
  let accessToken: string;
  let orgId: string;
  let totpSecret: string;
  let recoveryCodes: string[];

  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    process.env.MFA_REQUIRED_FOR_PRIVILEGED_ROLES = 'true';
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser('test-secret-at-least-32-characters-long'));
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(createValidationPipe());
    prisma = app.get(PrismaService);
    mfa = app.get(MfaService);
    await app.get(RolesService).seedGlobalPermissions();
    await app.init();

    const reg = await http()
      .post('/api/v1/auth/register')
      .send({ email, password, firstName: 'Mfa', lastName: 'Owner' })
      .expect(201);
    accessToken = reg.body.accessToken;
    expect(reg.body.mfaRequired).toBe(false);

    const org = await http()
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: `MFA Test Ltd ${Date.now()}`, country: 'GB', baseCurrency: 'GBP', timezone: 'Europe/London' })
      .expect(201);
    orgId = org.body.id ?? org.body.organization?.id;
    expect(orgId).toBeDefined();
  });

  afterAll(async () => {
    process.env.MFA_REQUIRED_FOR_PRIVILEGED_ROLES = previousFlag;
    await app.close();
  });

  it('blocks an owner without MFA from organisation endpoints', async () => {
    const res = await http()
      .get(`/api/v1/organizations/${orgId}/accounts`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);
    expect(res.body.error?.code ?? res.body.code).toBe('AUTH_MFA_REQUIRED');
  });

  it('enrols MFA with a valid TOTP code and then allows access', async () => {
    const setup = await http().post('/api/v1/auth/mfa/setup').set('Authorization', `Bearer ${accessToken}`).expect(200);
    totpSecret = setup.body.secret;
    expect(setup.body.otpauthUrl).toContain('otpauth://totp/');

    await http()
      .post('/api/v1/auth/mfa/enable')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code: '000000' === mfa.totp(totpSecret, Date.now()) ? '111111' : '000000' })
      .expect(401);

    const enabled = await http()
      .post('/api/v1/auth/mfa/enable')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code: mfa.totp(totpSecret, Date.now()) })
      .expect(200);
    recoveryCodes = enabled.body.recoveryCodes;
    expect(recoveryCodes).toHaveLength(10);

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.mfaSecretEncrypted).not.toContain(totpSecret);

    await http().get(`/api/v1/organizations/${orgId}/accounts`).set('Authorization', `Bearer ${accessToken}`).expect(200);
  });

  it('requires the MFA challenge on a new login, and accepts a recovery code once', async () => {
    const login = await http().post('/api/v1/auth/login').send({ email, password }).expect(200);
    expect(login.body.mfaRequired).toBe(true);
    const token = login.body.accessToken;

    await http().get(`/api/v1/organizations/${orgId}/accounts`).set('Authorization', `Bearer ${token}`).expect(403);

    await http().post('/api/v1/auth/mfa/verify').set('Authorization', `Bearer ${token}`).send({ code: recoveryCodes[0] }).expect(200);
    await http().get(`/api/v1/organizations/${orgId}/accounts`).set('Authorization', `Bearer ${token}`).expect(200);

    // Recovery codes are single-use.
    const second = await http().post('/api/v1/auth/login').send({ email, password }).expect(200);
    await http()
      .post('/api/v1/auth/mfa/verify')
      .set('Authorization', `Bearer ${second.body.accessToken}`)
      .send({ code: recoveryCodes[0] })
      .expect(401);
  });

  it('revokes the session when a rotated refresh token is reused', async () => {
    const login = await http().post('/api/v1/auth/login').send({ email, password }).expect(200);
    const refreshCookie = (login.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('refresh_token='))!;
    const firstRefresh = refreshCookie.split(';')[0].split('=')[1];

    const rotated = await http().post('/api/v1/auth/refresh').send({ refreshToken: firstRefresh }).expect(200);

    // Attacker replays the old token.
    await http().post('/api/v1/auth/refresh').send({ refreshToken: firstRefresh }).expect(401);

    // The legitimate holder's new tokens are now dead too.
    await http().get('/api/v1/auth/me').set('Authorization', `Bearer ${rotated.body.accessToken}`).expect(401);

    const events = await prisma.auditLog.findMany({
      where: { eventType: 'REFRESH_TOKEN_REUSE_DETECTED', userId: (await prisma.user.findUniqueOrThrow({ where: { email } })).id },
    });
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it('revokes all other sessions', async () => {
    const other = await http().post('/api/v1/auth/login').send({ email, password }).expect(200);
    const res = await http().post('/api/v1/auth/sessions/revoke-all').set('Authorization', `Bearer ${accessToken}`).expect(200);
    expect(res.body.revoked).toBeGreaterThanOrEqual(1);
    await http().get('/api/v1/auth/me').set('Authorization', `Bearer ${other.body.accessToken}`).expect(401);
    await http().get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
  });
});
