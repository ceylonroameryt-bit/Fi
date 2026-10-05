import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { createValidationPipe } from '../src/common/validation/validation.pipe';
import { RolesService } from '../src/roles/roles.service';
import { MailService } from '../src/auth/mail.service';
import { PasswordService } from '../src/auth/password.service';
import cookieParser from 'cookie-parser';

describe('Account Lifecycle & Token Concurrency Controls (Phase 5 E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mailService: MailService;
  let ownerToken: string;
  let orgId: string;
  let accountantRoleId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser('test-secret-at-least-32-characters-long'));
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(createValidationPipe());

    prisma = app.get(PrismaService);
    mailService = app.get(MailService);
    const roles = app.get(RolesService);
    await roles.seedGlobalPermissions();

    await app.init();

    // Login as existing owner
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'owner@democonsulting.com', password: 'Password1234!' })
      .expect(200);

    ownerToken = loginRes.body.accessToken;

    const orgsRes = await request(app.getHttpServer())
      .get('/api/v1/organizations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    orgId = orgsRes.body[0].organization.id;

    // Get an accountant role
    const rolesRes = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgId}/roles`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-organization-id', orgId)
      .expect(200);

    accountantRoleId = rolesRes.body.find((r: any) => r.systemKey === 'ACCOUNTANT')?.id || rolesRes.body[0].id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Invitations & Account Setup', () => {
    const newMemberEmail = `invitee-${Date.now()}@example.com`;
    let invitationToken: string;

    it('invites a new user, creates invited membership, and sends invitation email with token', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${orgId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .send({
          email: newMemberEmail,
          roleId: accountantRoleId,
        })
        .expect(201);

      expect(res.body.user.email).toBe(newMemberEmail);
      expect(res.body.status).toBe('INVITED');

      // Check mail service outbox
      const mail = mailService.lastMailTo(newMemberEmail);
      expect(mail).toBeDefined();
      expect(mail?.link).toContain('/accept-invitation?token=');

      // Extract raw token from link
      const match = mail?.link?.match(/token=([^&]+)/);
      expect(match).not.toBeNull();
      invitationToken = match![1];
    });

    it('rejects login before invitation is accepted', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: newMemberEmail, password: 'Password1234!' })
        .expect(401);
    });

    it('accepts invitation, sets password, activates user and member, and returns active session', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/accept-invitation')
        .send({
          token: invitationToken,
          password: 'NewStrongPassword2026!',
          firstName: 'Invited',
          lastName: 'Colleague',
        })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.email).toBe(newMemberEmail);
      expect(res.body.user.firstName).toBe('Invited');

      // Verify user and member status in DB
      const user = await prisma.user.findUnique({ where: { email: newMemberEmail } });
      expect(user?.status).toBe('ACTIVE');
      expect(user?.emailVerified).toBe(true);

      const member = await prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId: orgId, userId: user!.id } },
      });
      expect(member?.status).toBe('ACTIVE');
      expect(member?.joinedAt).not.toBeNull();
    });

    it('prevents reuse or replay of already consumed invitation token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/accept-invitation')
        .send({
          token: invitationToken,
          password: 'AnotherPassword1234!',
        })
        .expect(400);

      expect(res.body.error.code).toBe('AUTH_TOKEN_INVALID');
    });

    it('invites an existing active user and delivers notification email directly', async () => {
      const existingUserEmail = 'bookkeeper@democonsulting.com';

      // Ensure user exists and is active
      const user = await prisma.user.findUnique({ where: { email: existingUserEmail } });
      if (user) {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/organizations/${orgId}/members`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-organization-id', orgId)
          .send({
            email: existingUserEmail,
            roleId: accountantRoleId,
          });

        if (res.status === 201) {
          const mail = mailService.lastMailTo(existingUserEmail);
          expect(mail?.link).toContain('/login');
        } else {
          expect(res.status).toBe(409);
        }
      }
    });
  });

  describe('2. Password Recovery & Token Single-Use Protections', () => {
    const targetEmail = 'owner@democonsulting.com';
    let resetToken: string;

    it('requests password reset without leaking whether email exists', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: targetEmail })
        .expect(200);

      const mail = mailService.lastMailTo(targetEmail);
      expect(mail).toBeDefined();
      expect(mail?.link).toContain('/reset-password?token=');

      const match = mail?.link?.match(/token=([^&]+)/);
      expect(match).not.toBeNull();
      resetToken = match![1];
    });

    it('resets password using valid token and revokes previous sessions', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({
          token: resetToken,
          password: 'UpdatedPassword1234!',
        })
        .expect(200);

      // Verify that old session token is rejected
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(401);

      // Verify new password works
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: targetEmail, password: 'UpdatedPassword1234!' })
        .expect(200);

      // Update ownerToken for subsequent tests
      ownerToken = loginRes.body.accessToken;
    });

    it('rejects double reuse of password reset token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({
          token: resetToken,
          password: 'Password1234!',
        })
        .expect(400);

      expect(res.body.error.code).toBe('AUTH_TOKEN_INVALID');
    });

    // Reset password back to default Password1234! for test continuity
    afterAll(async () => {
      const passwordService = app.get(PasswordService);
      const hash = await passwordService.hash('Password1234!');
      await prisma.user.update({
        where: { email: targetEmail },
        data: { passwordHash: hash },
      });
    });
  });

  describe('3. Organisation Settings Persistence & Field Alignment', () => {
    it('persists taxNumber and address fields without data fabrication', async () => {
      const updateData = {
        name: 'Alpha Consulting Ltd Hardened',
        legalName: 'Alpha Consulting Limited Statutory',
        registrationNumber: 'GB12345678',
        taxNumber: 'GB999888777',
        addressLine1: '42 Baker Street',
        addressLine2: 'Suite 2A',
        city: 'London',
        postcode: 'W1U 7EW',
        timezone: 'Europe/London',
      };

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/organizations/${orgId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .send(updateData)
        .expect(200);

      expect(res.body.name).toBe(updateData.name);
      expect(res.body.taxNumber).toBe(updateData.taxNumber);
      expect(res.body.registrationNumber).toBe(updateData.registrationNumber);
      expect(res.body.addressLine1).toBe(updateData.addressLine1);
      expect(res.body.city).toBe(updateData.city);
      expect(res.body.postcode).toBe(updateData.postcode);

      // Reload from GET /organizations/:orgId to verify persistence
      const getRes = await request(app.getHttpServer())
        .get(`/api/v1/organizations/${orgId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-organization-id', orgId)
        .expect(200);

      expect(getRes.body.taxNumber).toBe(updateData.taxNumber);
      expect(getRes.body.addressLine1).toBe(updateData.addressLine1);
      expect(getRes.body.postcode).toBe(updateData.postcode);
    });
  });
});
