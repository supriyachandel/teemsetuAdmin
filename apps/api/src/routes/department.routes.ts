import { Router } from 'express';
import { departmentController } from '../controllers/department.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', (req, res, next) =>
  departmentController.list(req, res).catch(next)
);

export default router;
