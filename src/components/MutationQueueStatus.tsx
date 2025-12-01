/**
 * Mutation Queue Status Indicator
 *
 * Shows pending offline mutations and sync status.
 * Only visible when there are pending items or when offline.
 */

import { AlertCircle, CheckCircle, CloudOff, RefreshCw } from "lucide-react";
import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useMutationQueue } from "../hooks/useMutationQueue";

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

  const getStatusIcon = () => {
    if (!isOnline) {
      return <CloudOff className="h-4 w-4 text-orange-500" />;
    }
    if (isProcessing) {
      return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
    }
    if (failedCount > 0) {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
    if (pendingCount > 0) {
      return <RefreshCw className="h-4 w-4 text-yellow-500" />;
    }
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  const getStatusText = () => {
    if (!isOnline) {
      return pendingCount > 0 ? `Offline (${pendingCount} pending)` : "Offline";
    }
    if (isProcessing) {
      return "Syncing...";
    }
    if (failedCount > 0) {
      return `${failedCount} failed`;
    }
    if (pendingCount > 0) {
      return `${pendingCount} pending`;
    }
    return "Synced";
  };

  const handleSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await triggerSync();
  };

  const handleClear = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      window.confirm(
        "Clear all pending mutations? This will discard unsaved actions.",
      )
    ) {
      await clearQueue();
    }
  };

  return (
    <div className="fixed bottom-20 left-4 z-50 lg:bottom-4">
      <div
        className={`rounded-lg border shadow-lg transition-all duration-200 ${isExpanded ? "w-56" : "w-auto"}`}
        style={{
          background: "var(--bsky-bg-secondary)",
          borderColor: "var(--bsky-border)",
        }}
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex w-full items-center gap-2 p-3 text-left hover:opacity-80"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          {getStatusIcon()}
          {isExpanded && (
            <div className="flex-1">
              <span className="text-sm font-medium">{getStatusText()}</span>
            </div>
          )}
          {!isExpanded && (pendingCount > 0 || failedCount > 0) && (
            <span
              className="text-xs font-medium"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              {pendingCount + failedCount}
            </span>
          )}
        </button>

        {isExpanded && (
          <div
            className="border-t px-3 py-2 text-xs"
            style={{
              borderColor: "var(--bsky-border)",
              color: "var(--bsky-text-secondary)",
            }}
          >
            <div className="space-y-1">
              <div>Network: {isOnline ? "Online" : "Offline"}</div>
              {pendingCount > 0 && <div>Pending: {pendingCount}</div>}
              {failedCount > 0 && (
                <div className="text-red-500">Failed: {failedCount}</div>
              )}
            </div>

            <div className="mt-2 flex gap-2">
              {isOnline && pendingCount > 0 && !isProcessing && (
                <button
                  onClick={handleSync}
                  className="flex-1 rounded px-2 py-1 text-xs font-medium transition-colors"
                  style={{
                    background: "var(--bsky-primary)",
                    color: "white",
                  }}
                >
                  Sync Now
                </button>
              )}
              {(pendingCount > 0 || failedCount > 0) && (
                <button
                  onClick={handleClear}
                  className="rounded px-2 py-1 text-xs font-medium transition-colors hover:opacity-80"
                  style={{
                    background: "var(--bsky-bg-tertiary)",
                    color: "var(--bsky-text-secondary)",
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
