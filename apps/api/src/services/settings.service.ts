import type { Prisma } from '@prisma/client';
import { settingsRepository } from '../repositories/settings.repository';

export class SettingsService {
  async get(companyId: string) {
    return settingsRepository.getByCompany(companyId);
  }

  async update(
    companyId: string,
    input: {
      officeStartTime?: string;
      officeEndTime?: string;
      workDays?: number[];
      lateThresholdMin?: number;
      emailNotifications?: boolean;
      theme?: 'light' | 'dark' | 'system';
      payrollSettings?: Record<string, unknown>;
      employeeCodePrefix?: string;
      linkedinToken?: string;
    }
  ) {
    return settingsRepository.upsert(companyId, {
      ...(input.officeStartTime !== undefined && { officeStartTime: input.officeStartTime }),
      ...(input.officeEndTime !== undefined && { officeEndTime: input.officeEndTime }),
      ...(input.workDays !== undefined && { workDays: input.workDays }),
      ...(input.lateThresholdMin !== undefined && { lateThresholdMin: input.lateThresholdMin }),
      ...(input.emailNotifications !== undefined && {
        emailNotifications: input.emailNotifications,
      }),
      ...(input.theme !== undefined && { theme: input.theme }),
      ...(input.payrollSettings !== undefined && { payrollSettings: input.payrollSettings as Prisma.InputJsonValue }),
      ...(input.employeeCodePrefix !== undefined && { employeeCodePrefix: input.employeeCodePrefix }),
      ...(input.linkedinToken !== undefined && { linkedinToken: input.linkedinToken }),
    });
  }
}

export const settingsService = new SettingsService();
