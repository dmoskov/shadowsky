/**
 * MobileBatchActionsToolbar Component for React Native
 *
 * Floating toolbar for batch operations optimized for mobile.
 * Provides quick access to batch actions with selection count.
 */

import React, { useCallback, useMemo } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import type { BatchActionType } from "../../../contexts/BatchSelectionContext";
import { useBatchSelection } from "../../../contexts/BatchSelectionContext";
import { useDynamicType, type ScaledFontFn } from "../../hooks/useDynamicType";

interface MobileBatchActionsToolbarProps {
  /** Available actions for this context */
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
  icon: string;
  variant: "default" | "danger" | "warning";
}

const actionConfigs: Record<BatchActionType, ActionConfig> = {
  mute: {
    type: "mute",
    label: "Mute",
    icon: "🔇",
    variant: "warning",
  },
  unmute: {
    type: "unmute",
    label: "Unmute",
    icon: "🔊",
    variant: "default",
  },
  block: {
    type: "block",
    label: "Block",
    icon: "🚫",
    variant: "danger",
  },
  unblock: {
    type: "unblock",
    label: "Unblock",
    icon: "✅",
    variant: "default",
  },
  unfollow: {
    type: "unfollow",
    label: "Unfollow",
    icon: "➖",
    variant: "warning",
  },
  remove_follower: {
    type: "remove_follower",
    label: "Remove",
    icon: "❌",
    variant: "danger",
  },
  add_to_list: {
    type: "add_to_list",
    label: "Add to list",
    icon: "📋",
    variant: "default",
  },
};

function createStyles(scaledFont: ScaledFontFn) {
  return StyleSheet.create({
    container: {
      position: "absolute",
      bottom: 16,
      left: 8,
      right: 8,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(255, 255, 255, 0.98)",
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
      flexWrap: "wrap",
      gap: 8,
    } as ViewStyle,
    selectionInfo: {
      flexDirection: "row",
      alignItems: "center",
      paddingRight: 8,
      borderRightWidth: 1,
      borderRightColor: "#e1e1e1",
      gap: 4,
    } as ViewStyle,
    selectionIcon: {
      fontSize: scaledFont(16),
    } as TextStyle,
    selectionCount: {
      fontSize: scaledFont(14),
      fontWeight: "600",
      color: "#0f1419",
    } as TextStyle,
    selectAllButton: {
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: "#f0f0f0",
    } as ViewStyle,
    selectAllText: {
      fontSize: scaledFont(13),
      fontWeight: "600",
      color: "#0f1419",
    } as TextStyle,
    actionsContainer: {
      flexDirection: "row",
      flex: 1,
      gap: 6,
      justifyContent: "center",
    } as ViewStyle,
    actionButton: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: "#f0f0f0",
      gap: 4,
    } as ViewStyle,
    dangerButton: {
      backgroundColor: "#fee",
    } as ViewStyle,
    warningButton: {
      backgroundColor: "#fef3cd",
    } as ViewStyle,
    actionIcon: {
      fontSize: scaledFont(14),
    } as TextStyle,
    actionLabel: {
      fontSize: scaledFont(12),
      fontWeight: "600",
      color: "#0f1419",
    } as TextStyle,
    dangerLabel: {
      color: "#dc2626",
    } as TextStyle,
    warningLabel: {
      color: "#d97706",
    } as TextStyle,
    undoButton: {
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: "#dbeafe",
    } as ViewStyle,
    undoText: {
      fontSize: scaledFont(13),
      fontWeight: "600",
      color: "#1d9bf0",
    } as TextStyle,
    controlButtons: {
      flexDirection: "row",
      gap: 6,
    } as ViewStyle,
    clearButton: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: "#f0f0f0",
    } as ViewStyle,
    clearText: {
      fontSize: scaledFont(13),
      fontWeight: "600",
      color: "#687684",
    } as TextStyle,
    doneButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: "#0f1419",
    } as ViewStyle,
    doneText: {
      fontSize: scaledFont(13),
      fontWeight: "700",
      color: "#ffffff",
    } as TextStyle,
  });
}

export const MobileBatchActionsToolbar: React.FC<
  MobileBatchActionsToolbarProps
> = ({ availableActions, onAction, onSelectAll, isUndoing, onUndo }) => {
  const {
    selectedCount,
    isSelectionMode,
    toggleSelectionMode,
    deselectAll,
    canUndo,
    operation,
  } = useBatchSelection();

  const { scaledFont } = useDynamicType();
  const styles = useMemo(() => createStyles(scaledFont), [scaledFont]);

  const handleAction = useCallback(
    (actionType: BatchActionType) => {
      onAction(actionType);
    },
    [onAction],
  );

  // Don't render if not in selection mode
  if (!isSelectionMode) return null;

  const isOperationActive =
    operation.status === "running" || operation.status === "paused";

  // Filter to show available actions
  const actions = availableActions
    .filter((type) => actionConfigs[type])
    .map((type) => actionConfigs[type]);

  return (
    <View style={styles.container}>
      {/* Selection count */}
      <View style={styles.selectionInfo}>
        <Text style={styles.selectionIcon}>☑️</Text>
        <Text style={styles.selectionCount}>{selectedCount} selected</Text>
      </View>

      {/* Select all button */}
      {onSelectAll && (
        <Pressable
          onPress={onSelectAll}
          style={styles.selectAllButton}
          disabled={isOperationActive}
        >
          <Text style={styles.selectAllText}>All</Text>
        </Pressable>
      )}

      {/* Action buttons */}
      <View style={styles.actionsContainer}>
        {actions.slice(0, 3).map((action) => (
          <Pressable
            key={action.type}
            onPress={() => handleAction(action.type)}
            style={[
              styles.actionButton,
              action.variant === "danger" && styles.dangerButton,
              action.variant === "warning" && styles.warningButton,
            ]}
            disabled={selectedCount === 0 || isOperationActive}
          >
            <Text style={styles.actionIcon}>{action.icon}</Text>
            <Text
              style={[
                styles.actionLabel,
                action.variant === "danger" && styles.dangerLabel,
                action.variant === "warning" && styles.warningLabel,
              ]}
            >
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Undo button */}
      {canUndo && onUndo && (
        <Pressable
          onPress={onUndo}
          style={styles.undoButton}
          disabled={isUndoing || isOperationActive}
        >
          <Text style={styles.undoText}>↩️ Undo</Text>
        </Pressable>
      )}

      {/* Clear/Done buttons */}
      <View style={styles.controlButtons}>
        <Pressable
          onPress={deselectAll}
          style={styles.clearButton}
          disabled={selectedCount === 0 || isOperationActive}
        >
          <Text style={styles.clearText}>Clear</Text>
        </Pressable>
        <Pressable
          onPress={() => toggleSelectionMode(false)}
          style={styles.doneButton}
        >
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
};
