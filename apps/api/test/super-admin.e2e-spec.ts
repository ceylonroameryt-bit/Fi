import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/validation/validation.pipe';
import { PrismaService } from '../src/database/prisma.service';
import { PasswordService } from '../src/auth/password.service';
import { RolesService } from '../src/roles/roles.service';
import cookieParser from 'cookie-parser';

describe('Super Admin Portal & Platform Governance (E2E Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let normalUserToken: string;
  let testUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser('test-secret-at-least-32-characters-long'));
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(createValidationPipe());

    const roles = app.get(RolesService);
    await roles.seedGlobalPermissions();

    prisma = app.get(PrismaService);
    const passwords = app.get(PasswordService);

    const superAdminHash = await passwords.hash('SuperAdminSecret1234!');
    await prisma.user.upsert({
      where: { email: 'superadmin@blynt.internal' },
      create: {
        email: 'superadmin@blynt.internal',
        passwordHash: superAdminHash,
        firstName: 'Platform',
        lastName: 'Admin',
        status: 'ACTIVE',
        isSuperAdmin: true,
        emailVerified: true,
      },
      update: {
        passwordHash: superAdminHash,
        status: 'ACTIVE',
        isSuperAdmin: true,
      },
    });

    const normalUserHash = await passwords.hash('NormalUserSecret1234!');
    const normalUser = await prisma.user.upsert({
      where: { email: 'target-user@blynt.test' },
      create: {
        email: 'target-user@blynt.test',
        passwordHash: normalUserHash,
        firstName: 'Target',
        lastName: 'User',
        status: 'ACTIVE',
        isSuperAdmin: false,
        emailVerified: true,
      },
      update: {
        passwordHash: normalUserHash,
        status: 'ACTIVE',
        isSuperAdmin: false,
      },
    });
    testUserId = normalUser.id;

    await app.init();

    // Authenticate super admin
    const adminLoginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'superadmin@blynt.internal', password: 'SuperAdminSecret1234!' })
      .expect(200);
    adminToken = adminLoginRes.body.accessToken;

    // Authenticate normal user
    const normalLoginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'target-user@blynt.test', password: 'NormalUserSecret1234!' })
      .expect(200);
    normalUserToken = normalLoginRes.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Rejects non-super-admin access to platform stats with 403', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${normalUserToken}`)
      .expect(403);

    expect(res.body.error?.code).toBe('SUPER_ADMIN_REQUIRED');
  });

  it('2. Allows super admin to retrieve platform stats', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.tenants).toBeDefined();
    expect(res.body.users).toBeDefined();
    expect(res.body.health).toBeDefined();
    expect(res.body.health.status).toBe('HEALTHY');
  });

  it('3. Supports superAdminOnly query filter without validation rejection', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/users?superAdminOnly=true')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.items).toBeDefined();
    expect(Array.isArray(res.body.items)).toBe(true);
    for (const u of res.body.items) {
      expect(u.isSuperAdmin).toBe(true);
    }
  });

  it('4. Allows super admin to update user status without OrganizationAccessGuard false-positive', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${testUserId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'SUSPENDED' })
      .expect(200);

    expect(res.body.status).toBe('SUSPENDED');

    // Restore to ACTIVE
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${testUserId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'ACTIVE' })
      .expect(200);
  });

  it('5. Allows super admin to toggle user super admin privilege', async () => {
    const promoteRes = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${testUserId}/super-admin`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isSuperAdmin: true })
      .expect(200);

    expect(promoteRes.body.isSuperAdmin).toBe(true);

    const demoteRes = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${testUserId}/super-admin`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isSuperAdmin: false })
      .expect(200);

    expect(demoteRes.body.isSuperAdmin).toBe(false);
  });

  it('6. Allows super admin to retrieve audit logs', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/audit-logs?page=1&pageSize=10')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.items).toBeDefined();
    expect(res.body.total).toBeGreaterThanOrEqual(0);
  });
});
