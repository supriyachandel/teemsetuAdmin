import { prisma } from '../config/database';
import { Prisma } from '@prisma/client';
import {
  employeeRepository,
  departmentRepository,
  designationRepository,
} from '../repositories/employee.repository';
import { userRepository } from '../repositories/user.repository';
import { hashPassword } from '../utils/password';
import { auditService, formatAuditActor } from './audit.service';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../utils/errors';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';

function decimalToNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  if (value && typeof value === 'object' && 'toString' in value) {
    return Number((value as { toString: () => string }).toString());
  }
  return 0;
}

function employeeAuditSnapshot(emp: NonNullable<Awaited<ReturnType<typeof employeeRepository.findById>>>) {
  return {
    employeeId: emp.id,
    employeeCode: emp.employeeCode,
    email: emp.user.email,
    name: `${emp.user.firstName} ${emp.user.lastName}`.trim(),
    departmentId: emp.departmentId,
    designationId: emp.designationId,
    managerId: emp.managerId,
    phone: emp.phone,
    employmentStatus: emp.employmentStatus,
  };
}

function mapEmployee(emp: NonNullable<Awaited<ReturnType<typeof employeeRepository.findById>>>) {
  return {
    id: emp.id,
    employeeCode: emp.employeeCode,
    employmentStatus: emp.employmentStatus,
    joiningDate: emp.joiningDate,
    phone: emp.phone,
    department: emp.department,
    designation: emp.designation,
    manager: emp.manager,
    user: emp.user,
    dateOfBirth: emp.dateOfBirth,
    createdAt: emp.createdAt,
    employeeSalary: emp.employeeSalary ? {
      employeeId: emp.employeeSalary.employeeId,
      salaryStructureId: emp.employeeSalary.salaryStructureId,
      basicPay: decimalToNumber(emp.employeeSalary.basicPay),
      grossSalary: decimalToNumber(emp.employeeSalary.grossSalary),
      netSalary: decimalToNumber(emp.employeeSalary.netSalary),
      effectiveFrom: emp.employeeSalary.effectiveFrom.toISOString().slice(0, 10),
      salaryStructure: emp.employeeSalary.salaryStructure ? {
        id: emp.employeeSalary.salaryStructure.id,
        name: emp.employeeSalary.salaryStructure.name,
        isTemplate: emp.employeeSalary.salaryStructure.isTemplate,
        basicPay: decimalToNumber(emp.employeeSalary.salaryStructure.basicPay),
        pfEnabled: emp.employeeSalary.salaryStructure.pfEnabled,
        pfEmployeeRate: decimalToNumber(emp.employeeSalary.salaryStructure.pfEmployeeRate),
        pfEmployerRate: decimalToNumber(emp.employeeSalary.salaryStructure.pfEmployerRate),
        esiEnabled: emp.employeeSalary.salaryStructure.esiEnabled,
        esiEmployeeRate: decimalToNumber(emp.employeeSalary.salaryStructure.esiEmployeeRate),
        esiEmployerRate: decimalToNumber(emp.employeeSalary.salaryStructure.esiEmployerRate),
        taxEnabled: emp.employeeSalary.salaryStructure.taxEnabled,
        taxCalculationType: emp.employeeSalary.salaryStructure.taxCalculationType,
        taxRate: decimalToNumber(emp.employeeSalary.salaryStructure.taxRate),
        allowances: emp.employeeSalary.salaryStructure.allowances.map((a) => ({
          id: a.id,
          name: a.name,
          calculationType: a.calculationType,
          value: decimalToNumber(a.value),
        })),
        deductions: emp.employeeSalary.salaryStructure.deductions.map((d) => ({
          id: d.id,
          name: d.name,
          calculationType: d.calculationType,
          value: decimalToNumber(d.value),
        })),
      } : null,
    } : null,
  };
}

export class EmployeeService {
  async list(
    user: NonNullable<AuthenticatedRequest['user']>,
    query: {
      page: number;
      limit: number;
      search?: string;
      departmentId?: string;
      status?: string;
    }
  ) {
    const { items, total } = await employeeRepository.findMany(user.companyId, query);
    const auditMap = await auditService.getLatestForEntities(
      user.companyId,
      'Employee',
      items.map((item) => item.id)
    );

    return {
      items: items.map((emp) => ({
        ...mapEmployee(emp),
        lastChange: auditMap.get(emp.id) ?? null,
      })),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async listBirthdays(companyId: string) {
    const employees = await prisma.employee.findMany({
      where: { companyId, deletedAt: null },
      select: {
        id: true,
        dateOfBirth: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          }
        }
      }
    });
    return employees;
  }

  async getById(user: NonNullable<AuthenticatedRequest['user']>, id: string) {
    const emp = await employeeRepository.findById(id, user.companyId);
    if (!emp) throw new NotFoundError('Employee not found');
    const auditMap = await auditService.getLatestForEntities(user.companyId, 'Employee', [id]);
    const history = await auditService.list(user.companyId, {
      entityType: 'Employee',
      entityId: id,
      limit: 10,
    });
    const salary = await prisma.employeeSalary.findUnique({
      where: { employeeId: id },
      include: {
        salaryStructure: {
          include: {
            allowances: true,
            deductions: true,
          }
        }
      }
    });

    const salaryData = salary ? {
      basicPay: decimalToNumber(salary.basicPay),
      grossSalary: decimalToNumber(salary.grossSalary),
      netSalary: decimalToNumber(salary.netSalary),
      effectiveFrom: salary.effectiveFrom.toISOString().slice(0, 10),
      salaryStructureId: salary.salaryStructureId,
      allowances: salary.salaryStructure.allowances.map((a) => ({
        id: a.id,
        name: a.name,
        calculationType: a.calculationType,
        value: decimalToNumber(a.value),
      })),
      deductions: salary.salaryStructure.deductions.map((d) => ({
        id: d.id,
        name: d.name,
        calculationType: d.calculationType,
        value: decimalToNumber(d.value),
      })),
    } : null;

    return {
      ...mapEmployee(emp),
      salary: salaryData,
      lastChange: auditMap.get(id) ?? null,
      auditHistory: history,
    };
  }

  async create(
    actor: NonNullable<AuthenticatedRequest['user']>,
    input: {
      email: string;
      password?: string;
      firstName: string;
      lastName: string;
      employeeCode?: string;
      departmentId?: string;
      designationId?: string;
      joiningDate: string;
      phone?: string;
      employmentStatus?: string;
      managerId?: string;
      roleId?: string;
      dateOfBirth?: string | null;
    }
  ) {
    const email = input.email.toLowerCase();
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser && !existingUser.deletedAt) {
      throw new ConflictError('Email already in use');
    }

    let employeeRole;
    if (input.roleId) {
      employeeRole = await prisma.role.findUnique({ where: { id: input.roleId } });
      if (!employeeRole) throw new ValidationError('Invalid role provided.');
    } else {
      employeeRole = await prisma.role.findUnique({ where: { name: 'EMPLOYEE' } });
      if (!employeeRole) {
        employeeRole = await prisma.role.findFirst({ where: { name: { not: 'SUPER_ADMIN' } } });
      }
      if (!employeeRole) throw new ValidationError('No valid roles found to assign to new employee.');
    }

    const code = input.employeeCode ?? (await employeeRepository.getNextCode(actor.companyId));
    const codeTaken = await prisma.employee.findFirst({
      where: { companyId: actor.companyId, employeeCode: code, deletedAt: null },
    });
    if (codeTaken) throw new ConflictError('Employee code already exists');

    const passwordHash = await hashPassword(input.password ?? 'Password@123');
    const joiningDate = new Date(input.joiningDate);

    const result = await prisma.$transaction(async (tx) => {
      let user;
      if (existingUser) {
        user = await tx.user.update({
          where: { id: existingUser.id },
          data: {
            deletedAt: null,
            status: 'ACTIVE',
            firstName: input.firstName,
            lastName: input.lastName,
            passwordHash,
            roleId: employeeRole!.id,
          }
        });
      } else {
        user = await tx.user.create({
          data: {
            email,
            passwordHash,
            firstName: input.firstName,
            lastName: input.lastName,
            companyId: actor.companyId,
            roleId: employeeRole!.id,
            status: 'ACTIVE',
            emailVerified: true,
            emailVerifiedAt: new Date(),
          },
        });
      }

      const existingEmp = await tx.employee.findUnique({ where: { userId: user.id } });
      let employee;
      if (existingEmp) {
        employee = await tx.employee.update({
          where: { id: existingEmp.id },
          data: {
            deletedAt: null,
            employmentStatus: (input.employmentStatus as 'ACTIVE') ?? 'ACTIVE',
            employeeCode: code,
            departmentId: input.departmentId,
            designationId: input.designationId,
            joiningDate,
            phone: input.phone,
            managerId: input.managerId,
            dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
                status: true,
                role: { select: { id: true, name: true, displayName: true } },
              },
            },
            department: { select: { id: true, name: true, code: true } },
            designation: { select: { id: true, title: true, level: true } },
            manager: true,
          },
        });
      } else {
        employee = await tx.employee.create({
          data: {
            userId: user.id,
            companyId: actor.companyId,
            employeeCode: code,
            departmentId: input.departmentId,
            designationId: input.designationId,
            joiningDate,
            phone: input.phone,
            employmentStatus: (input.employmentStatus as 'ACTIVE') ?? 'ACTIVE',
            managerId: input.managerId,
            dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
                status: true,
                role: { select: { id: true, name: true, displayName: true } },
              },
            },
            department: { select: { id: true, name: true, code: true } },
            designation: { select: { id: true, title: true, level: true } },
            manager: true,
          },
        });
      }

      return employee;
    }, { timeout: 20000, maxWait: 5000 });

    const full = await employeeRepository.findById(result.id, actor.companyId);

    await auditService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: 'CREATE',
      entityType: 'Employee',
      entityId: result.id,
      newValues: {
        ...employeeAuditSnapshot(full!),
        createdBy: formatAuditActor(actor),
      },
    });

    return mapEmployee(full!);
  }

  async update(
    actor: NonNullable<AuthenticatedRequest['user']>,
    id: string,
    input: {
      firstName?: string;
      lastName?: string;
      departmentId?: string | null;
      designationId?: string | null;
      phone?: string | null;
      employmentStatus?: string;
      managerId?: string | null;
      roleId?: string | null;
      dateOfBirth?: string | null;
    }
  ) {
    const emp = await employeeRepository.findById(id, actor.companyId);
    if (!emp) throw new NotFoundError('Employee not found');

    const before = employeeAuditSnapshot(emp);

    if (input.firstName || input.lastName || input.roleId !== undefined) {
      await userRepository.update(emp.userId, {
        ...(input.firstName && { firstName: input.firstName }),
        ...(input.lastName && { lastName: input.lastName }),
        ...(input.roleId !== undefined && { roleId: input.roleId || undefined }),
      });
    }

    const updated = await employeeRepository.update(id, {
      ...(input.departmentId !== undefined && { departmentId: input.departmentId }),
      ...(input.designationId !== undefined && { designationId: input.designationId }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.employmentStatus && {
        employmentStatus: input.employmentStatus as 'ACTIVE',
      }),
      ...(input.managerId !== undefined && { managerId: input.managerId }),
      ...(input.dateOfBirth !== undefined && { dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null }),
    });

    await auditService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: 'UPDATE',
      entityType: 'Employee',
      entityId: id,
      oldValues: before,
      newValues: {
        ...employeeAuditSnapshot(updated),
        updatedBy: formatAuditActor(actor),
      },
    });

    return mapEmployee(updated);
  }

  async remove(actor: NonNullable<AuthenticatedRequest['user']>, id: string) {
    const emp = await employeeRepository.findById(id, actor.companyId);
    if (!emp) throw new NotFoundError('Employee not found');
    if (emp.userId === actor.id) throw new ForbiddenError('Cannot delete your own record');

    const before = employeeAuditSnapshot(emp);

    await employeeRepository.softDelete(id);
    await userRepository.update(emp.userId, { status: 'INACTIVE', deletedAt: new Date() });

    await auditService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: 'DELETE',
      entityType: 'Employee',
      entityId: id,
      oldValues: before,
      newValues: {
        deletedBy: formatAuditActor(actor),
        targetUserId: emp.userId,
        targetEmail: emp.user.email,
      },
    });

    await auditService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: 'DELETE',
      entityType: 'User',
      entityId: emp.userId,
      oldValues: {
        email: emp.user.email,
        name: `${emp.user.firstName} ${emp.user.lastName}`.trim(),
        employeeId: emp.id,
      },
      newValues: {
        deletedBy: formatAuditActor(actor),
      },
    });
  }

  async listDepartments(companyId: string) {
    return departmentRepository.findByCompany(companyId);
  }

  async createDepartment(
    actor: NonNullable<AuthenticatedRequest['user']>,
    data: { name: string; code?: string; description?: string }
  ) {
    return departmentRepository.create(actor.companyId, data);
  }

  async listDesignations(companyId: string) {
    return designationRepository.findByCompany(companyId);
  }

  async createDesignation(
    actor: NonNullable<AuthenticatedRequest['user']>,
    data: { title: string; level: number; description?: string }
  ) {
    return designationRepository.create(actor.companyId, data);
  }
}

export const employeeService = new EmployeeService();
