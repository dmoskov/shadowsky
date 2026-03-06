import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import { EyeOffIcon, EyeIcon, AlertTriangleIcon, ShieldIcon } from './icons';
import { useTheme } from "../contexts/ThemeContext";
import {fontSize} from '../utils/typography';

interface ContentLabelWarningProps {
  labels: Array<{ val: string; src?: string }>;
  warningText: string;
  children: React.ReactNode;
  style?: ViewStyle;
  blurImages?: boolean;
  onAppeal?: (labelVal: string, labelerDid: string) => void;
}

/**
 * ContentLabelWarning Component
 * Displays a warning overlay for content with moderation labels
 * Users can tap to reveal the content
 */
export function ContentLabelWarning({
  labels,
  warningText,
  children,
  style,
  blurImages = false,
  onAppeal,
}: ContentLabelWarningProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [revealed, setRevealed] = useState(false);

  // Get icon based on label severity
  const getIcon = () => {
    const labelValues = labels.map((l) => l.val.toLowerCase());

    if (
      labelValues.includes("porn") ||
      labelValues.includes("sexual") ||
      labelValues.includes("nudity")
    ) {
      return <EyeOffIcon size={24} color={colors.text} />;
    }

    if (
      labelValues.includes("graphic-media") ||
      labelValues.includes("gore") ||
      labelValues.includes("nsfl")
    ) {
      return <AlertTriangleIcon size={24} color={colors.text} />;
    }

    return <EyeIcon size={24} color={colors.text} />;
  };

  // Get background color based on severity
  const getBackgroundColor = () => {
    const labelValues = labels.map((l) => l.val.toLowerCase());

    if (
      labelValues.includes("porn") ||
      labelValues.includes("nsfl") ||
      labelValues.includes("graphic-media") ||
      labelValues.includes("gore")
    ) {
      return colors.danger; // Red for severe content
    }

    return colors.warning; // Orange for warnings
  };

  if (revealed) {
    return <View style={style}>{children}</View>;
  }

  return (
    <View style={[styles.container, style]}>
      {/* Blurred content in background */}
      {blurImages && (
        <View style={styles.blurredContent} pointerEvents="none">
          {children}
        </View>
      )}

      {/* Warning overlay */}
      <View
        style={[
          styles.overlay,
          { backgroundColor: getBackgroundColor() + "E6" }, // 90% opacity
        ]}
      >
        <View style={styles.content}>
          {getIcon()}
          <Text style={styles.warningText}>{warningText}</Text>
          <Text style={styles.description}>
            This content has been labeled by moderators
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => setRevealed(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Show ${warningText}`}
            accessibilityHint="Tap to reveal sensitive content"
          >
            <EyeIcon size={16} color={colors.text} />
            <Text style={styles.buttonText}>Show Content</Text>
          </TouchableOpacity>

          {/* Appeal button */}
          {onAppeal && labels.length > 0 && labels[0].src && (
            <TouchableOpacity
              style={styles.appealButton}
              onPress={() => onAppeal(labels[0].val, labels[0].src!)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Appeal this label"
            >
              <ShieldIcon size={14} color={colors.text} />
              <Text style={styles.appealButtonText}>Appeal</Text>
            </TouchableOpacity>
          )}

          {/* Label badges */}
          <View style={styles.labelContainer}>
            {labels.slice(0, 3).map((label, index) => (
              <View key={index} style={styles.labelBadge}>
                <Text style={styles.labelText}>{label.val}</Text>
              </View>
            ))}
            {labels.length > 3 && (
              <View style={styles.labelBadge}>
                <Text style={styles.labelText}>+{labels.length - 3}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      position: "relative",
      minHeight: 200,
    },
    blurredContent: {
      opacity: 0.1,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    content: {
      alignItems: "center",
      gap: 12,
    },
    warningText: {
      fontSize: fontSize.headline,
      fontWeight: "600",
      color: colors.text,
      textAlign: "center",
    },
    description: {
      fontSize: fontSize.subheadline,
      color: colors.text,
      opacity: 0.9,
      textAlign: "center",
    },
    button: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: "rgba(255, 255, 255, 0.2)",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      marginTop: 8,
    },
    buttonText: {
      fontSize: fontSize.subheadline,
      fontWeight: "600",
      color: colors.text,
    },
    appealButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.4)",
    },
    appealButtonText: {
      fontSize: fontSize.caption1,
      fontWeight: "500",
      color: colors.text,
      opacity: 0.9,
    },
    labelContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 6,
      marginTop: 8,
    },
    labelBadge: {
      backgroundColor: "rgba(255, 255, 255, 0.2)",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    labelText: {
      fontSize: fontSize.caption2,
      color: colors.text,
      fontWeight: "500",
      textTransform: "uppercase",
    },
  });
}
