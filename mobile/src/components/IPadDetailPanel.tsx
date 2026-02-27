import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import { useIPadLayout, DetailPanelContent } from "../contexts/IPadLayoutContext";
import { ThreadScreenNative } from "../screens/shared/ThreadScreenNative";
import { ProfileScreenNative } from "../screens/profile/ProfileScreenNative";

/** Maximum detail panel width on very wide screens */
const DETAIL_PANEL_MAX_WIDTH = 420;
/** Minimum detail panel width */
const DETAIL_PANEL_MIN_WIDTH = 320;
/** Default sidebar width — must stay in sync with IPadSidebar */
const DEFAULT_SIDEBAR_WIDTH = 260;

/**
 * Compute the detail panel width based on available window space.
 * The panel takes roughly 35% of the space after the sidebar, clamped between min/max.
 */
function computeDetailWidth(windowWidth: number, sidebarWidth: number): number {
  const available = windowWidth - sidebarWidth;
  const desired = Math.round(available * 0.35);
  return Math.max(DETAIL_PANEL_MIN_WIDTH, Math.min(DETAIL_PANEL_MAX_WIDTH, desired));
}

/**
 * Legacy constant for any code that previously imported a fixed width.
 * Prefer using `computeDetailWidth()` for responsive layouts.
 */
const DETAIL_PANEL_WIDTH = 380;

export { DETAIL_PANEL_WIDTH, computeDetailWidth };

function DetailPanelHeader({
  title,
  onClose,
  colors,
}: {
  title: string;
  onClose: () => void;
  colors: any;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.background,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }} numberOfLines={1}>
        {title}
      </Text>
      <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Close</Text>
      </TouchableOpacity>
    </View>
  );
}

function DetailContent({ content }: { content: DetailPanelContent }) {
  const { showThread, showProfile } = useIPadLayout();

  if (!content) return null;

  if (content.type === "thread") {
    return (
      <ThreadScreenNative
        handle={content.handle}
        postId={content.postId}
      />
    );
  }

  if (content.type === "profile") {
    return (
      <ProfileScreenNative
        handle={content.handle}
        onNavigateToPost={(uri: string) => {
          const parts = uri.split("/");
          const postId = parts[parts.length - 1];
          showThread(content.handle, postId);
        }}
        onNavigateToProfile={(handle: string) => {
          showProfile(handle);
        }}
      />
    );
  }

  return null;
}

export function IPadDetailPanel() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { detailContent, closeDetail, canShowDetailPanel, windowWidth } = useIPadLayout();

  const panelWidth = computeDetailWidth(windowWidth, DEFAULT_SIDEBAR_WIDTH);
  const styles = useMemo(() => createStyles(colors, panelWidth), [colors, panelWidth]);

  // Don't render if there's no content or the window is too narrow
  if (!detailContent || !canShowDetailPanel) {
    return null;
  }

  const title = detailContent.type === "thread" ? "Thread" : `@${detailContent.handle}`;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <DetailPanelHeader title={title} onClose={closeDetail} colors={colors} />
      <View style={styles.content}>
        <DetailContent content={detailContent} />
      </View>
    </View>
  );
}

function createStyles(colors: any, panelWidth: number = DETAIL_PANEL_WIDTH) {
  return StyleSheet.create({
    container: {
      width: panelWidth,
      backgroundColor: colors.background,
      borderLeftWidth: 1,
      borderLeftColor: colors.border,
    },
    content: {
      flex: 1,
    },
  });
}
