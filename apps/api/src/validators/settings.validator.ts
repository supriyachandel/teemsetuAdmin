import { z } from 'zod';

export const updateCompanySettingsSchema = z.object({
  officeStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  officeEndTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  workDays: z.array(z.coerce.number().int().min(0).max(6)).optional(),
  lateThresholdMin: z.coerce.number().int().min(0).max(180).optional(),
  emailNotifications: z.boolean().optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  payrollSettings: z.record(z.any()).optional(),
  employeeCodePrefix: z.string().min(1).max(10).optional(),
  linkedinToken: z.string().optional().nullable(),
});
