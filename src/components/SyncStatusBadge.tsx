/**
 * SyncStatusBadge - Visual feedback for individual action sync states
 *
 * Shows sync status for likes, reposts, bookmarks, and follows with
 * subtle visual indicators and inline retry for failed actions.
 */

import { AlertCircle, Check, Loader2, RotateCcw } from "lucide-react";
import React, { memo, useCallback, useEffect, useState } from "react";

export type SyncStatus = "idle" | "pending" | "synced" | "failed";

interface SyncStatusBadgeProps {
  status: SyncStatus;
  onRetry?: () => void;
  size?: "small" | "medium";
  className?: string;
  showSynced?: boolean;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = memo(
  ({ status, onRetry, size = "small", className = "", showSynced = true }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [displayStatus, setDisplayStatus] = useState<SyncStatus>(status);
    const [showSyncedCheck, setShowSyncedCheck] = useState(false);

    const iconSize = size === "small" ? 10 : 12;

    useEffect(() => {
      if (status === "pending" || status === "failed") {
        setIsVisible(true);
        setDisplayStatus(status);
      } else if (status === "synced" && showSynced) {
        setIsVisible(true);
        setDisplayStatus("synced");
        setShowSyncedCheck(true);

        const timer = setTimeout(() => {
          setShowSyncedCheck(false);
          setIsVisible(false);
        }, 1500);

        return () => clearTimeout(timer);
      } else {
        setIsVisible(false);
      }
    }, [status, showSynced]);

    const handleRetry = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onRetry?.();
      },
      [onRetry],
    );

    if (!isVisible) return null;

    const baseClasses =
      "absolute flex items-center justify-center rounded-full transition-all duration-200";
    const positionClasses =
      size === "small" ? "-top-0.5 -right-0.5" : "-top-1 -right-1";
    const sizeClasses = size === "small" ? "h-3.5 w-3.5" : "h-4 w-4";

    if (displayStatus === "pending") {
      return (
        <span
          className={`${baseClasses} ${positionClasses} ${sizeClasses} animate-sync-badge-in bg-blue-500 ${className}`}
          aria-label="Syncing..."
          role="status"
        >
          <Loader2
            size={iconSize}
            className="animate-spin text-white"
            aria-hidden="true"
          />
        </span>
      );
    }

    if (displayStatus === "failed") {
      return (
        <button
          onClick={handleRetry}
          className={`${baseClasses} ${positionClasses} animate-sync-badge-in group cursor-pointer border-none bg-red-500 p-0 hover:scale-110 ${className}`}
          style={{
            width: onRetry ? (size === "small" ? "28px" : "32px") : undefined,
            height: size === "small" ? "14px" : "16px",
            borderRadius: "7px",
          }}
          aria-label="Sync failed. Click to retry."
          title="Click to retry"
        >
          <span className="flex items-center gap-0.5 px-1">
            <AlertCircle size={iconSize} className="text-white" />
            {onRetry && (
              <RotateCcw
                size={iconSize - 2}
                className="text-white opacity-80 transition-opacity group-hover:opacity-100"
              />
            )}
          </span>
        </button>
      );
    }

    if (displayStatus === "synced" && showSyncedCheck) {
      return (
        <span
          className={`${baseClasses} ${positionClasses} ${sizeClasses} animate-sync-badge-in bg-green-500 ${className}`}
          aria-label="Synced"
          role="status"
        >
          <Check size={iconSize} className="text-white" aria-hidden="true" />
        </span>
      );
    }

    return null;
  },
);

SyncStatusBadge.displayName = "SyncStatusBadge";

export function useSyncStatus(
  isPending: boolean,
  isError: boolean,
  isSuccess: boolean,
): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [wasSuccessful, setWasSuccessful] = useState(false);

  useEffect(() => {
    if (isPending) {
      setStatus("pending");
      setWasSuccessful(false);
    } else if (isError) {
      setStatus("failed");
    } else if (isSuccess && !wasSuccessful) {
      setStatus("synced");
      setWasSuccessful(true);

      const timer = setTimeout(() => {
        setStatus("idle");
      }, 1500);

      return () => clearTimeout(timer);
    } else if (!isPending && !isError && !isSuccess) {
      setStatus("idle");
    }
  }, [isPending, isError, isSuccess, wasSuccessful]);

  return status;
}

export function useActionSyncStatus(
  actionUri: string | undefined,
  isPending: boolean,
  isError: boolean,
): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [previousUri, setPreviousUri] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (isPending) {
      setStatus("pending");
    } else if (isError) {
      setStatus("failed");
    } else if (
      actionUri &&
      actionUri !== previousUri &&
      !actionUri.startsWith("optimistic-")
    ) {
      setStatus("synced");
      setPreviousUri(actionUri);

      const timer = setTimeout(() => {
        setStatus("idle");
      }, 1500);

      return () => clearTimeout(timer);
    } else if (!isPending && !isError) {
      if (status === "pending") {
        setStatus("synced");
        const timer = setTimeout(() => {
          setStatus("idle");
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [actionUri, isPending, isError, previousUri, status]);

  return status;
}
