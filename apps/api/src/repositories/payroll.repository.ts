import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';

const payrollInclude = {
  employee: {
    select: {
      id: true,
      employeeCode: true,
      employmentStatus: true,
      user: { select: { firstName: true, lastName: true, email: true } },
    },
  },
} satisfies Prisma.PayrollInclude;

export class PayrollRepository {
  async list(
    companyId: string,
    query: { page: number; limit: number; month?: number; year?: number; employeeId?: string; startDate?: string; endDate?: string }
  ) {
    const where: Prisma.PayrollWhereInput = {
      employee: { companyId, deletedAt: null },
      ...(query.month && { month: query.month }),
      ...(query.year && { year: query.year }),
      ...(query.employeeId && { employeeId: query.employeeId }),
      ...(query.startDate && query.endDate && {
        createdAt: {
          gte: new Date(query.startDate),
          lte: new Date(query.endDate),
        }
      })
    };

    const [items, total] = await Promise.all([
      prisma.payroll.findMany({
        where,
        include: payrollInclude,
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.payroll.count({ where }),
    ]);
    return { items, total };
  }

  async listSalaryStructures(companyId: string) {
    return prisma.salaryStructure.findMany({
      where: { companyId, isTemplate: true },
      include: {
        allowances: true,
        deductions: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findSalaryStructureById(id: string) {
    return prisma.salaryStructure.findUnique({
      where: { id },
      include: {
        allowances: true,
        deductions: true,
      }
    });
  }

  async createSalaryStructureTemplate(companyId: string, data: {
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
  }) {
    return prisma.salaryStructure.create({
      data: {
        companyId,
        name: data.name,
        isTemplate: true,
        basicPay: new Prisma.Decimal(data.basicPay),
        pfEnabled: data.pfEnabled,
        pfEmployeeRate: new Prisma.Decimal(data.pfEmployeeRate),
        pfEmployerRate: new Prisma.Decimal(data.pfEmployerRate),
        esiEnabled: data.esiEnabled,
        esiEmployeeRate: new Prisma.Decimal(data.esiEmployeeRate),
        esiEmployerRate: new Prisma.Decimal(data.esiEmployerRate),
        taxEnabled: data.taxEnabled,
        taxCalculationType: data.taxCalculationType,
        taxRate: new Prisma.Decimal(data.taxRate),
        allowances: {
          create: data.allowances.map(a => ({
            name: a.name,
            calculationType: a.calculationType,
            value: new Prisma.Decimal(a.value),
          }))
        },
        deductions: {
          create: data.deductions.map(d => ({
            name: d.name,
            calculationType: d.calculationType,
            value: new Prisma.Decimal(d.value),
          }))
        }
      },
      include: {
        allowances: true,
        deductions: true,
      }
    });
  }

  async updateSalaryStructureTemplate(id: string, data: {
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
  }) {
    return prisma.$transaction(async (tx) => {
      // Delete old allowances and deductions
      await tx.salaryAllowance.deleteMany({ where: { salaryStructureId: id } });
      await tx.salaryDeduction.deleteMany({ where: { salaryStructureId: id } });

      return tx.salaryStructure.update({
        where: { id },
        data: {
          name: data.name,
          basicPay: new Prisma.Decimal(data.basicPay),
          pfEnabled: data.pfEnabled,
          pfEmployeeRate: new Prisma.Decimal(data.pfEmployeeRate),
          pfEmployerRate: new Prisma.Decimal(data.pfEmployerRate),
          esiEnabled: data.esiEnabled,
          esiEmployeeRate: new Prisma.Decimal(data.esiEmployeeRate),
          esiEmployerRate: new Prisma.Decimal(data.esiEmployerRate),
          taxEnabled: data.taxEnabled,
          taxCalculationType: data.taxCalculationType,
          taxRate: new Prisma.Decimal(data.taxRate),
          allowances: {
            create: data.allowances.map(a => ({
              name: a.name,
              calculationType: a.calculationType,
              value: new Prisma.Decimal(a.value),
            }))
          },
          deductions: {
            create: data.deductions.map(d => ({
              name: d.name,
              calculationType: d.calculationType,
              value: new Prisma.Decimal(d.value),
            }))
          }
        },
        include: {
          allowances: true,
          deductions: true,
        }
      });
    });
  }

  async deleteSalaryStructureTemplate(id: string) {
    return prisma.salaryStructure.delete({
      where: { id }
    });
  }

  async findEmployeeSalary(employeeId: string) {
    return prisma.employeeSalary.findUnique({
      where: { employeeId },
      include: {
        salaryStructure: {
          include: {
            allowances: true,
            deductions: true,
          }
        }
      }
    });
  }

  async upsertEmployeeSalary(companyId: string, data: {
    employeeId: string;
    salaryStructureId?: string | null;
    basicPay: number;
    grossSalary: number;
    netSalary: number;
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
    effectiveFrom: Date;
  }) {
    return prisma.$transaction(async (tx) => {
      const existingSalary = await tx.employeeSalary.findUnique({
        where: { employeeId: data.employeeId },
        include: { salaryStructure: true }
      });

      let targetStructureId = data.salaryStructureId;

      if (!targetStructureId || targetStructureId === 'custom') {
        const customStructure = await tx.salaryStructure.create({
          data: {
            companyId,
            name: null,
            isTemplate: false,
            basicPay: new Prisma.Decimal(data.basicPay),
            pfEnabled: data.pfEnabled,
            pfEmployeeRate: new Prisma.Decimal(data.pfEmployeeRate),
            pfEmployerRate: new Prisma.Decimal(data.pfEmployerRate),
            esiEnabled: data.esiEnabled,
            esiEmployeeRate: new Prisma.Decimal(data.esiEmployeeRate),
            esiEmployerRate: new Prisma.Decimal(data.esiEmployerRate),
            taxEnabled: data.taxEnabled,
            taxCalculationType: data.taxCalculationType,
            taxRate: new Prisma.Decimal(data.taxRate),
            allowances: {
              create: data.allowances.map(a => ({
                name: a.name,
                calculationType: a.calculationType,
                value: new Prisma.Decimal(a.value),
              }))
            },
            deductions: {
              create: data.deductions.map(d => ({
                name: d.name,
                calculationType: d.calculationType,
                value: new Prisma.Decimal(d.value),
              }))
            }
          }
        });
        targetStructureId = customStructure.id;
      } else {
        const template = await tx.salaryStructure.findUnique({
          where: { id: targetStructureId },
          include: { allowances: true, deductions: true }
        });
        if (!template) {
          throw new Error('Selected salary structure template not found');
        }

        const matchAllowances = template.allowances.length === data.allowances.length &&
          template.allowances.every(ta => data.allowances.some(da => da.name === ta.name && da.calculationType === ta.calculationType && Number(da.value) === Number(ta.value)));

        const matchDeductions = template.deductions.length === data.deductions.length &&
          template.deductions.every(td => data.deductions.some(dd => dd.name === td.name && dd.calculationType === td.calculationType && Number(dd.value) === Number(td.value)));

        const matchBasicPay = Number(template.basicPay) === data.basicPay;
        const matchPf = template.pfEnabled === data.pfEnabled && Number(template.pfEmployeeRate) === data.pfEmployeeRate && Number(template.pfEmployerRate) === data.pfEmployerRate;
        const matchEsi = template.esiEnabled === data.esiEnabled && Number(template.esiEmployeeRate) === data.esiEmployeeRate && Number(template.esiEmployerRate) === data.esiEmployerRate;
        const matchTax = template.taxEnabled === data.taxEnabled && template.taxCalculationType === data.taxCalculationType && Number(template.taxRate) === data.taxRate;

        if (!matchAllowances || !matchDeductions || !matchBasicPay || !matchPf || !matchEsi || !matchTax) {
          const customStructure = await tx.salaryStructure.create({
            data: {
              companyId,
              name: null,
              isTemplate: false,
              basicPay: new Prisma.Decimal(data.basicPay),
              pfEnabled: data.pfEnabled,
              pfEmployeeRate: new Prisma.Decimal(data.pfEmployeeRate),
              pfEmployerRate: new Prisma.Decimal(data.pfEmployerRate),
              esiEnabled: data.esiEnabled,
              esiEmployeeRate: new Prisma.Decimal(data.esiEmployeeRate),
              esiEmployerRate: new Prisma.Decimal(data.esiEmployerRate),
              taxEnabled: data.taxEnabled,
              taxCalculationType: data.taxCalculationType,
              taxRate: new Prisma.Decimal(data.taxRate),
              allowances: {
                create: data.allowances.map(a => ({
                  name: a.name,
                  calculationType: a.calculationType,
                  value: new Prisma.Decimal(a.value),
                }))
              },
              deductions: {
                create: data.deductions.map(d => ({
                  name: d.name,
                  calculationType: d.calculationType,
                  value: new Prisma.Decimal(d.value),
                }))
              }
            }
          });
          targetStructureId = customStructure.id;
        }
      }

      const employeeSalary = await tx.employeeSalary.upsert({
        where: { employeeId: data.employeeId },
        update: {
          salaryStructureId: targetStructureId!,
          basicPay: new Prisma.Decimal(data.basicPay),
          grossSalary: new Prisma.Decimal(data.grossSalary),
          netSalary: new Prisma.Decimal(data.netSalary),
          effectiveFrom: data.effectiveFrom,
        },
        create: {
          employeeId: data.employeeId,
          salaryStructureId: targetStructureId!,
          basicPay: new Prisma.Decimal(data.basicPay),
          grossSalary: new Prisma.Decimal(data.grossSalary),
          netSalary: new Prisma.Decimal(data.netSalary),
          effectiveFrom: data.effectiveFrom,
        },
        include: {
          salaryStructure: {
            include: {
              allowances: true,
              deductions: true,
            }
          }
        }
      });

      if (existingSalary && existingSalary.salaryStructureId && existingSalary.salaryStructureId !== targetStructureId && !existingSalary.salaryStructure.isTemplate) {
        await tx.salaryStructure.delete({
          where: { id: existingSalary.salaryStructureId }
        });
      }

      return employeeSalary;
    }, {
      timeout: 30000
    });
  }

  async generatePayrolls(companyId: string, month: number, year: number, data: Array<Prisma.PayrollCreateManyInput>) {
    return prisma.$transaction(
      data.map((payroll) => 
        prisma.payroll.upsert({
          where: { employeeId_month_year: { employeeId: payroll.employeeId, month, year } },
          update: {
             baseSalary: payroll.baseSalary,
             basicPay: payroll.basicPay,
             pfEmployee: payroll.pfEmployee,
             pfEmployer: payroll.pfEmployer,
             esiEmployee: payroll.esiEmployee,
             esiEmployer: payroll.esiEmployer,
             otherDeductions: payroll.otherDeductions,
             allowances: payroll.allowances,
             deductions: payroll.deductions,
             tax: payroll.tax,
             netSalary: payroll.netSalary,
             workingDays: payroll.workingDays ?? 0,
             presentDays: payroll.presentDays ?? 0,
             absentDays: payroll.absentDays ?? 0,
             unpaidLeaveDays: payroll.unpaidLeaveDays ?? 0,
             lateDays: payroll.lateDays ?? 0,
             payableDays: payroll.payableDays ?? 0,
             status: 'DRAFT'
          },
          create: payroll
        })
      )
    );
  }

  async findById(companyId: string, id: string) {
    return prisma.payroll.findFirst({
      where: { id, employee: { companyId, deletedAt: null } },
      include: {
        ...payrollInclude,
        employee: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
            department: { select: { name: true } },
            designation: { select: { title: true } },
          },
        },
      },
    });
  }

  async updateStatus(id: string, status: 'PROCESSED' | 'PAID' | 'CANCELLED') {
    return prisma.payroll.update({
      where: { id },
      data: { 
        status,
        ...(status === 'PAID' ? { paidAt: new Date() } : {})
      },
      include: payrollInclude,
    });
  }

  async getStats(companyId: string, query: { month?: number; year?: number; employeeId?: string; startDate?: string; endDate?: string }) {
    const where: Prisma.PayrollWhereInput = {
      employee: { companyId, deletedAt: null },
      ...(query.month && { month: query.month }),
      ...(query.year && { year: query.year }),
      ...(query.employeeId && { employeeId: query.employeeId }),
      ...(query.startDate && query.endDate && {
        createdAt: {
          gte: new Date(query.startDate),
          lte: new Date(query.endDate),
        }
      })
    };

    let totalEmployees = 0;
    if (query.month && query.year) {
      totalEmployees = await prisma.payroll.count({
        where: {
          employee: { companyId, deletedAt: null },
          month: query.month,
          year: query.year,
        }
      });
      if (totalEmployees === 0) {
        totalEmployees = await prisma.employee.count({
          where: { companyId, deletedAt: null, employmentStatus: 'ACTIVE' }
        });
      }
    } else {
      totalEmployees = await prisma.employee.count({
        where: { companyId, deletedAt: null, employmentStatus: 'ACTIVE' }
      });
    }

    const aggregates = await prisma.payroll.aggregate({
      where,
      _sum: {
        baseSalary: true,
        basicPay: true,
        allowances: true,
        deductions: true,
        pfEmployee: true,
        esiEmployee: true,
        tax: true,
        netSalary: true,
      }
    });

    return {
      totalEmployees,
      monthlyPayroll: Number(aggregates._sum.netSalary ?? 0),
      totalBasicPay: Number(aggregates._sum.basicPay ?? 0),
      totalAllowances: Number(aggregates._sum.allowances ?? 0),
      totalDeductions: Number(aggregates._sum.deductions ?? 0),
      netSalary: Number(aggregates._sum.netSalary ?? 0),
    };
  }
}

export const payrollRepository = new PayrollRepository();
