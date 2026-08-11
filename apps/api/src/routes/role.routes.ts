import { Router } from 'express';
import { roleController } from '../controllers/role.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAnyPermission } from '../middleware/rbac.middleware';
import { ROLES, PERMISSIONS } from '@crm/shared';

const router = Router();

router.use(authenticate);
router.use(requireAnyPermission(PERMISSIONS.EMPLOYEES_WRITE, PERMISSIONS.SETTINGS_MANAGE));

router.get('/', (req, res, next) => roleController.list(req, res).catch(next));
router.get('/permissions', (req, res, next) =>
  roleController.listPermissions(req, res).catch(next)
);
router.get('/:id', (req, res, next) => roleController.getById(req, res).catch(next));

export default router;
