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
import { createLogger } from "../utils/logger";

const logger = createLogger("JetstreamCtx");

interface JetstreamContextType {
  /** Whether the Jetstream WebSocket is currently connected */
  isConnected: boolean;
  /** Manually trigger a reconnect */
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
  const isInitializedRef = useRef(false);
  const [isConnected, setIsConnected] = React.useState(false);

  // Debounce timer for notification cache invalidation
  const notificationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const pendingNotificationCount = useRef(0);

  // Connect when authenticated, disconnect when not
  useEffect(() => {
    if (!isAuthenticated || !session?.did) {
      if (isInitializedRef.current) {
        logger.log("User logged out, disconnecting Jetstream");
        disconnectJetstream();
        isInitializedRef.current = false;
        setIsConnected(false);
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

    // Real-time timeline events: invalidate feed cache
    const handleNewPost = () => {
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
    };

    const handleDeletePost = () => {
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
    };

    const handleError = (event: JetstreamEvent) => {
      if (event.type === JetstreamEventType.ERROR) {
        logger.error("Jetstream error:", event.error);
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

  const reconnect = useCallback(() => {
    const service = getJetstreamService();
    if (service) {
      logger.log("Manual reconnect triggered");
      service.disconnect();
      setTimeout(() => {
        service.connect();
      }, 1000);
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
      reconnect,
      updateFollowedDids,
    }),
    [isConnected, reconnect, updateFollowedDids],
  );

  return (
    <JetstreamContext.Provider value={value}>
      {children}
    </JetstreamContext.Provider>
  );
}
