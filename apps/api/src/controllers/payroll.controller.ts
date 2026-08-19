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

  async createSalaryStructureTemplate(req: AuthenticatedRequest, res: Response) {
    const data = await payrollService.createSalaryStructureTemplate(req.user!, req.body);
    return sendCreated(res, data, 'Salary structure template created');
  }

  async updateSalaryStructureTemplate(req: AuthenticatedRequest, res: Response) {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await payrollService.updateSalaryStructureTemplate(req.user!, id, req.body);
    return sendSuccess(res, data, 'Salary structure template updated');
  }

  async deleteSalaryStructureTemplate(req: AuthenticatedRequest, res: Response) {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await payrollService.deleteSalaryStructureTemplate(req.user!, id);
    return sendSuccess(res, data, 'Salary structure template deleted');
  }

  async getEmployeeSalary(req: AuthenticatedRequest, res: Response) {
    const employeeId = Array.isArray(req.params.employeeId) ? req.params.employeeId[0] : req.params.employeeId;
    const data = await payrollService.getEmployeeSalary(req.user!, employeeId);
    return sendSuccess(res, data);
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

  async stats(req: AuthenticatedRequest, res: Response) {
    const { month, year, employeeId, startDate, endDate } = req.query as any;
    const parsedQuery = {
      ...(month && { month: Number(month) }),
      ...(year && { year: Number(year) }),
      ...(employeeId && { employeeId }),
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
    };
    const data = await payrollService.getStats(req.user!, parsedQuery);
    return sendSuccess(res, data);
  }
}

export const payrollController = new PayrollController();
