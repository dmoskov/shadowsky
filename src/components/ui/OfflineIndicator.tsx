/**
 * OfflineIndicator - Shows when the user is offline with enhanced reconnection UX
 *
 * Features:
 * - Progress bar during reconnection attempts
 * - Visual states: offline → reconnecting → syncing → online
 * - Pending action count from mutation queue
 * - Smooth transitions between states
 */

import {
  CheckCircle2,
  CloudOff,
  Database,
  Loader2,
  RefreshCw,
  Upload,
  WifiOff,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { offlineStorageDB } from "../../services/offline-storage-db";

type ConnectionState =
  | "online"
  | "offline"
  | "reconnecting"
  | "syncing"
  | "reconnected";

interface OfflineIndicatorProps {
  className?: string;
  position?: "top" | "bottom";
  showRetry?: boolean;
  pendingActionCount?: number;
  isSyncing?: boolean;
  onSyncComplete?: () => void;
  showCacheStatus?: boolean;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  className = "",
  position = "top",
  showRetry = true,
  pendingActionCount = 0,
  isSyncing = false,
  onSyncComplete,
  showCacheStatus = true,
}) => {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("online");
  const [reconnectProgress, setReconnectProgress] = useState(0);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [syncProgress, setSyncProgress] = useState(0);
  const [cachedFeedCount, setCachedFeedCount] = useState(0);
  const reconnectIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const reconnectedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const syncCompleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check cached content availability
  useEffect(() => {
    if (!showCacheStatus) return;

    const checkCachedContent = async () => {
      try {
        await offlineStorageDB.init();
        const stats = await offlineStorageDB.getStats();
        setCachedFeedCount(stats.feedItemCount);
      } catch {
        setCachedFeedCount(0);
      }
    };

    checkCachedContent();
    // Re-check when going offline
    const handleOffline = () => checkCachedContent();
    window.addEventListener("offline", handleOffline);
    return () => window.removeEventListener("offline", handleOffline);
  }, [showCacheStatus]);

  // Initialize online state
  useEffect(() => {
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    setConnectionState(isOnline ? "online" : "offline");
  }, []);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      // Clear any reconnection intervals
      if (reconnectIntervalRef.current) {
        clearInterval(reconnectIntervalRef.current);
        reconnectIntervalRef.current = null;
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      // If we have pending actions, go to syncing state
      if (pendingActionCount > 0 || isSyncing) {
        setConnectionState("syncing");
        setReconnectProgress(100);
        setSyncProgress(0);
      } else {
        // No pending actions, show reconnected briefly
        setConnectionState("reconnected");
        setReconnectProgress(100);
        setReconnectAttempt(0);

        // Hide after 3 seconds
        reconnectedTimeoutRef.current = setTimeout(() => {
          setConnectionState("online");
          setReconnectProgress(0);
        }, 3000);
      }
    };

    const handleOffline = () => {
      setConnectionState("offline");
      setReconnectProgress(0);
      setSyncProgress(0);
      setReconnectAttempt(0);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (reconnectedTimeoutRef.current) {
        clearTimeout(reconnectedTimeoutRef.current);
        reconnectedTimeoutRef.current = null;
      }
    };
  }, [pendingActionCount, isSyncing]);

  // Handle syncing state transition
  useEffect(() => {
    if (connectionState === "syncing") {
      if (!isSyncing && pendingActionCount === 0) {
        // Syncing complete
        setSyncProgress(100);
        syncCompleteTimeoutRef.current = setTimeout(() => {
          setConnectionState("reconnected");
          onSyncComplete?.();

          // Hide after 3 seconds
          hideTimeoutRef.current = setTimeout(() => {
            setConnectionState("online");
            setSyncProgress(0);
            setReconnectProgress(0);
          }, 3000);
        }, 500);
      } else if (pendingActionCount > 0) {
        // Simulate sync progress based on remaining items
        // In reality this would be driven by actual sync progress
        const baseProgress = Math.max(0, 100 - pendingActionCount * 10);
        setSyncProgress(Math.min(90, baseProgress));
      }
    }

    return () => {
      if (syncCompleteTimeoutRef.current) {
        clearTimeout(syncCompleteTimeoutRef.current);
        syncCompleteTimeoutRef.current = null;
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
    };
  }, [connectionState, isSyncing, pendingActionCount, onSyncComplete]);

  // Auto-retry reconnection when offline
  useEffect(() => {
    if (connectionState === "offline") {
      const attemptReconnect = async () => {
        setConnectionState("reconnecting");
        setReconnectAttempt((prev) => prev + 1);
        setReconnectProgress(0);

        // Animate progress bar during reconnection attempt
        progressIntervalRef.current = setInterval(() => {
          setReconnectProgress((prev) => {
            if (prev >= 90) return 90; // Cap at 90% until we confirm connection
            return prev + 10;
          });
        }, 200);

        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);

          const response = await fetch("/ping", {
            method: "HEAD",
            cache: "no-store",
            signal: controller.signal,
          });

          clearTimeout(timeout);

          if (response.ok) {
            // Connection successful - handleOnline will be called by browser event
            return;
          }
        } catch {
          // Still offline
        }

        // Clear progress interval
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }

        // Return to offline state
        setConnectionState("offline");
        setReconnectProgress(0);
      };

      // Initial delay before first retry
      const initialDelay = setTimeout(() => {
        attemptReconnect();
      }, 2000);

      // Set up recurring reconnection attempts with exponential backoff
      let attempt = 0;
      reconnectIntervalRef.current = setInterval(
        () => {
          attempt++;
          // Exponential backoff: 5s, 10s, 20s, 30s max
          const nextDelay = Math.min(5000 * Math.pow(2, attempt), 30000);
          setTimeout(attemptReconnect, nextDelay);
        },
        10000, // Base check interval
      );

      return () => {
        clearTimeout(initialDelay);
        if (reconnectIntervalRef.current) {
          clearInterval(reconnectIntervalRef.current);
        }
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }
      };
    }
  }, [connectionState]);

  const handleManualRetry = useCallback(async () => {
    if (connectionState === "reconnecting") return;

    setConnectionState("reconnecting");
    setReconnectAttempt((prev) => prev + 1);
    setReconnectProgress(0);

    // Animate progress
    progressIntervalRef.current = setInterval(() => {
      setReconnectProgress((prev) => Math.min(prev + 15, 90));
    }, 150);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch("/ping", {
        method: "HEAD",
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        setReconnectProgress(100);
        // Browser will fire 'online' event if truly back online
        return;
      }
    } catch {
      // Still offline
    }

    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    setConnectionState("offline");
    setReconnectProgress(0);
  }, [connectionState]);

  // Don't render if fully online with no pending actions
  if (connectionState === "online") {
    return null;
  }

  const positionClasses =
    position === "top"
      ? "top-16 left-0 right-0"
      : "bottom-16 left-0 right-0 lg:bottom-0";

  const getStateConfig = () => {
    switch (connectionState) {
      case "offline": {
        // Build message based on pending actions and cached content
        let offlineMessage = "Changes will sync when connected";
        if (pendingActionCount > 0) {
          offlineMessage = `${pendingActionCount} pending action${pendingActionCount !== 1 ? "s" : ""} — will sync when connected`;
        } else if (cachedFeedCount > 0) {
          offlineMessage = `Browsing ${cachedFeedCount} cached post${cachedFeedCount !== 1 ? "s" : ""}`;
        }

        return {
          bgColor: cachedFeedCount > 0 ? "bg-blue-600" : "bg-orange-500",
          icon:
            cachedFeedCount > 0 ? (
              <Database className="h-4 w-4" />
            ) : (
              <CloudOff className="h-4 w-4" />
            ),
          title: cachedFeedCount > 0 ? "Offline mode" : "Working offline",
          message: offlineMessage,
          showProgress: false,
          showRetryButton: showRetry,
          hasCachedContent: cachedFeedCount > 0,
        };
      }
      case "reconnecting":
        return {
          bgColor: "bg-yellow-500",
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
          title: "Reconnecting",
          message:
            reconnectAttempt > 1
              ? `Attempt ${reconnectAttempt}...`
              : "Checking connection...",
          showProgress: true,
          progressValue: reconnectProgress,
          showRetryButton: false,
        };
      case "syncing":
        return {
          bgColor: "bg-blue-500",
          icon: <Upload className="h-4 w-4 animate-pulse" />,
          title: "Syncing changes",
          message:
            pendingActionCount > 0
              ? `${pendingActionCount} action${pendingActionCount !== 1 ? "s" : ""} remaining...`
              : "Finishing up...",
          showProgress: true,
          progressValue: syncProgress,
          showRetryButton: false,
        };
      case "reconnected":
        return {
          bgColor: "bg-green-500",
          icon: <CheckCircle2 className="h-4 w-4" />,
          title: "Back online",
          message:
            pendingActionCount === 0
              ? "All changes synced"
              : "Connection restored",
          showProgress: false,
          showRetryButton: false,
        };
      default:
        return {
          bgColor: "bg-gray-500",
          icon: <WifiOff className="h-4 w-4" />,
          title: "Connection status unknown",
          message: "",
          showProgress: false,
          showRetryButton: true,
        };
    }
  };

  const config = getStateConfig();

  return (
    <div
      className={`fixed z-50 ${positionClasses} ${className}`}
      role={connectionState === "offline" ? "alert" : "status"}
      aria-live={connectionState === "offline" ? "assertive" : "polite"}
    >
      <div
        className={`${config.bgColor} shadow-md transition-colors duration-300`}
      >
        {/* Progress bar */}
        {config.showProgress && (
          <div className="h-1 w-full bg-black/20">
            <div
              className="h-full bg-white/40 transition-all duration-300 ease-out"
              style={{ width: `${config.progressValue || 0}%` }}
            />
          </div>
        )}

        {/* Content */}
        <div className="flex items-center justify-center gap-3 px-4 py-2.5 text-sm font-medium text-white">
          {config.icon}
          <div className="flex items-center gap-2">
            <span className="font-semibold">{config.title}</span>
            {config.message && (
              <>
                <span className="opacity-60">—</span>
                <span className="opacity-90">{config.message}</span>
              </>
            )}
          </div>

          {/* Pending count badge */}
          {pendingActionCount > 0 &&
            connectionState !== "syncing" &&
            connectionState !== "reconnected" && (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium">
                {pendingActionCount} pending
              </span>
            )}

          {/* Manual retry button */}
          {config.showRetryButton && (
            <button
              onClick={handleManualRetry}
              className="ml-2 flex items-center gap-1 rounded-md bg-white/20 px-2.5 py-1 text-xs font-medium transition-colors hover:bg-white/30"
            >
              <RefreshCw className="h-3 w-3" />
              Retry now
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Hook to check online status with enhanced state tracking
 */
export type ConnectionStatus =
  | "online"
  | "offline"
  | "reconnecting"
  | "syncing";

export function useOnlineStatus(): {
  isOnline: boolean;
  wasOffline: boolean;
  connectionStatus: ConnectionStatus;
} {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [wasOffline, setWasOffline] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("online");
  const statusResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    // Initialize state
    const initialOnline =
      typeof navigator !== "undefined" ? navigator.onLine : true;
    setIsOnline(initialOnline);
    setConnectionStatus(initialOnline ? "online" : "offline");
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      if (!isOnline) {
        setWasOffline(true);
        setConnectionStatus("syncing");
        statusResetTimeoutRef.current = setTimeout(() => {
          setWasOffline(false);
          setConnectionStatus("online");
        }, 5000);
      }
      setIsOnline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setConnectionStatus("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (statusResetTimeoutRef.current) {
        clearTimeout(statusResetTimeoutRef.current);
        statusResetTimeoutRef.current = null;
      }
    };
  }, [isOnline]);

  return { isOnline, wasOffline, connectionStatus };
}

/**
 * Connected version of OfflineIndicator that integrates with the mutation queue and post queue
 * This component should be used in the App to show offline status with pending action count
 */
export const ConnectedOfflineIndicator: React.FC<{
  className?: string;
  position?: "top" | "bottom";
}> = ({ className, position = "top" }) => {
  // We'll connect to mutation queue via a callback pattern
  // The parent component can pass these values or they default to 0
  const [mutationPendingCount, setMutationPendingCount] = useState(0);
  const [postPendingCount, setPostPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Listen for custom events from the mutation queue
  useEffect(() => {
    const handleMutationQueueUpdate = (event: CustomEvent) => {
      const { pendingCount: count, isProcessing } = event.detail;
      setMutationPendingCount(count);
      setIsSyncing((prev) => prev || isProcessing);
    };

    const handlePostQueueUpdate = (event: CustomEvent) => {
      const { pendingCount: count, isProcessing } = event.detail;
      setPostPendingCount(count);
      setIsSyncing((prev) => prev || isProcessing);
    };

    window.addEventListener(
      "mutation-queue-update",
      handleMutationQueueUpdate as EventListener,
    );

    window.addEventListener(
      "offline-post-queue-update",
      handlePostQueueUpdate as EventListener,
    );

    return () => {
      window.removeEventListener(
        "mutation-queue-update",
        handleMutationQueueUpdate as EventListener,
      );
      window.removeEventListener(
        "offline-post-queue-update",
        handlePostQueueUpdate as EventListener,
      );
    };
  }, []);

  // Combine pending counts from both queues
  const totalPendingCount = mutationPendingCount + postPendingCount;

  return (
    <OfflineIndicator
      className={className}
      position={position}
      pendingActionCount={totalPendingCount}
      isSyncing={isSyncing}
    />
  );
};

export default OfflineIndicator;
