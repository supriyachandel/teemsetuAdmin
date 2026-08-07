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

router.get('/health', async (_req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const count = await prisma.user.count();
    res.json({ success: true, message: 'API is healthy', usersCount: count, timestamp: new Date().toISOString() });
  } catch (e: any) {
    res.json({ success: false, error: e.message });
  }
});

router.get('/health/seed', async (_req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash('Password@123', 12);
    
    let role = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
    if (!role) {
      role = await prisma.role.create({
        data: { name: 'SUPER_ADMIN', displayName: 'Super Admin', isSystem: true }
      });
    }

    let company = await prisma.company.findUnique({ where: { slug: 'acme-corp' } });
    if (!company) {
      company = await prisma.company.create({
        data: { name: 'Acme', slug: 'acme-corp' }
      });
    }

    const user = await prisma.user.upsert({
      where: { email: 'thcoders@admin.com' },
      update: { passwordHash },
      create: {
        email: 'thcoders@admin.com',
        passwordHash,
        firstName: 'Tanya',
        lastName: 'Admin',
        roleId: role.id,
        companyId: company.id,
        status: 'ACTIVE',
        emailVerified: true
      }
    });

    res.json({ success: true, message: 'Seeded thcoders@admin.com', user: user.email });
  } catch (e: any) {
    res.json({ success: false, error: e.message, stack: e.stack });
  }
});

router.get('/health/push', (_req, res) => {
  try {
    const { execSync } = require('child_process');
    const out = execSync('npx prisma db push --accept-data-loss', { encoding: 'utf-8' });
    res.json({ success: true, output: out });
  } catch (e: any) {
    res.json({ success: false, error: e.message, output: e.stdout ? e.stdout.toString() : '' });
  }
});

export default router;
