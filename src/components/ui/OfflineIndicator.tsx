/**
 * OfflineIndicator - Shows when the user is offline
 *
 * A non-intrusive banner that appears at the top of the screen
 * when the network connection is lost, with reassuring messaging.
 */

import { CloudOff, RefreshCw, Wifi } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";

interface OfflineIndicatorProps {
  className?: string;
  position?: "top" | "bottom";
  showRetry?: boolean;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  className = "",
  position = "top",
  showRetry = true,
}) => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [isRetrying, setIsRetrying] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleRetry = useCallback(async () => {
    if (isRetrying) return;

    setIsRetrying(true);

    try {
      const response = await fetch("/ping", {
        method: "HEAD",
        cache: "no-store",
      });

      if (response.ok) {
        setIsOnline(true);
        setShowReconnected(true);
        setTimeout(() => setShowReconnected(false), 3000);
      }
    } catch {
      // Still offline
    } finally {
      setIsRetrying(false);
    }
  }, [isRetrying]);

  // Don't render if online and not showing reconnected message
  if (isOnline && !showReconnected) {
    return null;
  }

  const positionClasses =
    position === "top" ? "top-0 left-0 right-0" : "bottom-0 left-0 right-0";

  if (showReconnected) {
    return (
      <div
        className={`fixed z-50 ${positionClasses} ${className}`}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center justify-center gap-2 bg-green-500 px-4 py-2 text-sm font-medium text-white shadow-md">
          <Wifi className="h-4 w-4" />
          <span>You're back online</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed z-50 ${positionClasses} ${className}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-center justify-center gap-3 bg-orange-500 px-4 py-2.5 text-sm font-medium text-white shadow-md">
        <CloudOff className="h-4 w-4 flex-shrink-0" />
        <span>Working offline — changes will sync when connected</span>
        {showRetry && (
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="ml-2 flex items-center gap-1 rounded-md bg-orange-600 px-2 py-1 text-xs font-medium transition-colors hover:bg-orange-700 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3 w-3 ${isRetrying ? "animate-spin" : ""}`}
            />
            {isRetrying ? "Checking..." : "Retry"}
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Hook to check online status
 */
export function useOnlineStatus(): {
  isOnline: boolean;
  wasOffline: boolean;
} {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      if (!isOnline) {
        setWasOffline(true);
        setTimeout(() => setWasOffline(false), 5000);
      }
      setIsOnline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [isOnline]);

  return { isOnline, wasOffline };
}

export default OfflineIndicator;
