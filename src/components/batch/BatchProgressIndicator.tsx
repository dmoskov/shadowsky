/**
 * BatchProgressIndicator Component
 *
 * Shows progress of ongoing batch operations with:
 * - Progress bar with percentage
 * - Success/failure counts
 * - Estimated time remaining
 * - Pause/Resume/Cancel controls
 */

import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Pause,
  Play,
  Square,
  X,
  XCircle,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useBatchSelection } from "../../contexts/BatchSelectionContext";
import { getActionDescription } from "../../services/batch-operation-executor";

interface BatchProgressIndicatorProps {
  /** Callback when pause is clicked */
  onPause?: () => void;
  /** Callback when resume is clicked */
  onResume?: () => void;
  /** Callback when cancel is clicked */
  onCancel?: () => void;
  /** Callback when close is clicked (after completion) */
  onClose?: () => void;
}

export const BatchProgressIndicator: React.FC<BatchProgressIndicatorProps> = ({
  onPause,
  onResume,
  onCancel,
  onClose,
}) => {
  const { operation } = useBatchSelection();
  const [elapsedTime, setElapsedTime] = useState(0);

  // Update elapsed time every second while operation is running
  useEffect(() => {
    if (operation.status !== "running" || !operation.startTime) {
      return;
    }

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - operation.startTime!);
    }, 1000);

    return () => clearInterval(interval);
  }, [operation.status, operation.startTime]);

  // Calculate estimated time remaining - must be before early return to follow rules of hooks
  const estimatedRemaining = useMemo(() => {
    if (
      operation.completedCount === 0 ||
      operation.status !== "running" ||
      elapsedTime === 0
    ) {
      return operation.estimation?.estimatedTimeFormatted || "Calculating...";
    }

    const remaining = operation.totalCount - operation.completedCount;
    const avgTimePerOp = elapsedTime / operation.completedCount;
    const remainingMs = remaining * avgTimePerOp;

    if (remainingMs < 60000) {
      return `${Math.ceil(remainingMs / 1000)}s remaining`;
    }
    const minutes = Math.ceil(remainingMs / 60000);
    return `${minutes}m remaining`;
  }, [operation, elapsedTime]);

  // Don't render if no operation or idle
  if (!operation.actionType || operation.status === "idle") {
    return null;
  }

  const actionLabel = getActionDescription(operation.actionType);
  const progress =
    operation.totalCount > 0
      ? (operation.completedCount / operation.totalCount) * 100
      : 0;

  const formatElapsed = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  // Status-specific styling and content
  const getStatusContent = () => {
    switch (operation.status) {
      case "running":
        return {
          icon: <Loader2 className="h-5 w-5 animate-spin text-blue-500" />,
          title: `${actionLabel}ing users...`,
          color: "blue",
        };
      case "paused":
        return {
          icon: <Pause className="h-5 w-5 text-amber-500" />,
          title: "Paused",
          color: "amber",
        };
      case "completed":
        return {
          icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
          title: "Completed",
          color: "green",
        };
      case "cancelled":
        return {
          icon: <XCircle className="h-5 w-5 text-asph-text-tertiary" />,
          title: "Cancelled",
          color: "gray",
        };
      case "failed":
        return {
          icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
          title: "Failed",
          color: "red",
        };
      default:
        return {
          icon: <Loader2 className="h-5 w-5 text-asph-text-tertiary" />,
          title: "Processing...",
          color: "gray",
        };
    }
  };

  const statusContent = getStatusContent();
  const isActive =
    operation.status === "running" || operation.status === "paused";
  const isComplete =
    operation.status === "completed" ||
    operation.status === "cancelled" ||
    operation.status === "failed";

  return (
    <div
      className="fixed bottom-4 left-1/2 z-50 w-full max-w-md -translate-x-1/2 rounded-xl border bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
      role="status"
      aria-live="polite"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 dark:border-gray-700">
        <div className="flex items-center gap-3">
          {statusContent.icon}
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">
              {statusContent.title}
            </h3>
            <p className="text-xs text-asph-text-tertiary">
              {operation.completedCount} of {operation.totalCount} completed
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {operation.status === "running" && onPause && (
            <button
              onClick={onPause}
              className="rounded-lg p-2 text-asph-text-tertiary hover:bg-gray-100 dark:hover:bg-gray-800"
              title="Pause"
              aria-label="Pause operation"
            >
              <Pause className="h-4 w-4" />
            </button>
          )}
          {operation.status === "paused" && onResume && (
            <button
              onClick={onResume}
              className="rounded-lg p-2 text-asph-text-tertiary hover:bg-gray-100 dark:hover:bg-gray-800"
              title="Resume"
              aria-label="Resume operation"
            >
              <Play className="h-4 w-4" />
            </button>
          )}
          {isActive && onCancel && (
            <button
              onClick={onCancel}
              className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
              title="Cancel"
              aria-label="Cancel operation"
            >
              <Square className="h-4 w-4" />
            </button>
          )}
          {isComplete && onClose && (
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-asph-text-tertiary hover:bg-gray-100 dark:hover:bg-gray-800"
              title="Close"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 py-3">
        <div className="mb-2 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className={`h-full transition-all duration-300 ${
              operation.status === "completed"
                ? "bg-green-500"
                : operation.status === "failed"
                  ? "bg-red-500"
                  : operation.status === "cancelled"
                    ? "bg-gray-400"
                    : "bg-blue-500"
            }`}
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progress: ${Math.round(progress)}%`}
          />
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-xs text-asph-text-tertiary">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <CheckCircle2
                className="h-3 w-3 text-green-500"
                aria-hidden="true"
              />
              {operation.completedCount - operation.failedCount} success
            </span>
            {operation.failedCount > 0 && (
              <span className="flex items-center gap-1">
                <XCircle className="h-3 w-3 text-red-500" aria-hidden="true" />
                {operation.failedCount} failed
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {operation.status === "running" && (
              <span>{estimatedRemaining}</span>
            )}
            {(operation.status === "completed" ||
              operation.status === "cancelled") &&
              operation.startTime && (
                <span>
                  Completed in {formatElapsed(Date.now() - operation.startTime)}
                </span>
              )}
            <span>{Math.round(progress)}%</span>
          </div>
        </div>
      </div>

      {/* Failed operations summary */}
      {isComplete && operation.failedCount > 0 && (
        <div className="border-t px-4 py-3 dark:border-gray-700">
          <details className="text-sm">
            <summary className="cursor-pointer text-red-600 hover:text-red-700 dark:text-red-400">
              {operation.failedCount} operation
              {operation.failedCount !== 1 ? "s" : ""} failed
            </summary>
            <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto">
              {operation.results
                .filter((r) => !r.success)
                .map((result, index) => (
                  <li
                    key={`${result.user.did}-${index}`}
                    className="text-xs text-asph-text-secondary"
                  >
                    <span className="font-medium">@{result.user.handle}</span>:{" "}
                    {result.error || "Unknown error"}
                  </li>
                ))}
            </ul>
          </details>
        </div>
      )}
    </div>
  );
};
