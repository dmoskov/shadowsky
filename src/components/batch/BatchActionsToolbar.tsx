/**
 * BatchActionsToolbar Component
 *
 * Floating toolbar that appears when users are selected in batch selection mode.
 * Provides quick access to batch actions and shows selection count.
 */

import {
  Ban,
  Check,
  CheckSquare,
  ChevronDown,
  List,
  Undo2,
  UserMinus,
  UserX,
  VolumeX,
  X,
} from "lucide-react";
import React, { useCallback, useState } from "react";
import type { BatchActionType } from "../../contexts/BatchSelectionContext";
import { useBatchSelection } from "../../contexts/BatchSelectionContext";

interface BatchActionsToolbarProps {
  /** Available actions for this context (e.g., followers vs following lists) */
  availableActions: BatchActionType[];
  /** Callback when an action is selected */
  onAction: (actionType: BatchActionType) => void;
  /** Callback for select all */
  onSelectAll?: () => void;
  /** Whether undo is being processed */
  isUndoing?: boolean;
  /** Callback for undo action */
  onUndo?: () => void;
}

interface ActionConfig {
  type: BatchActionType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  variant: "default" | "danger" | "warning";
  description: string;
}

const actionConfigs: Record<BatchActionType, ActionConfig> = {
  mute: {
    type: "mute",
    label: "Mute",
    icon: VolumeX,
    variant: "warning",
    description: "Mute selected users",
  },
  unmute: {
    type: "unmute",
    label: "Unmute",
    icon: VolumeX,
    variant: "default",
    description: "Unmute selected users",
  },
  block: {
    type: "block",
    label: "Block",
    icon: Ban,
    variant: "danger",
    description: "Block selected users",
  },
  unblock: {
    type: "unblock",
    label: "Unblock",
    icon: Ban,
    variant: "default",
    description: "Unblock selected users",
  },
  unfollow: {
    type: "unfollow",
    label: "Unfollow",
    icon: UserMinus,
    variant: "warning",
    description: "Unfollow selected users",
  },
  remove_follower: {
    type: "remove_follower",
    label: "Remove",
    icon: UserX,
    variant: "danger",
    description: "Remove selected followers",
  },
  add_to_list: {
    type: "add_to_list",
    label: "Add to list",
    icon: List,
    variant: "default",
    description: "Add selected users to a list",
  },
};

export const BatchActionsToolbar: React.FC<BatchActionsToolbarProps> = ({
  availableActions,
  onAction,
  onSelectAll,
  isUndoing,
  onUndo,
}) => {
  const {
    selectedCount,
    isSelectionMode,
    toggleSelectionMode,
    deselectAll,
    canUndo,
    operation,
  } = useBatchSelection();

  const [showDropdown, setShowDropdown] = useState(false);

  const handleAction = useCallback(
    (actionType: BatchActionType) => {
      setShowDropdown(false);
      onAction(actionType);
    },
    [onAction],
  );

  const handleUndo = useCallback(() => {
    setShowDropdown(false);
    onUndo?.();
  }, [onUndo]);

  // Don't render if not in selection mode
  if (!isSelectionMode) return null;

  // Filter to only show available actions
  const actions = availableActions
    .filter((type) => actionConfigs[type])
    .map((type) => actionConfigs[type]);

  // Show primary actions directly, others in dropdown
  const primaryActions = actions.slice(0, 3);
  const dropdownActions = actions.slice(3);

  const getButtonClasses = (variant: "default" | "danger" | "warning") => {
    const base =
      "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

    switch (variant) {
      case "danger":
        return `${base} bg-red-100 text-red-700 hover:bg-red-200 focus-visible:ring-red-500 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50`;
      case "warning":
        return `${base} bg-amber-100 text-amber-700 hover:bg-amber-200 focus-visible:ring-amber-500 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50`;
      default:
        return `${base} bg-asph-bg-tertiary text-asph-text-secondary hover:bg-asph-bg-active focus-visible:ring-asph-border-secondary`;
    }
  };

  const isOperationActive =
    operation.status === "running" || operation.status === "paused";

  return (
    <div
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border bg-asph-bg-secondary/95 px-4 py-2 shadow-xl backdrop-blur-sm border-asph-border-primary"
      role="toolbar"
      aria-label="Batch actions"
    >
      {/* Selection count */}
      <div className="flex items-center gap-2 border-r border-asph-border-primary pr-3">
        <CheckSquare className="h-4 w-4 text-blue-500" aria-hidden="true" />
        <span className="text-sm font-medium text-asph-text-secondary">
          {selectedCount} selected
        </span>
      </div>

      {/* Select all button */}
      {onSelectAll && (
        <button
          onClick={onSelectAll}
          className="touch-target-sm flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-asph-text-secondary hover:bg-asph-bg-hover"
          disabled={isOperationActive}
        >
          <Check className="h-4 w-4" aria-hidden="true" />
          All
        </button>
      )}

      {/* Primary actions */}
      {primaryActions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.type}
            onClick={() => handleAction(action.type)}
            className={`touch-target ${getButtonClasses(action.variant)}`}
            disabled={selectedCount === 0 || isOperationActive}
            title={action.description}
            aria-label={action.description}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{action.label}</span>
          </button>
        );
      })}

      {/* Dropdown for additional actions */}
      {dropdownActions.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className={`touch-target ${getButtonClasses("default")} ${showDropdown ? "bg-asph-bg-active" : ""}`}
            disabled={selectedCount === 0 || isOperationActive}
            aria-expanded={showDropdown}
            aria-haspopup="menu"
          >
            More
            <ChevronDown
              className={`h-4 w-4 transition-transform ${showDropdown ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>

          {showDropdown && (
            <>
              {/* Backdrop to close dropdown */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowDropdown(false)}
                aria-hidden="true"
              />
              <div
                className="absolute bottom-full left-0 z-50 mb-2 w-48 overflow-hidden rounded-lg border bg-asph-bg-secondary shadow-lg border-asph-border-primary"
                role="menu"
              >
                {dropdownActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.type}
                      onClick={() => handleAction(action.type)}
                      className="touch-target-list-item flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-asph-text-secondary hover:bg-asph-bg-hover"
                      role="menuitem"
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {action.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Undo button */}
      {canUndo && onUndo && (
        <button
          onClick={handleUndo}
          className="touch-target-sm flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-blue-600 hover:bg-blue-50 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
          disabled={isUndoing || isOperationActive}
          title="Undo last action"
          aria-label="Undo last action"
        >
          <Undo2 className="h-4 w-4" aria-hidden="true" />
          Undo
        </button>
      )}

      {/* Divider */}
      <div className="mx-1 h-6 w-px bg-asph-border-primary" />

      {/* Deselect all */}
      <button
        onClick={deselectAll}
        className="touch-target-sm flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-asph-text-secondary hover:bg-asph-bg-hover"
        disabled={selectedCount === 0 || isOperationActive}
        title="Deselect all"
        aria-label="Deselect all"
      >
        <X className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Clear</span>
      </button>

      {/* Exit selection mode */}
      <button
        onClick={() => toggleSelectionMode(false)}
        className="touch-target-sm flex items-center gap-1.5 rounded-lg bg-asph-bg-active px-3 py-1.5 text-sm font-medium text-asph-text-secondary hover:bg-asph-border-secondary"
        title="Exit selection mode (Esc)"
        aria-label="Exit selection mode"
      >
        Done
      </button>
    </div>
  );
};
