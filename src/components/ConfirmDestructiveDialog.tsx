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
import { Button } from "./ui/Button";
import { Modal, ModalFooter } from "./ui/Modal";

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
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [typedConfirmation, setTypedConfirmation] = useState("");

  const colors = severityColors[severity];
  const iconColor = severityIconColors[severity];

  // Reset typed confirmation when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setTypedConfirmation("");
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      role="alertdialog"
      labelledBy={titleId}
      describedBy={descriptionId}
      closeOnBackdrop={!isProcessing}
      closeOnEscape={!isProcessing}
      backdropClassName="z-[60]"
      className="border border-asph-border-primary bg-asph-bg-secondary"
    >
      {(close) => (
        <>
          {/* Header */}
          <div className="border-b border-asph-border-primary px-6 py-4">
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
                  className="text-lg font-semibold text-asph-text-primary"
                >
                  {title}
                </h2>
              </div>
              <button
                onClick={close}
                disabled={isProcessing}
                className="touch-target-icon rounded-full p-1 text-asph-text-tertiary transition-colors hover:bg-asph-bg-hover hover:text-asph-text-secondary disabled:opacity-50"
                aria-label="Close dialog"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div id={descriptionId} className="space-y-4 px-6 py-4">
            <p className="text-asph-text-secondary">{message}</p>

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
                  className="block text-sm font-medium text-asph-text-secondary"
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
                  className="w-full rounded-lg border border-asph-border-secondary bg-asph-bg-secondary px-3 py-2 text-asph-text-primary placeholder-asph-text-tertiary focus-visible:border-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
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
          <ModalFooter className="bg-asph-bg-tertiary px-6 py-4">
            <Button
              variant="ghost"
              className="touch-target-sm ios-press-light"
              onClick={close}
              disabled={isProcessing}
            >
              {cancelButtonLabel}
            </Button>
            <button
              ref={confirmButtonRef}
              onClick={handleConfirm}
              disabled={isConfirmDisabled}
              className={`touch-target ios-press-light rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${colors.button}`}
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
          </ModalFooter>
        </>
      )}
    </Modal>
  );
};
