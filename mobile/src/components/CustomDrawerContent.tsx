import React, {ReactNode, useMemo} from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, usePathname } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { HomeIcon, ListIcon, CalendarIcon, ChartIcon, SettingsIcon, ChatBubbleIcon, SearchIcon, ImageIcon, BookmarkIcon } from "./icons";
import { useUnreadMessageCount, useDraftCount, useBookmarkCount } from "../hooks/api";

interface DrawerItemProps {
  label: string;
  icon?: ReactNode;
  onPress: () => void;
  isActive?: boolean;
  badge?: number;
  styles: any;
}

function DrawerItem({ label, icon, onPress, isActive, badge, styles }: DrawerItemProps) {
  return (
    <TouchableOpacity
      style={[styles.drawerItem, isActive && styles.drawerItemActive]}
      onPress={onPress}
    >
      {icon && <View style={styles.drawerItemIcon}>{icon}</View>}
      <Text
        style={[
          styles.drawerItemText,
          isActive && styles.drawerItemTextActive,
        ]}
      >
        {label}
      </Text>
      {badge !== undefined && badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function CustomDrawerContent() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { account } = useAuth();
  const unreadCount = useUnreadMessageCount();
  const draftCount = useDraftCount();
  const bookmarkCount = useBookmarkCount();

  return (
    <ScrollView style={[styles.drawerContent, { paddingTop: insets.top }]}>
      <View style={styles.drawerHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {account?.displayName?.charAt(0)?.toUpperCase() ||
              account?.handle?.charAt(0)?.toUpperCase() ||
              "S"}
          </Text>
        </View>
        <Text style={styles.username}>
          {account?.displayName || "Asphodel User"}
        </Text>
        <Text style={styles.handle}>
          @{account?.handle || "user.bsky.social"}
        </Text>
      </View>

      <View style={styles.drawerItems}>
        <DrawerItem
          label="Home"
          icon={<HomeIcon size={20} color={pathname === "/" || pathname.startsWith("/(app)/(tabs)") ? colors.primary : colors.text} />}
          isActive={pathname === "/" || pathname.startsWith("/(app)/(tabs)")}
          onPress={() => router.push("/(app)/(tabs)/(home)")}
          styles={styles}
        />
        <DrawerItem
          label="Messages"
          icon={<ChatBubbleIcon size={20} color={pathname.includes("/messages") ? colors.primary : colors.text} />}
          isActive={pathname.includes("/messages")}
          onPress={() => router.push("/(app)/messages")}
          badge={unreadCount}
          styles={styles}
        />
        <DrawerItem
          label="Bookmarks"
          icon={<BookmarkIcon size={20} color={pathname.includes("/bookmarks") ? colors.primary : colors.text} />}
          isActive={pathname.includes("/bookmarks")}
          onPress={() => router.push("/(app)/(tabs)/(profile)/bookmarks")}
          badge={bookmarkCount}
          styles={styles}
        />
        <DrawerItem
          label="My Feeds"
          icon={<SearchIcon size={20} color={pathname.includes("/feeds/saved") ? colors.primary : colors.text} />}
          isActive={pathname.includes("/feeds/saved")}
          onPress={() => router.push("/(app)/feeds/saved")}
          styles={styles}
        />
        <DrawerItem
          label="Discover Feeds"
          icon={<SearchIcon size={20} color={pathname.includes("/feeds/discover") ? colors.primary : colors.text} />}
          isActive={pathname.includes("/feeds/discover")}
          onPress={() => router.push("/(app)/feeds/discover")}
          styles={styles}
        />
        <DrawerItem
          label="Lists"
          icon={<ListIcon size={20} color={pathname.includes("/lists") ? colors.primary : colors.text} />}
          isActive={pathname.includes("/lists")}
          onPress={() => router.push("/(app)/lists")}
          styles={styles}
        />
        <DrawerItem
          label="Drafts"
          icon={<ImageIcon size={20} color={pathname.includes("/drafts") ? colors.primary : colors.text} />}
          isActive={pathname.includes("/drafts")}
          onPress={() => router.push("/(app)/drafts")}
          badge={draftCount}
          styles={styles}
        />
        <DrawerItem
          label="Scheduled Posts"
          icon={<CalendarIcon size={20} color={pathname.includes("/scheduled") ? colors.primary : colors.text} />}
          isActive={pathname.includes("/scheduled")}
          onPress={() => router.push("/(app)/scheduled")}
          styles={styles}
        />
        <DrawerItem
          label="Analytics"
          icon={<ChartIcon size={20} color={pathname.includes("/analytics") ? colors.primary : colors.text} />}
          isActive={pathname.includes("/analytics")}
          onPress={() => router.push("/(app)/analytics")}
          styles={styles}
        />

        <View style={styles.divider} />

        <DrawerItem
          label="Settings"
          icon={<SettingsIcon size={20} color={pathname.includes("/settings") ? colors.primary : colors.text} />}
          isActive={pathname.includes("/settings")}
          onPress={() => router.push("/(app)/settings")}
          styles={styles}
        />
      </View>

      <View style={styles.drawerFooter}>
        <Text style={styles.version}>Asphodel v0.7.0</Text>
      </View>
    </ScrollView>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    drawerContent: {
      flex: 1,
      backgroundColor: colors.background,
    },
    drawerHeader: {
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primary,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 12,
    },
    avatarText: {
      color: colors.text,
      fontSize: 24,
      fontWeight: "bold",
    },
    username: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "600",
    },
    handle: {
      color: colors.textSecondary,
      fontSize: 14,
      marginTop: 2,
    },
    drawerItems: {
      paddingVertical: 8,
    },
    drawerItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 14,
      minHeight: 44,
    },
    drawerItemActive: {
      backgroundColor: colors.border,
    },
    drawerItemIcon: {
      marginRight: 12,
      width: 24,
      alignItems: "center",
    },
    drawerItemText: {
      color: colors.text,
      fontSize: 16,
    },
    drawerItemTextActive: {
      color: colors.primary,
      fontWeight: "600",
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 8,
      marginHorizontal: 20,
    },
    drawerFooter: {
      padding: 20,
      marginTop: "auto",
    },
    version: {
      color: colors.textTertiary,
      fontSize: 12,
    },
    badge: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 2,
      marginLeft: 8,
      minWidth: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    badgeText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '600',
    },
  });
}
