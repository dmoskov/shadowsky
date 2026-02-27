/**
 * MobileBatchProgressIndicator Component for React Native
 *
 * Shows progress of batch operations with:
 * - Progress bar with percentage
 * - Success/failure counts
 * - Pause/Resume/Cancel controls
 * - Estimated time remaining
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useBatchSelection } from "../../../contexts/BatchSelectionContext";
import { getActionDescription } from "../../../services/batch-operation-executor";
import { useDynamicType, type ScaledFontFn } from "../../hooks/useDynamicType";
import { StatusIconShimmer } from "../SkeletonShimmer";

interface MobileBatchProgressIndicatorProps {
  /** Callback when pause is clicked */
  onPause?: () => void;
  /** Callback when resume is clicked */
  onResume?: () => void;
  /** Callback when cancel is clicked */
  onCancel?: () => void;
  /** Callback when close is clicked (after completion) */
  onClose?: () => void;
}

function createStyles(scaledFont: ScaledFontFn) {
  return StyleSheet.create({
    container: {
      position: "absolute",
      bottom: 16,
      left: 8,
      right: 8,
      backgroundColor: "#ffffff",
      borderRadius: 16,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
      overflow: "hidden",
    } as ViewStyle,
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: "#e1e1e1",
    } as ViewStyle,
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    } as ViewStyle,
    titleContent: {
      flex: 1,
    } as ViewStyle,
    statusIcon: {
      fontSize: scaledFont(20),
    } as TextStyle,
    title: {
      fontSize: scaledFont(16),
      fontWeight: "600",
      color: "#0f1419",
      marginBottom: 2,
    } as TextStyle,
    subtitle: {
      fontSize: scaledFont(12),
      color: "#687684",
    } as TextStyle,
    controls: {
      flexDirection: "row",
      gap: 8,
    } as ViewStyle,
    controlButton: {
      width: 36,
      height: 36,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 18,
      backgroundColor: "#f0f0f0",
    } as ViewStyle,
    controlIcon: {
      fontSize: scaledFont(16),
    } as TextStyle,
    cancelButton: {
      width: 36,
      height: 36,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 18,
      backgroundColor: "#fee",
    } as ViewStyle,
    cancelIcon: {
      fontSize: scaledFont(16),
      color: "#dc2626",
    } as TextStyle,
    progressSection: {
      padding: 16,
    } as ViewStyle,
    progressTrack: {
      height: 8,
      backgroundColor: "#e5e7eb",
      borderRadius: 4,
      overflow: "hidden",
      marginBottom: 12,
    } as ViewStyle,
    progressBar: {
      height: "100%",
      borderRadius: 4,
    } as ViewStyle,
    stats: {
      gap: 8,
    } as ViewStyle,
    statRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    } as ViewStyle,
    successStat: {
      fontSize: scaledFont(12),
      color: "#10b981",
      fontWeight: "600",
    } as TextStyle,
    failedStat: {
      fontSize: scaledFont(12),
      color: "#ef4444",
      fontWeight: "600",
    } as TextStyle,
    timeText: {
      fontSize: scaledFont(12),
      color: "#687684",
    } as TextStyle,
    percentText: {
      fontSize: scaledFont(14),
      fontWeight: "700",
      color: "#0f1419",
    } as TextStyle,
    errorSection: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: "#e1e1e1",
      backgroundColor: "#fef2f2",
    } as ViewStyle,
    errorTitle: {
      fontSize: scaledFont(13),
      fontWeight: "600",
      color: "#dc2626",
      marginBottom: 8,
    } as TextStyle,
    errorList: {
      gap: 4,
    } as ViewStyle,
    errorItem: {
      fontSize: scaledFont(11),
      color: "#991b1b",
    } as TextStyle,
    errorMore: {
      fontSize: scaledFont(11),
      color: "#991b1b",
      fontStyle: "italic",
    } as TextStyle,
  });
}

export const MobileBatchProgressIndicator: React.FC<
  MobileBatchProgressIndicatorProps
> = ({ onPause, onResume, onCancel, onClose }) => {
  const { operation } = useBatchSelection();
  const { scaledFont } = useDynamicType();
  const styles = useMemo(() => createStyles(scaledFont), [scaledFont]);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Update elapsed time every second while running
  useEffect(() => {
    if (operation.status !== "running" || !operation.startTime) {
      return;
    }

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - operation.startTime!);
    }, 1000);

    return () => clearInterval(interval);
  }, [operation.status, operation.startTime]);

  // Calculate estimated time remaining
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

  const isActive =
    operation.status === "running" || operation.status === "paused";
  const isComplete =
    operation.status === "completed" ||
    operation.status === "cancelled" ||
    operation.status === "failed";

  // Status icon and message
  const getStatusIcon = () => {
    switch (operation.status) {
      case "running":
        return <StatusIconShimmer size={20} color="#1d9bf0" />;
      case "paused":
        return <Text style={styles.statusIcon}>⏸️</Text>;
      case "completed":
        return <Text style={styles.statusIcon}>✅</Text>;
      case "cancelled":
        return <Text style={styles.statusIcon}>❌</Text>;
      case "failed":
        return <Text style={styles.statusIcon}>⚠️</Text>;
      default:
        return <StatusIconShimmer size={20} color="#687684" />;
    }
  };

  const getStatusTitle = () => {
    switch (operation.status) {
      case "running":
        return `${actionLabel}ing users...`;
      case "paused":
        return "Paused";
      case "completed":
        return "Completed";
      case "cancelled":
        return "Cancelled";
      case "failed":
        return "Failed";
      default:
        return "Processing...";
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          {getStatusIcon()}
          <View style={styles.titleContent}>
            <Text style={styles.title}>{getStatusTitle()}</Text>
            <Text style={styles.subtitle}>
              {operation.completedCount} of {operation.totalCount} completed
            </Text>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          {operation.status === "running" && onPause && (
            <Pressable onPress={onPause} style={styles.controlButton}>
              <Text style={styles.controlIcon}>⏸️</Text>
            </Pressable>
          )}
          {operation.status === "paused" && onResume && (
            <Pressable onPress={onResume} style={styles.controlButton}>
              <Text style={styles.controlIcon}>▶️</Text>
            </Pressable>
          )}
          {isActive && onCancel && (
            <Pressable onPress={onCancel} style={styles.cancelButton}>
              <Text style={styles.cancelIcon}>⏹️</Text>
            </Pressable>
          )}
          {isComplete && onClose && (
            <Pressable onPress={onClose} style={styles.controlButton}>
              <Text style={styles.controlIcon}>✕</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressSection}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${progress}%`,
                backgroundColor:
                  operation.status === "completed"
                    ? "#10b981"
                    : operation.status === "failed"
                      ? "#ef4444"
                      : operation.status === "cancelled"
                        ? "#9ca3af"
                        : "#1d9bf0",
              },
            ]}
          />
        </View>

        {/* Stats */}
        <View style={styles.stats}>
          <View style={styles.statRow}>
            <Text style={styles.successStat}>
              ✓ {operation.completedCount - operation.failedCount} success
            </Text>
            {operation.failedCount > 0 && (
              <Text style={styles.failedStat}>
                ✗ {operation.failedCount} failed
              </Text>
            )}
          </View>

          <View style={styles.statRow}>
            {operation.status === "running" && (
              <Text style={styles.timeText}>{estimatedRemaining}</Text>
            )}
            {(operation.status === "completed" ||
              operation.status === "cancelled") &&
              operation.startTime && (
                <Text style={styles.timeText}>
                  Completed in {formatElapsed(Date.now() - operation.startTime)}
                </Text>
              )}
            <Text style={styles.percentText}>{Math.round(progress)}%</Text>
          </View>
        </View>
      </View>

      {/* Failed operations summary */}
      {isComplete && operation.failedCount > 0 && (
        <View style={styles.errorSection}>
          <Text style={styles.errorTitle}>
            {operation.failedCount} operation
            {operation.failedCount !== 1 ? "s" : ""} failed
          </Text>
          <View style={styles.errorList}>
            {operation.results
              .filter((r) => !r.success)
              .slice(0, 3)
              .map((result, index) => (
                <Text
                  key={`${result.user.did}-${index}`}
                  style={styles.errorItem}
                  numberOfLines={1}
                >
                  @{result.user.handle}: {result.error || "Unknown error"}
                </Text>
              ))}
            {operation.failedCount > 3 && (
              <Text style={styles.errorMore}>
                and {operation.failedCount - 3} more...
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
};
