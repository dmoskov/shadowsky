import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { BlurOverlay } from "./BlurOverlay";
import { ChartIcon } from "./icons";
import {
  PAN_ENGAGEMENT_LABELS,
  isPanLabel,
  type PanLabelConfig,
} from "../config/pan-labeler";
import { fontSize } from "../utils/typography";

interface PanEngagementBadgeProps {
  labels?: Array<{ val: string; src?: string }>;
}

export function PanEngagementBadge({ labels }: PanEngagementBadgeProps) {
  const { colors } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const { width: windowWidth } = useWindowDimensions();
  const isWideScreen = windowWidth > 768;

  const panLabels = useMemo(() => {
    if (!labels || labels.length === 0) return [];
    return labels
      .filter(isPanLabel)
      .map((l) => ({
        val: l.val,
        config: PAN_ENGAGEMENT_LABELS[l.val],
      }))
      .filter((l): l is { val: string; config: PanLabelConfig } => !!l.config);
  }, [labels]);

  if (panLabels.length === 0) return null;

  const hasDisruptive = panLabels.some((l) => l.config.category === "disruptive");
  const hasConstructive = panLabels.some((l) => l.config.category === "constructive");

  let pillColor: string;
  if (hasDisruptive && hasConstructive) {
    pillColor = "#d97706";
  } else if (hasDisruptive) {
    pillColor = "#dc2626";
  } else {
    pillColor = "#059669";
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.badge, { borderColor: pillColor }]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
        accessibilityLabel="View engagement labels"
        accessibilityRole="button"
      >
        <ChartIcon size={12} color={pillColor} />
        <Text style={[styles.badgeText, { color: pillColor }]}>Engagement</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <BlurOverlay />
        </TouchableOpacity>
        <View style={styles.modalContainer} pointerEvents="box-none">
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: colors.background,
                maxWidth: isWideScreen ? 480 : windowWidth - 48,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Engagement Analysis
            </Text>

            <ScrollView style={styles.labelsList}>
              {panLabels.map(({ val, config }) => (
                <View key={val} style={styles.labelRow}>
                  <View
                    style={[styles.labelDot, { backgroundColor: config.color }]}
                  />
                  <View style={styles.labelInfo}>
                    <Text style={[styles.labelName, { color: config.color }]}>
                      {config.displayName}
                    </Text>
                    <Text
                      style={[
                        styles.labelDescription,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {config.description}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            <Text
              style={[styles.footer, { color: colors.textSecondary }]}
            >
              Powered by pan engagement analysis
            </Text>

            <TouchableOpacity
              style={[styles.closeButton, { borderTopColor: colors.border }]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={[styles.closeButtonText, { color: colors.primary }]}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: fontSize.caption2,
    fontWeight: "600",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  modalTitle: {
    fontSize: fontSize.title3,
    fontWeight: "700",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  labelsList: {
    maxHeight: 300,
    paddingHorizontal: 20,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 8,
  },
  labelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  labelInfo: {
    flex: 1,
  },
  labelName: {
    fontSize: fontSize.subheadline,
    fontWeight: "600",
  },
  labelDescription: {
    fontSize: fontSize.caption1,
    marginTop: 2,
  },
  footer: {
    fontSize: fontSize.caption2,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    opacity: 0.6,
  },
  closeButton: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 16,
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: fontSize.body,
    fontWeight: "600",
  },
});
