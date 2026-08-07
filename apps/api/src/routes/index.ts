import { Router } from 'express';
import { platformRoutes } from './platform.routes';
import jobRoutes from './job.routes';
import authRoutes from './auth.routes';
import dashboardRoutes from './dashboard.routes';
import roleRoutes from './role.routes';
import employeeRoutes from './employee.routes';
import attendanceRoutes from './attendance.routes';
import leaveRoutes from './leave.routes';
import projectRoutes from './project.routes';
import taskRoutes from './task.routes';
import payrollRoutes from './payroll.routes';
import reportRoutes from './report.routes';
import notificationRoutes from './notification.routes';
import settingsRoutes from './settings.routes';
import subscriptionRoutes from './subscription.routes';
import chatRoutes from './chat.routes';
import holidayRoutes from './holiday.routes';
import adminUserRoutes from './admin-user.routes';
import auditRoutes from './audit.routes';
import companyRoutes from './company.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/roles', roleRoutes);
router.use('/employees', employeeRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/leaves', leaveRoutes);
router.use('/holidays', holidayRoutes);
router.use('/projects', projectRoutes);
router.use('/tasks', taskRoutes);
router.use('/payroll', payrollRoutes);
router.use('/reports', reportRoutes);
router.use('/notifications', notificationRoutes);
router.use('/settings', settingsRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/chat', chatRoutes);
router.use('/admin/users', adminUserRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/company', companyRoutes);
router.use('/platform', platformRoutes);
router.use('/jobs', jobRoutes);

router.get('/health', (_req, res) => {
  res.json({ success: true, message: 'API is healthy', timestamp: new Date().toISOString() });
});

export default router;
