import { Request, Response, NextFunction } from 'express';
import { platformService } from '../services/platform.service';
import { sendSuccess } from '../utils/response';

export class PlatformController {
  async getDashboardStats(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await platformService.getDashboardStats();
      return sendSuccess(res, stats, 'Platform stats retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getCompanies(req: Request, res: Response, next: NextFunction) {
    try {
      const companies = await platformService.getCompanies();
      return sendSuccess(res, companies, 'Companies retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const platformController = new PlatformController();
