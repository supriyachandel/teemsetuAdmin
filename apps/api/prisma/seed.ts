import { PrismaClient } from '@prisma/client';
import { ROLE_PERMISSIONS } from '@crm/shared';
import bcrypt from 'bcryptjs';
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
  console.log('Seeding database...');

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

  const defaultLeaveTypes = [
    { code: 'ANNUAL', name: 'Annual Leave', daysPerYear: 18 },
    { code: 'SICK', name: 'Sick Leave', daysPerYear: 6 },
    { code: 'CASUAL', name: 'Casual Leave', daysPerYear: 12 },
  ];

  const planDefs = [
    {
      name: 'STARTER',
      displayName: 'Starter',
      description: 'For small teams getting started',
      monthlyPrice: 29,
      maxUsers: 10,
      maxProjects: 5,
      features: ['reports_export'],
    },
    {
      name: 'PROFESSIONAL',
      displayName: 'Professional',
      description: 'Full HRMS and project suite',
      monthlyPrice: 99,
      maxUsers: 100,
      maxProjects: 50,
      features: ['*'],
    },
    {
      name: 'ENTERPRISE',
      displayName: 'Enterprise',
      description: 'Advanced AI insights and scale',
      monthlyPrice: 299,
      maxUsers: 500,
      maxProjects: 200,
      features: ['*', 'ai_insights'],
    },
  ];

  for (const p of planDefs) {
    await prisma.plan.upsert({
      where: { name: p.name },
      update: {
        displayName: p.displayName,
        description: p.description,
        monthlyPrice: p.monthlyPrice,
        maxUsers: p.maxUsers,
        maxProjects: p.maxProjects,
        features: p.features,
      },
      create: {
        name: p.name,
        displayName: p.displayName,
        description: p.description,
        monthlyPrice: p.monthlyPrice,
        maxUsers: p.maxUsers,
        maxProjects: p.maxProjects,
        features: p.features,
      },
    });
  }

  const proPlan = await prisma.plan.findUnique({ where: { name: 'PROFESSIONAL' } });

  const company = await prisma.company.upsert({
    where: { slug: 'acme-corp' },
    update: {},
    create: {
      name: 'Acme Corporation',
      slug: 'acme-corp',
      industry: 'Technology',
      settings: { create: {} },
      subscription: {
        create: {
          plan: 'PROFESSIONAL',
          planId: proPlan?.id,
          status: 'ACTIVE',
          maxUsers: 100,
          maxProjects: 50,
        },
      },
    },
  });

  if (proPlan) {
    await prisma.subscription.updateMany({
      where: { companyId: company.id },
      data: { planId: proPlan.id },
    });
  }

  const systemCompany = await prisma.company.upsert({
    where: { slug: 'system-admin' },
    update: {},
    create: {
      name: 'System Admin Platform',
      slug: 'system-admin',
      industry: 'Software',
      settings: { create: {} },
      subscription: {
        create: {
          plan: 'ENTERPRISE',
          status: 'ACTIVE',
          maxUsers: 9999,
          maxProjects: 9999,
        },
      },
    },
  });

  for (const lt of defaultLeaveTypes) {
    await prisma.leaveType.upsert({
      where: { companyId_code: { companyId: company.id, code: lt.code } },
      update: { daysPerYear: lt.daysPerYear },
      create: { ...lt, companyId: company.id },
    });
  }

  const superAdminRole = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
  const systemAdminRole = await prisma.role.findUnique({ where: { name: 'SYSTEM_ADMIN' } });

  const passwordHash = await bcrypt.hash('Password@123', 12);

  const demoUsers = [
    {
      email: 'system@admin.com',
      firstName: 'Platform',
      lastName: 'Admin',
      roleId: systemAdminRole!.id,
      code: 'SYS-0001',
      companyId: systemCompany.id,
    },
    {
      email: 'thcoders@admin.com',
      firstName: 'Tanya',
      lastName: '',
      roleId: superAdminRole!.id,
      code: 'EMP-0001',
      companyId: company.id,
    },
  ];

  const departments = [
    { name: 'Engineering', code: 'ENG' },
    { name: 'Human Resources', code: 'HR' },
    { name: 'Sales', code: 'SALES' },
  ];

  const deptRecords: Record<string, string> = {};
  for (const d of departments) {
    const dept = await prisma.department.upsert({
      where: { companyId_name: { companyId: company.id, name: d.name } },
      update: {},
      create: { companyId: company.id, ...d },
    });
    deptRecords[d.code] = dept.id;
  }

  const designations = [
    { title: 'Software Engineer', level: 2 },
    { title: 'App Developer', level: 2 },
    { title: 'HR Specialist', level: 2 },
    { title: 'HR', level: 2 },
    { title: 'Sales Manager', level: 3 },
    { title: 'Sales', level: 2 },
    { title: 'Team Lead', level: 4 },
    { title: 'Project Manager', level: 3 },
    { title: '3D Designer', level: 2 },
    { title: 'Designer', level: 2 },
    { title: 'UI/UX Designer', level: 2 },
    { title: 'Intern Sales', level: 1 },
    { title: 'Intern Engineering', level: 1 },
  ];

  const desigRecords: Record<string, string> = {};
  for (const d of designations) {
    const desig = await prisma.designation.upsert({
      where: { companyId_title: { companyId: company.id, title: d.title } },
      update: {},
      create: { companyId: company.id, ...d },
    });
    desigRecords[d.title] = desig.id;
  }

  const deptByEmail: Record<string, string> = {
    'admin@acme.com': deptRecords.ENG,
  };

  const desigByEmail: Record<string, string> = {
    'admin@acme.com': desigRecords['Team Lead'],
  };

  const leaveTypes = await prisma.leaveType.findMany({ where: { companyId: company.id } });
  const year = new Date().getFullYear();

  for (const u of demoUsers) {
    let user = await prisma.user.findUnique({ where: { email: u.email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: u.email,
          passwordHash,
          firstName: u.firstName,
          lastName: u.lastName,
          companyId: u.companyId,
          roleId: u.roleId,
          status: 'ACTIVE',
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      });

      await prisma.employee.create({
        data: {
          userId: user.id,
          companyId: u.companyId,
          employeeCode: u.code,
          joiningDate: new Date('2024-01-15'),
          departmentId: deptByEmail[u.email],
          designationId: desigByEmail[u.email],
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          firstName: u.firstName,
          lastName: u.lastName,
          companyId: u.companyId,
          roleId: u.roleId,
          status: 'ACTIVE',
          deletedAt: null,
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      });

      const emp = await prisma.employee.findUnique({ where: { userId: user.id } });
      if (!emp) {
        await prisma.employee.create({
          data: {
            userId: user.id,
            companyId: company.id,
            employeeCode: u.code,
            joiningDate: new Date('2024-01-15'),
            departmentId: deptByEmail[u.email],
            designationId: desigByEmail[u.email],
          },
        });
      } else {
        await prisma.employee.update({
          where: { id: emp.id },
          data: {
            deletedAt: null,
            employmentStatus: 'ACTIVE',
            departmentId: deptByEmail[u.email],
            designationId: desigByEmail[u.email],
            employeeCode: u.code,
          },
        });
      }
    }

    const employee = await prisma.employee.findUnique({ where: { userId: user!.id } });
    if (!employee) continue;

    for (const lt of leaveTypes) {
      await prisma.leaveBalance.upsert({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: employee.id,
            leaveTypeId: lt.id,
            year,
          },
        },
        update: {},
        create: {
          employeeId: employee.id,
          leaveTypeId: lt.id,
          year,
          totalDays: lt.daysPerYear,
          usedDays: 0,
          remainingDays: lt.daysPerYear,
        },
      });
    }
  }

  const employees = await prisma.employee.findMany({
    where: { companyId: company.id },
    include: { user: { select: { email: true } } },
  });
  const employeeByEmail = Object.fromEntries(
    employees.map((e) => [e.user.email, e])
  );

  const managerEmp = employeeByEmail['manager@acme.com'];
  const devEmp = employeeByEmail['employee@acme.com'];

  let project = await prisma.project.findFirst({
    where: { companyId: company.id, code: 'CRM-001', deletedAt: null },
  });
  if (!project) {
    project = await prisma.project.create({
      data: {
        companyId: company.id,
        name: 'Nexus CRM Rollout',
        code: 'CRM-001',
        description: 'Phase 3 demo project for tasks and collaboration',
        status: 'ACTIVE',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        managerId: managerEmp?.id,
        progress: 35,
      },
    });
  }

  if (managerEmp) {
    await prisma.projectMember.upsert({
      where: { projectId_employeeId: { projectId: project.id, employeeId: managerEmp.id } },
      update: {},
      create: { projectId: project.id, employeeId: managerEmp.id, role: 'manager' },
    });
  }
  if (devEmp) {
    await prisma.projectMember.upsert({
      where: { projectId_employeeId: { projectId: project.id, employeeId: devEmp.id } },
      update: {},
      create: { projectId: project.id, employeeId: devEmp.id, role: 'member' },
    });
  }

  const demoTasks = [
    { title: 'Design payroll module UI', status: 'IN_PROGRESS' as const, priority: 'HIGH' as const },
    { title: 'Implement project API endpoints', status: 'REVIEW' as const, priority: 'MEDIUM' as const },
    { title: 'Write task board interactions', status: 'PENDING' as const, priority: 'MEDIUM' as const },
  ];

  for (const t of demoTasks) {
    const exists = await prisma.task.findFirst({
      where: { projectId: project.id, title: t.title, deletedAt: null },
    });
    if (exists) continue;
    await prisma.task.create({
      data: {
        projectId: project.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        assigneeId: devEmp?.id,
      },
    });
  }

  const salaryByEmail: Record<string, number> = {
    'admin@acme.com': 120000,
    'hr@acme.com': 90000,
    'manager@acme.com': 95000,
    'employee@acme.com': 75000,
  };

  for (const [email, basicPayVal] of Object.entries(salaryByEmail)) {
    const emp = employeeByEmail[email];
    if (!emp) continue;

    const existing = await prisma.employeeSalary.findUnique({
      where: { employeeId: emp.id },
    });

    if (existing) continue;

    const structure = await prisma.salaryStructure.create({
      data: {
        companyId: company.id,
        name: null,
        isTemplate: false,
        basicPay: basicPayVal,
        allowances: {
          create: [
            { name: 'HRA', calculationType: 'PERCENTAGE', value: 20 },
            { name: 'Special Allowance', calculationType: 'FIXED', value: 5000 },
          ]
        },
        deductions: {
          create: [
            { name: 'PF', calculationType: 'PERCENTAGE', value: 12 },
          ]
        }
      }
    });

    const allowancesAmount = (basicPayVal * 0.2) + 5000;
    const deductionsAmount = (basicPayVal * 0.12);
    const grossSalary = basicPayVal + allowancesAmount;
    const netSalary = grossSalary - deductionsAmount;

    await prisma.employeeSalary.create({
      data: {
        employeeId: emp.id,
        salaryStructureId: structure.id,
        basicPay: basicPayVal,
        grossSalary,
        netSalary,
        effectiveFrom: new Date('2026-01-01'),
      }
    });
  }

  const payrollMonth = new Date().getMonth() + 1;
  const payrollYear = new Date().getFullYear();
  for (const emp of employees) {
    const structure = await prisma.employeeSalary.findUnique({
      where: { employeeId: emp.id },
    });
    if (!structure) continue;
    const base = Number(structure.grossSalary);
    const tax = Math.round(base * 0.1 * 100) / 100;
    const net = base - tax;
    await prisma.payroll.upsert({
      where: {
        employeeId_month_year: { employeeId: emp.id, month: payrollMonth, year: payrollYear },
      },
      update: {},
      create: {
        employeeId: emp.id,
        month: payrollMonth,
        year: payrollYear,
        baseSalary: base,
        tax,
        netSalary: net,
        status: 'PROCESSED',
      },
    });
  }

  console.log('Seed completed.');
  console.log('Demo accounts (password: Password@123):');
  demoUsers.forEach((u) => console.log(`  ${u.email}`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
