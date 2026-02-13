/**
 * Hook for batch operation keyboard shortcuts
 *
 * Provides keyboard shortcuts for power users when in batch selection mode:
 * - Ctrl/Cmd + A: Select all
 * - Ctrl/Cmd + D: Deselect all
 * - Escape: Exit selection mode
 * - Space: Toggle selection on focused item
 * - Shift+Click: Range selection (handled in UserSelectableRow)
 *
 * Additional shortcuts when items are selected:
 * - M: Mute selected
 * - B: Block selected
 * - U: Unfollow selected (when available)
 * - L: Add to list (when available)
 * - Ctrl/Cmd + Z: Undo last action
 */

import { useCallback, useEffect } from "react";
import type {
  BatchActionType,
  SelectableUser,
} from "../contexts/BatchSelectionContext";
import { useBatchSelection } from "../contexts/BatchSelectionContext";

interface UseBatchKeyboardShortcutsOptions {
  /** All users that can be selected */
  allUsers: SelectableUser[];
  /** Available actions for keyboard shortcuts */
  availableActions: BatchActionType[];
  /** Callback when an action is triggered via keyboard */
  onAction?: (actionType: BatchActionType) => void;
  /** Callback for undo action */
  onUndo?: () => void;
  /** Whether shortcuts are enabled */
  enabled?: boolean;
}

export function useBatchKeyboardShortcuts({
  allUsers,
  availableActions,
  onAction,
  onUndo,
  enabled = true,
}: UseBatchKeyboardShortcutsOptions) {
  const {
    isSelectionMode,
    toggleSelectionMode,
    selectAll,
    deselectAll,
    selectedCount,
    canUndo,
  } = useBatchSelection();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Check if we're in an editable context
      const activeElement = document.activeElement as HTMLElement | null;
      const isEditable =
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA" ||
        activeElement?.isContentEditable;

      if (isEditable) return;

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      // Global shortcuts (work regardless of selection mode)

      // Enter selection mode with Ctrl/Cmd + Shift + S
      if (isCtrlOrCmd && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        toggleSelectionMode(true);
        return;
      }

      // Only handle shortcuts when in selection mode
      if (!isSelectionMode) return;

      // Escape to exit selection mode
      if (e.key === "Escape") {
        e.preventDefault();
        toggleSelectionMode(false);
        return;
      }

      // Ctrl/Cmd + A to select all
      if (isCtrlOrCmd && e.key.toLowerCase() === "a") {
        e.preventDefault();
        selectAll(allUsers);
        return;
      }

      // Ctrl/Cmd + D to deselect all
      if (isCtrlOrCmd && e.key.toLowerCase() === "d") {
        e.preventDefault();
        deselectAll();
        return;
      }

      // Ctrl/Cmd + Z to undo
      if (isCtrlOrCmd && e.key.toLowerCase() === "z" && canUndo && onUndo) {
        e.preventDefault();
        onUndo();
        return;
      }

      // Action shortcuts (only when items are selected)
      if (selectedCount === 0) return;

      // Skip if Ctrl/Cmd is pressed for action shortcuts
      if (isCtrlOrCmd) return;

      let actionType: BatchActionType | null = null;

      switch (e.key.toLowerCase()) {
        case "m":
          // Mute
          if (availableActions.includes("mute")) {
            actionType = "mute";
          }
          break;

        case "b":
          // Block (Shift+B for extra safety)
          if (e.shiftKey && availableActions.includes("block")) {
            actionType = "block";
          }
          break;

        case "u":
          // Unfollow
          if (availableActions.includes("unfollow")) {
            actionType = "unfollow";
          }
          break;

        case "l":
          // Add to list
          if (availableActions.includes("add_to_list")) {
            actionType = "add_to_list";
          }
          break;

        case "r":
          // Remove follower (Shift+R for extra safety)
          if (e.shiftKey && availableActions.includes("remove_follower")) {
            actionType = "remove_follower";
          }
          break;
      }

      if (actionType && onAction) {
        e.preventDefault();
        onAction(actionType);
      }
    },
    [
      enabled,
      isSelectionMode,
      toggleSelectionMode,
      selectAll,
      deselectAll,
      selectedCount,
      canUndo,
      allUsers,
      availableActions,
      onAction,
      onUndo,
    ],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return {
    isSelectionMode,
    toggleSelectionMode,
  };
}

/**
 * Keyboard Shortcuts Reference (for future help modal)
 *
 * Available shortcuts:
 * - Ctrl/Cmd + Shift + S: Enter selection mode
 * - Escape: Exit selection mode
 * - Ctrl/Cmd + A: Select all
 * - Ctrl/Cmd + D: Deselect all
 * - Space: Toggle selection on focused item
 * - Shift + Click: Range select
 * - M: Mute selected users
 * - Shift + B: Block selected users
 * - U: Unfollow selected users
 * - L: Add selected to list
 * - Shift + R: Remove selected followers
 * - Ctrl/Cmd + Z: Undo last batch action
 */
