import { Router } from 'express';
import { leaveController } from '../controllers/leave.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAnyPermission } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { PERMISSIONS } from '@crm/shared';
import {
  listLeaveRequestsSchema,
  createLeaveRequestSchema,
  rejectLeaveSchema,
} from '../validators/leave.validator';

const router = Router();

router.use(authenticate);

router.get(
  '/types',
  requireAnyPermission(PERMISSIONS.LEAVES_READ, PERMISSIONS.LEAVES_WRITE),
  (req, res, next) => leaveController.types(req, res).catch(next)
);

router.get(
  '/who-is-away',
  requireAnyPermission(PERMISSIONS.LEAVES_READ, PERMISSIONS.LEAVES_WRITE),
  (req, res, next) => leaveController.whoIsAway(req, res).catch(next)
);

router.get(
  '/balances',
  requireAnyPermission(PERMISSIONS.LEAVES_READ, PERMISSIONS.LEAVES_WRITE),
  (req, res, next) => leaveController.balances(req, res).catch(next)
);

router.get(
  '/requests',
  requireAnyPermission(PERMISSIONS.LEAVES_READ, PERMISSIONS.LEAVES_WRITE),
  validate(listLeaveRequestsSchema, 'query'),
  (req, res, next) => leaveController.list(req, res).catch(next)
);

router.post(
  '/requests',
  requireAnyPermission(PERMISSIONS.LEAVES_WRITE),
  validate(createLeaveRequestSchema),
  (req, res, next) => leaveController.apply(req, res).catch(next)
);

router.post(
  '/requests/:id/approve',
  requireAnyPermission(PERMISSIONS.LEAVES_APPROVE),
  (req, res, next) => leaveController.approve(req, res).catch(next)
);

router.post(
  '/requests/:id/reject',
  requireAnyPermission(PERMISSIONS.LEAVES_APPROVE),
  validate(rejectLeaveSchema),
  (req, res, next) => leaveController.reject(req, res).catch(next)
);

export default router;
