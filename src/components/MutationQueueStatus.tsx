/**
 * Mutation Queue Status Indicator
 *
 * Shows pending offline mutations and sync status with user-friendly messaging.
 * Only visible when there are pending items or when offline.
 */

import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  CloudOff,
  HelpCircle,
  RefreshCw,
  Trash2,
  Wifi,
} from "lucide-react";
import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useMutationQueue } from "../hooks/useMutationQueue";

interface StatusConfig {
  icon: React.ReactNode;
  title: string;
  message: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
}

export const MutationQueueStatus: React.FC = () => {
  const { agent } = useAuth();
  const {
    pendingCount,
    failedCount,
    isProcessing,
    isOnline,
    triggerSync,
    clearQueue,
    isInitialized,
  } = useMutationQueue(agent);
  const [isExpanded, setIsExpanded] = useState(false);

  // Don't show if nothing to display
  if (!isInitialized || (isOnline && pendingCount === 0 && failedCount === 0)) {
    return null;
  }

  const getStatusConfig = (): StatusConfig => {
    if (!isOnline) {
      return {
        icon: <CloudOff className="h-4 w-4 text-orange-500" />,
        title: "Working offline",
        message:
          pendingCount > 0
            ? `${pendingCount} action${pendingCount !== 1 ? "s" : ""} saved. Will sync when you're back online.`
            : "Your changes are saved locally.",
        bgColor: "bg-orange-50 dark:bg-orange-900/20",
        borderColor: "border-orange-200 dark:border-orange-800",
        textColor: "text-orange-800 dark:text-orange-200",
      };
    }
    if (isProcessing) {
      return {
        icon: <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />,
        title: "Syncing your changes",
        message: "Please wait while we save your actions...",
        bgColor: "bg-blue-50 dark:bg-blue-900/20",
        borderColor: "border-blue-200 dark:border-blue-800",
        textColor: "text-blue-800 dark:text-blue-200",
      };
    }
    if (failedCount > 0) {
      return {
        icon: <AlertCircle className="h-4 w-4 text-red-500" />,
        title: `${failedCount} action${failedCount !== 1 ? "s" : ""} couldn't be saved`,
        message:
          "Some changes failed to sync. You can try again or discard them.",
        bgColor: "bg-red-50 dark:bg-red-900/20",
        borderColor: "border-red-200 dark:border-red-800",
        textColor: "text-red-800 dark:text-red-200",
      };
    }
    if (pendingCount > 0) {
      return {
        icon: <RefreshCw className="h-4 w-4 text-yellow-500" />,
        title: `${pendingCount} action${pendingCount !== 1 ? "s" : ""} waiting`,
        message: "These will sync automatically when possible.",
        bgColor: "bg-yellow-50 dark:bg-yellow-900/20",
        borderColor: "border-yellow-200 dark:border-yellow-800",
        textColor: "text-yellow-800 dark:text-yellow-200",
      };
    }
    return {
      icon: <CheckCircle className="h-4 w-4 text-green-500" />,
      title: "All synced",
      message: "Your changes are saved.",
      bgColor: "bg-green-50 dark:bg-green-900/20",
      borderColor: "border-green-200 dark:border-green-800",
      textColor: "text-green-800 dark:text-green-200",
    };
  };

  const config = getStatusConfig();

  const handleSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await triggerSync();
  };

  const handleClear = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      window.confirm("Discard unsaved changes? This action cannot be undone.")
    ) {
      await clearQueue();
    }
  };

  const getCompactLabel = () => {
    if (!isOnline) return "Offline";
    if (isProcessing) return "Syncing";
    if (failedCount > 0) return `${failedCount} failed`;
    if (pendingCount > 0) return `${pendingCount} pending`;
    return "Synced";
  };

  return (
    <div className="fixed bottom-20 left-4 z-50 lg:bottom-4">
      <div
        className={`rounded-lg border shadow-lg transition-all duration-200 ${config.bgColor} ${config.borderColor} ${isExpanded ? "w-72" : "w-auto"}`}
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex w-full items-center gap-2 p-3 text-left hover:opacity-90"
          aria-expanded={isExpanded}
          aria-label={`Sync status: ${config.title}`}
        >
          {config.icon}
          {isExpanded ? (
            <div className="flex flex-1 items-center justify-between">
              <span className={`text-sm font-medium ${config.textColor}`}>
                {config.title}
              </span>
              <ChevronUp className="h-4 w-4 text-gray-400" />
            </div>
          ) : (
            <>
              <span
                className="text-xs font-medium"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                {getCompactLabel()}
              </span>
              <ChevronDown className="h-3 w-3 text-gray-400" />
            </>
          )}
        </button>

        {isExpanded && (
          <div
            className="border-t px-3 pb-3 pt-2"
            style={{ borderColor: "var(--asph-border)" }}
          >
            <p
              className="mb-3 text-xs"
              style={{ color: "var(--asph-text-secondary)" }}
            >
              {config.message}
            </p>

            {/* Status details */}
            <div
              className="mb-3 flex items-center gap-3 text-xs"
              style={{ color: "var(--asph-text-tertiary)" }}
            >
              <div className="flex items-center gap-1">
                <Wifi
                  className={`h-3 w-3 ${isOnline ? "text-green-500" : "text-orange-500"}`}
                />
                <span>{isOnline ? "Online" : "Offline"}</span>
              </div>
              {pendingCount > 0 && (
                <div className="flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" />
                  <span>{pendingCount} waiting</span>
                </div>
              )}
              {failedCount > 0 && (
                <div className="flex items-center gap-1 text-red-500">
                  <AlertCircle className="h-3 w-3" />
                  <span>{failedCount} failed</span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              {isOnline &&
                (pendingCount > 0 || failedCount > 0) &&
                !isProcessing && (
                  <button
                    onClick={handleSync}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white transition-colors"
                    style={{ backgroundColor: "var(--asph-primary)" }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Sync now
                  </button>
                )}
              {(pendingCount > 0 || failedCount > 0) && (
                <button
                  onClick={handleClear}
                  className="flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:opacity-80"
                  style={{
                    backgroundColor: "var(--asph-bg-secondary)",
                    borderColor: "var(--asph-border)",
                    color: "var(--asph-text-secondary)",
                  }}
                  title="Discard unsaved changes"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Discard
                </button>
              )}
            </div>

            {/* Help tip for failed items */}
            {failedCount > 0 && (
              <div
                className="mt-3 flex items-start gap-1.5 text-xs"
                style={{ color: "var(--asph-text-tertiary)" }}
              >
                <HelpCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                <span>
                  Failed actions might be due to network issues or server
                  problems. Try syncing again later.
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
