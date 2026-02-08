import type { Notification } from "@atproto/api/dist/client/types/app/bsky/notification/listNotifications";
import { debug } from "@bsky/shared";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AuthExpiredModal } from "../components/AuthExpiredModal";
import { WS_CONFIG } from "../config/websocket.config";
import {
  getWebSocketService,
  initializeWebSocketService,
} from "../services/websocket-service";
import {
  WebSocketConnectionState,
  WebSocketEventType,
  type AuthExpiredEvent,
  type NewNotificationEvent,
  type NotificationCountEvent,
  type WebSocketMessage,
  type WebSocketStats,
} from "../types/websocket";
import { AuthContext } from "./AuthContext";

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
  // Use useContext directly instead of useAuth to handle HMR edge cases
  // where the component tree may be in an inconsistent state
  const authContext = useContext(AuthContext);
  const isAuthenticated = authContext?.isAuthenticated ?? false;
  const session = authContext?.session ?? null;
  const logout = authContext?.logout ?? (() => {});
  const queryClient = useQueryClient();
  const [connectionState, setConnectionState] =
    useState<WebSocketConnectionState>(WebSocketConnectionState.DISCONNECTED);
  const [stats, setStats] = useState<WebSocketStats>({
    connectionState: WebSocketConnectionState.DISCONNECTED,
    reconnectAttempts: 0,
    messagesSent: 0,
    messagesReceived: 0,
  });

  // Auth expired modal state
  const [showAuthExpiredModal, setShowAuthExpiredModal] = useState(false);
  const [authExpiredReason, setAuthExpiredReason] = useState<string>();

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
    authExpired: EventHandler | null;
  }>({
    newNotification: null,
    notificationCount: null,
    connect: null,
    disconnect: null,
    reconnect: null,
    error: null,
    authExpired: null,
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
        ? WS_CONFIG.STATS_POLL_CONNECTED_MS
        : WS_CONFIG.STATS_POLL_DISCONNECTED_MS;

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
      }, WS_CONFIG.NOTIFICATION_DEBOUNCE_MS);

      // Show browser notification if permitted
      if (window.Notification?.permission === "granted") {
        new window.Notification("New Bluesky Notification", {
          body: getNotificationBody(event.notification),
          icon: event.notification.author.avatar || "/butterfly-icon.svg",
          tag: event.notification.uri,
        });
      }
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
      }, WS_CONFIG.NOTIFICATION_DEBOUNCE_MS);
    },
    [flushPendingCount],
  );

  const handleConnect = useCallback(() => {
    debug.log("✅ [WebSocket] Connected");
    updateStats();
    // Switch to longer polling interval when connected (event-driven updates handle the rest)
    updatePollingInterval(true);

    // Trigger data refresh on connect
    debug.log("🔄 [WebSocket] Triggering data refresh on connect");
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["notificationCount"] });
    queryClient.invalidateQueries({ queryKey: ["timeline"] });
  }, [updateStats, updatePollingInterval, queryClient]);

  const handleDisconnect = useCallback(() => {
    debug.log("❌ [WebSocket] Disconnected");

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

    // Reset pending data buffers
    pendingNotificationsRef.current = [];
    pendingCountRef.current = null;

    updateStats();
    // Switch to shorter polling interval to monitor reconnection status
    updatePollingInterval(false);
  }, [updateStats, updatePollingInterval]);

  const handleReconnect = useCallback(() => {
    debug.log("🔄 [WebSocket] Reconnecting...");
    updateStats();

    // Trigger data refresh on reconnect
    debug.log("🔄 [WebSocket] Triggering data refresh on reconnect");
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["notificationCount"] });
    queryClient.invalidateQueries({ queryKey: ["timeline"] });
  }, [updateStats, queryClient]);

  const handleError = useCallback(() => {
    debug.error("⚠️ [WebSocket] Error occurred");
    updateStats();
  }, [updateStats]);

  const handleAuthExpired = useCallback((event: AuthExpiredEvent) => {
    debug.error("🔐 [WebSocket] Auth expired:", event.reason);
    setAuthExpiredReason(event.reason);
    setShowAuthExpiredModal(true);
  }, []);

  const handleReLogin = useCallback(() => {
    setShowAuthExpiredModal(false);
    setAuthExpiredReason(undefined);
    logout();
  }, [logout]);

  const reconnect = useCallback(() => {
    const service = getWebSocketService();
    if (service) {
      debug.log("🔄 [WebSocket] Manual reconnection triggered");
      service.disconnect();
      setTimeout(() => {
        service.connect();
      }, WS_CONFIG.MANUAL_RECONNECT_DELAY_MS);
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
          if (handlers.authExpired)
            service.off(WebSocketEventType.AUTH_EXPIRED, handlers.authExpired);

          // Clear handler refs
          handlersRef.current = {
            newNotification: null,
            notificationCount: null,
            connect: null,
            disconnect: null,
            reconnect: null,
            error: null,
            authExpired: null,
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

    // Pass token or DID via config for authentication
    // - App-password users: send JWT token, server polls notifications
    // - OAuth users: send DID only (no raw JWT available), client polls notifications
    const hasAccessToken = session.accessJwt && session.accessJwt.length > 0;
    debug.log(
      `🔌 [WebSocket] Initializing service with ${hasAccessToken ? "token" : "DID"} authentication`,
    );
    const service = initializeWebSocketService({
      url: wsUrl,
      accessToken: hasAccessToken ? session.accessJwt : undefined,
      did: hasAccessToken ? undefined : session.did,
      authTimeout: WS_CONFIG.AUTH_TIMEOUT_MS,
      reconnectDelay: WS_CONFIG.INITIAL_RECONNECT_DELAY_MS,
      maxReconnectAttempts: WS_CONFIG.MAX_RECONNECT_ATTEMPTS,
      heartbeatInterval: WS_CONFIG.HEARTBEAT_INTERVAL_MS,
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
    const authExpiredHandler: EventHandler = (event) =>
      handleAuthExpired(event as AuthExpiredEvent);

    // Store handler references for cleanup
    handlersRef.current = {
      newNotification: newNotificationHandler,
      notificationCount: notificationCountHandler,
      connect: connectHandler,
      disconnect: disconnectHandler,
      reconnect: reconnectHandler,
      error: errorHandler,
      authExpired: authExpiredHandler,
    };

    // Register handlers
    service.on(WebSocketEventType.NEW_NOTIFICATION, newNotificationHandler);
    service.on(WebSocketEventType.NOTIFICATION_COUNT, notificationCountHandler);
    service.on(WebSocketEventType.CONNECT, connectHandler);
    service.on(WebSocketEventType.DISCONNECT, disconnectHandler);
    service.on(WebSocketEventType.RECONNECT, reconnectHandler);
    service.on(WebSocketEventType.ERROR, errorHandler);
    service.on(WebSocketEventType.AUTH_EXPIRED, authExpiredHandler);

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
        if (handlers.authExpired)
          currentService.off(
            WebSocketEventType.AUTH_EXPIRED,
            handlers.authExpired,
          );
      }

      // Clear handler refs
      handlersRef.current = {
        newNotification: null,
        notificationCount: null,
        connect: null,
        disconnect: null,
        reconnect: null,
        error: null,
        authExpired: null,
      };

      // Disconnect the WebSocket service
      if (currentService) {
        currentService.disconnect();
      }

      // Mark as uninitialized to allow re-initialization if needed
      isInitialized.current = false;
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
    handleAuthExpired,
    updatePollingInterval,
  ]);

  // Memoize context value to prevent unnecessary re-renders of consumers
  const value = useMemo(
    (): WebSocketContextType => ({
      isConnected: connectionState === WebSocketConnectionState.CONNECTED,
      connectionState,
      stats,
      reconnect,
      isEnabled: !!import.meta.env.VITE_WS_URL,
    }),
    [connectionState, stats, reconnect],
  );

  return (
    <WebSocketContext.Provider value={value}>
      {children}
      <AuthExpiredModal
        isOpen={showAuthExpiredModal}
        onReLogin={handleReLogin}
        reason={authExpiredReason}
      />
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
