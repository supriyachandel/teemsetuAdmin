import { Response } from 'express';
import { chatService } from '../services/chat.service';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendPaginated } from '../utils/response';
import { getIO } from '../websocket/socket.handler';
import { prisma } from '../config/database';

/**
 * Helper to emit WebSocket events to all members of a chat room
 */
async function emitToRoomMembers(roomId: string, eventName: string, payload: any) {
  try {
    const io = getIO();
    if (!io) return;

    // Emit to the specific chat room channel for active participants
    io.to(`chat:${roomId}`).emit(eventName, payload);

    // Also emit to individual user channels for background notifications (e.g. unread badges)
    const members = await prisma.chatMember.findMany({
      where: { roomId },
      select: { userId: true },
    });

    members.forEach((member) => {
      io.to(`user:${member.userId}`).emit(eventName, payload);
    });
  } catch (error) {
    // Gracefully handle any web socket emission failures
  }
}

export class ChatController {
  async getOrCreateDirectRoom(req: AuthenticatedRequest, res: Response) {
    const userId = req.params.userId as string;
    const room = await chatService.getOrCreateDirectRoom(req.user!.id, userId);
    return sendSuccess(res, room);
  }

  async getOrCreateProjectRoom(req: AuthenticatedRequest, res: Response) {
    const projectId = req.params.projectId as string;
    const room = await chatService.getOrCreateProjectRoom(projectId, req.user!);
    return sendSuccess(res, room);
  }

  async getChatRooms(req: AuthenticatedRequest, res: Response) {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const result = await chatService.getChatRooms(req.user!, { limit, offset });
    
    const pagination = {
      page,
      limit,
      total: result.total,
      totalPages: Math.ceil(result.total / limit),
    };

    return sendPaginated(res, result.rooms, pagination);
  }

  async getMessages(req: AuthenticatedRequest, res: Response) {
    const roomId = req.params.roomId as string;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const result = await chatService.getMessages(roomId, req.user!, { limit, offset });

    const pagination = {
      page,
      limit,
      total: result.total,
      totalPages: Math.ceil(result.total / limit),
    };

    return sendPaginated(res, result.messages, pagination);
  }

  async sendMessage(req: AuthenticatedRequest, res: Response) {
    const roomId = req.params.roomId as string;
    const { content, mentions, fileUrl } = req.body;

    const message = await chatService.sendMessage(
      roomId,
      req.user!.id,
      content,
      mentions,
      fileUrl
    );

    // Broadcast to room members in real-time
    await emitToRoomMembers(roomId, 'message:new', message);

    return sendSuccess(res, message);
  }

  async editMessage(req: AuthenticatedRequest, res: Response) {
    const messageId = req.params.messageId as string;
    const { content } = req.body;

    const message = await chatService.editMessage(messageId, req.user!.id, content);

    // Broadcast update to room members in real-time
    await emitToRoomMembers(message.roomId, 'message:updated', message);

    return sendSuccess(res, message);
  }

  async deleteMessage(req: AuthenticatedRequest, res: Response) {
    const messageId = req.params.messageId as string;

    const message = await chatService.deleteMessage(messageId, req.user!.id);

    // Broadcast deletion to room members in real-time
    await emitToRoomMembers(message.roomId, 'message:deleted', { messageId, roomId: message.roomId });

    return sendSuccess(res, { success: true });
  }

  async addMembers(req: AuthenticatedRequest, res: Response) {
    const roomId = req.params.roomId as string;
    const { userIds } = req.body;

    const room = await chatService.addMembers(roomId, userIds, req.user!);

    // Broadcast room updates (membership changes) to room members
    await emitToRoomMembers(roomId, 'room:members_added', room);

    return sendSuccess(res, room);
  }

  async removeMember(req: AuthenticatedRequest, res: Response) {
    const roomId = req.params.roomId as string;
    const userId = req.params.userId as string;

    await chatService.removeMember(roomId, userId, req.user!);

    // Broadcast member removal to room members
    await emitToRoomMembers(roomId, 'room:member_removed', { roomId, userId });

    return sendSuccess(res, { success: true });
  }

  async getRoomDetails(req: AuthenticatedRequest, res: Response) {
    const roomId = req.params.roomId as string;
    const room = await chatService.getRoomDetails(roomId, req.user!);
    return sendSuccess(res, room);
  }

  async markRoomAsRead(req: AuthenticatedRequest, res: Response) {
    const roomId = req.params.roomId as string;
    const userId = req.user!.id;

    // Fetch and mark notifications of type CHAT for this user and room as read
    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        type: 'CHAT',
        isRead: false,
      }
    });

    // Filter by data.roomId matching
    const matchingNotificationIds: string[] = [];
    for (const n of notifications) {
      const dataObj = n.data as any;
      if (dataObj && dataObj.roomId === roomId) {
        matchingNotificationIds.push(n.id);
      }
    }

    if (matchingNotificationIds.length > 0) {
      await prisma.notification.updateMany({
        where: { id: { in: matchingNotificationIds } },
        data: { isRead: true, readAt: new Date() }
      });
    }

    return sendSuccess(res, { success: true, count: matchingNotificationIds.length });
  }

  async registerPushToken(req: AuthenticatedRequest, res: Response) {
    const { token, deviceType } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, error: 'Token is required' });
    }

    const pushToken = await prisma.pushToken.upsert({
      where: { token },
      update: { userId: req.user!.id, deviceType: deviceType || 'BROWSER', isActive: true },
      create: { userId: req.user!.id, deviceType: deviceType || 'BROWSER', token, isActive: true }
    });

    return sendSuccess(res, pushToken);
  }
}

export const chatController = new ChatController();
