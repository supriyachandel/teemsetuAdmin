import { Response } from 'express';
import { employeeService } from '../services/employee.service';
import { sendSuccess, sendCreated, sendPaginated } from '../utils/response';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';

export class EmployeeController {
  async list(req: AuthenticatedRequest, res: Response) {
    const result = await employeeService.list(req.user!, req.query as never);
    return sendPaginated(res, result.items, result.meta);
  }

  async listBirthdays(req: AuthenticatedRequest, res: Response) {
    const data = await employeeService.listBirthdays(req.user!.companyId);
    return sendSuccess(res, data);
  }

  async getById(req: AuthenticatedRequest, res: Response) {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await employeeService.getById(req.user!, id);
    return sendSuccess(res, data);
  }

  async create(req: AuthenticatedRequest, res: Response) {
    const data = await employeeService.create(req.user!, req.body);
    return sendCreated(res, data, 'Employee created');
  }

  async update(req: AuthenticatedRequest, res: Response) {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await employeeService.update(req.user!, id, req.body);
    return sendSuccess(res, data, 'Employee updated');
  }

  async updateBirthday(req: AuthenticatedRequest, res: Response) {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await employeeService.update(req.user!, id, { dateOfBirth: req.body.dateOfBirth });
    return sendSuccess(res, data, 'Birthday updated');
  }

  async remove(req: AuthenticatedRequest, res: Response) {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await employeeService.remove(req.user!, id);
    return sendSuccess(res, null, 'Employee removed');
  }

  async listDepartments(req: AuthenticatedRequest, res: Response) {
    const data = await employeeService.listDepartments(req.user!.companyId);
    return sendSuccess(res, data);
  }

  async createDepartment(req: AuthenticatedRequest, res: Response) {
    const data = await employeeService.createDepartment(req.user!, req.body);
    return sendCreated(res, data, 'Department created');
  }

  async listDesignations(req: AuthenticatedRequest, res: Response) {
    const data = await employeeService.listDesignations(req.user!.companyId);
    return sendSuccess(res, data);
  }

  async createDesignation(req: AuthenticatedRequest, res: Response) {
    const data = await employeeService.createDesignation(req.user!, req.body);
    return sendCreated(res, data, 'Designation created');
  }
}

export const employeeController = new EmployeeController();
