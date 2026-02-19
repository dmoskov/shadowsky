import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import { useIPadLayout, DetailPanelContent } from "../contexts/IPadLayoutContext";
import { ThreadScreenNative } from "../screens/shared/ThreadScreenNative";
import { ProfileScreenNative } from "../screens/profile/ProfileScreenNative";

const DETAIL_PANEL_WIDTH = 380;

export { DETAIL_PANEL_WIDTH };

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
          // Extract handle and postId from URI to show in detail panel
          const parts = uri.split("/");
          const postId = parts[parts.length - 1];
          // For AT URIs, the DID is in position 2
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
  const { detailContent, closeDetail } = useIPadLayout();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!detailContent) {
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

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      width: DETAIL_PANEL_WIDTH,
      backgroundColor: colors.background,
      borderLeftWidth: 1,
      borderLeftColor: colors.border,
    },
    content: {
      flex: 1,
    },
  });
}
