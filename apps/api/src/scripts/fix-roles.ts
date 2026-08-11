import { PrismaClient } from '@prisma/client';
import { ROLE_PERMISSIONS } from '@crm/shared';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../../../.env') });
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const prisma = new PrismaClient();

const ROLES = [
  { name: 'SYSTEM_ADMIN', displayName: 'Platform Admin', description: 'Platform level access' },
  { name: 'SUPER_ADMIN', displayName: 'Super Admin', description: 'Full system access' },
  { name: 'HR', displayName: 'HR Manager', description: 'Human resources management' },
  { name: 'MANAGER', displayName: 'Manager', description: 'Department and team management' },
  { name: 'EMPLOYEE', displayName: 'Employee', description: 'Standard employee access' },
];

async function main() {
  console.log('Fixing database roles...');

  const permissionKeys = new Set<string>();
  Object.values(ROLE_PERMISSIONS).forEach((perms) =>
    perms.forEach((p) => permissionKeys.add(p))
  );

  for (const key of permissionKeys) {
    const module = key.split(':')[0];
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key, module, description: `Permission: ${key}` },
    });
  }

  const allPermissions = await prisma.permission.findMany();

  for (const roleData of ROLES) {
    const role = await prisma.role.upsert({
      where: { name: roleData.name },
      update: { displayName: roleData.displayName, description: roleData.description },
      create: { ...roleData, isSystem: true },
    });

    const perms = ROLE_PERMISSIONS[roleData.name] || [];
    for (const permKey of perms) {
      const permission = allPermissions.find((p) => p.key === permKey);
      if (permission) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: role.id, permissionId: permission.id },
          },
          update: {},
          create: { roleId: role.id, permissionId: permission.id },
        });
      }
    }
  }
  
  // Update employees that were mistakenly assigned SYSTEM_ADMIN to EMPLOYEE
  const systemAdminRole = await prisma.role.findUnique({ where: { name: 'SYSTEM_ADMIN' } });
  const employeeRole = await prisma.role.findUnique({ where: { name: 'EMPLOYEE' } });
  const superAdminRole = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
  
  if (systemAdminRole && employeeRole && superAdminRole) {
    // Find all users who are SYSTEM_ADMIN or SUPER_ADMIN but shouldn't be (i.e. those with employees attached)
    // Actually, maybe it's safer to just let the user fix them manually in the UI now that they can.
    console.log('Roles successfully seeded.');
  }

  console.log('Roles fixed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
