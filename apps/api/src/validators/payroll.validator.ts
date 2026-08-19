import { z } from 'zod';

export const listPayrollSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  employeeId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const createSalaryTemplateSchema = z.object({
  name: z.string().min(1, 'Name cannot be empty'),
  basicPay: z.coerce.number().min(0, 'Basic Pay cannot be negative'),
  allowances: z.array(z.object({
    name: z.string().min(1, 'Name cannot be empty'),
    calculationType: z.enum(['PERCENTAGE', 'FIXED']),
    value: z.coerce.number().min(0, 'Value cannot be negative')
  })).default([]),
  deductions: z.array(z.object({
    name: z.string().min(1, 'Name cannot be empty'),
    calculationType: z.enum(['PERCENTAGE', 'FIXED']),
    value: z.coerce.number().min(0, 'Value cannot be negative')
  })).default([]),
  pfEnabled: z.boolean().default(false),
  pfEmployeeRate: z.coerce.number().min(0).max(100).default(12),
  pfEmployerRate: z.coerce.number().min(0).max(100).default(12),
  esiEnabled: z.boolean().default(false),
  esiEmployeeRate: z.coerce.number().min(0).max(100).default(0.75),
  esiEmployerRate: z.coerce.number().min(0).max(100).default(3.25),
  taxEnabled: z.boolean().default(false),
  taxCalculationType: z.enum(['PERCENTAGE', 'FIXED']).default('PERCENTAGE'),
  taxRate: z.coerce.number().min(0).default(0),
});

export const upsertSalaryStructureSchema = z.object({
  employeeId: z.string().uuid(),
  salaryStructureId: z.string().uuid().optional().nullable(),
  basicPay: z.coerce.number().min(0, 'Basic Pay cannot be negative'),
  allowances: z.array(z.object({
    name: z.string().min(1, 'Name cannot be empty'),
    calculationType: z.enum(['PERCENTAGE', 'FIXED']),
    value: z.coerce.number().min(0, 'Value cannot be negative')
  })).default([]),
  deductions: z.array(z.object({
    name: z.string().min(1, 'Name cannot be empty'),
    calculationType: z.enum(['PERCENTAGE', 'FIXED']),
    value: z.coerce.number().min(0, 'Value cannot be negative')
  })).default([]),
  pfEnabled: z.boolean().default(false),
  pfEmployeeRate: z.coerce.number().min(0).max(100).default(12),
  pfEmployerRate: z.coerce.number().min(0).max(100).default(12),
  esiEnabled: z.boolean().default(false),
  esiEmployeeRate: z.coerce.number().min(0).max(100).default(0.75),
  esiEmployerRate: z.coerce.number().min(0).max(100).default(3.25),
  taxEnabled: z.boolean().default(false),
  taxCalculationType: z.enum(['PERCENTAGE', 'FIXED']).default('PERCENTAGE'),
  taxRate: z.coerce.number().min(0).default(0),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const generatePayrollSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});

export const updatePayrollStatusSchema = z.object({
  status: z.enum(['PROCESSED', 'PAID', 'CANCELLED']),
});
