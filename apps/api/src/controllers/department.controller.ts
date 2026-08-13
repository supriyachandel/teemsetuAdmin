import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../config/database';
import { sendSuccess } from '../utils/response';

export class DepartmentController {
  async list(req: AuthenticatedRequest, res: Response) {
    const { companyId } = req.user!;
    const departments = await prisma.department.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
    return sendSuccess(res, { departments, total: departments.length });
  }
}

export const departmentController = new DepartmentController();
