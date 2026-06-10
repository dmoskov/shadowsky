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
  /**
   * Whether followed accounts have posted since the timeline was last
   * refreshed. Drives the "New posts" pill — content is never refetched
   * underneath the reader.
   */
  hasNewTimelinePosts: boolean;
  /** Clear the new-posts signal (call when the timeline is refreshed) */
  clearNewTimelinePosts: () => void;
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
  const [hasNewTimelinePosts, setHasNewTimelinePosts] = React.useState(false);

  // Track whether Jetstream was connected before low-power mode kicked in
  const wasConnectedBeforeLowPowerRef = useRef(false);

  // Track first connect: startup gets an active timeline refresh, but
  // reconnects (app foreground, network blips) only mark it stale so the
  // feed is never rebuilt underneath the reader
  const hasConnectedOnceRef = useRef(false);

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
      if (!hasConnectedOnceRef.current) {
        // First connect after launch: actively fetch a fresh timeline
        hasConnectedOnceRef.current = true;
        queryClient.invalidateQueries({ queryKey: ["timeline"] });
      } else {
        // Reconnect: mark stale only; the "New posts" pill and
        // pull-to-refresh bring fresh content in on the user's terms
        queryClient.invalidateQueries({
          queryKey: ["timeline"],
          refetchType: "none",
        });
      }
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

    // Real-time timeline events. Following the official client's pattern,
    // a new post never refetches the feed in place (that would replace
    // content underneath the reader and refetch every cached page) — it
    // only raises the "New posts" signal for the pill.
    const handleNewPost = () => {
      setHasNewTimelinePosts(true);
    };

    // A deleted post is removed surgically from cached feed pages —
    // one row disappears, no refetch, no feed rebuild.
    const handleDeletePost = (event: JetstreamEvent) => {
      if (event.type !== JetstreamEventType.TIMELINE_DELETE_POST) return;
      const deletedUri = event.uri;
      queryClient.setQueriesData(
        {
          predicate: (query) =>
            query.queryKey[0] === "timeline" || query.queryKey[0] === "feed",
        },
        (oldData: unknown) => {
          const data = oldData as
            | { pages?: Array<{ feed?: Array<{ post?: { uri?: string } }> }> }
            | undefined;
          if (!data?.pages) return oldData;

          let changed = false;
          const newPages = data.pages.map((page) => {
            if (!page.feed?.some((item) => item.post?.uri === deletedUri)) {
              return page;
            }
            changed = true;
            return {
              ...page,
              feed: page.feed.filter((item) => item.post?.uri !== deletedUri),
            };
          });

          return changed ? { ...data, pages: newPages } : oldData;
        },
      );
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

  const clearNewTimelinePosts = useCallback(() => {
    setHasNewTimelinePosts(false);
  }, []);

  const value = useMemo(
    (): JetstreamContextType => ({
      isConnected,
      isReconnectExhausted,
      reconnect,
      updateFollowedDids,
      hasNewTimelinePosts,
      clearNewTimelinePosts,
    }),
    [
      isConnected,
      isReconnectExhausted,
      reconnect,
      updateFollowedDids,
      hasNewTimelinePosts,
      clearNewTimelinePosts,
    ],
  );

  return (
    <JetstreamContext.Provider value={value}>
      {children}
    </JetstreamContext.Provider>
  );
}
