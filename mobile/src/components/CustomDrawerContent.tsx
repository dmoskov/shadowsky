import React, {ReactNode} from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { colors } from "../constants/theme";
import { HomeIcon, ListIcon, CalendarIcon, ChartIcon, SettingsIcon } from "./icons";

interface DrawerItemProps {
  label: string;
  icon?: ReactNode;
  onPress: () => void;
  isActive?: boolean;
}

function DrawerItem({ label, icon, onPress, isActive }: DrawerItemProps) {
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
    </TouchableOpacity>
  );
}

export function CustomDrawerContent() {
  const router = useRouter();
  const pathname = usePathname();
  const { account } = useAuth();

  return (
    <ScrollView style={styles.drawerContent}>
      <View style={styles.drawerHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {account?.displayName?.charAt(0)?.toUpperCase() ||
              account?.handle?.charAt(0)?.toUpperCase() ||
              "S"}
          </Text>
        </View>
        <Text style={styles.username}>
          {account?.displayName || "ShadowSky User"}
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
        />
        <DrawerItem
          label="Lists"
          icon={<ListIcon size={20} color={pathname.includes("/lists") ? colors.primary : colors.text} />}
          isActive={pathname.includes("/lists")}
          onPress={() => router.push("/(app)/lists")}
        />
        <DrawerItem
          label="Scheduled Posts"
          icon={<CalendarIcon size={20} color={pathname.includes("/scheduled") ? colors.primary : colors.text} />}
          isActive={pathname.includes("/scheduled")}
          onPress={() => router.push("/(app)/scheduled")}
        />
        <DrawerItem
          label="Analytics"
          icon={<ChartIcon size={20} color={pathname.includes("/analytics") ? colors.primary : colors.text} />}
          isActive={pathname.includes("/analytics")}
          onPress={() => router.push("/(app)/analytics")}
        />

        <View style={styles.divider} />

        <DrawerItem
          label="Settings"
          icon={<SettingsIcon size={20} color={pathname.includes("/settings") ? colors.primary : colors.text} />}
          isActive={pathname.includes("/settings")}
          onPress={() => router.push("/(app)/settings")}
        />
      </View>

      <View style={styles.drawerFooter}>
        <Text style={styles.version}>ShadowSky v0.7.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
});
