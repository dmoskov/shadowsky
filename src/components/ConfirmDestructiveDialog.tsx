/**
 * ConfirmDestructiveDialog Component
 *
 * Modal dialog for confirming destructive actions with:
 * - Red/warning styling for dangerous operations
 * - Optional re-type confirmation for high-risk actions
 * - Clear description of consequences
 * - Extends BatchConfirmationDialog patterns for consistency
 */

import { AlertTriangle, X } from "lucide-react";
import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";

export type DestructiveActionSeverity = "warning" | "danger" | "critical";

export interface ConfirmDestructiveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  /** Title of the dialog */
  title: string;
  /** Description of what will happen */
  message: string;
  /** Text to confirm (required for critical actions) */
  confirmText?: string;
  /** Text the user must type to confirm (for high-risk actions) */
  requireTypeConfirmation?: string;
  /** Label for the confirm button */
  confirmButtonLabel?: string;
  /** Label for the cancel button */
  cancelButtonLabel?: string;
  /** Severity level of the action */
  severity?: DestructiveActionSeverity;
  /** Whether the action can be undone */
  canUndo?: boolean;
  /** Additional warning message */
  warningMessage?: string;
  /** Whether the confirm action is currently processing */
  isProcessing?: boolean;
}

const severityColors: Record<
  DestructiveActionSeverity,
  {
    bg: string;
    border: string;
    text: string;
    button: string;
    buttonHover: string;
  }
> = {
  warning: {
    bg: "bg-amber-50 dark:bg-amber-900/20",
    border: "border-amber-200 dark:border-amber-800",
    text: "text-amber-800 dark:text-amber-200",
    button: "bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500",
    buttonHover: "hover:bg-amber-700",
  },
  danger: {
    bg: "bg-red-50 dark:bg-red-900/20",
    border: "border-red-200 dark:border-red-800",
    text: "text-red-800 dark:text-red-200",
    button: "bg-red-600 hover:bg-red-700 focus-visible:ring-red-500",
    buttonHover: "hover:bg-red-700",
  },
  critical: {
    bg: "bg-red-100 dark:bg-red-900/30",
    border: "border-red-300 dark:border-red-700",
    text: "text-red-900 dark:text-red-100",
    button: "bg-red-700 hover:bg-red-800 focus-visible:ring-red-600",
    buttonHover: "hover:bg-red-800",
  },
};

const severityIconColors: Record<DestructiveActionSeverity, string> = {
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-red-600 dark:text-red-400",
  critical: "text-red-700 dark:text-red-300",
};

export const ConfirmDestructiveDialog: React.FC<
  ConfirmDestructiveDialogProps
> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  requireTypeConfirmation,
  confirmButtonLabel = "Confirm",
  cancelButtonLabel = "Cancel",
  severity = "danger",
  canUndo = false,
  warningMessage,
  isProcessing = false,
}) => {
  const titleId = useId();
  const descriptionId = useId();
  const containerRef = useFocusTrap<HTMLDivElement>(isOpen);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [typedConfirmation, setTypedConfirmation] = useState("");
  const [isExiting, setIsExiting] = useState(false);

  const colors = severityColors[severity];
  const iconColor = severityIconColors[severity];

  // Reset typed confirmation when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setTypedConfirmation("");
      setIsExiting(false);
    }
  }, [isOpen]);

  // Focus appropriate element when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (requireTypeConfirmation) {
          inputRef.current?.focus();
        } else {
          confirmButtonRef.current?.focus();
        }
      }, 50);
    }
  }, [isOpen, requireTypeConfirmation]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isProcessing) {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isProcessing]);

  const handleClose = useCallback(() => {
    if (isProcessing) return;
    setIsExiting(true);
    setTimeout(() => {
      setIsExiting(false);
      onClose();
    }, 200);
  }, [isProcessing, onClose]);

  const handleConfirm = useCallback(async () => {
    if (isProcessing) return;

    // Check if type confirmation is required and matches
    if (
      requireTypeConfirmation &&
      typedConfirmation !== requireTypeConfirmation
    ) {
      inputRef.current?.focus();
      return;
    }

    await onConfirm();
  }, [isProcessing, onConfirm, requireTypeConfirmation, typedConfirmation]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !isProcessing) {
        e.preventDefault();
        handleConfirm();
      }
    },
    [handleConfirm, isProcessing],
  );

  const isConfirmDisabled =
    isProcessing ||
    Boolean(
      requireTypeConfirmation && typedConfirmation !== requireTypeConfirmation,
    );

  if (!isOpen) return null;

  return (
    <div
      className={`modal-backdrop z-[60] ${
        isExiting ? "animate-exit-fade" : "animate-enter-fade"
      }`}
      onClick={handleClose}
      role="presentation"
    >
      <div
        ref={containerRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={`modal-container modal-auto-height modal-md border bg-white dark:border-gray-700 dark:bg-gray-900 ${
          isExiting ? "animate-exit-scale" : "animate-enter-scale"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full ${colors.bg}`}
              >
                <AlertTriangle
                  className={`h-5 w-5 ${iconColor}`}
                  aria-hidden="true"
                />
              </div>
              <h2
                id={titleId}
                className="text-lg font-semibold text-gray-900 dark:text-white"
              >
                {title}
              </h2>
            </div>
            <button
              onClick={handleClose}
              disabled={isProcessing}
              className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-500 disabled:opacity-50 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              aria-label="Close dialog"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div id={descriptionId} className="space-y-4 px-6 py-4">
          <p className="text-gray-600 dark:text-gray-300">{message}</p>

          {/* Warning message */}
          {warningMessage && (
            <div
              className={`flex gap-3 rounded-lg px-4 py-3 ${colors.bg} ${colors.border} border`}
            >
              <AlertTriangle
                className={`mt-0.5 h-4 w-4 flex-shrink-0 ${iconColor}`}
                aria-hidden="true"
              />
              <p className={`text-sm ${colors.text}`}>{warningMessage}</p>
            </div>
          )}

          {/* Undo capability notice */}
          {!canUndo && (
            <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600 dark:text-red-400"
                aria-hidden="true"
              />
              <p className="text-sm text-red-800 dark:text-red-200">
                This action cannot be undone.
              </p>
            </div>
          )}

          {canUndo && (
            <div className="flex gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-800 dark:bg-green-900/20">
              <span
                className="mt-0.5 text-green-600 dark:text-green-400"
                aria-hidden="true"
              >
                ✓
              </span>
              <p className="text-sm text-green-800 dark:text-green-200">
                You can undo this action within 5 seconds.
              </p>
            </div>
          )}

          {/* Type confirmation input */}
          {requireTypeConfirmation && (
            <div className="space-y-2">
              <label
                htmlFor="confirm-input"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Type{" "}
                <span className="font-mono font-bold">
                  {requireTypeConfirmation}
                </span>{" "}
                to confirm
              </label>
              <input
                ref={inputRef}
                id="confirm-input"
                type="text"
                value={typedConfirmation}
                onChange={(e) => setTypedConfirmation(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isProcessing}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus-visible:border-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
                placeholder={requireTypeConfirmation}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800/50">
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="ios-press-light rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {cancelButtonLabel}
          </button>
          <button
            ref={confirmButtonRef}
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className={`ios-press-light rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${colors.button}`}
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Processing...
              </span>
            ) : (
              confirmButtonLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
