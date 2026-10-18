import { PrismaClient } from '@prisma/client';
import { SYSTEM_PERMISSIONS, SYSTEM_ROLE_PERMISSIONS } from '../apps/api/dist/roles/roles.constants.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Ensuring all SYSTEM_PERMISSIONS exist in database...');
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

  const allPerms = await prisma.permission.findMany();
  const permMap = new Map(allPerms.map((p) => [p.code, p.id]));

  const systemRoles = await prisma.role.findMany({
    where: { isSystemRole: true, systemKey: { not: null } },
    include: { permissions: { include: { permission: true } } },
  });

  console.log(`Found ${systemRoles.length} system roles across all organisations.`);
  let addedTotal = 0;

  for (const role of systemRoles) {
    const key = role.systemKey;
    const targetCodes = SYSTEM_ROLE_PERMISSIONS[key] || [];
    const currentCodes = new Set(role.permissions.map((p) => p.permission.code));

    const missingCodes = targetCodes.filter((c) => !currentCodes.has(c));
    if (missingCodes.length > 0) {
      console.log(`Role ${role.name} (${key}) in org ${role.organizationId} is missing ${missingCodes.length} permissions.`);
      const createData = missingCodes
        .map((code) => permMap.get(code))
        .filter(Boolean)
        .map((permissionId) => ({
          roleId: role.id,
          permissionId,
        }));

      if (createData.length > 0) {
        await prisma.rolePermission.createMany({
          data: createData,
          skipDuplicates: true,
        });
        addedTotal += createData.length;
      }
    }
  }

  console.log(`Permission synchronization complete! Added ${addedTotal} missing permissions.`);
}

main()
  .catch((err) => {
    console.error('Error syncing permissions:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
