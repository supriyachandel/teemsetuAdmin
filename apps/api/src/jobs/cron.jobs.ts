import cron from 'node-cron';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { notificationFallbackService } from '../services/notification-fallback.service';

/** Scheduled maintenance jobs */
export function startCronJobs(): void {
  // Clean expired refresh tokens daily at 2 AM
  cron.schedule('0 2 * * *', async () => {
    const result = await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { revokedAt: { not: null } },
        ],
      },
    });
    logger.info(`Cleaned ${result.count} expired refresh tokens`);
  });

  // Mark absent employees (placeholder for Phase 2)
  cron.schedule('0 23 * * *', () => {
    logger.debug('Attendance cron placeholder — Phase 2');
  });

  // Run background notification jobs every minute
  cron.schedule('* * * * *', async () => {
    try {
      await notificationFallbackService.processBackgroundJobs();
    } catch (err) {
      logger.error('Failed to run background notification fallback jobs', err);
    }
  });

  logger.info('Cron jobs started');
}
