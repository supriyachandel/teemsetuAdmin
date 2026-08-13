import { Response } from 'express';
import { dashboardService } from '../services/dashboard.service';
import { sendSuccess } from '../utils/response';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';

export class DashboardController {
  async getStats(req: AuthenticatedRequest, res: Response) {
    const stats = await dashboardService.getDashboard(
      req.user!.companyId,
      req.user!.role,
      req.user!.employeeId
    );
    return sendSuccess(res, stats);
  }

  async search(req: AuthenticatedRequest, res: Response) {
    const query = req.query.q as string || '';
    const results = await dashboardService.globalSearch(req.user!.companyId, query);
    return sendSuccess(res, results);
  }
}

export const dashboardController = new DashboardController();
