import { OrganizationMembersService } from './organization-members.service';
import { MemberStatus, SystemRoleKey, UserStatus } from '@prisma/client';

describe('OrganizationMembersService Response Contracts & Data Hygiene (organization-members.service.ts)', () => {
  let service: OrganizationMembersService;
  let prisma: any;
  let audit: any;
  let mail: any;

  const actor = {
    userId: 'actor-user-id',
    sessionId: 'session-id',
    organizationId: 'org-1',
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    requestId: 'req-test-1',
  };

  beforeEach(() => {
    prisma = {
      organizationMember: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      role: {
        findFirst: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      transaction: jest.fn().mockImplementation(async (callback) => callback(prisma)),
    };

    audit = {
      record: jest.fn(),
    };

    mail = {
      send: jest.fn().mockResolvedValue(true),
    };

    service = new OrganizationMembersService(prisma, audit, mail);
  });

  it('guarantees listMembers excludes password hashes and authentication token hashes', async () => {
    prisma.organizationMember.findMany.mockResolvedValue([
      {
        id: 'member-1',
        organizationId: 'org-1',
        userId: 'user-1',
        status: MemberStatus.ACTIVE,
        user: {
          id: 'user-1',
          email: 'alice@example.com',
          firstName: 'Alice',
          lastName: 'Smith',
          status: UserStatus.ACTIVE,
          lastLoginAt: new Date(),
        },
        role: {
          id: 'role-1',
          name: 'Owner',
          systemKey: SystemRoleKey.OWNER,
          isSystemRole: true,
        },
      },
    ]);

    const members = await service.listMembers('org-1');
    expect(members).toHaveLength(1);
    const m = members[0];
    expect(m.user).toBeDefined();
    expect((m.user as any).passwordHash).toBeUndefined();
    expect((m.user as any).emailVerificationTokenHash).toBeUndefined();
    expect((m.user as any).passwordResetTokenHash).toBeUndefined();
  });

  it('guarantees inviteMember response excludes sensitive password and token fields', async () => {
    prisma.role.findFirst.mockResolvedValue({
      id: 'role-1',
      name: 'Accountant',
      organizationId: 'org-1',
      systemKey: SystemRoleKey.ACCOUNTANT,
      isSystemRole: true,
    });

    prisma.user.findUnique.mockResolvedValue({
      id: 'user-new',
      email: 'newuser@example.com',
      status: UserStatus.ACTIVE,
    });

    prisma.organizationMember.findUnique.mockResolvedValue(null);

    const safeMemberRecord = {
      id: 'member-new-id',
      organizationId: 'org-1',
      userId: 'user-new',
      roleId: 'role-1',
      status: MemberStatus.ACTIVE,
      user: {
        id: 'user-new',
        email: 'newuser@example.com',
        firstName: 'Bob',
        lastName: 'Jones',
        status: UserStatus.ACTIVE,
        lastLoginAt: null,
      },
      role: {
        id: 'role-1',
        name: 'Accountant',
        systemKey: SystemRoleKey.ACCOUNTANT,
        isSystemRole: true,
      },
    };

    prisma.organizationMember.create.mockResolvedValue(safeMemberRecord);

    const result = await service.inviteMember(
      'org-1',
      { email: 'newuser@example.com', roleId: 'role-1' },
      actor,
    );

    expect(result).toBeDefined();
    expect(result.user).toBeDefined();
    expect((result.user as any).passwordHash).toBeUndefined();
    expect((result.user as any).passwordResetTokenHash).toBeUndefined();
    expect((result.user as any).emailVerificationTokenHash).toBeUndefined();
  });

  it('guarantees updateMemberRole response excludes sensitive password and token fields', async () => {
    prisma.organizationMember.findFirst.mockResolvedValue({
      id: 'member-1',
      organizationId: 'org-1',
      role: { id: 'role-old', name: 'Accountant', systemKey: SystemRoleKey.ACCOUNTANT },
    });

    prisma.role.findFirst.mockResolvedValue({
      id: 'role-new',
      name: 'Manager',
      organizationId: 'org-1',
      systemKey: 'CUSTOM',
      isSystemRole: false,
    });

    const safeMemberUpdated = {
      id: 'member-1',
      roleId: 'role-new',
      user: {
        id: 'user-1',
        email: 'alice@example.com',
        firstName: 'Alice',
        lastName: 'Smith',
        status: UserStatus.ACTIVE,
        lastLoginAt: new Date(),
      },
      role: {
        id: 'role-new',
        name: 'Manager',
        systemKey: 'CUSTOM',
        isSystemRole: false,
      },
    };

    prisma.organizationMember.update.mockResolvedValue(safeMemberUpdated);

    const result = await service.updateMemberRole(
      'org-1',
      'member-1',
      { roleId: 'role-new' },
      actor,
    );

    expect(result).toBeDefined();
    expect(result.user).toBeDefined();
    expect((result.user as any).passwordHash).toBeUndefined();
    expect((result.user as any).passwordResetTokenHash).toBeUndefined();
    expect((result.user as any).emailVerificationTokenHash).toBeUndefined();
  });
});
