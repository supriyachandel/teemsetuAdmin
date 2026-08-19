import { prisma } from '../config/database';
import { NotFoundError, ValidationError } from '../utils/errors';
import { payrollRepository } from '../repositories/payroll.repository';
import { employeeRepository } from '../repositories/employee.repository';
import { attendanceRepository } from '../repositories/attendance.repository';
import { leaveRepository } from '../repositories/leave.repository';
import { notificationService } from './notification.service';
import { realtimeService } from './realtime.service';
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
    query: { page: number; limit: number; month?: number; year?: number; employeeId?: string; startDate?: string; endDate?: string }
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
        basicPay: decimalToNumber(p.basicPay),
        pfEmployee: decimalToNumber(p.pfEmployee),
        pfEmployer: decimalToNumber(p.pfEmployer),
        esiEmployee: decimalToNumber(p.esiEmployee),
        esiEmployer: decimalToNumber(p.esiEmployer),
        otherDeductions: decimalToNumber(p.otherDeductions),
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
      id: r.id,
      name: r.name,
      basicPay: decimalToNumber(r.basicPay),
      pfEnabled: r.pfEnabled,
      pfEmployeeRate: decimalToNumber(r.pfEmployeeRate),
      pfEmployerRate: decimalToNumber(r.pfEmployerRate),
      esiEnabled: r.esiEnabled,
      esiEmployeeRate: decimalToNumber(r.esiEmployeeRate),
      esiEmployerRate: decimalToNumber(r.esiEmployerRate),
      taxEnabled: r.taxEnabled,
      taxCalculationType: r.taxCalculationType,
      taxRate: decimalToNumber(r.taxRate),
      allowances: r.allowances.map((a) => ({
        id: a.id,
        name: a.name,
        calculationType: a.calculationType,
        value: decimalToNumber(a.value),
      })),
      deductions: r.deductions.map((d) => ({
        id: d.id,
        name: d.name,
        calculationType: d.calculationType,
        value: decimalToNumber(d.value),
      })),
    }));
  }

  async createSalaryStructureTemplate(
    user: NonNullable<AuthenticatedRequest['user']>,
    input: {
      name: string;
      basicPay: number;
      allowances: Array<{ name: string; calculationType: string; value: number }>;
      deductions: Array<{ name: string; calculationType: string; value: number }>;
      pfEnabled: boolean;
      pfEmployeeRate: number;
      pfEmployerRate: number;
      esiEnabled: boolean;
      esiEmployeeRate: number;
      esiEmployerRate: number;
      taxEnabled: boolean;
      taxCalculationType: string;
      taxRate: number;
    }
  ) {
    const result = await payrollRepository.createSalaryStructureTemplate(user.companyId, input);
    return {
      id: result.id,
      name: result.name,
      basicPay: decimalToNumber(result.basicPay),
      pfEnabled: result.pfEnabled,
      pfEmployeeRate: decimalToNumber(result.pfEmployeeRate),
      pfEmployerRate: decimalToNumber(result.pfEmployerRate),
      esiEnabled: result.esiEnabled,
      esiEmployeeRate: decimalToNumber(result.esiEmployeeRate),
      esiEmployerRate: decimalToNumber(result.esiEmployerRate),
      taxEnabled: result.taxEnabled,
      taxCalculationType: result.taxCalculationType,
      taxRate: decimalToNumber(result.taxRate),
      allowances: result.allowances.map((a) => ({
        id: a.id,
        name: a.name,
        calculationType: a.calculationType,
        value: decimalToNumber(a.value),
      })),
      deductions: result.deductions.map((d) => ({
        id: d.id,
        name: d.name,
        calculationType: d.calculationType,
        value: decimalToNumber(d.value),
      })),
    };
  }

  async updateSalaryStructureTemplate(
    user: NonNullable<AuthenticatedRequest['user']>,
    id: string,
    input: {
      name: string;
      basicPay: number;
      allowances: Array<{ name: string; calculationType: string; value: number }>;
      deductions: Array<{ name: string; calculationType: string; value: number }>;
      pfEnabled: boolean;
      pfEmployeeRate: number;
      pfEmployerRate: number;
      esiEnabled: boolean;
      esiEmployeeRate: number;
      esiEmployerRate: number;
      taxEnabled: boolean;
      taxCalculationType: string;
      taxRate: number;
    }
  ) {
    const template = await payrollRepository.findSalaryStructureById(id);
    if (!template || template.companyId !== user.companyId) {
      throw new NotFoundError('Salary structure template not found');
    }
    const result = await payrollRepository.updateSalaryStructureTemplate(id, input);
    return {
      id: result.id,
      name: result.name,
      basicPay: decimalToNumber(result.basicPay),
      pfEnabled: result.pfEnabled,
      pfEmployeeRate: decimalToNumber(result.pfEmployeeRate),
      pfEmployerRate: decimalToNumber(result.pfEmployerRate),
      esiEnabled: result.esiEnabled,
      esiEmployeeRate: decimalToNumber(result.esiEmployeeRate),
      esiEmployerRate: decimalToNumber(result.esiEmployerRate),
      taxEnabled: result.taxEnabled,
      taxCalculationType: result.taxCalculationType,
      taxRate: decimalToNumber(result.taxRate),
      allowances: result.allowances.map((a) => ({
        id: a.id,
        name: a.name,
        calculationType: a.calculationType,
        value: decimalToNumber(a.value),
      })),
      deductions: result.deductions.map((d) => ({
        id: d.id,
        name: d.name,
        calculationType: d.calculationType,
        value: decimalToNumber(d.value),
      })),
    };
  }

  async deleteSalaryStructureTemplate(user: NonNullable<AuthenticatedRequest['user']>, id: string) {
    const template = await payrollRepository.findSalaryStructureById(id);
    if (!template || template.companyId !== user.companyId) {
      throw new NotFoundError('Salary structure template not found');
    }
    await payrollRepository.deleteSalaryStructureTemplate(id);
    return { success: true };
  }

  async getEmployeeSalary(user: NonNullable<AuthenticatedRequest['user']>, employeeId: string) {
    const employee = await employeeRepository.findById(employeeId, user.companyId);
    if (!employee) throw new NotFoundError('Employee not found');
    const salary = await payrollRepository.findEmployeeSalary(employeeId);
    if (!salary) return null;
    return {
      employeeId: salary.employeeId,
      salaryStructureId: salary.salaryStructureId,
      basicPay: decimalToNumber(salary.basicPay),
      grossSalary: decimalToNumber(salary.grossSalary),
      netSalary: decimalToNumber(salary.netSalary),
      effectiveFrom: salary.effectiveFrom.toISOString().slice(0, 10),
      pfEnabled: salary.salaryStructure.pfEnabled,
      pfEmployeeRate: decimalToNumber(salary.salaryStructure.pfEmployeeRate),
      pfEmployerRate: decimalToNumber(salary.salaryStructure.pfEmployerRate),
      esiEnabled: salary.salaryStructure.esiEnabled,
      esiEmployeeRate: decimalToNumber(salary.salaryStructure.esiEmployeeRate),
      esiEmployerRate: decimalToNumber(salary.salaryStructure.esiEmployerRate),
      taxEnabled: salary.salaryStructure.taxEnabled,
      taxCalculationType: salary.salaryStructure.taxCalculationType,
      taxRate: decimalToNumber(salary.salaryStructure.taxRate),
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
    };
  }

  async mySalaryStructure(user: NonNullable<AuthenticatedRequest['user']>) {
    if (!user.employeeId) throw new NotFoundError('No employee profile linked');
    const salary = await payrollRepository.findEmployeeSalary(user.employeeId);
    if (!salary) throw new NotFoundError('Salary structure not found');
    return {
      employeeId: salary.employeeId,
      salaryStructureId: salary.salaryStructureId,
      basicPay: decimalToNumber(salary.basicPay),
      grossSalary: decimalToNumber(salary.grossSalary),
      netSalary: decimalToNumber(salary.netSalary),
      effectiveFrom: salary.effectiveFrom.toISOString().slice(0, 10),
      pfEnabled: salary.salaryStructure.pfEnabled,
      pfEmployeeRate: decimalToNumber(salary.salaryStructure.pfEmployeeRate),
      pfEmployerRate: decimalToNumber(salary.salaryStructure.pfEmployerRate),
      esiEnabled: salary.salaryStructure.esiEnabled,
      esiEmployeeRate: decimalToNumber(salary.salaryStructure.esiEmployeeRate),
      esiEmployerRate: decimalToNumber(salary.salaryStructure.esiEmployerRate),
      taxEnabled: salary.salaryStructure.taxEnabled,
      taxCalculationType: salary.salaryStructure.taxCalculationType,
      taxRate: decimalToNumber(salary.salaryStructure.taxRate),
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
      baseSalary: decimalToNumber(salary.grossSalary),
    };
  }

  async upsertSalaryStructure(
    user: NonNullable<AuthenticatedRequest['user']>,
    input: {
      employeeId: string;
      salaryStructureId?: string | null;
      basicPay: number;
      allowances: Array<{ name: string; calculationType: string; value: number }>;
      deductions: Array<{ name: string; calculationType: string; value: number }>;
      pfEnabled: boolean;
      pfEmployeeRate: number;
      pfEmployerRate: number;
      esiEnabled: boolean;
      esiEmployeeRate: number;
      esiEmployerRate: number;
      taxEnabled: boolean;
      taxCalculationType: string;
      taxRate: number;
      effectiveFrom: string;
    }
  ) {
    const employee = await employeeRepository.findById(input.employeeId, user.companyId);
    if (!employee) throw new NotFoundError('Employee not found');

    const basicPay = Number(input.basicPay);
    let totalAllowances = 0;
    let totalDeductions = 0;

    const allowances = input.allowances.map(a => {
      const val = Number(a.value);
      const amount = a.calculationType === 'PERCENTAGE' ? (basicPay * val / 100) : val;
      totalAllowances += amount;
      return { ...a, value: val };
    });

    const deductions = input.deductions.map(d => {
      const val = Number(d.value);
      const amount = d.calculationType === 'PERCENTAGE' ? (basicPay * val / 100) : val;
      totalDeductions += amount;
      return { ...d, value: val };
    });

    const pfEmployee = input.pfEnabled ? (basicPay * Number(input.pfEmployeeRate) / 100) : 0;
    const pfEmployer = input.pfEnabled ? (basicPay * Number(input.pfEmployerRate) / 100) : 0;

    const esiEmployee = input.esiEnabled ? (basicPay * Number(input.esiEmployeeRate) / 100) : 0;
    const esiEmployer = input.esiEnabled ? (basicPay * Number(input.esiEmployerRate) / 100) : 0;

    const tax = input.taxEnabled ? (input.taxCalculationType === 'PERCENTAGE' ? (basicPay * Number(input.taxRate) / 100) : Number(input.taxRate)) : 0;

    const grossSalary = basicPay + totalAllowances;
    const netSalary = Math.max(0, grossSalary - totalDeductions - pfEmployee - esiEmployee - tax);

    const result = await payrollRepository.upsertEmployeeSalary(user.companyId, {
      employeeId: input.employeeId,
      salaryStructureId: input.salaryStructureId,
      basicPay,
      grossSalary,
      netSalary,
      allowances,
      deductions,
      pfEnabled: input.pfEnabled,
      pfEmployeeRate: input.pfEmployeeRate,
      pfEmployerRate: input.pfEmployerRate,
      esiEnabled: input.esiEnabled,
      esiEmployeeRate: input.esiEmployeeRate,
      esiEmployerRate: input.esiEmployerRate,
      taxEnabled: input.taxEnabled,
      taxCalculationType: input.taxCalculationType,
      taxRate: input.taxRate,
      effectiveFrom: new Date(input.effectiveFrom),
    });

    realtimeService.emitToCompany(user.companyId, 'salary.updated', {
      event: 'salary.updated',
      entityId: input.employeeId,
      timestamp: new Date().toISOString(),
      updatedBy: { userId: user.id, role: user.role }
    });

    return {
      employeeId: result.employeeId,
      salaryStructureId: result.salaryStructureId,
      basicPay: decimalToNumber(result.basicPay),
      grossSalary: decimalToNumber(result.grossSalary),
      netSalary: decimalToNumber(result.netSalary),
      effectiveFrom: result.effectiveFrom.toISOString().slice(0, 10),
      baseSalary: decimalToNumber(result.grossSalary),
    };
  }

  async generate(user: NonNullable<AuthenticatedRequest['user']>, month: number, year: number) {
    const employees = await employeeRepository.findMany(user.companyId, { status: 'ACTIVE', page: 1, limit: 10000 });
    
    const employeeSalaries = await prisma.employeeSalary.findMany({
      where: { employee: { companyId: user.companyId, deletedAt: null } },
      include: {
        salaryStructure: {
          include: {
            allowances: true,
            deductions: true,
          }
        }
      }
    });
    const salaryMap = new Map(employeeSalaries.map(s => [s.employeeId, s]));

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

    const existingPayrolls = await prisma.payroll.findMany({
      where: {
        employee: { companyId: user.companyId, deletedAt: null },
        month,
        year,
      }
    });
    const existingPayrollMap = new Map(existingPayrolls.map(p => [p.employeeId, p]));

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    console.log(`PAYROLL GENERATION START`);
    console.log(`Month: ${year}-${String(month).padStart(2, '0')}`);
    console.log(`Active employees found: ${employees.items.length}`);

    const payrollsToCreate: Prisma.PayrollCreateManyInput[] = [];

    for (const employee of employees.items) {
      const salary = salaryMap.get(employee.id);
      if (!salary) {
        console.log(`\nEmployee: ${employee.user.firstName} ${employee.user.lastName}`);
        console.log(`ID: ${employee.id}`);
        console.log(`Salary configuration: NOT FOUND - Skipping`);
        skippedCount++;
        continue;
      }

      const existing = existingPayrollMap.get(employee.id);
      if (existing && (existing.status === 'PROCESSED' || existing.status === 'PAID')) {
        console.log(`\nEmployee: ${employee.user.firstName} ${employee.user.lastName}`);
        console.log(`ID: ${employee.id}`);
        console.log(`Payroll: SKIPPED (Finalized historical status ${existing.status})`);
        skippedCount++;
        continue;
      }

      const basicPayLimit = decimalToNumber(salary.basicPay);
      const allowancesList = salary.salaryStructure?.allowances ?? [];
      const deductionsList = salary.salaryStructure?.deductions ?? [];

      console.log(`Salary configuration: FOUND`);
      console.log(`Configuration type: ${salary.salaryStructure?.isTemplate ? 'TEMPLATE' : 'CUSTOM'}`);
      if (salary.salaryStructure?.isTemplate) {
        console.log(`Template: ${salary.salaryStructure.name}`);
      }
      console.log(`Basic: ₹${basicPayLimit}`);

      const daysInMonth = new Date(year, month, 0).getDate();
      const unpaidLeaveDays = await leaveRepository.getUnpaidLeaveDays(
        user.companyId,
        employee.id,
        year,
        month
      );

      const { startDate, endDate } = getMonthDateRange(year, month);
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
      const targetHours = workingDays * 9;
      const shortfallHours = Math.max(0, targetHours - actualHours);
      const shortfallDays = shortfallHours / 9;

      // Disable automatic joining/leaving date proration based on user requirements
      let joinedMidMonthDays = 0;
      let leftMidMonthDays = 0;

      const totalUnpaidDays = unpaidLeaveDays + joinedMidMonthDays + leftMidMonthDays;
      const finalPayableDays = Math.max(0, daysInMonth - totalUnpaidDays);

      // Prorate Basic Pay
      let roundedBasic = basicPayLimit;
      if (totalUnpaidDays > 0) {
        const earnedBasic = (basicPayLimit / daysInMonth) * finalPayableDays;
        roundedBasic = Math.round((earnedBasic + Number.EPSILON) * 100) / 100;
      }

      // Prorate/Percentage Allowances List
      let earnedAllowances = 0;
      for (const a of allowancesList) {
        const val = decimalToNumber(a.value);
        const amount = a.calculationType === 'PERCENTAGE' ? (roundedBasic * val / 100) : (val - (totalUnpaidDays * (val / daysInMonth)));
        earnedAllowances += Math.max(0, amount);
      }
      const roundedAllowances = Math.round((earnedAllowances + Number.EPSILON) * 100) / 100;

      // Prorate/Percentage Deductions List
      let earnedDeductions = 0;
      for (const d of deductionsList) {
        const val = decimalToNumber(d.value);
        const amount = d.calculationType === 'PERCENTAGE' ? (roundedBasic * val / 100) : (val - (totalUnpaidDays * (val / daysInMonth)));
        earnedDeductions += Math.max(0, amount);
      }
      const roundedDeductions = Math.round((earnedDeductions + Number.EPSILON) * 100) / 100;

      // Calculate PF, ESI, Tax
      const pfEmployee = salary.salaryStructure?.pfEnabled ? (roundedBasic * decimalToNumber(salary.salaryStructure.pfEmployeeRate) / 100) : 0;
      const pfEmployer = salary.salaryStructure?.pfEnabled ? (roundedBasic * decimalToNumber(salary.salaryStructure.pfEmployerRate) / 100) : 0;
      const esiEmployee = salary.salaryStructure?.esiEnabled ? (roundedBasic * decimalToNumber(salary.salaryStructure.esiEmployeeRate) / 100) : 0;
      const esiEmployer = salary.salaryStructure?.esiEnabled ? (roundedBasic * decimalToNumber(salary.salaryStructure.esiEmployerRate) / 100) : 0;
      const tax = salary.salaryStructure?.taxEnabled ? (salary.salaryStructure.taxCalculationType === 'PERCENTAGE' ? (roundedBasic * decimalToNumber(salary.salaryStructure.taxRate) / 100) : decimalToNumber(salary.salaryStructure.taxRate)) : 0;

      const roundedPfEmployee = Math.round((pfEmployee + Number.EPSILON) * 100) / 100;
      const roundedPfEmployer = Math.round((pfEmployer + Number.EPSILON) * 100) / 100;
      const roundedEsiEmployee = Math.round((esiEmployee + Number.EPSILON) * 100) / 100;
      const roundedEsiEmployer = Math.round((esiEmployer + Number.EPSILON) * 100) / 100;
      const roundedTax = Math.round((tax + Number.EPSILON) * 100) / 100;

      // Authoritative Math:
      // Gross Pay = Basic Pay + Total Allowances
      // Total Deductions = PF + ESI + Tax + Other Deductions
      // Net Pay = Gross Pay - Total Deductions
      const grossPay = Math.round((roundedBasic + roundedAllowances + Number.EPSILON) * 100) / 100;
      const totalDeds = Math.round((roundedPfEmployee + roundedEsiEmployee + roundedTax + roundedDeductions + Number.EPSILON) * 100) / 100;
      const netSalary = Math.max(0, Math.round((grossPay - totalDeds + Number.EPSILON) * 100) / 100);

      const prorationFactor = finalPayableDays / daysInMonth;
      console.log(`[PAYROLL CALCULATION LOG]`);
      console.log(`  Employee: ${employee.user.firstName} ${employee.user.lastName} (${employee.employeeCode})`);
      console.log(`  Payroll period: ${year}-${String(month).padStart(2, '0')}`);
      console.log(`  Configured Basic: ${basicPayLimit}`);
      console.log(`  Calendar Days: ${daysInMonth}`);
      console.log(`  Payable Days: ${finalPayableDays}`);
      console.log(`  Proration Factor: ${prorationFactor.toFixed(4)}`);
      console.log(`  Effective Basic: ${roundedBasic}`);
      console.log(`  Allowances: ${roundedAllowances}`);
      console.log(`  Gross: ${grossPay}`);
      console.log(`  Deductions: ${totalDeds}`);
      console.log(`  Net: ${netSalary}`);

      payrollsToCreate.push({
        employeeId: employee.id,
        month,
        year,
        baseSalary: grossPay,         // Stored as baseSalary (representing Gross Pay)
        basicPay: roundedBasic,       // Stored as basicPay
        allowances: roundedAllowances, // Stored as allowances sum
        otherDeductions: roundedDeductions, // Stored as otherDeductions sum
        pfEmployee: roundedPfEmployee,
        pfEmployer: roundedPfEmployer,
        esiEmployee: roundedEsiEmployee,
        esiEmployer: roundedEsiEmployer,
        tax: roundedTax,
        deductions: totalDeds,        // Stored as deductions (representing Total Deductions)
        bonus: 0,
        netSalary,
        workingDays,
        presentDays: presentCount + halfDayCount,
        absentDays: Math.floor(shortfallDays),
        unpaidLeaveDays,
        lateDays: lateCount,
        payableDays: finalPayableDays,
        status: 'DRAFT',
      });

      if (existing) {
        console.log(`Payroll: UPDATED`);
        updatedCount++;
      } else {
        console.log(`Payroll: CREATED`);
        createdCount++;
      }
    }

    if (payrollsToCreate.length === 0) {
      return [];
    }

    await payrollRepository.generatePayrolls(user.companyId, month, year, payrollsToCreate);

    console.log(`\nPAYROLL GENERATION COMPLETE`);
    console.log(`Employees processed: ${employees.items.length}`);
    console.log(`Payroll records created: ${createdCount}`);
    console.log(`Payroll records updated: ${updatedCount}`);
    console.log(`Failed: 0`);

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

    realtimeService.emitToCompany(user.companyId, 'payroll.generated', {
      event: 'payroll.generated',
      month,
      year,
      timestamp: new Date().toISOString(),
      updatedBy: { userId: user.id, role: user.role }
    });

    return {
      currency,
      items: items.map((p) => ({
        ...p,
        baseSalary: decimalToNumber(p.baseSalary),
        basicPay: decimalToNumber(p.basicPay),
        pfEmployee: decimalToNumber(p.pfEmployee),
        pfEmployer: decimalToNumber(p.pfEmployer),
        esiEmployee: decimalToNumber(p.esiEmployee),
        esiEmployer: decimalToNumber(p.esiEmployer),
        otherDeductions: decimalToNumber(p.otherDeductions),
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

    realtimeService.emitToCompany(user.companyId, 'payroll.updated', {
      event: 'payroll.updated',
      entityId: id,
      status,
      timestamp: new Date().toISOString(),
      updatedBy: { userId: user.id, role: user.role }
    });

    return {
      ...updated,
      baseSalary: decimalToNumber(updated.baseSalary),
      basicPay: decimalToNumber(updated.basicPay),
      pfEmployee: decimalToNumber(updated.pfEmployee),
      pfEmployer: decimalToNumber(updated.pfEmployer),
      esiEmployee: decimalToNumber(updated.esiEmployee),
      esiEmployer: decimalToNumber(updated.esiEmployer),
      otherDeductions: decimalToNumber(updated.otherDeductions),
      allowances: decimalToNumber(updated.allowances),
      deductions: decimalToNumber(updated.deductions),
      tax: decimalToNumber(updated.tax),
      netSalary: decimalToNumber(updated.netSalary),
    };
  }

  async getStats(user: NonNullable<AuthenticatedRequest['user']>, query: { month?: number; year?: number; employeeId?: string; startDate?: string; endDate?: string }) {
    return payrollRepository.getStats(user.companyId, query);
  }
}

export const payrollService = new PayrollService();
