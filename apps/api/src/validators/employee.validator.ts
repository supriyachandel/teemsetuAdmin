import { z } from 'zod';

export const listEmployeesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'PROBATION', 'ON_LEAVE', 'TERMINATED', 'RESIGNED']).optional(),
});

export const createEmployeeSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).optional(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  employeeCode: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.string().min(1).max(20).optional()
  ),
  departmentId: z.string().uuid().optional(),
  designationId: z.string().uuid().optional(),
  joiningDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  phone: z.string().max(20).optional(),
  employmentStatus: z
    .enum(['ACTIVE', 'PROBATION', 'ON_LEAVE', 'TERMINATED', 'RESIGNED'])
    .default('ACTIVE'),
  managerId: z.string().uuid().optional(),
  roleId: z.string().uuid().optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional().nullable(),
  baseSalary: z.number().optional(),
});

export const updateEmployeeSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  departmentId: z.string().uuid().nullable().optional(),
  designationId: z.string().uuid().nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  employmentStatus: z
    .enum(['ACTIVE', 'PROBATION', 'ON_LEAVE', 'TERMINATED', 'RESIGNED'])
    .optional(),
  managerId: z.string().uuid('Invalid manager ID format').optional().nullable(),
  roleId: z.string().uuid().optional().nullable(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional().nullable(),
});

export const createDepartmentSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().max(20).optional(),
  description: z.string().max(500).optional(),
});

export const createDesignationSchema = z.object({
  title: z.string().min(1).max(100),
  level: z.coerce.number().int().min(1).max(20).default(1),
  description: z.string().max(500).optional(),
});
