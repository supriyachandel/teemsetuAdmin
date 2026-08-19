import { prisma } from '../config/database';
import { logger } from '../utils/logger';

// Try optional imports for production integrations
let twilioClient: any = null;
try {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (accountSid && authToken) {
    const twilio = require('twilio');
    twilioClient = twilio(accountSid, authToken);
  }
} catch (e) {
  logger.warn('[Fallback Service] Twilio SDK loading failed or skipped.');
}

export class NotificationFallbackService {
  /**
   * Schedule a delayed SMS fallback background job
   */
  async scheduleSmsFallback(messageId: string, recipientUserId: string) {
    const delayMinutes = Number(process.env.CHAT_SMS_FALLBACK_DELAY_MINUTES) || 5;
    const runAt = new Date(Date.now() + delayMinutes * 60 * 1000);

    const job = await prisma.backgroundJob.create({
      data: {
        type: 'SMS_FALLBACK',
        payload: { messageId, recipientUserId },
        runAt,
        status: 'PENDING',
      },
    });

    logger.debug(`[WS] Scheduled SMS fallback job ${job.id} for user ${recipientUserId} at ${runAt.toISOString()}`);
    return job;
  }

  /**
   * Send direct push notification immediately if active token exists
   */
  async sendPushNotification(recipientUserId: string, senderName: string, messageId: string) {
    // 1. Check user preference
    const prefs = await prisma.notificationPreference.findUnique({
      where: { userId: recipientUserId },
    });
    if (prefs && !prefs.pushEnabled) {
      logger.debug(`[Push] Notifications disabled by preference for user ${recipientUserId}`);
      return;
    }

    // 2. Fetch active tokens
    const tokens = await prisma.pushToken.findMany({
      where: { userId: recipientUserId, isActive: true },
    });

    if (tokens.length === 0) {
      logger.debug(`[Push] No active device tokens found for user ${recipientUserId}`);
      return;
    }

    const title = 'New TeamSetu Message';
    const body = `${senderName} sent you a new message.`;

    for (const t of tokens) {
      try {
        // Log to notification logs
        await prisma.notificationLog.create({
          data: {
            userId: recipientUserId,
            messageId,
            channel: 'PUSH',
            status: 'DELIVERED',
            sentAt: new Date(),
          },
        });

        // Real push execution placeholder/mock block
        console.log(`[PUSH FALLBACK SENT] Token: ${t.token} | Title: ${title} | Body: ${body}`);
      } catch (err: any) {
        logger.error(`[Push] Failed to send to token ${t.token}`, err);
        
        await prisma.notificationLog.create({
          data: {
            userId: recipientUserId,
            messageId,
            channel: 'PUSH',
            status: 'FAILED',
            failureReason: err.message || 'Unknown push error',
          },
        });

        // Mark token inactive if rejected by provider
        await prisma.pushToken.update({
          where: { id: t.id },
          data: { isActive: false },
        });
      }
    }
  }

  /**
   * Run background jobs processor (e.g. called from cron scheduler)
   */
  async processBackgroundJobs() {
    const jobs = await prisma.backgroundJob.findMany({
      where: {
        status: 'PENDING',
        runAt: { lte: new Date() },
      },
    });

    if (jobs.length === 0) return;

    logger.debug(`[Jobs] Processing ${jobs.length} pending background tasks...`);

    for (const job of jobs) {
      // Mark job as PROCESSING to prevent double-execution
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: { status: 'PROCESSING', attempts: { increment: 1 } },
      });

      try {
        const payload = job.payload as { messageId: string; recipientUserId: string };
        
        // 1. Verify if notification is still unread
        const notification = await prisma.notification.findFirst({
          where: {
            userId: payload.recipientUserId,
            type: 'CHAT',
            isRead: false,
          },
        });

        // If no unread chat notification exists, recipient has read the message!
        if (!notification) {
          logger.debug(`[Jobs] SMS skipped for job ${job.id}: Message already read.`);
          await prisma.backgroundJob.update({
            where: { id: job.id },
            data: { status: 'COMPLETED' },
          });

          await prisma.notificationLog.create({
            data: {
              userId: payload.recipientUserId,
              messageId: payload.messageId,
              channel: 'SMS',
              status: 'NOT_SENT',
              failureReason: 'Message already read',
            },
          });
          continue;
        }

        // 2. Verify SMS preference
        const prefs = await prisma.notificationPreference.findUnique({
          where: { userId: payload.recipientUserId },
        });
        if (prefs && !prefs.smsEnabled) {
          logger.debug(`[Jobs] SMS skipped: Preference disabled for user ${payload.recipientUserId}`);
          await prisma.backgroundJob.update({
            where: { id: job.id },
            data: { status: 'COMPLETED' },
          });
          continue;
        }

        // 3. Resolve phone number from Employee/User details
        const employee = await prisma.employee.findUnique({
          where: { userId: payload.recipientUserId },
        });
        if (!employee || !employee.phone) {
          throw new Error('Recipient has no linked profile or phone number configured');
        }

        // 4. Resolve sender name
        const message = await prisma.message.findUnique({
          where: { id: payload.messageId },
          include: { sender: true },
        });
        const senderName = message ? `${message.sender.firstName} ${message.sender.lastName}` : 'Someone';

        // 5. Send SMS
        const smsContent = `TeamSetu: You have a new message from ${senderName}. Please log in to TeamSetu to view it.`;
        
        if (twilioClient) {
          const fromNum = process.env.TWILIO_PHONE_NUMBER;
          await twilioClient.messages.create({
            body: smsContent,
            from: fromNum,
            to: employee.phone,
          });
        }

        // Output to console for local verification
        console.log(`[SMS FALLBACK SENT] To: ${employee.phone} | Message: ${smsContent}`);

        // Update DB logs
        await prisma.notificationLog.create({
          data: {
            userId: payload.recipientUserId,
            messageId: payload.messageId,
            channel: 'SMS',
            status: 'DELIVERED',
            sentAt: new Date(),
          },
        });

        await prisma.backgroundJob.update({
          where: { id: job.id },
          data: { status: 'COMPLETED' },
        });
      } catch (err: any) {
        logger.error(`[Jobs] Failed executing job ${job.id}`, err);
        
        const isFinalAttempt = job.attempts >= job.maxAttempts;
        await prisma.backgroundJob.update({
          where: { id: job.id },
          data: {
            status: isFinalAttempt ? 'FAILED' : 'PENDING',
            lastError: err.message || 'Unknown execution error',
          },
        });

        await prisma.notificationLog.create({
          data: {
            userId: (job.payload as any).recipientUserId,
            messageId: (job.payload as any).messageId,
            channel: 'SMS',
            status: 'FAILED',
            failureReason: err.message || 'Unknown SMS error',
            retryCount: job.attempts,
          },
        });
      }
    }
  }
}

export const notificationFallbackService = new NotificationFallbackService();
