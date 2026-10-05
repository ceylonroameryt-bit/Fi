/**
 * Ledgerline Platform Super Admin Bootstrap
 *
 * This utility creates or promotes a designated platform Super Administrator
 * using explicit, isolated environment variables.
 *
 * Usage:
 *   BOOTSTRAP_ADMIN_EMAIL=admin@yourdomain.com \
 *   BOOTSTRAP_ADMIN_PASSWORD=YourStrongRandomPassword123! \
 *   BOOTSTRAP_ADMIN_FIRST_NAME=Platform \
 *   BOOTSTRAP_ADMIN_LAST_NAME=Admin \
 *   npx ts-node scripts/bootstrap-super-admin.ts
 *
 * SECURITY CONSTRAINTS:
 * 1. Must NEVER be invoked automatically on production startup.
 * 2. Refuses demo credentials, known defaults, and weak passwords.
 * 3. Does not log passwords or tokens.
 */

import { PrismaClient, UserStatus } from '@prisma/client';
import { PasswordService } from '../src/auth/password.service';

const FORBIDDEN_PASSWORDS = new Set([
  'password1234!',
  'password',
  'password123',
  'admin',
  'admin123',
  'administrator',
  'changeme',
  'secret',
  'ledgerline',
  'ledgerpro',
  'welcome',
  'welcome123',
  'qwerty',
  '12345678',
  '123456789',
]);

const FORBIDDEN_EMAILS = new Set([
  'owner@democonsulting.com',
  'accountant@democonsulting.com',
  'viewer@democonsulting.com',
  'demo@example.com',
  'test@example.com',
  'admin@example.com',
]);

async function bootstrap() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const firstName = process.env.BOOTSTRAP_ADMIN_FIRST_NAME?.trim() || 'Platform';
  const lastName = process.env.BOOTSTRAP_ADMIN_LAST_NAME?.trim() || 'Administrator';

  console.log('[Security Audit] Initializing Platform Super Admin bootstrap procedure...');

  if (!email || !email.includes('@')) {
    console.error('FATAL: BOOTSTRAP_ADMIN_EMAIL environment variable is missing or invalid.');
    process.exit(1);
  }

  if (FORBIDDEN_EMAILS.has(email)) {
    console.error(`FATAL: "${email}" is a reserved demo/placeholder address and CANNOT be granted Super Admin privileges.`);
    process.exit(1);
  }

  if (!password) {
    console.error('FATAL: BOOTSTRAP_ADMIN_PASSWORD environment variable is missing.');
    process.exit(1);
  }

  if (password.length < 12) {
    console.error('FATAL: Super Admin password must be at least 12 characters long.');
    process.exit(1);
  }

  if (FORBIDDEN_PASSWORDS.has(password.toLowerCase())) {
    console.error('FATAL: Provided password is in the common/default credential blocklist.');
    process.exit(1);
  }

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  if (!hasLower || !hasUpper || !hasDigit || !hasSpecial) {
    console.error('FATAL: Super Admin password must contain lowercase, uppercase, numeric, and special characters.');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const passwords = new PasswordService();

  try {
    const passwordHash = await passwords.hash(password);

    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        passwordHash,
        firstName,
        lastName,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        status: UserStatus.ACTIVE,
        isSuperAdmin: true,
      },
      update: {
        passwordHash,
        firstName,
        lastName,
        emailVerified: true,
        status: UserStatus.ACTIVE,
        isSuperAdmin: true,
      },
    });

    console.log(`[Security Audit] Super Admin successfully created/updated: ${user.email} (User ID: ${user.id})`);
    console.log('[Security Audit] Access granted: Platform Super Admin (isSuperAdmin = true).');
  } catch (err: any) {
    console.error('FATAL: Failed to bootstrap super admin:', err?.message || err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

bootstrap();
