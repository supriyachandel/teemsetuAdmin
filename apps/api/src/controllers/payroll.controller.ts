import { Response } from 'express';
import { sendCreated, sendSuccess } from '../utils/response';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { payrollService } from '../services/payroll.service';
import { payslipService } from '../services/payslip.service';
import { ForbiddenError, NotFoundError } from '../utils/errors';

export class PayrollController {
  async list(req: AuthenticatedRequest, res: Response) {
    const result = await payrollService.list(req.user!, req.query as never);
    return res.json({
      success: true,
      data: result.items,
      meta: result.meta,
      currency: result.currency,
    });
  }

  async listSalaryStructures(req: AuthenticatedRequest, res: Response) {
    const data = await payrollService.listSalaryStructures(req.user!);
    return sendSuccess(res, data);
  }

  async mySalaryStructure(req: AuthenticatedRequest, res: Response) {
    const data = await payrollService.mySalaryStructure(req.user!);
    return sendSuccess(res, data);
  }

  async upsertSalaryStructure(req: AuthenticatedRequest, res: Response) {
    const data = await payrollService.upsertSalaryStructure(req.user!, req.body);
    return sendCreated(res, data, 'Salary structure saved');
  }

  async generate(req: AuthenticatedRequest, res: Response) {
    const { month, year } = req.body;
    const data = await payrollService.generate(req.user!, month, year);
    return sendCreated(res, data, `Payroll generated for ${month}/${year}`);
  }

  async updateStatus(req: AuthenticatedRequest, res: Response) {
    const id = req.params.id as string;
    const { status } = req.body;
    const data = await payrollService.updateStatus(req.user!, id, status);
    return sendSuccess(res, data, `Payroll marked as ${status}`);
  }

  async downloadPayslip(req: AuthenticatedRequest, res: Response) {
    const id = req.params.id as string;
    const user = req.user!;

    const payroll = await payrollService.getById(user.companyId, id);
    if (!payroll) throw new NotFoundError('Payroll not found');

    const canViewAll = user.permissions.some(p => ['payroll:read', 'payroll:write', 'payroll:process'].includes(p));
    if (!canViewAll && payroll.employeeId !== user.employeeId) {
      throw new ForbiddenError();
    }

    const pdf = await payslipService.generatePayslip(user.companyId, id);
    const monthName = new Date(payroll.year, payroll.month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const empName = payroll.employee?.user ? `${payroll.employee.user.firstName}_${payroll.employee.user.lastName}` : 'employee';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="payslip_${empName}_${monthName.replace(/\s/g, '_')}.pdf"`);
    res.send(pdf);
  }
}

export const payrollController = new PayrollController();
