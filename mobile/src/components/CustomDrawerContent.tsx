import React, {ReactNode, useMemo} from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, usePathname } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import {
  Home as HomeIcon,
  List as ListIcon,
  Calendar as CalendarIcon,
  BarChart3 as ChartIcon,
  Settings as SettingsIcon,
  MessageCircle as ChatBubbleIcon,
  Search as SearchIcon,
  Image as ImageIcon,
  Bookmark as BookmarkIcon,
  PenLine as PenIcon,
  Bell as BellIcon,
  User as PersonIcon,
  Compass as CompassIcon,
} from "lucide-react-native";
import { useUnreadMessageCount, useDraftCount } from "../hooks/api";
import { useUnreadCount } from "../hooks/api/useNotifications";
import {fontSize} from '../utils/typography';

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
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{selected: isActive}}
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
  const { data: notifUnreadCount } = useUnreadCount();
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
          icon={<HomeIcon size={20} color={pathname === "/" || pathname.startsWith("/(app)/(tabs)/(home)") ? colors.primary : colors.text} />}
          isActive={pathname === "/" || pathname.startsWith("/(app)/(tabs)/(home)")}
          onPress={() => router.push("/(app)/(tabs)/(home)")}
          styles={styles}
        />
        <DrawerItem
          label="Search"
          icon={<SearchIcon size={20} color={pathname.includes("/(search)") ? colors.primary : colors.text} />}
          isActive={pathname.includes("/(search)")}
          onPress={() => router.push("/(app)/(tabs)/(search)")}
          styles={styles}
        />
        <DrawerItem
          label="Compose"
          icon={<PenIcon size={20} color={pathname.includes("/compose") ? colors.primary : colors.text} />}
          isActive={pathname.includes("/compose")}
          onPress={() => router.push("/(app)/compose")}
          styles={styles}
        />
        <DrawerItem
          label="Notifications"
          icon={<BellIcon size={20} color={pathname.includes("/(notifications)") ? colors.primary : colors.text} />}
          isActive={pathname.includes("/(notifications)")}
          onPress={() => router.push("/(app)/(tabs)/(notifications)")}
          badge={notifUnreadCount || undefined}
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
          icon={<CompassIcon size={20} color={pathname.includes("/feeds/discover") ? colors.primary : colors.text} />}
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
          label="Profile"
          icon={<PersonIcon size={20} color={pathname.includes("/(profile)") ? colors.primary : colors.text} />}
          isActive={pathname.includes("/(profile)") && !pathname.includes("/bookmarks")}
          onPress={() => router.push("/(app)/(tabs)/(profile)")}
          styles={styles}
        />

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
      fontSize: fontSize.title2,
      fontWeight: "bold",
    },
    username: {
      color: colors.text,
      fontSize: fontSize.headline,
      fontWeight: "600",
    },
    handle: {
      color: colors.textSecondary,
      fontSize: fontSize.subheadline,
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
      fontSize: fontSize.callout,
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
      fontSize: fontSize.caption1,
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
      fontSize: fontSize.caption1,
      fontWeight: '600',
    },
  });
}
