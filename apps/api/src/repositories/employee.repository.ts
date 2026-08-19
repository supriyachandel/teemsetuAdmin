import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';

const employeeInclude = {
  user: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      status: true,
      avatarUrl: true,
    },
  },
  department: { select: { id: true, name: true, code: true } },
  designation: { select: { id: true, title: true, level: true } },
  manager: {
    select: {
      id: true,
      employeeCode: true,
      user: { select: { firstName: true, lastName: true } },
    },
  },
  employeeSalary: {
    include: {
      salaryStructure: {
        include: {
          allowances: true,
          deductions: true,
        }
      }
    }
  }
} satisfies Prisma.EmployeeInclude;

export class EmployeeRepository {
  async findMany(
    companyId: string,
    opts: {
      page: number;
      limit: number;
      search?: string;
      departmentId?: string;
      status?: string;
    }
  ) {
    const where: Prisma.EmployeeWhereInput = {
      companyId,
      deletedAt: null,
      ...(opts.departmentId && { departmentId: opts.departmentId }),
      ...(opts.status && { employmentStatus: opts.status as Prisma.EnumEmploymentStatusFilter }),
      ...(opts.search && {
        OR: [
          { employeeCode: { contains: opts.search } },
          { user: { firstName: { contains: opts.search } } },
          { user: { lastName: { contains: opts.search } } },
          { user: { email: { contains: opts.search } } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        include: employeeInclude,
        orderBy: { createdAt: 'desc' },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
      prisma.employee.count({ where }),
    ]);

    return { items, total };
  }

  async findById(id: string, companyId: string) {
    return prisma.employee.findFirst({
      where: { id, companyId, deletedAt: null },
      include: employeeInclude,
    });
  }

  async findByUserId(userId: string) {
    return prisma.employee.findFirst({
      where: { userId, deletedAt: null },
      include: employeeInclude,
    });
  }

  async getNextCode(companyId: string): Promise<string> {
    const settings = await prisma.companySettings.findUnique({
      where: { companyId },
      select: { employeeCodePrefix: true },
    });
    const prefix = settings?.employeeCodePrefix || 'EMP';

    let count = await prisma.employee.count({ where: { companyId } });
    let nextCode = `${prefix}-${String(count + 1).padStart(4, '0')}`;

    while (true) {
      const existing = await prisma.employee.findFirst({
        where: { companyId, employeeCode: nextCode }
      });
      if (!existing) break;
      count++;
      nextCode = `${prefix}-${String(count + 1).padStart(4, '0')}`;
    }

    return nextCode;
  }

  async softDelete(id: string) {
    return prisma.employee.update({
      where: { id },
      data: { deletedAt: new Date(), employmentStatus: 'TERMINATED' },
    });
  }

  async update(id: string, data: Prisma.EmployeeUpdateInput) {
    return prisma.employee.update({
      where: { id },
      data,
      include: employeeInclude,
    });
  }
}

export const employeeRepository = new EmployeeRepository();

export class DepartmentRepository {
  async findByCompany(companyId: string) {
    return prisma.department.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { name: 'asc' },
      include: { _count: { select: { employees: true } } },
    });
  }

  async create(companyId: string, data: { name: string; code?: string; description?: string }) {
    return prisma.department.create({
      data: { companyId, ...data },
    });
  }
}

export const departmentRepository = new DepartmentRepository();

export class DesignationRepository {
  async findByCompany(companyId: string) {
    return prisma.designation.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { level: 'asc' },
      include: { _count: { select: { employees: true } } },
    });
  }

  async create(
    companyId: string,
    data: { title: string; level: number; description?: string }
  ) {
    return prisma.designation.create({
      data: { companyId, ...data },
    });
  }
}

export const designationRepository = new DesignationRepository();
