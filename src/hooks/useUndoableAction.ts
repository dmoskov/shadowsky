/**
 * useUndoableAction Hook
 *
 * Provides state-based undo capability for destructive actions.
 * Stores pending deletions in component state and executes actual
 * deletion after undo window expires.
 *
 * Usage:
 * const { executePendingAction, cancelPendingAction, hasPendingAction } = useUndoableAction({
 *   onExecute: async () => { ... },
 *   onUndo: () => { ... },
 *   undoWindowMs: 5000,
 * });
 */

import { useCallback, useRef, useState } from "react";
import { useToast } from "../contexts/ToastContext";

export interface UndoableActionOptions<T = void> {
  /** The actual action to execute after undo window expires */
  onExecute: () => Promise<T>;
  /** Optional callback when user clicks undo (before execute) */
  onUndo?: () => void;
  /** Duration of the undo window in milliseconds (default: 5000) */
  undoWindowMs?: number;
  /** Message to show in the undo toast */
  toastMessage?: string;
  /** Whether to show a toast notification (default: true) */
  showToast?: boolean;
}

export interface PendingAction<TData = unknown> {
  id: string;
  data: TData;
  timeoutId: ReturnType<typeof setTimeout>;
  toastId?: string;
}

export interface UseUndoableActionReturn<TData = unknown> {
  /** Queue an action for execution after the undo window */
  queueAction: (id: string, data?: TData) => void;
  /** Cancel a pending action (undo) */
  cancelAction: (id: string) => void;
  /** Check if an action is pending */
  isPending: (id: string) => boolean;
  /** Get all pending action IDs */
  pendingIds: string[];
  /** Check if there are any pending actions */
  hasPendingActions: boolean;
  /** Execute an action immediately (bypass undo window) */
  executeImmediately: (id: string, data?: TData) => Promise<void>;
  /** Cancel all pending actions */
  cancelAll: () => void;
}

export function useUndoableAction<TData = unknown>(
  options: UndoableActionOptions,
): UseUndoableActionReturn<TData> {
  const {
    onExecute,
    onUndo,
    undoWindowMs = 5000,
    toastMessage = "Action will complete soon",
    showToast: shouldShowToast = true,
  } = options;

  const [pendingActions, setPendingActions] = useState<
    Map<string, PendingAction<TData>>
  >(new Map());
  const { showUndoToast, dismissToast } = useToast();
  const pendingActionsRef = useRef(pendingActions);
  pendingActionsRef.current = pendingActions;

  const executeAction = useCallback(
    async (id: string) => {
      const pending = pendingActionsRef.current.get(id);
      if (!pending) return;

      // Remove from pending
      setPendingActions((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });

      // Execute the actual action
      try {
        await onExecute();
      } catch (error) {
        console.error(`Failed to execute undoable action ${id}:`, error);
        throw error;
      }
    },
    [onExecute],
  );

  const cancelAction = useCallback(
    (id: string) => {
      const pending = pendingActionsRef.current.get(id);
      if (!pending) return;

      // Clear the timeout
      clearTimeout(pending.timeoutId);

      // Dismiss the toast if shown
      if (pending.toastId) {
        dismissToast(pending.toastId);
      }

      // Remove from pending
      setPendingActions((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });

      // Call the undo callback
      onUndo?.();
    },
    [dismissToast, onUndo],
  );

  const queueAction = useCallback(
    (id: string, data?: TData) => {
      // If already pending, cancel the old one first
      if (pendingActionsRef.current.has(id)) {
        cancelAction(id);
      }

      // Show undo toast
      let toastId: string | undefined;
      if (shouldShowToast) {
        toastId = showUndoToast(
          toastMessage,
          () => cancelAction(id),
          () => executeAction(id),
          undoWindowMs,
        );
      }

      // Set timeout for execution
      const timeoutId = setTimeout(() => {
        executeAction(id);
      }, undoWindowMs);

      // Add to pending actions
      const pendingAction: PendingAction<TData> = {
        id,
        data: data as TData,
        timeoutId,
        toastId,
      };

      setPendingActions((prev) => {
        const next = new Map(prev);
        next.set(id, pendingAction);
        return next;
      });
    },
    [
      cancelAction,
      executeAction,
      shouldShowToast,
      showUndoToast,
      toastMessage,
      undoWindowMs,
    ],
  );

  const isPending = useCallback(
    (id: string) => pendingActionsRef.current.has(id),
    [],
  );

  const executeImmediately = useCallback(
    async (id: string, _data?: TData) => {
      // If there's a pending action, cancel its timer but execute immediately
      const pending = pendingActionsRef.current.get(id);
      if (pending) {
        clearTimeout(pending.timeoutId);
        if (pending.toastId) {
          dismissToast(pending.toastId);
        }
        setPendingActions((prev) => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
      }

      // Execute immediately
      await onExecute();
    },
    [dismissToast, onExecute],
  );

  const cancelAll = useCallback(() => {
    pendingActionsRef.current.forEach((pending, _id) => {
      clearTimeout(pending.timeoutId);
      if (pending.toastId) {
        dismissToast(pending.toastId);
      }
      onUndo?.();
    });

    setPendingActions(new Map());
  }, [dismissToast, onUndo]);

  return {
    queueAction,
    cancelAction,
    isPending,
    pendingIds: Array.from(pendingActions.keys()),
    hasPendingActions: pendingActions.size > 0,
    executeImmediately,
    cancelAll,
  };
}

/**
 * Simpler hook for single item undo actions
 */
export interface UseSingleUndoableActionOptions {
  onExecute: () => Promise<void>;
  onUndo?: () => void;
  undoWindowMs?: number;
  toastMessage?: string;
}

export interface UseSingleUndoableActionReturn {
  execute: () => void;
  cancel: () => void;
  isPending: boolean;
}

export function useSingleUndoableAction(
  options: UseSingleUndoableActionOptions,
): UseSingleUndoableActionReturn {
  const {
    onExecute,
    onUndo,
    undoWindowMs = 5000,
    toastMessage = "Action will complete soon",
  } = options;

  const [isPending, setIsPending] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const toastIdRef = useRef<string>();
  const { showUndoToast, dismissToast } = useToast();

  const executeAction = useCallback(async () => {
    setIsPending(false);
    toastIdRef.current = undefined;
    try {
      await onExecute();
    } catch (error) {
      console.error("Failed to execute undoable action:", error);
    }
  }, [onExecute]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
    if (toastIdRef.current) {
      dismissToast(toastIdRef.current);
      toastIdRef.current = undefined;
    }
    setIsPending(false);
    onUndo?.();
  }, [dismissToast, onUndo]);

  const execute = useCallback(() => {
    // Cancel any existing pending action
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setIsPending(true);

    // Show undo toast
    toastIdRef.current = showUndoToast(
      toastMessage,
      cancel,
      executeAction,
      undoWindowMs,
    );

    // Set timeout for execution
    timeoutRef.current = setTimeout(() => {
      executeAction();
    }, undoWindowMs);
  }, [cancel, executeAction, showUndoToast, toastMessage, undoWindowMs]);

  return {
    execute,
    cancel,
    isPending,
  };
}
