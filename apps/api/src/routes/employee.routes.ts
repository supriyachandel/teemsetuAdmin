import { Router } from 'express';
import { employeeController } from '../controllers/employee.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAnyPermission, requireRoles } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { PERMISSIONS, ROLES } from '@crm/shared';
import {
  listEmployeesSchema,
  createEmployeeSchema,
  updateEmployeeSchema,
  createDepartmentSchema,
  createDesignationSchema,
  updateBirthdaySchema,
} from '../validators/employee.validator';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requireAnyPermission(PERMISSIONS.EMPLOYEES_READ),
  validate(listEmployeesSchema, 'query'),
  (req, res, next) => employeeController.list(req, res).catch(next)
);

router.get(
  '/birthdays',
  (req, res, next) => employeeController.listBirthdays(req, res).catch(next)
);

router.get(
  '/departments',
  requireAnyPermission(PERMISSIONS.EMPLOYEES_READ),
  (req, res, next) => employeeController.listDepartments(req, res).catch(next)
);

router.post(
  '/departments',
  requireAnyPermission(PERMISSIONS.DEPARTMENTS_MANAGE),
  validate(createDepartmentSchema),
  (req, res, next) => employeeController.createDepartment(req, res).catch(next)
);

router.get(
  '/designations',
  requireAnyPermission(PERMISSIONS.EMPLOYEES_READ),
  (req, res, next) => employeeController.listDesignations(req, res).catch(next)
);

router.post(
  '/designations',
  requireAnyPermission(PERMISSIONS.DEPARTMENTS_MANAGE),
  validate(createDesignationSchema),
  (req, res, next) => employeeController.createDesignation(req, res).catch(next)
);

router.post(
  '/',
  requireAnyPermission(PERMISSIONS.EMPLOYEES_WRITE),
  validate(createEmployeeSchema),
  (req, res, next) => employeeController.create(req, res).catch(next)
);

router.get(
  '/:id',
  requireAnyPermission(PERMISSIONS.EMPLOYEES_READ),
  (req, res, next) => employeeController.getById(req, res).catch(next)
);

router.patch(
  '/:id',
  requireAnyPermission(PERMISSIONS.EMPLOYEES_WRITE),
  validate(updateEmployeeSchema),
  (req, res, next) => employeeController.update(req, res).catch(next)
);

router.patch(
  '/:id/birthday',
  requireAnyPermission(PERMISSIONS.EMPLOYEES_WRITE, PERMISSIONS.LEAVES_APPROVE),
  validate(updateBirthdaySchema),
  (req, res, next) => employeeController.updateBirthday(req, res).catch(next)
);

router.delete(
  '/:id',
  requireRoles(ROLES.SUPER_ADMIN),
  (req, res, next) => employeeController.remove(req, res).catch(next)
);

export default router;
