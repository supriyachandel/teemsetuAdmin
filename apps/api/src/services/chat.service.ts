import { prisma } from '../config/database';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';
import { notificationFallbackService } from './notification-fallback.service';

/**
 * Chat Service - handles chat rooms, messages, and real-time communication
 */
export class ChatService {
  /**
   * Get or create a direct chat room between two users
   */
  async getOrCreateDirectRoom(userId: string, otherUserId: string) {
    if (userId === otherUserId) {
      throw new Error('Cannot create direct chat with yourself');
    }

    // Look for existing direct room containing both users
    let room = await prisma.chatRoom.findFirst({
      where: {
        isDirect: true,
        AND: [
          { members: { some: { userId: userId } } },
          { members: { some: { userId: otherUserId } } },
        ],
      },
      include: {
        members: {
          select: {
            user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            content: true,
            createdAt: true,
            sender: { select: { firstName: true, lastName: true } },
          },
        },
        project: { select: { name: true } },
        _count: { select: { messages: true } },
      },
    });

    // Create new direct room if it doesn't exist
    if (!room) {
      room = await prisma.chatRoom.create({
        data: {
          isDirect: true,
          companyId: (await this.getCompanyIdForUser(userId))!,
          members: {
            create: [
              { userId },
              { userId: otherUserId },
            ],
          },
        },
        include: {
          members: {
            select: {
              user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
            },
          },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              content: true,
              createdAt: true,
              sender: { select: { firstName: true, lastName: true } },
            },
          },
          project: { select: { name: true } },
          _count: { select: { messages: true } },
        },
      });
    }

    return room;
  }

  /**
   * Get or create a project chat room
   */
  async getOrCreateProjectRoom(
    projectId: string,
    user: NonNullable<AuthenticatedRequest['user']>
  ) {
    // Verify user is a project member
    const membership = await prisma.projectMember.findFirst({
      where: {
        projectId,
        employee: { companyId: user.companyId },
      },
    });

    if (!membership) {
      throw new ForbiddenError('Not a member of this project');
    }

    let room = await prisma.chatRoom.findFirst({
      where: {
        projectId,
        isDirect: false,
      },
      include: { members: true, _count: { select: { messages: true } } },
    });

    if (!room) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        throw new NotFoundError('Project not found');
      }

      room = await prisma.chatRoom.create({
        data: {
          projectId,
          companyId: user.companyId,
          name: `${project.name} Chat`,
          isDirect: false,
          members: {
            create: (
              await prisma.projectMember.findMany({
                where: { projectId },
                include: { employee: { select: { userId: true } } },
              })
            ).map((member) => ({ userId: member.employee.userId })),
          },
        },
        include: { members: true, _count: { select: { messages: true } } },
      });
    }

    return room;
  }

  /**
   * Get chat rooms for a user
   */
  async getChatRooms(
    user: NonNullable<AuthenticatedRequest['user']>,
    options?: { limit?: number; offset?: number }
  ) {
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;

    const rooms = await prisma.chatRoom.findMany({
      where: {
        companyId: user.companyId,
        members: {
          some: { userId: user.id },
        },
      },
      include: {
        members: {
          select: {
            user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            content: true,
            createdAt: true,
            sender: { select: { firstName: true, lastName: true } },
          },
        },
        project: { select: { name: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    });

    const total = await prisma.chatRoom.count({
      where: {
        companyId: user.companyId,
        members: {
          some: { userId: user.id },
        },
      },
    });

    return { rooms, total, limit, offset };
  }

  /**
   * Get messages in a room
   */
  async getMessages(
    roomId: string,
    user: NonNullable<AuthenticatedRequest['user']>,
    options?: { limit?: number; offset?: number }
  ) {
    // Verify user is member of the room
    const membership = await prisma.chatMember.findFirst({
      where: { roomId, userId: user.id },
    });

    if (!membership) {
      throw new ForbiddenError('Not a member of this chat room');
    }

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const messages = await prisma.message.findMany({
      where: { roomId },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    });

    const total = await prisma.message.count({ where: { roomId } });

    return {
      messages: messages.reverse(), // Return in chronological order
      total,
      limit,
      offset,
    };
  }

  /**
   * Send a message
   */
  async sendMessage(
    roomId: string,
    senderId: string,
    content: string,
    mentions?: string[],
    fileUrl?: string
  ) {
    // Verify sender is member of room
    const membership = await prisma.chatMember.findFirst({
      where: { roomId, userId: senderId },
    });

    if (!membership) {
      throw new ForbiddenError('Not a member of this chat room');
    }

    const message = await prisma.message.create({
      data: {
        roomId,
        senderId,
        content,
        mentions: mentions || [],
        fileUrl,
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Update room's updatedAt by touching one of its relations
    logger.debug(`Message sent in room ${roomId} by user ${senderId}`);

    // Trigger notification fallback pipeline asynchronously (do not block client request)
    (async () => {
      try {
        const senderName = `${message.sender.firstName} ${message.sender.lastName}`;
        const members = await prisma.chatMember.findMany({
          where: { roomId, userId: { not: senderId } },
          include: { user: { include: { userPresence: true } } },
        });

        for (const m of members) {
          // 1. Create a CHAT Notification record in database
          await prisma.notification.create({
            data: {
              userId: m.userId,
              type: 'CHAT',
              title: `New message from ${senderName}`,
              message: content.length > 50 ? `${content.slice(0, 50)}...` : content,
              data: { roomId, messageId: message.id },
              isRead: false,
            },
          });

          // 2. Fetch recipient presence details
          const presence = m.user.userPresence;
          const isOnline = presence?.connectionStatus === 'ONLINE';

          if (!isOnline) {
            // Recipient is OFFLINE: Send push immediately and schedule delayed SMS fallback
            await notificationFallbackService.sendPushNotification(m.userId, senderName, message.id);
            await notificationFallbackService.scheduleSmsFallback(message.id, m.userId);
          } else {
            // Recipient is ONLINE: Send push notification immediately
            await notificationFallbackService.sendPushNotification(m.userId, senderName, message.id);
          }
        }
      } catch (err) {
        logger.error(`[WS] Error in chat notification pipeline`, err);
      }
    })();

    return message;
  }

  /**
   * Edit a message
   */
  async editMessage(
    messageId: string,
    senderId: string,
    newContent: string
  ) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundError('Message not found');
    }

    if (message.senderId !== senderId) {
      throw new ForbiddenError('You can only edit your own messages');
    }

    return prisma.message.update({
      where: { id: messageId },
      data: { content: newContent },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  /**
   * Delete a message
   */
  async deleteMessage(
    messageId: string,
    userId: string
  ) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundError('Message not found');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenError('You can only delete your own messages');
    }

    return prisma.message.delete({
      where: { id: messageId },
    });
  }

  /**
   * Add members to a chat room
   */
  async addMembers(
    roomId: string,
    userIds: string[],
    user: NonNullable<AuthenticatedRequest['user']>
  ) {
    // Verify user is admin/owner of room - for now just check membership
    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: { members: true },
    });

    if (!room) {
      throw new NotFoundError('Chat room not found');
    }

    const isAdmin = room.members.some((m) => m.userId === user.id);
    if (!isAdmin) {
      throw new ForbiddenError('Only room members can add new members');
    }

    // Add new members
    const newMembers = await Promise.all(
      userIds.map((userId) =>
        prisma.chatMember.create({
          data: { roomId, userId },
        }).catch(() => null) // Silently fail if already member
      )
    );

    logger.debug(`Added ${newMembers.length} members to room ${roomId}`);

    return prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: {
        members: {
          select: {
            user: {
              select: { id: true, firstName: true, lastName: true, avatarUrl: true },
            },
          },
        },
      },
    });
  }

  /**
   * Remove member from chat room
   */
  async removeMember(
    roomId: string,
    userId: string,
    requester: NonNullable<AuthenticatedRequest['user']>
  ) {
    // User can remove themselves or admin can remove others
    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: { members: true },
    });

    if (!room) {
      throw new NotFoundError('Chat room not found');
    }

    const isAdmin = room.members.some((m) => m.userId === requester.id);
    const isSelf = userId === requester.id;

    if (!isAdmin && !isSelf) {
      throw new ForbiddenError('You can only remove yourself or be an admin');
    }

    await prisma.chatMember.delete({
      where: {
        roomId_userId: { roomId, userId },
      },
    });

    return { success: true };
  }

  /**
   * Get room details
   */
  async getRoomDetails(
    roomId: string,
    user: NonNullable<AuthenticatedRequest['user']>
  ) {
    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: {
        members: {
          select: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
        },
        project: { select: { id: true, name: true } },
        _count: { select: { messages: true } },
      },
    });

    if (!room) {
      throw new NotFoundError('Chat room not found');
    }

    // Verify user is member
    const isMember = room.members.some((m) => m.user.id === user.id);
    if (!isMember) {
      throw new ForbiddenError('Not a member of this chat room');
    }

    return room;
  }

  /**
   * Helper to get company ID for a user
   */
  private async getCompanyIdForUser(userId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { employee: { select: { companyId: true } } },
    });
    return user?.employee?.companyId || null;
  }
}

export const chatService = new ChatService();
