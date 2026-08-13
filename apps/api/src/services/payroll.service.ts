import { prisma } from '../config/database';
import { NotFoundError } from '../utils/errors';
import { payrollRepository } from '../repositories/payroll.repository';
import { employeeRepository } from '../repositories/employee.repository';
import { attendanceRepository } from '../repositories/attendance.repository';
import { leaveRepository } from '../repositories/leave.repository';
import { notificationService } from './notification.service';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { PERMISSIONS } from '@crm/shared';
import { Prisma } from '@prisma/client';
import { getWorkingDaysInMonth, calcPerDaySalary, getMonthDateRange } from '../utils/working-days';

function decimalToNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  if (value && typeof value === 'object' && 'toString' in value) {
    return Number((value as { toString: () => string }).toString());
  }
  return 0;
}

export class PayrollService {
  async list(
    user: NonNullable<AuthenticatedRequest['user']>,
    query: { page: number; limit: number; month?: number; year?: number; employeeId?: string }
  ) {
    const canViewAll = user.permissions.includes(PERMISSIONS.PAYROLL_READ) || user.permissions.includes(PERMISSIONS.PAYROLL_WRITE) || user.permissions.includes(PERMISSIONS.PAYROLL_PROCESS);
    let employeeId = query.employeeId;
    if (!canViewAll) {
      if (!user.employeeId) throw new NotFoundError('No employee profile linked');
      employeeId = user.employeeId;
    }

    const company = await prisma.company.findUnique({ where: { id: user.companyId }, select: { currency: true } });
    const currency = company?.currency ?? 'USD';

    const { items, total } = await payrollRepository.list(user.companyId, { ...query, employeeId });
    return {
      currency,
      items: items.map((p) => ({
        ...p,
        baseSalary: decimalToNumber(p.baseSalary),
        allowances: decimalToNumber(p.allowances),
        deductions: decimalToNumber(p.deductions),
        bonus: decimalToNumber(p.bonus),
        tax: decimalToNumber(p.tax),
        netSalary: decimalToNumber(p.netSalary),
        payableDays: decimalToNumber(p.payableDays),
      })),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async listSalaryStructures(user: NonNullable<AuthenticatedRequest['user']>) {
    const rows = await payrollRepository.listSalaryStructures(user.companyId);
    return rows.map((r) => ({
      ...r,
      baseSalary: decimalToNumber(r.baseSalary),
    }));
  }

  async mySalaryStructure(user: NonNullable<AuthenticatedRequest['user']>) {
    if (!user.employeeId) throw new NotFoundError('No employee profile linked');
    const structure = await prisma.salaryStructure.findUnique({
      where: { employeeId: user.employeeId }
    });
    if (!structure) throw new NotFoundError('Salary structure not found');
    return {
      ...structure,
      baseSalary: decimalToNumber(structure.baseSalary),
    };
  }

  async upsertSalaryStructure(
    user: NonNullable<AuthenticatedRequest['user']>,
    input: {
      employeeId: string;
      baseSalary: number;
      allowances: Array<{ label: string; amount: number }>;
      deductions: Array<{ label: string; amount: number }>;
      effectiveFrom: string;
    }
  ) {
    const employee = await employeeRepository.findById(input.employeeId, user.companyId);
    if (!employee) throw new NotFoundError('Employee not found');
    const result = await payrollRepository.upsertSalaryStructure({
      employeeId: input.employeeId,
      baseSalary: input.baseSalary,
      allowances: input.allowances,
      deductions: input.deductions,
      effectiveFrom: new Date(input.effectiveFrom),
    });
    return { ...result, baseSalary: decimalToNumber(result.baseSalary) };
  }

  async generate(user: NonNullable<AuthenticatedRequest['user']>, month: number, year: number) {
    const employees = await employeeRepository.findMany(user.companyId, { status: 'ACTIVE', page: 1, limit: 10000 });
    const salaryStructures = await payrollRepository.listSalaryStructures(user.companyId);
    const structureMap = new Map(salaryStructures.map(s => [s.employeeId, s]));

    const settings = await prisma.companySettings.findUnique({ where: { companyId: user.companyId } });
    const workDays = (settings?.workDays as number[]) ?? [1, 2, 3, 4, 5];

    const holidays = await prisma.holiday.findMany({
      where: {
        companyId: user.companyId,
        date: {
          gte: new Date(year, month - 1, 1),
          lte: new Date(year, month, 0),
        },
      },
      select: { date: true, isOptional: true },
    });

    const workingDays = getWorkingDaysInMonth(year, month, workDays, holidays);

    const payrollsToCreate: Prisma.PayrollCreateManyInput[] = [];

    for (const employee of employees.items) {
      const structure = structureMap.get(employee.id);
      if (!structure) continue;

      const baseSalary = decimalToNumber(structure.baseSalary);
      const allowancesList = structure.allowances as Array<{ label: string; amount: number }>;
      const deductionsList = structure.deductions as Array<{ label: string; amount: number }>;

      const totalAllowances = allowancesList.reduce((sum, a) => sum + Number(a.amount), 0);
      const totalDeductions = deductionsList.reduce((sum, d) => sum + Number(d.amount), 0);

      const { startDate, endDate } = getMonthDateRange(year, month);
      const daysInMonth = new Date(year, month, 0).getDate();

      let presentCount = 0;
      let lateCount = 0;
      let halfDayCount = 0;
      let onLeaveCount = 0;
      let actualHours = 0;

      const attendanceRecords = await prisma.attendance.findMany({
        where: {
          employeeId: employee.id,
          date: { gte: startDate, lte: endDate },
        },
        select: { status: true, date: true, workHours: true },
      });

      for (const r of attendanceRecords) {
        if (r.workHours) actualHours += r.workHours;
        switch (r.status) {
          case 'PRESENT':
          case 'REMOTE':
            presentCount++;
            break;
          case 'LATE':
            lateCount++;
            presentCount++;
            break;
          case 'HALF_DAY':
            halfDayCount++;
            break;
          case 'ON_LEAVE':
            onLeaveCount++;
            break;
        }
      }

      // Calculate Target Hours (9 hours per working day)
      const targetHours = workingDays * 9;
      
      // Calculate Shortfall Days based on hours (Saturday/Sunday work offsets short hours)
      const shortfallHours = Math.max(0, targetHours - actualHours);
      const shortfallDays = shortfallHours / 9;

      const unpaidLeaveDays = await leaveRepository.getUnpaidLeaveDays(
        user.companyId,
        employee.id,
        year,
        month
      );

      // Total Leave Without Pay (LWP)
      const totalUnpaidDays = shortfallDays + unpaidLeaveDays;
      const finalPayableDays = Math.max(0, daysInMonth - totalUnpaidDays);

      // Calculate Earnings
      // In the Indian structure, 'allowances' array contains Basic, HRA, etc., representing the Gross Salary.
      const perDayGross = totalAllowances / daysInMonth;
      const earnedGross = Math.max(0, totalAllowances - (totalUnpaidDays * perDayGross));
      
      const netSalary = Math.max(0, earnedGross - totalDeductions);

      payrollsToCreate.push({
        employeeId: employee.id,
        month,
        year,
        baseSalary, // Keeping original CTC reference
        allowances: earnedGross, // Earned Gross
        deductions: totalDeductions,
        bonus: 0,
        tax: 0,
        netSalary,
        workingDays,
        presentDays: presentCount + halfDayCount,
        absentDays: Math.floor(shortfallDays),
        unpaidLeaveDays,
        lateDays: lateCount,
        payableDays: finalPayableDays,
        status: 'DRAFT',
      });
    }

    if (payrollsToCreate.length === 0) {
      return [];
    }

    await payrollRepository.generatePayrolls(user.companyId, month, year, payrollsToCreate);

    const { items } = await payrollRepository.list(user.companyId, { page: 1, limit: 1000, month, year });

    for (const payroll of items) {
      const emp = employees.items.find(e => e.id === payroll.employeeId);
      if (emp?.userId) {
        await notificationService.notifyPayrollProcessed(
          payroll.employeeId,
          month,
          year,
          decimalToNumber(payroll.netSalary)
        );
      }
    }

    const company = await prisma.company.findUnique({ where: { id: user.companyId }, select: { currency: true } });
    const currency = company?.currency ?? 'USD';

    return {
      currency,
      items: items.map((p) => ({
        ...p,
        baseSalary: decimalToNumber(p.baseSalary),
        allowances: decimalToNumber(p.allowances),
        deductions: decimalToNumber(p.deductions),
        bonus: decimalToNumber(p.bonus),
        tax: decimalToNumber(p.tax),
        netSalary: decimalToNumber(p.netSalary),
        payableDays: decimalToNumber(p.payableDays),
      })),
    };
  }

  async getById(companyId: string, id: string) {
    return payrollRepository.findById(companyId, id);
  }

  async updateStatus(user: NonNullable<AuthenticatedRequest['user']>, id: string, status: 'PROCESSED' | 'PAID' | 'CANCELLED') {
    const updated = await payrollRepository.updateStatus(id, status);
    return {
      ...updated,
      baseSalary: decimalToNumber(updated.baseSalary),
      allowances: decimalToNumber(updated.allowances),
      deductions: decimalToNumber(updated.deductions),
      netSalary: decimalToNumber(updated.netSalary),
    };
  }
}

export const payrollService = new PayrollService();
