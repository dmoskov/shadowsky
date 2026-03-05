/**
 * VideoCompressionProgress
 *
 * Displays compression progress overlay on the video preview in the composer.
 * Shows progress bar, percentage, and status messages.
 */

import React, { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import type { VideoCompressionState } from "../hooks/useVideoCompression";
import {fontSize} from '../utils/typography';

interface VideoCompressionProgressProps {
  state: VideoCompressionState;
  statusMessage: string;
  onCancel?: () => void;
}

export function VideoCompressionProgress({
  state,
  statusMessage,
  onCancel,
}: VideoCompressionProgressProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (state.status === "idle" || state.status === "skipped") {
    return null;
  }

  const isActive = state.status === "compressing" || state.status === "analyzing";
  const isComplete = state.status === "complete";
  const isError = state.status === "error";

  return (
    <View style={styles.container}>
      {isActive && (
        <>
          <View style={styles.progressBarBackground}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.round(state.progress * 100)}%` },
              ]}
            />
          </View>
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.statusText} numberOfLines={1}>
              {statusMessage}
            </Text>
          </View>
          {onCancel && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {isComplete && state.compressionRatio && state.compressionRatio > 1 && (
        <View style={styles.completeBadge}>
          <Text style={styles.completeText}>{statusMessage}</Text>
        </View>
      )}

      {isError && (
        <View style={styles.errorBadge}>
          <Text style={styles.errorText} numberOfLines={2}>
            {statusMessage}
          </Text>
        </View>
      )}
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      marginTop: 6,
    },
    progressBarBackground: {
      height: 4,
      backgroundColor: colors.surfaceElevated,
      borderRadius: 2,
      overflow: "hidden",
    },
    progressBarFill: {
      height: "100%",
      backgroundColor: colors.primary,
      borderRadius: 2,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 4,
    },
    statusText: {
      color: colors.textSecondary,
      fontSize: fontSize.caption1,
      flex: 1,
    },
    cancelButton: {
      alignSelf: "flex-start",
      marginTop: 4,
    },
    cancelText: {
      color: colors.textTertiary,
      fontSize: fontSize.caption1,
    },
    completeBadge: {
      backgroundColor: "rgba(34, 197, 94, 0.15)",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
      alignSelf: "flex-start",
    },
    completeText: {
      color: "#22c55e",
      fontSize: fontSize.caption2,
      fontWeight: "500",
    },
    errorBadge: {
      backgroundColor: "rgba(239, 68, 68, 0.15)",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
      alignSelf: "flex-start",
    },
    errorText: {
      color: "#ef4444",
      fontSize: fontSize.caption2,
    },
  });
}
