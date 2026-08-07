import { Router } from 'express';
import { platformController } from '../controllers/platform.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRoles } from '../middleware/rbac.middleware';
import { ROLES, PERMISSIONS } from '@crm/shared';

const router = Router();

// Protect all platform routes to SYSTEM_ADMIN
router.use(authenticate);
router.use(requireRoles(ROLES.SYSTEM_ADMIN));

router.get('/stats', platformController.getDashboardStats.bind(platformController));
router.get('/companies', platformController.getCompanies.bind(platformController));

export const platformRoutes = router;
