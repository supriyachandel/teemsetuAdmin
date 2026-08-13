import { PERMISSIONS } from '@crm/shared';
import { attendanceRepository } from '../repositories/attendance.repository';
import { employeeRepository } from '../repositories/employee.repository';
import { auditService } from './audit.service';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';

const OFFICE_START_HOUR = 9;
const OFFICE_START_MINUTE = 30;
const STANDARD_HOURS = 9;

function calcWorkHours(checkIn: Date, checkOut: Date): { workHours: number; overtimeHours: number } {
  const ms = checkOut.getTime() - checkIn.getTime();
  const hours = ms / (1000 * 60 * 60);
  const workHours = Math.round(hours * 100) / 100;
  const overtimeHours = Math.max(0, Math.round((workHours - STANDARD_HOURS) * 100) / 100);
  return { workHours, overtimeHours };
}

function isLate(checkIn: Date): { isLate: boolean; lateMinutes: number } {
  const threshold = new Date(checkIn);
  threshold.setHours(OFFICE_START_HOUR, OFFICE_START_MINUTE, 0, 0);
  if (checkIn <= threshold) return { isLate: false, lateMinutes: 0 };
  const lateMinutes = Math.floor((checkIn.getTime() - threshold.getTime()) / 60000);
  return { isLate: true, lateMinutes };
}

export class AttendanceService {
  private async resolveEmployeeId(
    user: NonNullable<AuthenticatedRequest['user']>,
    employeeId?: string
  ): Promise<string> {
    if (employeeId) {
      const canViewOthers = user.permissions.includes(PERMISSIONS.ATTENDANCE_APPROVE);
      if (!canViewOthers && employeeId !== user.employeeId) {
        throw new ForbiddenError();
      }
      const emp = await employeeRepository.findById(employeeId, user.companyId);
      if (!emp) throw new NotFoundError('Employee not found');
      return employeeId;
    }
    if (!user.employeeId) throw new ValidationError('No employee profile linked to this account');
    return user.employeeId;
  }

  async checkIn(
    user: NonNullable<AuthenticatedRequest['user']>,
    data: { lat?: number; lng?: number; notes?: string }
  ) {
    const employeeId = await this.resolveEmployeeId(user);
    const existing = await attendanceRepository.findToday(employeeId);
    if (existing?.checkIn) {
      return existing;
    }

    const now = new Date();
    const late = isLate(now);

    const attendance = await attendanceRepository.createCheckIn(employeeId, {
      checkIn: now,
      lat: data.lat,
      lng: data.lng,
      notes: data.notes,
      ...late,
    });

    await auditService.log({
      companyId: user.companyId,
      userId: user.id,
      action: 'CREATE',
      entityType: 'Attendance',
      entityId: attendance.id,
    });

    return attendance;
  }

  async checkOut(
    user: NonNullable<AuthenticatedRequest['user']>,
    data: { notes?: string }
  ) {
    const employeeId = await this.resolveEmployeeId(user);
    const existing = await attendanceRepository.findToday(employeeId);
    if (!existing?.checkIn) throw new ValidationError('Check in first before checking out');
    if (existing.checkOut) throw new ConflictError('Already checked out today');

    const now = new Date();
    const { workHours, overtimeHours } = calcWorkHours(existing.checkIn, now);

    const updated = await attendanceRepository.updateCheckOut(existing.id, {
      checkOut: now,
      workHours,
      overtimeHours,
      notes: data.notes ?? existing.notes ?? undefined,
    });

    await auditService.log({
      companyId: user.companyId,
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Attendance',
      entityId: existing.id,
    });

    return updated;
  }

  async getToday(user: NonNullable<AuthenticatedRequest['user']>, employeeId?: string) {
    const eid = await this.resolveEmployeeId(user, employeeId);
    return attendanceRepository.findToday(eid);
  }

  async list(
    user: NonNullable<AuthenticatedRequest['user']>,
    query: {
      page: number;
      limit: number;
      employeeId?: string;
      startDate?: string;
      endDate?: string;
    }
  ) {
    const canViewAll = user.permissions.includes(PERMISSIONS.ATTENDANCE_APPROVE);
    let employeeId = query.employeeId;

    if (!canViewAll) {
      employeeId = user.employeeId;
      if (!employeeId) throw new ForbiddenError();
    }

    const { items, total } = await attendanceRepository.findMany(user.companyId, {
      ...query,
      employeeId,
    });

    return {
      items,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }
}

export const attendanceService = new AttendanceService();
