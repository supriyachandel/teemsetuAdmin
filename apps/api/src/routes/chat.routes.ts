import { Router } from 'express';
import { PERMISSIONS } from '@crm/shared';
import { authenticate } from '../middleware/auth.middleware';
import { requireAnyPermission } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { chatController } from '../controllers/chat.controller';
import {
  sendMessageSchema,
  editMessageSchema,
  addMembersSchema,
} from '../validators/chat.validator';

const router = Router();

// All chat routes require authentication and CHAT_USE permission
router.use(authenticate);
router.use(requireAnyPermission(PERMISSIONS.CHAT_USE));

/**
 * GET /api/v1/chat/rooms
 * List user's chat rooms
 */
router.get('/rooms', (req, res, next) => chatController.getChatRooms(req, res).catch(next));

/**
 * GET /api/v1/chat/rooms/:roomId
 * Get room details
 */
router.get('/rooms/:roomId', (req, res, next) => chatController.getRoomDetails(req, res).catch(next));

/**
 * GET /api/v1/chat/rooms/:roomId/messages
 * Get message history for room (paginated)
 */
router.get('/rooms/:roomId/messages', (req, res, next) => chatController.getMessages(req, res).catch(next));

/**
 * POST /api/v1/chat/rooms/:roomId/messages
 * Send message to room
 */
router.post(
  '/rooms/:roomId/messages',
  validate(sendMessageSchema),
  (req, res, next) => chatController.sendMessage(req, res).catch(next)
);

/**
 * PUT /api/v1/chat/messages/:messageId
 * Edit message
 */
router.put(
  '/messages/:messageId',
  validate(editMessageSchema),
  (req, res, next) => chatController.editMessage(req, res).catch(next)
);

/**
 * DELETE /api/v1/chat/messages/:messageId
 * Delete message
 */
router.delete('/messages/:messageId', (req, res, next) => chatController.deleteMessage(req, res).catch(next));

/**
 * POST /api/v1/chat/direct/:userId
 * Get or create direct chat room with another user
 */
router.post('/direct/:userId', (req, res, next) => chatController.getOrCreateDirectRoom(req, res).catch(next));

/**
 * POST /api/v1/chat/project/:projectId
 * Get or create chat room for a project
 */
router.post('/project/:projectId', (req, res, next) => chatController.getOrCreateProjectRoom(req, res).catch(next));

/**
 * POST /api/v1/chat/rooms/:roomId/members
 * Add members to room
 */
router.post(
  '/rooms/:roomId/members',
  validate(addMembersSchema),
  (req, res, next) => chatController.addMembers(req, res).catch(next)
);

/**
 * DELETE /api/v1/chat/rooms/:roomId/members/:userId
 * Remove member from room
 */
router.delete('/rooms/:roomId/members/:userId', (req, res, next) => chatController.removeMember(req, res).catch(next));

/**
 * POST /api/v1/chat/rooms/:roomId/read
 * Mark chat notifications for a room as read
 */
router.post('/rooms/:roomId/read', (req, res, next) => chatController.markRoomAsRead(req, res).catch(next));

/**
 * POST /api/v1/chat/push-tokens
 * Register browser push notification token
 */
router.post('/push-tokens', (req, res, next) => chatController.registerPushToken(req, res).catch(next));

export default router;
