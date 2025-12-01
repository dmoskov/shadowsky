import type { Notification } from "@atproto/api/dist/client/types/app/bsky/notification/listNotifications";
import { debug } from "@bsky/shared";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { pushNotificationService } from "../services/push-notification-service";
import {
  getWebSocketService,
  initializeWebSocketService,
} from "../services/websocket-service";
import type { PushNotificationPayload } from "../types/push-notifications";
import {
  WebSocketConnectionState,
  WebSocketEventType,
  type NewNotificationEvent,
  type NotificationCountEvent,
  type WebSocketStats,
} from "../types/websocket";
import { useAuth } from "./AuthContext";

interface WebSocketContextType {
  isConnected: boolean;
  connectionState: WebSocketConnectionState;
  stats: WebSocketStats;
  reconnect: () => void;
  isEnabled: boolean;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within WebSocketProvider");
  }
  return context;
};

interface WebSocketProviderProps {
  children: ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  children,
}) => {
  const { isAuthenticated, session } = useAuth();
  const queryClient = useQueryClient();
  const [connectionState, setConnectionState] =
    useState<WebSocketConnectionState>(WebSocketConnectionState.DISCONNECTED);
  const [stats, setStats] = useState<WebSocketStats>({
    connectionState: WebSocketConnectionState.DISCONNECTED,
    reconnectAttempts: 0,
    messagesSent: 0,
    messagesReceived: 0,
  });

  const isInitialized = useRef(false);
  const reconnectAttemptTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const updateStats = useCallback(() => {
    const service = getWebSocketService();
    if (service) {
      const currentStats = service.getStats();
      setStats(currentStats);
      setConnectionState(currentStats.connectionState);
    }
  }, []);

  const handleNewNotification = useCallback(
    (event: NewNotificationEvent) => {
      debug.log(
        "📬 [WebSocket] New notification received:",
        event.notification,
      );

      queryClient.setQueryData(["notificationCount"], (oldCount: number) => {
        return (oldCount || 0) + 1;
      });

      queryClient.setQueriesData(
        { queryKey: ["notifications"] },
        (oldData: unknown) => {
          const data = oldData as
            | { pages?: Array<{ notifications: Notification[] }> }
            | undefined;
          if (!data?.pages) return oldData;

          const newPages = [...data.pages];
          if (newPages[0]) {
            newPages[0] = {
              ...newPages[0],
              notifications: [event.notification, ...newPages[0].notifications],
            };
          }

          return {
            ...data,
            pages: newPages,
          };
        },
      );

      // Show push notification via service worker for better handling
      const pushPayload: PushNotificationPayload = {
        type: "notification",
        title: "New Bluesky Notification",
        body: getNotificationBody(event.notification),
        icon: event.notification.author.avatar || "/butterfly-icon.svg",
        badge: "/butterfly-icon.svg",
        tag: event.notification.uri,
        data: {
          url: getNotificationUrl(event.notification),
          notificationUri: event.notification.uri,
          authorDid: event.notification.author.did,
          reason: event.notification.reason,
          postUri: getPostUri(event.notification),
        },
        renotify: true,
      };

      // Use push notification service for settings-aware notifications
      pushNotificationService
        .showLocalNotification(pushPayload)
        .catch((err) => {
          debug.warn("Failed to show push notification:", err);
          // Fallback to basic notification API
          if (window.Notification?.permission === "granted") {
            new window.Notification("New Bluesky Notification", {
              body: getNotificationBody(event.notification),
              icon: event.notification.author.avatar,
              tag: event.notification.uri,
            });
          }
        });
    },
    [queryClient],
  );

  const handleNotificationCount = useCallback(
    (event: NotificationCountEvent) => {
      debug.log("🔢 [WebSocket] Notification count update:", event.count);
      queryClient.setQueryData(["notificationCount"], event.count);
    },
    [queryClient],
  );

  const handleConnect = useCallback(() => {
    debug.log("✅ [WebSocket] Connected");
    updateStats();
  }, [updateStats]);

  const handleDisconnect = useCallback(() => {
    debug.log("❌ [WebSocket] Disconnected");
    updateStats();
  }, [updateStats]);

  const handleReconnect = useCallback(() => {
    debug.log("🔄 [WebSocket] Reconnecting...");
    updateStats();
  }, [updateStats]);

  const handleError = useCallback(() => {
    debug.error("⚠️ [WebSocket] Error occurred");
    updateStats();
  }, [updateStats]);

  const reconnect = useCallback(() => {
    const service = getWebSocketService();
    if (service) {
      debug.log("🔄 [WebSocket] Manual reconnection triggered");
      service.disconnect();
      setTimeout(() => {
        service.connect();
      }, 1000);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !session) {
      if (isInitialized.current) {
        debug.log("🔌 [WebSocket] User logged out, disconnecting");
        const service = getWebSocketService();
        if (service) {
          service.disconnect();
        }
        isInitialized.current = false;
      }
      return;
    }

    if (isInitialized.current) {
      return;
    }

    const wsUrl = import.meta.env.VITE_WS_URL;
    if (!wsUrl) {
      debug.warn(
        "🔌 [WebSocket] VITE_WS_URL not configured, WebSocket disabled",
      );
      return;
    }

    const fullWsUrl = `${wsUrl}?token=${session.accessJwt}`;

    debug.log("🔌 [WebSocket] Initializing service");
    const service = initializeWebSocketService({
      url: fullWsUrl,
      reconnectDelay: 5000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      debug: true,
    });

    service.on(WebSocketEventType.NEW_NOTIFICATION, (event) =>
      handleNewNotification(event as NewNotificationEvent),
    );
    service.on(WebSocketEventType.NOTIFICATION_COUNT, (event) =>
      handleNotificationCount(event as NotificationCountEvent),
    );
    service.on(WebSocketEventType.CONNECT, handleConnect);
    service.on(WebSocketEventType.DISCONNECT, handleDisconnect);
    service.on(WebSocketEventType.RECONNECT, handleReconnect);
    service.on(WebSocketEventType.ERROR, handleError);

    service.connect();
    isInitialized.current = true;

    const statsInterval = setInterval(updateStats, 5000);

    return () => {
      clearInterval(statsInterval);
      if (reconnectAttemptTimer.current) {
        clearTimeout(reconnectAttemptTimer.current);
      }
    };
  }, [
    isAuthenticated,
    session,
    handleNewNotification,
    handleNotificationCount,
    handleConnect,
    handleDisconnect,
    handleReconnect,
    handleError,
    updateStats,
  ]);

  const value: WebSocketContextType = {
    isConnected: connectionState === WebSocketConnectionState.CONNECTED,
    connectionState,
    stats,
    reconnect,
    isEnabled: !!import.meta.env.VITE_WS_URL,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

function getNotificationBody(notification: Notification): string {
  const author =
    notification.author.displayName || `@${notification.author.handle}`;

  switch (notification.reason) {
    case "like":
      return `${author} liked your post`;
    case "repost":
      return `${author} reposted your post`;
    case "follow":
      return `${author} followed you`;
    case "mention":
      return `${author} mentioned you`;
    case "reply":
      return `${author} replied to your post`;
    case "quote":
      return `${author} quoted your post`;
    default:
      return `${author} interacted with your post`;
  }
}

function getNotificationUrl(notification: Notification): string {
  // For follows, link to the profile
  if (notification.reason === "follow") {
    return `/profile/${notification.author.handle}`;
  }

  // For post-related notifications, link to the notification tab
  // which will show the context
  return "/notifications";
}

function getPostUri(notification: Notification): string | undefined {
  // Extract post URI from the notification if available
  const record = notification.record as
    | { subject?: { uri?: string } }
    | undefined;
  return record?.subject?.uri || notification.reasonSubject;
}
