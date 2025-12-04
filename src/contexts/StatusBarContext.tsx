/**
 * StatusBar Context
 *
 * Centralized state management for system status indicators.
 * Consolidates WebSocket, mutation queue, and rate limit status
 * into a unified health monitoring system.
 *
 * Design principle: Hidden by default, only visible when there's an issue.
 */

import type { ReactNode } from "react";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useMutationQueue } from "../hooks/useMutationQueue";
import { getRateLimiterStats } from "../services/rate-limiter";
import { WebSocketConnectionState } from "../types/websocket";
import { useAuth } from "./AuthContext";
import { useWebSocket } from "./WebSocketContext";

// Health levels in order of severity
export type HealthLevel = "healthy" | "warning" | "error" | "critical";

// Individual subsystem status
export interface SubsystemStatus {
  name: string;
  level: HealthLevel;
  message: string;
  details?: Record<string, unknown>;
  action?: {
    label: string;
    handler: () => void;
  };
}

// Overall system status
export interface SystemStatus {
  overallHealth: HealthLevel;
  subsystems: {
    websocket: SubsystemStatus;
    mutationQueue: SubsystemStatus;
    rateLimit: SubsystemStatus;
    network: SubsystemStatus;
  };
  hasIssues: boolean;
  issueCount: number;
}

interface StatusBarContextType {
  status: SystemStatus;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  refresh: () => void;
}

const StatusBarContext = createContext<StatusBarContextType | null>(null);

export const useStatusBar = () => {
  const context = useContext(StatusBarContext);
  if (!context) {
    throw new Error("useStatusBar must be used within StatusBarProvider");
  }
  return context;
};

interface StatusBarProviderProps {
  children: ReactNode;
}

export const StatusBarProvider: React.FC<StatusBarProviderProps> = ({
  children,
}) => {
  const { agent } = useAuth();
  const {
    connectionState,
    stats: wsStats,
    reconnect,
    isEnabled: wsEnabled,
  } = useWebSocket();
  const mutationQueue = useMutationQueue(agent);
  const [rateLimitStats, setRateLimitStats] = useState(getRateLimiterStats());
  const [isExpanded, setIsExpanded] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Update rate limit stats periodically
  useEffect(() => {
    const updateRateLimits = () => {
      setRateLimitStats(getRateLimiterStats());
    };

    // Update every 2 seconds
    const interval = setInterval(updateRateLimits, 2000);
    return () => clearInterval(interval);
  }, []);

  const refresh = useCallback(() => {
    setRateLimitStats(getRateLimiterStats());
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  // Compute WebSocket subsystem status
  const websocketStatus = useMemo((): SubsystemStatus => {
    if (!wsEnabled) {
      return {
        name: "WebSocket",
        level: "healthy",
        message: "Disabled",
        details: { enabled: false },
      };
    }

    switch (connectionState) {
      case WebSocketConnectionState.CONNECTED:
        return {
          name: "WebSocket",
          level: "healthy",
          message: "Connected",
          details: {
            connectedAt: wsStats.connectedAt,
            messagesSent: wsStats.messagesSent,
            messagesReceived: wsStats.messagesReceived,
          },
        };
      case WebSocketConnectionState.CONNECTING:
        return {
          name: "WebSocket",
          level: "warning",
          message: "Connecting...",
        };
      case WebSocketConnectionState.RECONNECTING:
        return {
          name: "WebSocket",
          level: "warning",
          message: `Reconnecting (attempt ${wsStats.reconnectAttempts})`,
          details: { reconnectAttempts: wsStats.reconnectAttempts },
          action: {
            label: "Reconnect Now",
            handler: reconnect,
          },
        };
      case WebSocketConnectionState.ERROR:
        return {
          name: "WebSocket",
          level: "error",
          message: wsStats.lastError || "Connection error",
          details: { error: wsStats.lastError },
          action: {
            label: "Retry",
            handler: reconnect,
          },
        };
      default:
        return {
          name: "WebSocket",
          level: "warning",
          message: "Disconnected",
          action: {
            label: "Connect",
            handler: reconnect,
          },
        };
    }
  }, [connectionState, wsStats, reconnect, wsEnabled]);

  // Compute Mutation Queue subsystem status
  const mutationQueueStatus = useMemo((): SubsystemStatus => {
    const { pendingCount, failedCount, isProcessing, isOnline, triggerSync } =
      mutationQueue;

    if (!isOnline) {
      return {
        name: "Sync Queue",
        level: pendingCount > 0 ? "warning" : "healthy",
        message:
          pendingCount > 0 ? `Offline (${pendingCount} pending)` : "Offline",
        details: { pendingCount, failedCount, isOnline },
      };
    }

    if (failedCount > 0) {
      return {
        name: "Sync Queue",
        level: "error",
        message: `${failedCount} failed action${failedCount > 1 ? "s" : ""}`,
        details: { pendingCount, failedCount },
        action: {
          label: "Retry",
          handler: () => triggerSync(),
        },
      };
    }

    if (isProcessing) {
      return {
        name: "Sync Queue",
        level: "healthy",
        message: "Syncing...",
        details: { pendingCount, isProcessing },
      };
    }

    if (pendingCount > 0) {
      return {
        name: "Sync Queue",
        level: "warning",
        message: `${pendingCount} pending`,
        details: { pendingCount },
        action: {
          label: "Sync Now",
          handler: () => triggerSync(),
        },
      };
    }

    return {
      name: "Sync Queue",
      level: "healthy",
      message: "Synced",
      details: { pendingCount: 0, failedCount: 0 },
    };
  }, [mutationQueue]);

  // Compute Rate Limit subsystem status
  const rateLimitStatus = useMemo((): SubsystemStatus => {
    const stats = rateLimitStats;
    const buckets = [
      { name: "API", stats: stats.api },
      { name: "Profiles", stats: stats.profile },
      { name: "Posts", stats: stats.post },
      { name: "Notifications", stats: stats.notification },
    ];

    const hasThrottling = buckets.some(
      (b) => b.stats.throttledRequests > 0 || b.stats.queueLength > 0,
    );
    const hasQueue = buckets.some((b) => b.stats.queueLength > 0);
    const lowTokens = buckets.some(
      (b) => b.stats.availableTokens < b.stats.maxTokens * 0.2,
    );

    if (hasQueue) {
      const queuedCount = buckets.reduce(
        (sum, b) => sum + b.stats.queueLength,
        0,
      );
      return {
        name: "Rate Limits",
        level: "warning",
        message: `${queuedCount} request${queuedCount > 1 ? "s" : ""} queued`,
        details: {
          buckets: buckets.map((b) => ({
            name: b.name,
            available: b.stats.availableTokens,
            max: b.stats.maxTokens,
            throttled: b.stats.throttledRequests,
            queued: b.stats.queueLength,
          })),
        },
      };
    }

    if (hasThrottling || lowTokens) {
      return {
        name: "Rate Limits",
        level: "warning",
        message: "Slowing down requests",
        details: {
          buckets: buckets.map((b) => ({
            name: b.name,
            available: b.stats.availableTokens,
            max: b.stats.maxTokens,
            throttled: b.stats.throttledRequests,
          })),
        },
      };
    }

    return {
      name: "Rate Limits",
      level: "healthy",
      message: "OK",
      details: {
        buckets: buckets.map((b) => ({
          name: b.name,
          available: b.stats.availableTokens,
          max: b.stats.maxTokens,
        })),
      },
    };
  }, [rateLimitStats]);

  // Compute Network subsystem status
  const networkStatus = useMemo((): SubsystemStatus => {
    const isOnline = mutationQueue.isOnline;

    if (!isOnline) {
      return {
        name: "Network",
        level: "error",
        message: "Offline",
      };
    }

    return {
      name: "Network",
      level: "healthy",
      message: "Online",
    };
  }, [mutationQueue.isOnline]);

  // Compute overall system status
  const status = useMemo((): SystemStatus => {
    const subsystems = {
      websocket: websocketStatus,
      mutationQueue: mutationQueueStatus,
      rateLimit: rateLimitStatus,
      network: networkStatus,
    };

    const levels: HealthLevel[] = Object.values(subsystems).map((s) => s.level);

    // Determine overall health (worst of all subsystems)
    let overallHealth: HealthLevel = "healthy";
    if (levels.includes("critical")) {
      overallHealth = "critical";
    } else if (levels.includes("error")) {
      overallHealth = "error";
    } else if (levels.includes("warning")) {
      overallHealth = "warning";
    }

    const issueCount = levels.filter((l) => l !== "healthy").length;

    return {
      overallHealth,
      subsystems,
      hasIssues: overallHealth !== "healthy",
      issueCount,
    };
  }, [
    websocketStatus,
    mutationQueueStatus,
    rateLimitStatus,
    networkStatus,
    refreshTrigger,
  ]);

  // Memoize context value to prevent unnecessary re-renders of consumers
  const value = useMemo(
    (): StatusBarContextType => ({
      status,
      isExpanded,
      setIsExpanded,
      refresh,
    }),
    [status, isExpanded, refresh],
  );

  return (
    <StatusBarContext.Provider value={value}>
      {children}
    </StatusBarContext.Provider>
  );
};
