import { PERMISSIONS } from '@crm/shared';
import { prisma } from '../config/database';
import { leaveRepository } from '../repositories/leave.repository';
import { employeeRepository } from '../repositories/employee.repository';
import { auditService } from './audit.service';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../utils/errors';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';

function parseDate(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

function countLeaveDays(start: Date, end: Date): number {
  let days = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getUTCDay();
    if (dow !== 0 && dow !== 6) days++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return Math.max(days, 1);
}

export class LeaveService {
  private async resolveEmployeeId(
    user: NonNullable<AuthenticatedRequest['user']>,
    employeeId?: string
  ): Promise<string> {
    if (employeeId) {
      const canViewOthers =
        user.permissions.includes(PERMISSIONS.LEAVES_READ) &&
        user.permissions.includes(PERMISSIONS.LEAVES_APPROVE);
      if (!canViewOthers && employeeId !== user.employeeId) {
        throw new ForbiddenError();
      }
      const emp = await employeeRepository.findById(employeeId, user.companyId);
      if (!emp) throw new NotFoundError('Employee not found');
      return employeeId;
    }
    if (!user.employeeId) {
      const existingEmp = await prisma.employee.findUnique({ where: { userId: user.id } });
      if (existingEmp) return existingEmp.id;

      const count = await prisma.employee.count({ where: { companyId: user.companyId } });
      const code = `EMP-${String(count + 1).padStart(4, '0')}`;
      const newEmp = await prisma.employee.create({
        data: {
          userId: user.id,
          companyId: user.companyId,
          employeeCode: code,
          joiningDate: new Date(),
        },
      });
      return newEmp.id;
    }
    return user.employeeId;
  }

  async getTypes(companyId: string) {
    return leaveRepository.findTypes(companyId);
  }

  async whoIsAway(companyId: string) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const requests = await prisma.leaveRequest.findMany({
      where: {
        employee: { companyId, deletedAt: null },
        status: 'APPROVED',
        startDate: { lte: today },
        endDate: { gte: today },
      },
      include: {
        employee: {
          select: {
            employeeCode: true,
            user: { select: { firstName: true, lastName: true, avatarUrl: true } }
          }
        },
        leaveType: { select: { name: true } }
      }
    });

    return requests.map(r => ({
      id: r.id,
      employeeId: r.employeeId,
      employeeName: `${r.employee.user.firstName} ${r.employee.user.lastName}`,
      avatarUrl: r.employee.user.avatarUrl,
      leaveType: r.leaveType.name,
      startDate: r.startDate,
      endDate: r.endDate,
    }));
  }

  async getBalances(user: NonNullable<AuthenticatedRequest['user']>, employeeId?: string) {
    const eid = await this.resolveEmployeeId(user, employeeId);
    const year = new Date().getFullYear();
    await leaveRepository.ensureBalances(eid, user.companyId, year);
    
    const balances = await leaveRepository.findBalances(eid, year);
    const { items: pendingRequests } = await leaveRepository.findRequests(user.companyId, {
      page: 1, limit: 1000, employeeId: eid, status: 'PENDING'
    });

    return balances.map(b => {
      const pendingDays = pendingRequests
        .filter(r => r.leaveTypeId === b.leaveTypeId)
        .reduce((sum, r) => sum + r.days, 0);
      return { ...b, pendingDays };
    });
  }

  async listRequests(
    user: NonNullable<AuthenticatedRequest['user']>,
    query: { page: number; limit: number; status?: string; employeeId?: string }
  ) {
    const canViewAll = user.permissions.includes(PERMISSIONS.LEAVES_APPROVE);
    let employeeId = query.employeeId;

    if (!canViewAll) {
      employeeId = user.employeeId;
      if (!employeeId) throw new ForbiddenError();
    }

    const { items, total } = await leaveRepository.findRequests(user.companyId, {
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

  async apply(
    user: NonNullable<AuthenticatedRequest['user']>,
    input: { leaveTypeId: string; startDate: string; endDate: string; reason?: string; employeeId?: string; autoApprove?: boolean }
  ) {
    const employeeId = await this.resolveEmployeeId(user, input.employeeId);
    const startDate = parseDate(input.startDate);
    const endDate = parseDate(input.endDate);

    if (endDate < startDate) {
      throw new ValidationError('End date must be on or after start date');
    }

    const leaveType = await leaveRepository.findTypes(user.companyId).then((types) =>
      types.find((t) => t.id === input.leaveTypeId)
    );
    if (!leaveType) throw new NotFoundError('Leave type not found');

    const days = countLeaveDays(startDate, endDate);
    const year = startDate.getUTCFullYear();

    await leaveRepository.ensureBalances(employeeId, user.companyId, year);
    const balance = await leaveRepository.findBalance(employeeId, input.leaveTypeId, year);

    if (!balance || balance.remainingDays < days) {
      throw new ValidationError('Insufficient leave balance');
    }

    if (leaveType.code === 'CASUAL') {
      const allReqs = await leaveRepository.findRequests(user.companyId, {
        page: 1, limit: 100, employeeId
      });
      const month = startDate.getUTCMonth();
      const hasCasualThisMonth = allReqs.items.some(r => 
        r.leaveTypeId === leaveType.id && 
        (r.status === 'PENDING' || r.status === 'APPROVED') &&
        r.startDate.getUTCMonth() === month &&
        r.startDate.getUTCFullYear() === year
      );
      if (hasCasualThisMonth) {
        throw new ValidationError('You can only take 1 Casual Leave per month');
      }
    }

    const overlapping = await leaveRepository.findRequests(user.companyId, {
      page: 1,
      limit: 50,
      employeeId,
    });
    const hasOverlap = overlapping.items.some(
      (r) =>
        (r.status === 'PENDING' || r.status === 'APPROVED') &&
        startDate <= r.endDate &&
        endDate >= r.startDate
    );
    if (hasOverlap) throw new ConflictError('Overlapping leave request exists');

    const request = await leaveRepository.createRequest({
      employeeId,
      leaveTypeId: input.leaveTypeId,
      startDate,
      endDate,
      days,
      reason: input.reason,
    });

    await auditService.log({
      companyId: user.companyId,
      userId: user.id,
      action: 'CREATE',
      entityType: 'LeaveRequest',
      entityId: request.id,
    });

    if (input.autoApprove && user.permissions.includes(PERMISSIONS.LEAVES_APPROVE)) {
      return this.approve(user, request.id);
    }

    return request;
  }

  async approve(user: NonNullable<AuthenticatedRequest['user']>, id: string) {
    if (!user.permissions.includes(PERMISSIONS.LEAVES_APPROVE)) {
      throw new ForbiddenError();
    }

    const request = await leaveRepository.findRequestById(id, user.companyId);
    if (!request) throw new NotFoundError('Leave request not found');
    if (request.status !== 'PENDING') throw new ConflictError('Request is not pending');

    const year = request.startDate.getUTCFullYear();
    const balance = await leaveRepository.findBalance(
      request.employeeId,
      request.leaveTypeId,
      year
    );
    if (!balance || balance.remainingDays < request.days) {
      throw new ValidationError('Insufficient leave balance');
    }

    await leaveRepository.deductBalance(
      request.employeeId,
      request.leaveTypeId,
      year,
      request.days
    );

    const updated = await leaveRepository.updateRequestStatus(id, {
      status: 'APPROVED',
      approvedBy: user.id,
      approvedAt: new Date(),
    });

    const settings = await prisma.companySettings.findUnique({ where: { companyId: user.companyId } });
    const workDays = (settings?.workDays as number[]) ?? [1, 2, 3, 4, 5];

    const cur = new Date(request.startDate);
    while (cur <= request.endDate) {
      const dow = cur.getUTCDay();
      if (workDays.includes(dow)) {
        await prisma.attendance.upsert({
          where: {
            employeeId_date: { employeeId: request.employeeId, date: new Date(cur) },
          },
          update: { status: 'ON_LEAVE' },
          create: {
            employeeId: request.employeeId,
            date: new Date(cur),
            status: 'ON_LEAVE',
          },
        });
      }
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    await auditService.log({
      companyId: user.companyId,
      userId: user.id,
      action: 'APPROVE',
      entityType: 'LeaveRequest',
      entityId: id,
    });

    return updated;
  }

  async reject(
    user: NonNullable<AuthenticatedRequest['user']>,
    id: string,
    rejectionReason: string
  ) {
    if (!user.permissions.includes(PERMISSIONS.LEAVES_APPROVE)) {
      throw new ForbiddenError();
    }

    const request = await leaveRepository.findRequestById(id, user.companyId);
    if (!request) throw new NotFoundError('Leave request not found');
    if (request.status !== 'PENDING') throw new ConflictError('Request is not pending');

    const updated = await leaveRepository.updateRequestStatus(id, {
      status: 'REJECTED',
      approvedBy: user.id,
      approvedAt: new Date(),
      rejectionReason,
    });

    await auditService.log({
      companyId: user.companyId,
      userId: user.id,
      action: 'REJECT',
      entityType: 'LeaveRequest',
      entityId: id,
    });

    return updated;
  }
}

export const leaveService = new LeaveService();
