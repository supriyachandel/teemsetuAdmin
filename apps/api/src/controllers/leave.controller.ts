import { Response } from 'express';
import { leaveService } from '../services/leave.service';
import { sendSuccess, sendCreated, sendPaginated } from '../utils/response';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';

export class LeaveController {
  async types(req: AuthenticatedRequest, res: Response) {
    const data = await leaveService.getTypes(req.user!.companyId);
    return sendSuccess(res, data);
  }

  async whoIsAway(req: AuthenticatedRequest, res: Response) {
    const data = await leaveService.whoIsAway(req.user!.companyId);
    return sendSuccess(res, data);
  }

  async balances(req: AuthenticatedRequest, res: Response) {
    const employeeId = req.query.employeeId as string | undefined;
    const data = await leaveService.getBalances(req.user!, employeeId);
    return sendSuccess(res, data);
  }

  async list(req: AuthenticatedRequest, res: Response) {
    const result = await leaveService.listRequests(req.user!, req.query as never);
    return sendPaginated(res, result.items, result.meta);
  }

  async apply(req: AuthenticatedRequest, res: Response) {
    const data = await leaveService.apply(req.user!, req.body);
    return sendCreated(res, data, 'Leave request submitted');
  }

  async approve(req: AuthenticatedRequest, res: Response) {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await leaveService.approve(req.user!, id);
    return sendSuccess(res, data, 'Leave approved');
  }

  async reject(req: AuthenticatedRequest, res: Response) {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await leaveService.reject(req.user!, id, req.body.rejectionReason);
    return sendSuccess(res, data, 'Leave rejected');
  }
}

export const leaveController = new LeaveController();
