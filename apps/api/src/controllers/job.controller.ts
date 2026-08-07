import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { jobService } from '../services/job.service';
import { sendSuccess, sendCreated } from '../utils/response';

export class JobController {
  async getJobs(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      // Assuming req.user is populated by authenticate middleware
      const companyId = req.user!.companyId;
      const jobs = await jobService.getJobs(companyId);
      return sendSuccess(res, jobs, 'Jobs retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async createJob(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const job = await jobService.createJob(companyId, req.body);
      return sendCreated(res, job, 'Job created successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const jobController = new JobController();
