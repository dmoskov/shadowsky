import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import { EyeOff, Eye, AlertTriangle } from "lucide-react-native";
import { colors } from "../constants/theme";

interface ContentLabelWarningProps {
  labels: Array<{ val: string }>;
  warningText: string;
  children: React.ReactNode;
  style?: ViewStyle;
  blurImages?: boolean;
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
}: ContentLabelWarningProps) {
  const [revealed, setRevealed] = useState(false);

  // Get icon based on label severity
  const getIcon = () => {
    const labelValues = labels.map((l) => l.val.toLowerCase());

    if (
      labelValues.includes("porn") ||
      labelValues.includes("sexual") ||
      labelValues.includes("nudity")
    ) {
      return <EyeOff size={24} color="#fff" />;
    }

    if (
      labelValues.includes("graphic-media") ||
      labelValues.includes("gore") ||
      labelValues.includes("nsfl")
    ) {
      return <AlertTriangle size={24} color="#fff" />;
    }

    return <Eye size={24} color="#fff" />;
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
      return "#dc2626"; // Red for severe content
    }

    return "#f59e0b"; // Orange for warnings
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
            <Eye size={16} color="#fff" />
            <Text style={styles.buttonText}>Show Content</Text>
          </TouchableOpacity>

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

const styles = StyleSheet.create({
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
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
  },
  description: {
    fontSize: 14,
    color: "#fff",
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
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
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
    fontSize: 11,
    color: "#fff",
    fontWeight: "500",
    textTransform: "uppercase",
  },
});
