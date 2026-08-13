import { Router } from 'express';
import { attendanceController } from '../controllers/attendance.controller';
import { attendanceRequestController } from '../controllers/attendance-request.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAnyPermission } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { PERMISSIONS } from '@crm/shared';
import {
  listAttendanceSchema,
  checkInSchema,
  checkOutSchema,
} from '../validators/attendance.validator';

const router = Router();

router.use(authenticate);

router.post(
  '/check-in',
  requireAnyPermission(PERMISSIONS.ATTENDANCE_WRITE),
  validate(checkInSchema),
  (req, res, next) => attendanceController.checkIn(req, res).catch(next)
);

router.post(
  '/check-out',
  requireAnyPermission(PERMISSIONS.ATTENDANCE_WRITE),
  validate(checkOutSchema),
  (req, res, next) => attendanceController.checkOut(req, res).catch(next)
);

router.get(
  '/today',
  requireAnyPermission(PERMISSIONS.ATTENDANCE_READ, PERMISSIONS.ATTENDANCE_WRITE),
  (req, res, next) => attendanceController.today(req, res).catch(next)
);

router.get(
  '/',
  requireAnyPermission(PERMISSIONS.ATTENDANCE_READ, PERMISSIONS.ATTENDANCE_WRITE),
  validate(listAttendanceSchema, 'query'),
  (req, res, next) => attendanceController.list(req, res).catch(next)
);

// Attendance Request routes
router.post(
  '/requests',
  requireAnyPermission(PERMISSIONS.ATTENDANCE_WRITE),
  (req, res, next) => attendanceRequestController.createRequest(req, res).catch(next)
);

router.get(
  '/requests',
  requireAnyPermission(PERMISSIONS.ATTENDANCE_READ, PERMISSIONS.ATTENDANCE_WRITE),
  (req, res, next) => attendanceRequestController.list(req, res).catch(next)
);

router.patch(
  '/requests/:id/approve',
  requireAnyPermission(PERMISSIONS.ATTENDANCE_APPROVE),
  (req, res, next) => attendanceRequestController.approveRequest(req, res).catch(next)
);

router.patch(
  '/requests/:id/reject',
  requireAnyPermission(PERMISSIONS.ATTENDANCE_APPROVE),
  (req, res, next) => attendanceRequestController.rejectRequest(req, res).catch(next)
);

router.get(
  '/requests/count',
  requireAnyPermission(PERMISSIONS.ATTENDANCE_READ, PERMISSIONS.ATTENDANCE_WRITE),
  (req, res, next) => attendanceRequestController.getMonthlyCount(req, res).catch(next)
);

export default router;
