import { getIO } from '../websocket/socket.handler';
import { logger } from '../utils/logger';

export class RealtimeService {
  /**
   * Emit a real-time event directly to a specific user.
   */
  emitToUser(userId: string, event: string, payload: any): void {
    const io = getIO();
    if (io) {
      io.to(`user:${userId}`).emit(event, payload);
      logger.debug(`[WS] Realtime event '${event}' emitted to user:${userId}`);
    } else {
      logger.warn(`[WS] Could not emit event '${event}' to user:${userId} (Socket.IO not initialized)`);
    }
  }

  /**
   * Emit a real-time event to all connected sockets in a company.
   */
  emitToCompany(companyId: string, event: string, payload: any): void {
    const io = getIO();
    if (io) {
      io.to(`company:${companyId}`).emit(event, payload);
      logger.debug(`[WS] Realtime event '${event}' emitted to company:${companyId}`);
    } else {
      logger.warn(`[WS] Could not emit event '${event}' to company:${companyId} (Socket.IO not initialized)`);
    }
  }

  /**
   * Emit a real-time event exclusively to the company's Super Admin room.
   */
  emitToSuperAdmin(companyId: string, event: string, payload: any): void {
    const io = getIO();
    if (io) {
      io.to(`company:${companyId}:super-admin`).emit(event, payload);
      logger.debug(`[WS] Realtime event '${event}' emitted to company:${companyId}:super-admin`);
    } else {
      logger.warn(`[WS] Could not emit event '${event}' to company:${companyId}:super-admin (Socket.IO not initialized)`);
    }
  }

  /**
   * Emit a real-time event exclusively to the company's Admin room (HR/Managers).
   */
  emitToAdmin(companyId: string, event: string, payload: any): void {
    const io = getIO();
    if (io) {
      io.to(`company:${companyId}:admin`).emit(event, payload);
      logger.debug(`[WS] Realtime event '${event}' emitted to company:${companyId}:admin`);
    } else {
      logger.warn(`[WS] Could not emit event '${event}' to company:${companyId}:admin (Socket.IO not initialized)`);
    }
  }

  /**
   * Broadcast a real-time event globally to all connected clients.
   */
  broadcast(event: string, payload: any): void {
    const io = getIO();
    if (io) {
      io.emit(event, payload);
      logger.debug(`[WS] Realtime event '${event}' broadcasted globally`);
    } else {
      logger.warn(`[WS] Could not broadcast event '${event}' (Socket.IO not initialized)`);
    }
  }
}

export const realtimeService = new RealtimeService();
