const { PrismaClient } = require('@prisma/client');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'system@admin.com' },
    include: { role: true }
  });
  console.log('Role Name:', user?.role.name);
}
main().finally(() => prisma.$disconnect());
