/**
 * Jetstream Context - Real-time Bluesky Updates for Mobile
 *
 * Provides Jetstream WebSocket connectivity to the component tree.
 * Handles:
 * - Connecting/disconnecting based on auth state
 * - Invalidating React Query caches on real-time events
 * - Exposing connection state to consumers
 *
 * When connected, notification and timeline polling intervals are reduced
 * since real-time events trigger cache invalidation directly.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./AuthContext";
import {
  JetstreamEventType,
  initializeJetstreamService,
  getJetstreamService,
  disconnectJetstream,
  type JetstreamEvent,
} from "../services/jetstream-service";
import { useLowPowerMode } from "../hooks/useLowPowerMode";
import { createLogger } from "../utils/logger";

const logger = createLogger("JetstreamCtx");

interface JetstreamContextType {
  /** Whether the Jetstream WebSocket is currently connected */
  isConnected: boolean;
  /** Whether reconnection attempts have been exhausted (real-time updates paused) */
  isReconnectExhausted: boolean;
  /** Manually trigger a reconnect (resets backoff if exhausted) */
  reconnect: () => void;
  /** Update the list of followed DIDs for timeline filtering */
  updateFollowedDids: (dids: string[]) => void;
}

const JetstreamContext = createContext<JetstreamContextType | null>(null);

export function useJetstream(): JetstreamContextType {
  const context = useContext(JetstreamContext);
  if (!context) {
    throw new Error("useJetstream must be used within JetstreamProvider");
  }
  return context;
}

/**
 * Optionally access Jetstream context (returns null if not in provider)
 */
export function useJetstreamOptional(): JetstreamContextType | null {
  return useContext(JetstreamContext);
}

interface JetstreamProviderProps {
  children: React.ReactNode;
}

export function JetstreamProvider({ children }: JetstreamProviderProps) {
  const { isAuthenticated, session } = useAuth();
  const queryClient = useQueryClient();
  const isLowPower = useLowPowerMode();
  const isInitializedRef = useRef(false);
  const [isConnected, setIsConnected] = React.useState(false);
  const [isReconnectExhausted, setIsReconnectExhausted] = React.useState(false);

  // Track whether Jetstream was connected before low-power mode kicked in
  const wasConnectedBeforeLowPowerRef = useRef(false);

  // Debounce timer for notification cache invalidation
  const notificationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const pendingNotificationCount = useRef(0);

  // Debounce timer for timeline cache invalidation
  const timelineDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const pendingTimelineEvents = useRef(0);

  // Connect when authenticated, disconnect when not
  useEffect(() => {
    if (!isAuthenticated || !session?.did) {
      if (isInitializedRef.current) {
        logger.log("User logged out, disconnecting Jetstream");
        disconnectJetstream();
        isInitializedRef.current = false;
        setIsConnected(false);
        setIsReconnectExhausted(false);
      }
      return;
    }

    if (isInitializedRef.current) return;

    const service = initializeJetstreamService({
      userDid: session.did,
    });

    // Connection state tracking
    const handleConnect = () => {
      logger.log("Jetstream connected");
      setIsConnected(true);
      setIsReconnectExhausted(false);

      // Refresh stale caches on connect
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    // Real-time notification events: batch and debounce cache invalidation
    const handleNotification = (_event: JetstreamEvent) => {
      pendingNotificationCount.current++;

      if (notificationDebounceRef.current) {
        clearTimeout(notificationDebounceRef.current);
      }

      notificationDebounceRef.current = setTimeout(() => {
        if (pendingNotificationCount.current > 0) {
          logger.log(
            `Flushing ${pendingNotificationCount.current} notification events`,
          );
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
          queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
          pendingNotificationCount.current = 0;
        }
        notificationDebounceRef.current = null;
      }, 300);
    };

    // Real-time timeline events: batch and debounce cache invalidation
    const flushTimelineEvents = () => {
      if (pendingTimelineEvents.current > 0) {
        logger.log(
          `Flushing ${pendingTimelineEvents.current} timeline events`,
        );
        queryClient.invalidateQueries({ queryKey: ["timeline"] });
        pendingTimelineEvents.current = 0;
      }
      timelineDebounceRef.current = null;
    };

    const debounceTimelineInvalidation = () => {
      pendingTimelineEvents.current++;
      if (timelineDebounceRef.current) {
        clearTimeout(timelineDebounceRef.current);
      }
      timelineDebounceRef.current = setTimeout(flushTimelineEvents, 500);
    };

    const handleNewPost = () => {
      debounceTimelineInvalidation();
    };

    const handleDeletePost = () => {
      debounceTimelineInvalidation();
    };

    const handleError = (event: JetstreamEvent) => {
      if (event.type === JetstreamEventType.ERROR) {
        logger.error("Jetstream error:", event.error);
        if (
          event.error === "Max reconnection attempts exceeded"
        ) {
          setIsReconnectExhausted(true);
        }
      }
    };

    service.on(JetstreamEventType.CONNECT, handleConnect);
    service.on(JetstreamEventType.DISCONNECT, handleDisconnect);
    service.on(JetstreamEventType.NEW_NOTIFICATION, handleNotification);
    service.on(JetstreamEventType.TIMELINE_NEW_POST, handleNewPost);
    service.on(JetstreamEventType.TIMELINE_DELETE_POST, handleDeletePost);
    service.on(JetstreamEventType.ERROR, handleError);

    service.connect();
    isInitializedRef.current = true;

    return () => {
      if (notificationDebounceRef.current) {
        clearTimeout(notificationDebounceRef.current);
        notificationDebounceRef.current = null;
      }
      pendingNotificationCount.current = 0;

      if (timelineDebounceRef.current) {
        clearTimeout(timelineDebounceRef.current);
        timelineDebounceRef.current = null;
      }
      pendingTimelineEvents.current = 0;

      const svc = getJetstreamService();
      if (svc) {
        svc.off(JetstreamEventType.CONNECT, handleConnect);
        svc.off(JetstreamEventType.DISCONNECT, handleDisconnect);
        svc.off(JetstreamEventType.NEW_NOTIFICATION, handleNotification);
        svc.off(JetstreamEventType.TIMELINE_NEW_POST, handleNewPost);
        svc.off(JetstreamEventType.TIMELINE_DELETE_POST, handleDeletePost);
        svc.off(JetstreamEventType.ERROR, handleError);
      }

      disconnectJetstream();
      isInitializedRef.current = false;
      setIsConnected(false);
    };
  }, [isAuthenticated, session?.did, queryClient]);

  // Disconnect Jetstream in Low Power Mode to save battery.
  // The app falls back to polling-only (with tripled intervals) via useAdaptivePolling.
  // When Low Power Mode is turned off, reconnect automatically.
  useEffect(() => {
    const service = getJetstreamService();
    if (!service) return;

    if (isLowPower) {
      wasConnectedBeforeLowPowerRef.current = service.isConnected();
      if (service.isConnected()) {
        logger.log("Low Power Mode enabled, disconnecting Jetstream");
        service.disconnect();
      }
    } else if (wasConnectedBeforeLowPowerRef.current) {
      logger.log("Low Power Mode disabled, reconnecting Jetstream");
      wasConnectedBeforeLowPowerRef.current = false;
      service.connect();
    }
  }, [isLowPower]);

  const reconnect = useCallback(() => {
    const service = getJetstreamService();
    if (service) {
      logger.log("Manual reconnect triggered");
      service.resetReconnect();
      setIsReconnectExhausted(false);
      service.disconnect();
      service.connect();
    }
  }, []);

  const updateFollowedDids = useCallback((dids: string[]) => {
    const service = getJetstreamService();
    if (service) {
      service.updateFollowedDids(dids);
    }
  }, []);

  const value = useMemo(
    (): JetstreamContextType => ({
      isConnected,
      isReconnectExhausted,
      reconnect,
      updateFollowedDids,
    }),
    [isConnected, isReconnectExhausted, reconnect, updateFollowedDids],
  );

  return (
    <JetstreamContext.Provider value={value}>
      {children}
    </JetstreamContext.Provider>
  );
}
