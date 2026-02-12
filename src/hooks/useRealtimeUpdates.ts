/**
 * useRealtimeUpdates Hook
 *
 * Manages real-time updates via Jetstream WebSocket firehose.
 * Handles:
 * - New posts from followed accounts
 * - Real-time notifications
 * - Post deletions
 * - Connection lifecycle management
 * - Automatic reconnection
 *
 * Integrates with React Query to invalidate/update caches
 * when real-time events are received.
 */

import { debug } from "@bsky/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getJetstreamService,
  initializeJetstreamService,
} from "../services/jetstream-service";
import {
  WebSocketEventType,
  type TimelineDeletePostEvent,
  type TimelineNewPostEvent,
  type WebSocketMessage,
} from "../types/websocket";

/**
 * Options for useRealtimeUpdates hook
 */
export interface UseRealtimeUpdatesOptions {
  /** Current user's DID */
  userDid: string;
  /** Array of DIDs the user follows */
  followedDids?: string[];
  /** Enable debug logging */
  debug?: boolean;
  /** Auto-connect on mount (default: true) */
  autoConnect?: boolean;
}

/**
 * Return type for useRealtimeUpdates hook
 */
export interface UseRealtimeUpdatesReturn {
  /** Whether Jetstream is connected */
  isConnected: boolean;
  /** Number of new posts available */
  newPostsCount: number;
  /** Manually connect to Jetstream */
  connect: () => void;
  /** Manually disconnect from Jetstream */
  disconnect: () => void;
  /** Refresh timeline to show new posts */
  refreshTimeline: () => void;
  /** Service stats */
  stats: {
    messagesReceived: number;
    postsReceived: number;
    notificationsReceived: number;
    lastEventTime: Date | null;
  };
}

/**
 * Hook for real-time updates via Jetstream
 */
export function useRealtimeUpdates(
  options: UseRealtimeUpdatesOptions,
): UseRealtimeUpdatesReturn {
  const {
    userDid,
    followedDids = [],
    debug: debugEnabled = false,
    autoConnect = true,
  } = options;

  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [newPostsCount, setNewPostsCount] = useState(0);
  const [stats, setStats] = useState({
    messagesReceived: 0,
    postsReceived: 0,
    notificationsReceived: 0,
    lastEventTime: null as Date | null,
  });

  const serviceRef = useRef<ReturnType<typeof getJetstreamService>>(null);
  const handlerRefsRef = useRef<{
    connect: ((event: WebSocketMessage) => void) | null;
    disconnect: ((event: WebSocketMessage) => void) | null;
    newPost: ((event: WebSocketMessage) => void) | null;
    deletePost: ((event: WebSocketMessage) => void) | null;
    newNotification: ((event: WebSocketMessage) => void) | null;
  }>({
    connect: null,
    disconnect: null,
    newPost: null,
    deletePost: null,
    newNotification: null,
  });

  const log = useCallback(
    (message: string) => {
      if (debugEnabled) {
        debug.log(`🔄 [RealtimeUpdates] ${message}`);
      }
    },
    [debugEnabled],
  );

  // Handle connection event
  const handleConnect = useCallback(() => {
    log("Connected to Jetstream");
    setIsConnected(true);
  }, [log]);

  // Handle disconnection event
  const handleDisconnect = useCallback(() => {
    log("Disconnected from Jetstream");
    setIsConnected(false);
  }, [log]);

  // Handle new post from followed account
  const handleNewPost = useCallback(
    (event: TimelineNewPostEvent) => {
      log(`New post received from ${event.data.did}`);
      setNewPostsCount((prev) => prev + 1);

      // Update stats
      const service = serviceRef.current;
      if (service) {
        setStats(service.getStats());
      }
    },
    [log],
  );

  // Handle post deletion
  const handleDeletePost = useCallback(
    (event: TimelineDeletePostEvent) => {
      log(`Post deleted: ${event.data.uri}`);

      // Invalidate timeline queries to remove deleted post
      queryClient.setQueriesData(
        { predicate: (query) => query.queryKey[0] === "timeline" },
        (oldData: unknown) => {
          if (!oldData || typeof oldData !== "object") return oldData;

          const data = oldData as {
            pages?: Array<{
              feed?: Array<{ post?: { uri?: string } }>;
            }>;
          };

          if (!data.pages) return oldData;

          const newPages = data.pages.map((page) => {
            if (!page.feed) return page;

            const newFeed = page.feed.filter(
              (item) => item.post?.uri !== event.data.uri,
            );

            return newFeed !== page.feed ? { ...page, feed: newFeed } : page;
          });

          return { ...data, pages: newPages };
        },
      );

      // Update stats
      const service = serviceRef.current;
      if (service) {
        setStats(service.getStats());
      }
    },
    [log, queryClient],
  );

  // Handle new notification
  const handleNewNotification = useCallback(() => {
    log("New notification received");

    // Invalidate notification queries
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["notificationCount"] });

    // Update stats
    const service = serviceRef.current;
    if (service) {
      setStats(service.getStats());
    }
  }, [log, queryClient]);

  // Refresh timeline - invalidates queries and resets new posts count
  const refreshTimeline = useCallback(() => {
    log("Refreshing timeline");
    setNewPostsCount(0);
    queryClient.invalidateQueries({ queryKey: ["timeline"] });
  }, [log, queryClient]);

  // Connect to Jetstream
  const connect = useCallback(() => {
    if (serviceRef.current?.isConnected()) {
      log("Already connected");
      return;
    }

    log("Connecting to Jetstream...");
    const service = initializeJetstreamService({
      userDid,
      followedDids,
      debug: debugEnabled,
    });

    serviceRef.current = service;

    // Create handler wrappers
    const connectHandler = () => handleConnect();
    const disconnectHandler = () => handleDisconnect();
    const newPostHandler = (event: WebSocketMessage) =>
      handleNewPost(event as TimelineNewPostEvent);
    const deletePostHandler = (event: WebSocketMessage) =>
      handleDeletePost(event as TimelineDeletePostEvent);
    const newNotificationHandler = () => handleNewNotification();

    // Store handler refs for cleanup
    handlerRefsRef.current = {
      connect: connectHandler,
      disconnect: disconnectHandler,
      newPost: newPostHandler,
      deletePost: deletePostHandler,
      newNotification: newNotificationHandler,
    };

    // Register event handlers
    service.on(WebSocketEventType.CONNECT, connectHandler);
    service.on(WebSocketEventType.DISCONNECT, disconnectHandler);
    service.on(WebSocketEventType.TIMELINE_NEW_POST, newPostHandler);
    service.on(WebSocketEventType.TIMELINE_DELETE_POST, deletePostHandler);
    service.on(WebSocketEventType.NEW_NOTIFICATION, newNotificationHandler);

    // Connect
    service.connect();
  }, [
    userDid,
    followedDids,
    debugEnabled,
    log,
    handleConnect,
    handleDisconnect,
    handleNewPost,
    handleDeletePost,
    handleNewNotification,
  ]);

  // Disconnect from Jetstream
  const disconnect = useCallback(() => {
    const service = serviceRef.current;
    if (!service) return;

    log("Disconnecting from Jetstream...");

    // Remove event handlers
    const handlers = handlerRefsRef.current;
    if (handlers.connect) {
      service.off(WebSocketEventType.CONNECT, handlers.connect);
    }
    if (handlers.disconnect) {
      service.off(WebSocketEventType.DISCONNECT, handlers.disconnect);
    }
    if (handlers.newPost) {
      service.off(WebSocketEventType.TIMELINE_NEW_POST, handlers.newPost);
    }
    if (handlers.deletePost) {
      service.off(WebSocketEventType.TIMELINE_DELETE_POST, handlers.deletePost);
    }
    if (handlers.newNotification) {
      service.off(
        WebSocketEventType.NEW_NOTIFICATION,
        handlers.newNotification,
      );
    }

    // Clear handler refs
    handlerRefsRef.current = {
      connect: null,
      disconnect: null,
      newPost: null,
      deletePost: null,
      newNotification: null,
    };

    // Disconnect
    service.disconnect();
    serviceRef.current = null;
    setIsConnected(false);
  }, [log]);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect && userDid) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, userDid, connect, disconnect]);

  // Update followed DIDs when they change
  useEffect(() => {
    const service = serviceRef.current;
    if (service && followedDids.length > 0) {
      service.updateFollowedDids(followedDids);
    }
  }, [followedDids]);

  return {
    isConnected,
    newPostsCount,
    connect,
    disconnect,
    refreshTimeline,
    stats,
  };
}

export default useRealtimeUpdates;
