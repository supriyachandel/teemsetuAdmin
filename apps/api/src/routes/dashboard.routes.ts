import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/stats', (req, res, next) =>
  dashboardController.getStats(req, res).catch(next)
);

router.get('/search', (req, res, next) =>
  dashboardController.search(req, res).catch(next)
);

export default router;
