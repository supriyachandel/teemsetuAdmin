import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { addNotification } from '@/store/slices/notificationSlice';
import { toast } from 'sonner';
import { api } from '@/lib/api';

const WS_URL = import.meta.env.VITE_WS_URL || '';

let socketInstance: Socket | null = null;

export const getSocket = () => socketInstance;

function getAccessToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)accessToken=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function useSocket() {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const [isConnected, setIsConnected] = useState(socketInstance?.connected ?? false);

  useEffect(() => {
    if (!isAuthenticated) {
      if (socketInstance) {
        console.log('[WS] User logged out. Disconnecting socket.');
        socketInstance.disconnect();
        socketInstance = null;
      }
      setIsConnected(false);
      return;
    }

    const token = getAccessToken();
    if (!token) return;

    if (!socketInstance) {
      console.log('[WS] Initializing connection to', WS_URL || window.location.origin);
      socketInstance = io(WS_URL || window.location.origin, {
        auth: { token },
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });
    }

    const onConnect = () => {
      console.log('[WS] Connected successfully');
      setIsConnected(true);

      // Register device push token automatically
      (async () => {
        try {
          let pushToken = localStorage.getItem('pushToken');
          if (!pushToken) {
            pushToken = 'push-token-' + Math.random().toString(36).substring(2, 15);
            localStorage.setItem('pushToken', pushToken);
          }
          await api.post('/chat/push-tokens', { token: pushToken, deviceType: 'BROWSER' });
          console.log('[WS] Push token registered:', pushToken);
        } catch (e) {
          console.error('[WS] Failed to register push token:', e);
        }
      })();
    };

    const onDisconnect = (reason: string) => {
      console.log('[WS] Disconnected:', reason);
      setIsConnected(false);
    };

    const onConnectError = (err: Error) => {
      console.error('[WS] Connection error:', err.message);
      setIsConnected(false);
    };

    socketInstance.on('connect', onConnect);
    socketInstance.on('disconnect', onDisconnect);
    socketInstance.on('connect_error', onConnectError);

    socketInstance.on('notification:new', (notification) => {
      dispatch(addNotification(notification));
      toast.info(notification.title, { description: notification.message });
    });

    // Centralized event listener forwarding to the window event bus
    const events = ['salary.updated', 'payroll.generated', 'payroll.updated'];
    events.forEach((eventName) => {
      socketInstance?.off(eventName); // Prevent duplicate handlers
      socketInstance?.on(eventName, (data) => {
        console.log(`[WS] Centralized receiver caught: ${eventName}`, data);
        window.dispatchEvent(new CustomEvent(`socket:${eventName}`, { detail: data }));
      });
    });

    // Handle initial state if already connected
    if (socketInstance.connected) {
      setIsConnected(true);
    }

    return () => {
      if (socketInstance) {
        socketInstance.off('connect', onConnect);
        socketInstance.off('disconnect', onDisconnect);
        socketInstance.off('connect_error', onConnectError);
        events.forEach((eventName) => socketInstance?.off(eventName));
      }
    };
  }, [isAuthenticated, dispatch]);

  return { isConnected, socket: socketInstance };
}
