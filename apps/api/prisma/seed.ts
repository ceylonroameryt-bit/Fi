import { PrismaClient, UserStatus, MemberStatus, FinancialYearStatus, JournalStatus, JournalType, JournalSourceType } from '@prisma/client';
import { SYSTEM_PERMISSIONS, SYSTEM_ROLE_PERMISSIONS } from '../src/roles/roles.constants';
import { PasswordService } from '../src/auth/password.service';
import { DEFAULT_CHART_OF_ACCOUNTS } from '../src/accounts/accounts.constants';

const prisma = new PrismaClient();
const passwords = new PasswordService();

async function main() {
  const appEnv = process.env.APP_ENV || 'development';
  const allowDemoSeed = process.env.ALLOW_DEMO_SEED === 'true';

  // SECURITY GUARD: Demo seed data must NEVER execute in production unless an explicit
  // ALLOW_DEMO_SEED=true override has been intentionally provided.
  if (appEnv === 'production' && !allowDemoSeed) {
    throw new Error(
      'SECURITY VIOLATION: Attempted to run demo seed script in production environment without explicit ALLOW_DEMO_SEED=true override. Aborting immediately.',
    );
  }

  if (appEnv !== 'development' && appEnv !== 'test' && !allowDemoSeed) {
    throw new Error(
      `Demo seeding is restricted to development or test environments. Current environment: "${appEnv}". Set ALLOW_DEMO_SEED=true to override.`,
    );
  }

  console.log('Seeding Ledgerline database...');

  // 1. Seed global permissions
  for (const perm of SYSTEM_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      create: {
        code: perm.code,
        description: perm.description,
        category: perm.category,
      },
      update: {
        description: perm.description,
        category: perm.category,
      },
    });
  }
  const allPermissions = await prisma.permission.findMany();
  const permMap = new Map(allPermissions.map((p) => [p.code, p.id]));

  // 2. Seed Users
  const defaultPasswordHash = await passwords.hash('Password1234!');

  // SECURITY ARCHITECTURE RULE:
  // Demo accounts must NEVER be granted platform Super Admin privileges.
  // An organisation OWNER role is tenant-scoped and completely distinct from Platform Super Admin.
  // Platform Super Admins have global cross-tenant administrative control and must ONLY be
  // created through explicit, authenticated deployment scripts (e.g. scripts/bootstrap-super-admin.ts).
  const ownerUser = await prisma.user.upsert({
    where: { email: 'owner@democonsulting.com' },
    create: {
      email: 'owner@democonsulting.com',
      passwordHash: defaultPasswordHash,
      firstName: 'Alice',
      lastName: 'Owner',
      emailVerified: true,
      emailVerifiedAt: new Date(),
      status: UserStatus.ACTIVE,
      isSuperAdmin: false,
    },
    update: {
      passwordHash: defaultPasswordHash,
      isSuperAdmin: false,
    },
  });

  const accountantUser = await prisma.user.upsert({
    where: { email: 'accountant@democonsulting.com' },
    create: {
      email: 'accountant@democonsulting.com',
      passwordHash: defaultPasswordHash,
      firstName: 'Bob',
      lastName: 'Accountant',
      emailVerified: true,
      emailVerifiedAt: new Date(),
      status: UserStatus.ACTIVE,
    },
    update: {
      passwordHash: defaultPasswordHash,
    },
  });

  const viewerUser = await prisma.user.upsert({
    where: { email: 'viewer@democonsulting.com' },
    create: {
      email: 'viewer@democonsulting.com',
      passwordHash: defaultPasswordHash,
      firstName: 'Charlie',
      lastName: 'Viewer',
      emailVerified: true,
      emailVerifiedAt: new Date(),
      status: UserStatus.ACTIVE,
    },
    update: {
      passwordHash: defaultPasswordHash,
    },
  });

  // 3. Seed Organisation
  let org = await prisma.organization.findFirst({
    where: { name: 'Demo Consulting Ltd' },
  });

  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: 'Demo Consulting Ltd',
        legalName: 'Demo Consulting Limited',
        registrationNumber: '12345678',
        country: 'GB',
        baseCurrency: 'GBP',
        timezone: 'Europe/London',
        financialYearStartMonth: 4,
        financialYearStartDay: 1,
        createdById: ownerUser.id,
      },
    });
  }

  // 4. Seed Roles for Org
  const roleDefs = [
    { key: 'OWNER', name: 'Owner', description: 'Full access to organization and financial settings' },
    { key: 'ADMINISTRATOR', name: 'Administrator', description: 'Administrative and accounting management' },
    { key: 'ACCOUNTANT', name: 'Accountant', description: 'Full access to accounting books and periods' },
    { key: 'BOOKKEEPER', name: 'Bookkeeper', description: 'Draft journal entry, validation, and viewing' },
    { key: 'VIEWER', name: 'Viewer', description: 'Read-only access to accounts and journals' },
  ] as const;

  const roleMap: Record<string, string> = {};

  for (const def of roleDefs) {
    let role = await prisma.role.findFirst({
      where: { organizationId: org.id, systemKey: def.key },
    });

    if (!role) {
      role = await prisma.role.create({
        data: {
          organizationId: org.id,
          name: def.name,
          description: def.description,
          systemKey: def.key,
          isSystemRole: true,
        },
      });
    }

    // Always keep role permissions in sync with latest system definitions
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    const permCodes = SYSTEM_ROLE_PERMISSIONS[def.key] ?? [];
    const rolePermsData = permCodes
      .map((code) => permMap.get(code))
      .filter((id): id is string => Boolean(id))
      .map((permissionId) => ({
        roleId: role!.id,
        permissionId,
      }));

    if (rolePermsData.length > 0) {
      await prisma.rolePermission.createMany({
        data: rolePermsData,
      });
    }
    roleMap[def.key] = role.id;
  }

  // 5. Seed Memberships
  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: ownerUser.id } },
    create: {
      organizationId: org.id,
      userId: ownerUser.id,
      roleId: roleMap['OWNER'],
      status: MemberStatus.ACTIVE,
      joinedAt: new Date(),
    },
    update: {
      roleId: roleMap['OWNER'],
    },
  });

  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: accountantUser.id } },
    create: {
      organizationId: org.id,
      userId: accountantUser.id,
      roleId: roleMap['ACCOUNTANT'],
      status: MemberStatus.ACTIVE,
      joinedAt: new Date(),
    },
    update: {
      roleId: roleMap['ACCOUNTANT'],
    },
  });

  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: viewerUser.id } },
    create: {
      organizationId: org.id,
      userId: viewerUser.id,
      roleId: roleMap['VIEWER'],
      status: MemberStatus.ACTIVE,
      joinedAt: new Date(),
    },
    update: {
      roleId: roleMap['VIEWER'],
    },
  });

  // 6. Seed Accounts
  for (const acc of DEFAULT_CHART_OF_ACCOUNTS) {
    await prisma.account.upsert({
      where: { organizationId_code: { organizationId: org.id, code: acc.code } },
      create: {
        organizationId: org.id,
        code: acc.code,
        name: acc.name,
        accountType: acc.type,
        accountSubtype: acc.subtype,
        normalBalance: acc.normalBalance,
        reportGroup: acc.reportGroup,
        description: acc.description,
        allowManualPosting: acc.allowManualPosting,
        isControlAccount: acc.isControlAccount ?? false,
        isActive: true,
        createdById: ownerUser.id,
      },
      update: {},
    });
  }

  // 7. Seed Financial Year & Monthly Periods (01 April 2026 - 31 March 2027)
  const fyStartDate = new Date(Date.UTC(2026, 3, 1));
  const fyEndDate = new Date(Date.UTC(2027, 2, 31));

  let fy = await prisma.financialYear.findFirst({
    where: { organizationId: org.id, name: 'FY 2026/2027' },
  });

  if (!fy) {
    fy = await prisma.financialYear.create({
      data: {
        organizationId: org.id,
        name: 'FY 2026/2027',
        startDate: fyStartDate,
        endDate: fyEndDate,
        status: FinancialYearStatus.OPEN,
        createdById: ownerUser.id,
      },
    });

    const months = [
      { num: 1, name: 'April 2026', start: new Date(Date.UTC(2026, 3, 1)), end: new Date(Date.UTC(2026, 3, 30)) },
      { num: 2, name: 'May 2026', start: new Date(Date.UTC(2026, 4, 1)), end: new Date(Date.UTC(2026, 4, 31)) },
      { num: 3, name: 'June 2026', start: new Date(Date.UTC(2026, 5, 1)), end: new Date(Date.UTC(2026, 5, 30)) },
      { num: 4, name: 'July 2026', start: new Date(Date.UTC(2026, 6, 1)), end: new Date(Date.UTC(2026, 6, 31)) },
      { num: 5, name: 'August 2026', start: new Date(Date.UTC(2026, 7, 1)), end: new Date(Date.UTC(2026, 7, 31)) },
      { num: 6, name: 'September 2026', start: new Date(Date.UTC(2026, 8, 1)), end: new Date(Date.UTC(2026, 8, 30)) },
      { num: 7, name: 'October 2026', start: new Date(Date.UTC(2026, 9, 1)), end: new Date(Date.UTC(2026, 9, 31)) },
      { num: 8, name: 'November 2026', start: new Date(Date.UTC(2026, 10, 1)), end: new Date(Date.UTC(2026, 10, 30)) },
      { num: 9, name: 'December 2026', start: new Date(Date.UTC(2026, 11, 1)), end: new Date(Date.UTC(2026, 11, 31)) },
      { num: 10, name: 'January 2027', start: new Date(Date.UTC(2027, 0, 1)), end: new Date(Date.UTC(2027, 0, 31)) },
      { num: 11, name: 'February 2027', start: new Date(Date.UTC(2027, 1, 1)), end: new Date(Date.UTC(2027, 1, 28)) },
      { num: 12, name: 'March 2027', start: new Date(Date.UTC(2027, 2, 1)), end: new Date(Date.UTC(2027, 2, 31)) },
    ];

    for (const m of months) {
      await prisma.accountingPeriod.create({
        data: {
          organizationId: org.id,
          financialYearId: fy.id,
          periodNumber: m.num,
          name: m.name,
          startDate: m.start,
          endDate: m.end,
        },
      });
    }
  }

  // 8. Seed Journals according to Phase 9-16 requirements
  const bankAcc = await prisma.account.findFirstOrThrow({
    where: { organizationId: org.id, code: '1010' },
  });
  const capitalAcc = await prisma.account.findFirstOrThrow({
    where: { organizationId: org.id, code: '3000' },
  });
  const rentAcc = await prisma.account.findFirstOrThrow({
    where: { organizationId: org.id, code: '6000' },
  });
  const officeSuppliesAcc = await prisma.account.findFirstOrThrow({
    where: { organizationId: org.id, code: '6700' },
  });

  const aprilPeriod = await prisma.accountingPeriod.findFirst({
    where: { organizationId: org.id, periodNumber: 1 },
  });

  await prisma.organizationSequence.upsert({
    where: { organizationId_sequenceKey: { organizationId: org.id, sequenceKey: 'JOURNAL_2026' } },
    create: { organizationId: org.id, sequenceKey: 'JOURNAL_2026', currentValue: 3 },
    update: { currentValue: 3 },
  });

  // Journal 1: JE-2026-000001 (POSTED)
  const existingJ1 = await prisma.journalEntry.findFirst({
    where: { organizationId: org.id, journalNumber: 'JE-2026-000001' },
  });

  if (!existingJ1) {
    const postTime1 = new Date(Date.UTC(2026, 3, 1, 10, 0, 0));
    // Create as DRAFT first (trigger only fires when status is POSTED/REVERSED)
    const j1 = await prisma.journalEntry.create({
      data: {
        organizationId: org.id,
        journalNumber: 'JE-2026-000001',
        journalType: JournalType.GENERAL,
        journalDate: new Date(Date.UTC(2026, 3, 1)),
        postingDate: new Date(Date.UTC(2026, 3, 1)),
        description: 'Owner Capital Investment',
        reference: 'CAP-2026-01',
        sourceType: JournalSourceType.MANUAL,
        currency: 'GBP',
        status: JournalStatus.DRAFT,
        periodId: aprilPeriod?.id,
        createdById: ownerUser.id,
        lines: {
          create: [
            {
              lineNumber: 1,
              accountId: bankAcc.id,
              description: 'Capital subscription paid to Main Bank',
              debit: 25000,
              credit: 0,
              currency: 'GBP',
            },
            {
              lineNumber: 2,
              accountId: capitalAcc.id,
              description: 'Ordinary share capital contribution',
              debit: 0,
              credit: 25000,
              currency: 'GBP',
            },
          ],
        },
      },
    });
    // Now promote to POSTED (trigger allows this path: DRAFT -> VALIDATED -> POSTED)
    await prisma.journalEntry.update({
      where: { id: j1.id },
      data: {
        status: JournalStatus.VALIDATED,
        validatedById: accountantUser.id,
        validatedAt: new Date(Date.UTC(2026, 3, 1, 9, 30, 0)),
      },
    });
    await prisma.journalEntry.update({
      where: { id: j1.id },
      data: {
        status: JournalStatus.POSTED,
        postedById: accountantUser.id,
        postedAt: postTime1,
      },
    });
  }

  // Journal 2: JE-2026-000002 (POSTED)
  const existingJ2 = await prisma.journalEntry.findFirst({
    where: { organizationId: org.id, journalNumber: 'JE-2026-000002' },
  });

  if (!existingJ2) {
    const postTime2 = new Date(Date.UTC(2026, 3, 5, 11, 0, 0));
    const j2 = await prisma.journalEntry.create({
      data: {
        organizationId: org.id,
        journalNumber: 'JE-2026-000002',
        journalType: JournalType.GENERAL,
        journalDate: new Date(Date.UTC(2026, 3, 5)),
        postingDate: new Date(Date.UTC(2026, 3, 5)),
        description: 'April Office Rent Payment',
        reference: 'RENT-APR26',
        sourceType: JournalSourceType.MANUAL,
        currency: 'GBP',
        status: JournalStatus.DRAFT,
        periodId: aprilPeriod?.id,
        createdById: accountantUser.id,
        lines: {
          create: [
            {
              lineNumber: 1,
              accountId: rentAcc.id,
              description: 'Commercial office lease for April 2026',
              debit: 2000,
              credit: 0,
              currency: 'GBP',
            },
            {
              lineNumber: 2,
              accountId: bankAcc.id,
              description: 'Direct payment from Main Bank account',
              debit: 0,
              credit: 2000,
              currency: 'GBP',
            },
          ],
        },
      },
    });
    await prisma.journalEntry.update({
      where: { id: j2.id },
      data: {
        status: JournalStatus.VALIDATED,
        validatedById: accountantUser.id,
        validatedAt: new Date(Date.UTC(2026, 3, 5, 10, 45, 0)),
      },
    });
    await prisma.journalEntry.update({
      where: { id: j2.id },
      data: {
        status: JournalStatus.POSTED,
        postedById: accountantUser.id,
        postedAt: postTime2,
      },
    });
  }

  // Journal 3: JE-2026-000003 (VALIDATED - ready to test in UI)
  const existingJ3 = await prisma.journalEntry.findFirst({
    where: { organizationId: org.id, journalNumber: 'JE-2026-000003' },
  });

  if (!existingJ3) {
    await prisma.journalEntry.create({
      data: {
        organizationId: org.id,
        journalNumber: 'JE-2026-000003',
        journalType: JournalType.GENERAL,
        journalDate: new Date(Date.UTC(2026, 3, 10)),
        postingDate: new Date(Date.UTC(2026, 3, 10)),
        description: 'Office Supplies and Stationery',
        reference: 'SUP-001',
        sourceType: JournalSourceType.MANUAL,
        currency: 'GBP',
        status: JournalStatus.VALIDATED,
        periodId: aprilPeriod?.id,
        createdById: accountantUser.id,
        validatedById: accountantUser.id,
        validatedAt: new Date(Date.UTC(2026, 3, 10, 9, 15, 0)),
        lines: {
          create: [
            {
              lineNumber: 1,
              accountId: officeSuppliesAcc.id,
              description: 'Printer paper and stationery consumables',
              debit: 350,
              credit: 0,
              currency: 'GBP',
            },
            {
              lineNumber: 2,
              accountId: bankAcc.id,
              description: 'Debit card payment',
              debit: 0,
              credit: 350,
              currency: 'GBP',
            },
          ],
        },
      },
    });
  }

  // 6. Seed Demo Contacts
  const existingContact = await prisma.contact.findFirst({
    where: { organizationId: org.id, name: 'Acme Global Corp' },
  });
  if (!existingContact) {
    await prisma.contact.create({
      data: {
        organizationId: org.id,
        type: 'CUSTOMER',
        name: 'Acme Global Corp',
        companyName: 'Acme Global Corporation UK Ltd',
        email: 'billing@acmeglobal.co.uk',
        phone: '+44 20 7946 0912',
        website: 'https://acmeglobal.example.com',
        taxNumber: 'GB987654321',
        paymentTermsDays: 30,
        addressLine1: '100 Bishopsgate',
        city: 'London',
        postcode: 'EC2N 4AG',
        country: 'GB',
        createdById: ownerUser.id,
      },
    });
    await prisma.contact.create({
      data: {
        organizationId: org.id,
        type: 'CUSTOMER',
        name: 'Starlight Tech Ltd',
        companyName: 'Starlight Technologies Ltd',
        email: 'finance@starlight-tech.com',
        phone: '+44 161 496 0123',
        website: 'https://starlight-tech.com',
        taxNumber: 'GB123987456',
        paymentTermsDays: 14,
        addressLine1: '42 Silicon Way',
        city: 'Manchester',
        postcode: 'M1 4ET',
        country: 'GB',
        createdById: ownerUser.id,
      },
    });
    await prisma.contact.create({
      data: {
        organizationId: org.id,
        type: 'SUPPLIER',
        name: 'Apex Cloud Solutions',
        companyName: 'Apex Cloud Solutions UK',
        email: 'invoices@apexcloud.co.uk',
        phone: '+44 117 496 0456',
        website: 'https://apexcloud.co.uk',
        taxNumber: 'GB456789123',
        paymentTermsDays: 30,
        addressLine1: '7 Innovation Park',
        city: 'Bristol',
        postcode: 'BS1 6NX',
        country: 'GB',
        createdById: ownerUser.id,
      },
    });
  }

  console.log('Seeding completed successfully!');
  console.log('Demo accounts created:');
  console.log(' - owner@democonsulting.com (Password1234!)');
  console.log(' - accountant@democonsulting.com (Password1234!)');
  console.log(' - viewer@democonsulting.com (Password1234!)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
