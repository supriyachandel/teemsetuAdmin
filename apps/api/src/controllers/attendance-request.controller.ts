import { Response } from 'express';
import { attendanceRequestService } from '../services/attendance-request.service';
import { sendSuccess, sendPaginated } from '../utils/response';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';

export class AttendanceRequestController {
  async createRequest(req: AuthenticatedRequest, res: Response) {
    const data = await attendanceRequestService.createRequest(req.user!, req.body);
    return sendSuccess(res, data, 'Attendance request submitted successfully');
  }

  async list(req: AuthenticatedRequest, res: Response) {
    const result = await attendanceRequestService.list(req.user!, {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10,
      employeeId: req.query.employeeId as string,
      status: req.query.status as any,
    });
    return sendPaginated(res, result.items, result.meta);
  }

  async approveRequest(req: AuthenticatedRequest, res: Response) {
    const data = await attendanceRequestService.approveRequest(req.user!, req.params.id as string);
    return sendSuccess(res, data, 'Request approved successfully');
  }

  async rejectRequest(req: AuthenticatedRequest, res: Response) {
    const data = await attendanceRequestService.rejectRequest(req.user!, req.params.id as string, req.body.rejectionReason);
    return sendSuccess(res, data, 'Request rejected successfully');
  }

  async getMonthlyCount(req: AuthenticatedRequest, res: Response) {
    const month = parseInt(req.query.month as string);
    const year = parseInt(req.query.year as string);
    const data = await attendanceRequestService.getMonthlyCount(req.user!, month, year);
    return sendSuccess(res, data);
  }
}

export const attendanceRequestController = new AttendanceRequestController();
