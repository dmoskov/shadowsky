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
  type WebSocketMessage,
  type WebSocketStats,
} from "../types/websocket";
import { useAuth } from "./AuthContext";

// Polling intervals based on connection state
const STATS_POLLING_INTERVAL_CONNECTED = 30000; // 30 seconds when connected
const STATS_POLLING_INTERVAL_DISCONNECTED = 5000; // 5 seconds when disconnected/reconnecting

// Debounce delay for batching notification updates
const NOTIFICATION_DEBOUNCE_MS = 100;

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
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refs for debounced notification updates
  const pendingNotificationsRef = useRef<Notification[]>([]);
  const notificationDebounceTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const pendingCountRef = useRef<number | null>(null);
  const countDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Handler refs for cleanup - using refs to avoid effect re-runs
  type EventHandler = (event: WebSocketMessage) => void;
  const handlersRef = useRef<{
    newNotification: EventHandler | null;
    notificationCount: EventHandler | null;
    connect: EventHandler | null;
    disconnect: EventHandler | null;
    reconnect: EventHandler | null;
    error: EventHandler | null;
  }>({
    newNotification: null,
    notificationCount: null,
    connect: null,
    disconnect: null,
    reconnect: null,
    error: null,
  });

  const updateStats = useCallback(() => {
    const service = getWebSocketService();
    if (service) {
      const currentStats = service.getStats();
      setStats(currentStats);
      setConnectionState(currentStats.connectionState);
    }
  }, []);

  // Update polling interval based on connection state
  const updatePollingInterval = useCallback(
    (isConnected: boolean) => {
      // Clear existing interval
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }

      // Set new interval based on connection state
      const interval = isConnected
        ? STATS_POLLING_INTERVAL_CONNECTED
        : STATS_POLLING_INTERVAL_DISCONNECTED;

      debug.log(`📊 [WebSocket] Stats polling interval: ${interval / 1000}s`);
      statsIntervalRef.current = setInterval(updateStats, interval);
    },
    [updateStats],
  );

  // Flush pending notifications to React Query (batched)
  const flushPendingNotifications = useCallback(() => {
    const notifications = pendingNotificationsRef.current;
    if (notifications.length === 0) return;

    debug.log(
      `📬 [WebSocket] Flushing ${notifications.length} batched notifications`,
    );

    // Update notification count
    queryClient.setQueryData(["notificationCount"], (oldCount: number) => {
      return (oldCount || 0) + notifications.length;
    });

    // Update notifications list
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
            notifications: [...notifications, ...newPages[0].notifications],
          };
        }

        return {
          ...data,
          pages: newPages,
        };
      },
    );

    // Clear pending
    pendingNotificationsRef.current = [];
  }, [queryClient]);

  // Flush pending count update
  const flushPendingCount = useCallback(() => {
    const count = pendingCountRef.current;
    if (count === null) return;

    debug.log(`🔢 [WebSocket] Flushing notification count: ${count}`);
    queryClient.setQueryData(["notificationCount"], count);
    pendingCountRef.current = null;
  }, [queryClient]);

  const handleNewNotification = useCallback(
    (event: NewNotificationEvent) => {
      debug.log(
        "📬 [WebSocket] New notification received:",
        event.notification,
      );

      // Add to pending notifications for batched update
      pendingNotificationsRef.current.push(event.notification);

      // Debounce the React Query update to batch rapid notifications
      if (notificationDebounceTimerRef.current) {
        clearTimeout(notificationDebounceTimerRef.current);
      }
      notificationDebounceTimerRef.current = setTimeout(() => {
        flushPendingNotifications();
        notificationDebounceTimerRef.current = null;
      }, NOTIFICATION_DEBOUNCE_MS);

      // Show push notification via service worker for better handling
      // (Push notifications are shown immediately, not debounced)
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
    [flushPendingNotifications],
  );

  const handleNotificationCount = useCallback(
    (event: NotificationCountEvent) => {
      debug.log("🔢 [WebSocket] Notification count update:", event.count);

      // Debounce count updates to avoid rapid re-renders
      pendingCountRef.current = event.count;

      if (countDebounceTimerRef.current) {
        clearTimeout(countDebounceTimerRef.current);
      }
      countDebounceTimerRef.current = setTimeout(() => {
        flushPendingCount();
        countDebounceTimerRef.current = null;
      }, NOTIFICATION_DEBOUNCE_MS);
    },
    [flushPendingCount],
  );

  const handleConnect = useCallback(() => {
    debug.log("✅ [WebSocket] Connected");
    updateStats();
    // Switch to longer polling interval when connected (event-driven updates handle the rest)
    updatePollingInterval(true);
  }, [updateStats, updatePollingInterval]);

  const handleDisconnect = useCallback(() => {
    debug.log("❌ [WebSocket] Disconnected");
    updateStats();
    // Switch to shorter polling interval to monitor reconnection status
    updatePollingInterval(false);
  }, [updateStats, updatePollingInterval]);

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
          // Remove event handlers before disconnecting
          const handlers = handlersRef.current;
          if (handlers.newNotification)
            service.off(
              WebSocketEventType.NEW_NOTIFICATION,
              handlers.newNotification,
            );
          if (handlers.notificationCount)
            service.off(
              WebSocketEventType.NOTIFICATION_COUNT,
              handlers.notificationCount,
            );
          if (handlers.connect)
            service.off(WebSocketEventType.CONNECT, handlers.connect);
          if (handlers.disconnect)
            service.off(WebSocketEventType.DISCONNECT, handlers.disconnect);
          if (handlers.reconnect)
            service.off(WebSocketEventType.RECONNECT, handlers.reconnect);
          if (handlers.error)
            service.off(WebSocketEventType.ERROR, handlers.error);

          // Clear handler refs
          handlersRef.current = {
            newNotification: null,
            notificationCount: null,
            connect: null,
            disconnect: null,
            reconnect: null,
            error: null,
          };

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

    // Pass token via config for initial message authentication
    // This prevents token exposure in URL (browser history, logs, referrer headers)
    debug.log("🔌 [WebSocket] Initializing service with secure authentication");
    const service = initializeWebSocketService({
      url: wsUrl,
      accessToken: session.accessJwt,
      authTimeout: 10000,
      reconnectDelay: 5000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      debug: true,
    });

    // Create wrapper handlers to store references for cleanup
    // Using wrappers ensures we can call the current callback versions
    const newNotificationHandler: EventHandler = (event) =>
      handleNewNotification(event as NewNotificationEvent);
    const notificationCountHandler: EventHandler = (event) =>
      handleNotificationCount(event as NotificationCountEvent);
    const connectHandler: EventHandler = () => handleConnect();
    const disconnectHandler: EventHandler = () => handleDisconnect();
    const reconnectHandler: EventHandler = () => handleReconnect();
    const errorHandler: EventHandler = () => handleError();

    // Store handler references for cleanup
    handlersRef.current = {
      newNotification: newNotificationHandler,
      notificationCount: notificationCountHandler,
      connect: connectHandler,
      disconnect: disconnectHandler,
      reconnect: reconnectHandler,
      error: errorHandler,
    };

    // Register handlers
    service.on(WebSocketEventType.NEW_NOTIFICATION, newNotificationHandler);
    service.on(WebSocketEventType.NOTIFICATION_COUNT, notificationCountHandler);
    service.on(WebSocketEventType.CONNECT, connectHandler);
    service.on(WebSocketEventType.DISCONNECT, disconnectHandler);
    service.on(WebSocketEventType.RECONNECT, reconnectHandler);
    service.on(WebSocketEventType.ERROR, errorHandler);

    service.connect();
    isInitialized.current = true;

    // Start with shorter polling interval until connected
    updatePollingInterval(false);

    return () => {
      // Clear stats polling interval
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
        statsIntervalRef.current = null;
      }

      // Clear reconnect timer
      if (reconnectAttemptTimer.current) {
        clearTimeout(reconnectAttemptTimer.current);
        reconnectAttemptTimer.current = null;
      }

      // Clear debounce timers
      if (notificationDebounceTimerRef.current) {
        clearTimeout(notificationDebounceTimerRef.current);
        notificationDebounceTimerRef.current = null;
      }
      if (countDebounceTimerRef.current) {
        clearTimeout(countDebounceTimerRef.current);
        countDebounceTimerRef.current = null;
      }

      // Clear pending data
      pendingNotificationsRef.current = [];
      pendingCountRef.current = null;

      // Remove event handlers from service
      const currentService = getWebSocketService();
      if (currentService) {
        const handlers = handlersRef.current;
        if (handlers.newNotification)
          currentService.off(
            WebSocketEventType.NEW_NOTIFICATION,
            handlers.newNotification,
          );
        if (handlers.notificationCount)
          currentService.off(
            WebSocketEventType.NOTIFICATION_COUNT,
            handlers.notificationCount,
          );
        if (handlers.connect)
          currentService.off(WebSocketEventType.CONNECT, handlers.connect);
        if (handlers.disconnect)
          currentService.off(
            WebSocketEventType.DISCONNECT,
            handlers.disconnect,
          );
        if (handlers.reconnect)
          currentService.off(WebSocketEventType.RECONNECT, handlers.reconnect);
        if (handlers.error)
          currentService.off(WebSocketEventType.ERROR, handlers.error);
      }

      // Clear handler refs
      handlersRef.current = {
        newNotification: null,
        notificationCount: null,
        connect: null,
        disconnect: null,
        reconnect: null,
        error: null,
      };
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
    updatePollingInterval,
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
