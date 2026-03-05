import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, usePathname } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useIPadLayout } from "../contexts/IPadLayoutContext";
import {
  HomeIcon,
  SearchIcon,
  BellIcon,
  PersonIcon,
  ListIcon,
  CalendarIcon,
  ChartIcon,
  SettingsIcon,
  ChatBubbleIcon,
  ImageIcon,
  BookmarkIcon,
} from "./icons";
import { useUnreadCount } from "../hooks/api/useNotifications";
import { useUnreadMessageCount, useDraftCount } from "../hooks/api";
import {fontSize} from '../utils/typography';

/** Full sidebar width when there is plenty of room */
const SIDEBAR_WIDTH_FULL = 260;
/** Narrow sidebar width for compact Split View windows */
const SIDEBAR_WIDTH_COMPACT = 200;
/** Window width below which the sidebar uses compact mode */
const COMPACT_THRESHOLD = 800;

// Legacy export — matches SIDEBAR_WIDTH_FULL for backwards compat
const SIDEBAR_WIDTH = SIDEBAR_WIDTH_FULL;

interface SidebarItemProps {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  isActive?: boolean;
  badge?: number;
  colors: any;
}

function SidebarItem({ label, icon, onPress, isActive, badge, colors }: SidebarItemProps) {
  return (
    <TouchableOpacity
      style={[
        sidebarItemStyles.item,
        { backgroundColor: isActive ? colors.surface : "transparent" },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={sidebarItemStyles.icon}>{icon}</View>
      <Text
        style={[
          sidebarItemStyles.label,
          { color: isActive ? colors.primary : colors.text },
          isActive && sidebarItemStyles.labelActive,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {badge !== undefined && badge > 0 && (
        <View style={[sidebarItemStyles.badge, { backgroundColor: colors.danger }]}>
          <Text style={sidebarItemStyles.badgeText}>
            {badge > 99 ? "99+" : badge}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const sidebarItemStyles = StyleSheet.create({
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    marginHorizontal: 8,
    marginVertical: 1,
    minHeight: 44,
  },
  icon: {
    width: 24,
    alignItems: "center",
    marginRight: 12,
  },
  label: {
    fontSize: fontSize.subheadline,
    flex: 1,
  },
  labelActive: {
    fontWeight: "600",
  },
  badge: {
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeText: {
    color: "#ffffff",
    fontSize: fontSize.caption2,
    fontWeight: "700",
  },
});

export { SIDEBAR_WIDTH };

function IPadSidebarInner() {
  const { windowWidth } = useIPadLayout();
  const { colors } = useTheme();
  const isCompact = windowWidth < COMPACT_THRESHOLD;
  const sidebarWidth = isCompact ? SIDEBAR_WIDTH_COMPACT : SIDEBAR_WIDTH_FULL;
  const styles = useMemo(() => createStyles(colors, sidebarWidth), [colors, sidebarWidth]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { account } = useAuth();
  const { data: unreadNotifications } = useUnreadCount();
  const unreadMessages = useUnreadMessageCount();
  const draftCount = useDraftCount();

  const isHome = pathname === "/" || pathname.startsWith("/(app)/(tabs)/(home)");
  const isSearch = pathname.includes("/(search)");
  const isNotifications = pathname.includes("/(notifications)");
  const isProfile = pathname.includes("/(profile)") && !pathname.includes("/messages") && !pathname.includes("/bookmarks");

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* User Info */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {account?.displayName?.charAt(0)?.toUpperCase() ||
              account?.handle?.charAt(0)?.toUpperCase() ||
              "S"}
          </Text>
        </View>
        <Text style={styles.username} numberOfLines={1}>
          {account?.displayName || "Asphodel User"}
        </Text>
        <Text style={styles.handle} numberOfLines={1}>
          @{account?.handle || "user.bsky.social"}
        </Text>
      </View>

      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
        {/* Primary Navigation */}
        <View style={styles.section}>
          <SidebarItem
            label="Home"
            icon={<HomeIcon size={22} color={isHome ? colors.primary : colors.text} filled={isHome} />}
            isActive={isHome}
            onPress={() => router.push("/(app)/(tabs)/(home)")}
            colors={colors}
          />
          <SidebarItem
            label="Search"
            icon={<SearchIcon size={22} color={isSearch ? colors.primary : colors.text} />}
            isActive={isSearch}
            onPress={() => router.push("/(app)/(tabs)/(search)")}
            colors={colors}
          />
          <SidebarItem
            label="Notifications"
            icon={<BellIcon size={22} color={isNotifications ? colors.primary : colors.text} filled={isNotifications} />}
            isActive={isNotifications}
            badge={unreadNotifications}
            onPress={() => router.push("/(app)/(tabs)/(notifications)")}
            colors={colors}
          />
          <SidebarItem
            label="Profile"
            icon={<PersonIcon size={22} color={isProfile ? colors.primary : colors.text} filled={isProfile} />}
            isActive={isProfile}
            onPress={() => router.push("/(app)/(tabs)/(profile)")}
            colors={colors}
          />
        </View>

        <View style={styles.divider} />

        {/* Secondary Navigation */}
        <View style={styles.section}>
          <SidebarItem
            label="Messages"
            icon={<ChatBubbleIcon size={22} color={pathname.includes("/messages") ? colors.primary : colors.text} />}
            isActive={pathname.includes("/messages")}
            badge={unreadMessages}
            onPress={() => router.push("/(app)/messages")}
            colors={colors}
          />
          <SidebarItem
            label="Bookmarks"
            icon={<BookmarkIcon size={22} color={pathname.includes("/bookmarks") ? colors.primary : colors.text} />}
            isActive={pathname.includes("/bookmarks")}
            onPress={() => router.push("/(app)/(tabs)/(profile)/bookmarks")}
            colors={colors}
          />
          <SidebarItem
            label="My Feeds"
            icon={<SearchIcon size={22} color={pathname.includes("/feeds/saved") ? colors.primary : colors.text} />}
            isActive={pathname.includes("/feeds/saved")}
            onPress={() => router.push("/(app)/feeds/saved")}
            colors={colors}
          />
          <SidebarItem
            label="Lists"
            icon={<ListIcon size={22} color={pathname.includes("/lists") ? colors.primary : colors.text} />}
            isActive={pathname.includes("/lists")}
            onPress={() => router.push("/(app)/lists")}
            colors={colors}
          />
          <SidebarItem
            label="Drafts"
            icon={<ImageIcon size={22} color={pathname.includes("/drafts") ? colors.primary : colors.text} />}
            isActive={pathname.includes("/drafts")}
            badge={draftCount}
            onPress={() => router.push("/(app)/drafts")}
            colors={colors}
          />
          <SidebarItem
            label="Scheduled"
            icon={<CalendarIcon size={22} color={pathname.includes("/scheduled") ? colors.primary : colors.text} />}
            isActive={pathname.includes("/scheduled")}
            onPress={() => router.push("/(app)/scheduled")}
            colors={colors}
          />
          <SidebarItem
            label="Analytics"
            icon={<ChartIcon size={22} color={pathname.includes("/analytics") ? colors.primary : colors.text} />}
            isActive={pathname.includes("/analytics")}
            onPress={() => router.push("/(app)/analytics")}
            colors={colors}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <SidebarItem
            label="Settings"
            icon={<SettingsIcon size={22} color={pathname.includes("/settings") ? colors.primary : colors.text} />}
            isActive={pathname.includes("/settings")}
            onPress={() => router.push("/(app)/settings")}
            colors={colors}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.version}>Asphodel v0.7.0</Text>
      </View>
    </View>
  );
}

function createStyles(colors: any, width: number = SIDEBAR_WIDTH_FULL) {
  return StyleSheet.create({
    container: {
      width,
      backgroundColor: colors.background,
      borderRightWidth: 1,
      borderRightColor: colors.border,
    },
    header: {
      padding: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 8,
    },
    avatarText: {
      color: colors.text,
      fontSize: fontSize.title3,
      fontWeight: "bold",
    },
    username: {
      color: colors.text,
      fontSize: fontSize.callout,
      fontWeight: "600",
    },
    handle: {
      color: colors.textSecondary,
      fontSize: fontSize.footnote,
      marginTop: 2,
    },
    scrollArea: {
      flex: 1,
    },
    section: {
      paddingVertical: 4,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 4,
      marginHorizontal: 16,
    },
    footer: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    version: {
      color: colors.textTertiary,
      fontSize: fontSize.caption1,
    },
  });
}

export const IPadSidebar = React.memo(IPadSidebarInner);
