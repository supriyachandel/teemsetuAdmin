import { Router } from 'express';
import { jobController } from '../controllers/job.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRoles } from '../middleware/rbac.middleware';
import { ROLES } from '@crm/shared';

const router = Router();

// Protect job routes to HR and SUPER_ADMIN
router.use(authenticate);
router.use(requireRoles(ROLES.SUPER_ADMIN, ROLES.HR));

router.get('/', jobController.getJobs.bind(jobController));
router.post('/', jobController.createJob.bind(jobController));

export default router;
