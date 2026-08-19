import { Router } from 'express';
import { PERMISSIONS } from '@crm/shared';
import { authenticate } from '../middleware/auth.middleware';
import { requireAnyPermission } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { payrollController } from '../controllers/payroll.controller';
import {
  listPayrollSchema,
  upsertSalaryStructureSchema,
  createSalaryTemplateSchema,
  generatePayrollSchema,
  updatePayrollStatusSchema,
} from '../validators/payroll.validator';

const router = Router();
router.use(authenticate);

router.get(
  '/',
  validate(listPayrollSchema, 'query'),
  (req, res, next) => payrollController.list(req, res).catch(next)
);

router.get(
  '/salary-structures',
  requireAnyPermission(PERMISSIONS.PAYROLL_READ),
  (req, res, next) => payrollController.listSalaryStructures(req, res).catch(next)
);

router.get(
  '/salary-structures/me',
  (req, res, next) => payrollController.mySalaryStructure(req, res).catch(next)
);

router.post(
  '/salary-structures',
  requireAnyPermission(PERMISSIONS.PAYROLL_WRITE),
  validate(upsertSalaryStructureSchema),
  (req, res, next) => payrollController.upsertSalaryStructure(req, res).catch(next)
);

router.post(
  '/salary-structures/templates',
  requireAnyPermission(PERMISSIONS.PAYROLL_WRITE),
  validate(createSalaryTemplateSchema),
  (req, res, next) => payrollController.createSalaryStructureTemplate(req, res).catch(next)
);

router.put(
  '/salary-structures/templates/:id',
  requireAnyPermission(PERMISSIONS.PAYROLL_WRITE),
  validate(createSalaryTemplateSchema),
  (req, res, next) => payrollController.updateSalaryStructureTemplate(req, res).catch(next)
);

router.delete(
  '/salary-structures/templates/:id',
  requireAnyPermission(PERMISSIONS.PAYROLL_WRITE),
  (req, res, next) => payrollController.deleteSalaryStructureTemplate(req, res).catch(next)
);

router.get(
  '/employee-salary/:employeeId',
  requireAnyPermission(PERMISSIONS.PAYROLL_READ),
  (req, res, next) => payrollController.getEmployeeSalary(req, res).catch(next)
);

router.post(
  '/generate',
  requireAnyPermission(PERMISSIONS.PAYROLL_WRITE),
  validate(generatePayrollSchema),
  (req, res, next) => payrollController.generate(req, res).catch(next)
);

router.patch(
  '/:id/status',
  requireAnyPermission(PERMISSIONS.PAYROLL_WRITE),
  validate(updatePayrollStatusSchema),
  (req, res, next) => payrollController.updateStatus(req, res).catch(next)
);

router.get(
  '/stats',
  requireAnyPermission(PERMISSIONS.PAYROLL_READ),
  (req, res, next) => payrollController.stats(req, res).catch(next)
);

router.get(
  '/:id/payslip',
  (req, res, next) => payrollController.downloadPayslip(req, res).catch(next)
);

export default router;
