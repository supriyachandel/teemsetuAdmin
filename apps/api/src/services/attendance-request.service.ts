import { PERMISSIONS } from '@crm/shared';
import { prisma } from '../config/database';
import { employeeRepository } from '../repositories/employee.repository';
import { auditService } from './audit.service';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';

function calcWorkHours(checkIn: Date, checkOut: Date): { workHours: number; overtimeHours: number } {
  const ms = checkOut.getTime() - checkIn.getTime();
  const hours = ms / (1000 * 60 * 60);
  const workHours = Math.round(hours * 100) / 100;
  const overtimeHours = Math.max(0, Math.round((workHours - 9) * 100) / 100);
  return { workHours, overtimeHours };
}

function isLate(checkIn: Date): { isLate: boolean; lateMinutes: number } {
  const threshold = new Date(checkIn);
  threshold.setHours(9, 30, 0, 0); // Assuming 9:30 AM is start
  if (checkIn <= threshold) return { isLate: false, lateMinutes: 0 };
  const lateMinutes = Math.floor((checkIn.getTime() - threshold.getTime()) / 60000);
  return { isLate: true, lateMinutes };
}

export class AttendanceRequestService {
  private async resolveEmployeeId(user: NonNullable<AuthenticatedRequest['user']>): Promise<string> {
    if (!user.employeeId) throw new ValidationError('No employee profile linked to this account');
    return user.employeeId;
  }

  async createRequest(
    user: NonNullable<AuthenticatedRequest['user']>,
    data: { date: string; checkInTime?: string; checkOutTime?: string; reason: string }
  ) {
    const employeeId = await this.resolveEmployeeId(user);
    const date = new Date(data.date);
    date.setUTCHours(0, 0, 0, 0); // Start of day for the selected date

    // Limit check: 10 per month (based on the date of attendance)
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
    
    const count = await prisma.attendanceRequest.count({
      where: {
        employeeId,
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    });

    if (count >= 10) {
      throw new ConflictError('You have reached the maximum limit of 10 attendance requests for this month.');
    }

    const checkInTime = data.checkInTime ? new Date(data.checkInTime) : null;
    const checkOutTime = data.checkOutTime ? new Date(data.checkOutTime) : null;

    if (!checkInTime && !checkOutTime) {
      throw new ValidationError('You must provide at least a check-in or check-out time.');
    }

    const request = await prisma.attendanceRequest.create({
      data: {
        employeeId,
        date,
        checkInTime,
        checkOutTime,
        reason: data.reason,
        status: 'PENDING',
      },
    });

    await auditService.log({
      companyId: user.companyId,
      userId: user.id,
      action: 'CREATE',
      entityType: 'AttendanceRequest',
      entityId: request.id,
    });

    return request;
  }

  async list(
    user: NonNullable<AuthenticatedRequest['user']>,
    query: {
      page: number;
      limit: number;
      employeeId?: string;
      status?: 'PENDING' | 'APPROVED' | 'REJECTED';
    }
  ) {
    const canViewAll = user.permissions.includes(PERMISSIONS.ATTENDANCE_APPROVE);
    let employeeId = query.employeeId;

    if (!canViewAll) {
      employeeId = user.employeeId;
      if (!employeeId) throw new ForbiddenError();
    }

    const where = {
      employee: { companyId: user.companyId, deletedAt: null },
      ...(employeeId && { employeeId }),
      ...(query.status && { status: query.status }),
    };

    const [items, total] = await Promise.all([
      prisma.attendanceRequest.findMany({
        where,
        include: {
          employee: {
            select: {
              employeeCode: true,
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.attendanceRequest.count({ where }),
    ]);

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

  async approveRequest(user: NonNullable<AuthenticatedRequest['user']>, id: string) {
    if (!user.permissions.includes(PERMISSIONS.ATTENDANCE_APPROVE)) {
      throw new ForbiddenError();
    }

    const request = await prisma.attendanceRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundError('Request not found');
    if (request.status !== 'PENDING') throw new ConflictError('Request is not pending');

    const updatedRequest = await prisma.attendanceRequest.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy: user.id },
    });

    // Upsert the actual attendance record
    const existing = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId: request.employeeId, date: request.date } }
    });

    const checkInToSave = request.checkInTime || existing?.checkIn || undefined;
    const checkOutToSave = request.checkOutTime || existing?.checkOut || undefined;

    const lateness = checkInToSave ? isLate(checkInToSave) : { isLate: false, lateMinutes: 0 };
    
    let workHours = null;
    let overtimeHours = 0;
    if (checkInToSave && checkOutToSave) {
      const calc = calcWorkHours(checkInToSave, checkOutToSave);
      workHours = calc.workHours;
      overtimeHours = calc.overtimeHours;
    }

    if (existing) {
      await prisma.attendance.update({
        where: { id: existing.id },
        data: {
          checkIn: checkInToSave,
          checkOut: checkOutToSave,
          workHours,
          overtimeHours,
          status: lateness.isLate ? 'LATE' : 'PRESENT',
          isLate: lateness.isLate,
          lateMinutes: lateness.lateMinutes,
        },
      });
    } else {
      if (checkInToSave) {
        await prisma.attendance.create({
          data: {
            employeeId: request.employeeId,
            date: request.date,
            checkIn: checkInToSave,
            checkOut: checkOutToSave,
            workHours,
            overtimeHours,
            status: lateness.isLate ? 'LATE' : 'PRESENT',
            isLate: lateness.isLate,
            lateMinutes: lateness.lateMinutes,
            notes: 'Created from check-in request',
          }
        });
      }
    }

    await auditService.log({
      companyId: user.companyId,
      userId: user.id,
      action: 'APPROVE',
      entityType: 'AttendanceRequest',
      entityId: request.id,
    });

    return updatedRequest;
  }

  async rejectRequest(user: NonNullable<AuthenticatedRequest['user']>, id: string, rejectionReason: string) {
    if (!user.permissions.includes(PERMISSIONS.ATTENDANCE_APPROVE)) {
      throw new ForbiddenError();
    }

    const request = await prisma.attendanceRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundError('Request not found');
    if (request.status !== 'PENDING') throw new ConflictError('Request is not pending');

    const updatedRequest = await prisma.attendanceRequest.update({
      where: { id },
      data: { status: 'REJECTED', rejectionReason },
    });

    await auditService.log({
      companyId: user.companyId,
      userId: user.id,
      action: 'REJECT',
      entityType: 'AttendanceRequest',
      entityId: request.id,
    });

    return updatedRequest;
  }

  async getMonthlyCount(user: NonNullable<AuthenticatedRequest['user']>, month: number, year: number) {
    const employeeId = await this.resolveEmployeeId(user);
    const monthStart = new Date(year, month - 1, 1); // JS months are 0-indexed
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const count = await prisma.attendanceRequest.count({
      where: {
        employeeId,
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    });

    return { count };
  }
}

export const attendanceRequestService = new AttendanceRequestService();
