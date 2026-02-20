/**
 * BatchConfirmationDialog Component
 *
 * Modal dialog for confirming batch operations with:
 * - Pre-flight estimation display (risk level, time estimate)
 * - User count and action summary
 * - Undo capability warning for irreversible actions
 * - Cancel/Confirm actions
 */

import { AlertTriangle, Clock, Info, Users } from "lucide-react";
import React, { useEffect, useId, useRef } from "react";
import type { BatchActionType } from "../../contexts/BatchSelectionContext";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import {
  canUndoAction,
  getActionDescription,
} from "../../services/batch-operation-executor";
import type { BatchEstimation } from "../../services/batch-rate-limit-estimator";
import {
  getRiskLevelColor,
  getRiskLevelDescription,
} from "../../services/batch-rate-limit-estimator";

interface BatchConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  actionType: BatchActionType;
  selectedCount: number;
  estimation: BatchEstimation;
  /** Optional list name for add_to_list action */
  listName?: string;
}

export const BatchConfirmationDialog: React.FC<
  BatchConfirmationDialogProps
> = ({
  isOpen,
  onClose,
  onConfirm,
  actionType,
  selectedCount,
  estimation,
  listName,
}) => {
  const titleId = useId();
  const descriptionId = useId();
  const containerRef = useFocusTrap<HTMLDivElement>(isOpen);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Focus the confirm button when dialog opens
  useEffect(() => {
    if (isOpen && confirmButtonRef.current) {
      // Small delay to ensure the dialog is rendered
      setTimeout(() => confirmButtonRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const actionLabel = getActionDescription(actionType);
  const canUndo = canUndoAction(actionType);
  const riskColor = getRiskLevelColor(estimation.riskLevel);
  const riskDescription = getRiskLevelDescription(estimation.riskLevel);

  // Get action-specific warning message
  const getWarningMessage = (): string | null => {
    switch (actionType) {
      case "remove_follower":
        return "This action uses a block/unblock technique. Removed users will need to re-follow you manually.";
      case "unfollow":
        return "Unfollowed users will no longer appear in your home feed.";
      case "block":
        return "Blocked users won't be able to see your posts or interact with you.";
      default:
        return null;
    }
  };

  const warningMessage = getWarningMessage();

  // Get dialog title based on risk level
  const getDialogTitle = (): string => {
    if (estimation.riskLevel === "dangerous") {
      return `Warning: Large Batch ${actionLabel}`;
    }
    if (estimation.riskLevel === "high") {
      return `Confirm Batch ${actionLabel}`;
    }
    return `${actionLabel} ${selectedCount} User${selectedCount !== 1 ? "s" : ""}`;
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={containerRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="mx-4 w-full max-w-md overflow-hidden rounded-xl border bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b px-6 py-4 dark:border-gray-700">
          <div className="flex items-center gap-3">
            {estimation.riskLevel !== "safe" && (
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: `${riskColor}20` }}
              >
                <AlertTriangle
                  className="h-5 w-5"
                  style={{ color: riskColor }}
                  aria-hidden="true"
                />
              </div>
            )}
            <div>
              <h2
                id={titleId}
                className="text-lg font-semibold text-gray-900 dark:text-white"
              >
                {getDialogTitle()}
              </h2>
              {actionType === "add_to_list" && listName && (
                <p className="text-sm text-asph-text-secondary">
                  Adding to: {listName}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div id={descriptionId} className="space-y-4 px-6 py-4">
          {/* Stats */}
          <div className="flex gap-4">
            <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 dark:bg-gray-800">
              <Users
                className="h-4 w-4 text-asph-text-tertiary"
                aria-hidden="true"
              />
              <span className="text-sm font-medium text-asph-text-secondary">
                {selectedCount} user{selectedCount !== 1 ? "s" : ""}
              </span>
            </div>

            {estimation.estimatedTimeSeconds > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 dark:bg-gray-800">
                <Clock
                  className="h-4 w-4 text-asph-text-tertiary"
                  aria-hidden="true"
                />
                <span className="text-sm font-medium text-asph-text-secondary">
                  ~{estimation.estimatedTimeFormatted}
                </span>
              </div>
            )}
          </div>

          {/* Risk level indicator */}
          {estimation.riskLevel !== "safe" && (
            <div
              className="rounded-lg border-l-4 px-4 py-3"
              style={{
                borderLeftColor: riskColor,
                backgroundColor: `${riskColor}10`,
              }}
            >
              <p className="text-sm font-medium" style={{ color: riskColor }}>
                {riskDescription}
              </p>
              {estimation.warningMessage && (
                <p className="mt-1 text-sm text-asph-text-secondary">
                  {estimation.warningMessage}
                </p>
              )}
            </div>
          )}

          {/* Action-specific warning */}
          {warningMessage && (
            <div className="flex gap-3 rounded-lg bg-amber-50 px-4 py-3 dark:bg-amber-900/20">
              <Info
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400"
                aria-hidden="true"
              />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {warningMessage}
              </p>
            </div>
          )}

          {/* Undo capability notice */}
          {!canUndo && (
            <div className="flex gap-3 rounded-lg bg-red-50 px-4 py-3 dark:bg-red-900/20">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600 dark:text-red-400"
                aria-hidden="true"
              />
              <p className="text-sm text-red-800 dark:text-red-200">
                This action cannot be undone automatically.
              </p>
            </div>
          )}

          {/* Suggestions */}
          {estimation.suggestions && estimation.suggestions.length > 0 && (
            <div className="rounded-lg bg-blue-50 px-4 py-3 dark:bg-blue-900/20">
              <p className="mb-2 text-sm font-medium text-blue-800 dark:text-blue-200">
                Suggestions:
              </p>
              <ul className="list-inside list-disc space-y-1">
                {estimation.suggestions.map((suggestion, index) => (
                  <li
                    key={`suggestion-${index}-${suggestion.substring(0, 20)}`}
                    className="text-sm text-blue-700 dark:text-blue-300"
                  >
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800/50">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-asph-text-secondary hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            ref={confirmButtonRef}
            onClick={onConfirm}
            disabled={!estimation.canProceed}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
              actionType === "block" || actionType === "remove_follower"
                ? "bg-red-600 hover:bg-red-700 focus-visible:ring-red-500"
                : actionType === "mute" || actionType === "unfollow"
                  ? "bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500"
                  : "bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500"
            }`}
          >
            {estimation.canProceed
              ? `${actionLabel} ${selectedCount} User${selectedCount !== 1 ? "s" : ""}`
              : "Cannot Proceed (Rate Limited)"}
          </button>
        </div>
      </div>
    </div>
  );
};
