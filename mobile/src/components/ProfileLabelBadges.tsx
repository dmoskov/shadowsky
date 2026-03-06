import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { ShieldIcon } from "./icons";
import { fontSize } from "../utils/typography";

interface ProfileLabelBadgesProps {
  labels?: Array<{ val: string; src: string }>;
  profileDid?: string;
}

const LABEL_DISPLAY_NAMES: Record<string, string> = {
  porn: "Adult Content",
  sexual: "Sexually Suggestive",
  nudity: "Nudity",
  "graphic-media": "Graphic Media",
  gore: "Gore",
  nsfl: "NSFL",
  spam: "Spam",
  impersonation: "Impersonation",
  scam: "Scam",
  misleading: "Misleading",
};

function getSeverityColor(val: string): "danger" | "warning" | "info" {
  const lower = val.toLowerCase();
  if (["porn", "nsfl", "gore", "scam"].includes(lower)) return "danger";
  if (["sexual", "nudity", "graphic-media", "spam", "impersonation", "misleading"].includes(lower)) return "warning";
  return "info";
}

export function ProfileLabelBadges({ labels, profileDid }: ProfileLabelBadgesProps) {
  const { colors } = useTheme();

  const visibleLabels = useMemo(() => {
    if (!labels || labels.length === 0) return [];
    return labels.filter((l) => {
      if ((l as any).neg) return false;
      if (l.val.startsWith("!")) return false;
      return true;
    });
  }, [labels]);

  if (visibleLabels.length === 0) return null;

  return (
    <View style={styles.container}>
      {visibleLabels.map((label, index) => {
        const severity = getSeverityColor(label.val);
        const isSelfLabeled = label.src === profileDid;
        const displayName = LABEL_DISPLAY_NAMES[label.val.toLowerCase()] || label.val;
        const badgeColor =
          severity === "danger"
            ? colors.danger
            : severity === "warning"
              ? colors.warning
              : colors.textSecondary;

        return (
          <View
            key={`${label.val}-${index}`}
            style={[styles.badge, { borderColor: badgeColor }]}
            accessibilityLabel={`Content label: ${displayName}${isSelfLabeled ? " (self-labeled)" : ""}`}
          >
            <ShieldIcon size={12} color={badgeColor} />
            <Text style={[styles.badgeText, { color: badgeColor }]}>
              {displayName}
            </Text>
            {isSelfLabeled && (
              <Text style={[styles.selfLabel, { color: badgeColor }]}>self</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 16,
  },
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
  selfLabel: {
    fontSize: fontSize.caption2,
    fontWeight: "400",
    fontStyle: "italic",
    opacity: 0.7,
  },
});
