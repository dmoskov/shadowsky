import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { StackActions } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { usePreferences } from "../contexts/PreferencesContext";
import { useTheme } from "../contexts/ThemeContext";
import { useUnreadCount } from "../hooks/api/useNotifications";
import { triggerHaptic } from "../utils/haptics";
import { ALL_NAV_ITEMS, TabBarCustomizer } from "./TabBarCustomizer";

/**
 * Maps nav item IDs to their Expo Router route names.
 * Items that don't map to a tab group route (e.g. messages, settings)
 * navigate via router.push instead of tab switching.
 */
const TAB_ROUTE_MAP: Record<string, string> = {
  home: "(home)",
  search: "(search)",
  feeds: "(feeds)",
  notifications: "(notifications)",
  profile: "(profile)",
};

/**
 * Items that navigate to non-tab routes (modal/push navigation)
 * rather than switching tab groups.
 */
const PUSH_ROUTE_MAP: Record<string, string> = {
  messages: "/(app)/messages",
  bookmarks: "/(app)/(tabs)/(profile)/bookmarks",
  lists: "/(app)/lists",
  analytics: "/(app)/analytics",
  settings: "/(app)/settings",
};

function NotificationsBadge() {
  const { data: unreadCount } = useUnreadCount();
  const { colors } = useTheme();

  if (!unreadCount || unreadCount === 0) {
    return null;
  }

  return (
    <View
      style={[styles.badge, { backgroundColor: colors.danger }]}
      accessible={true}
      accessibilityLabel={`${unreadCount} unread notifications`}
      accessibilityRole="text"
    >
      <Text style={styles.badgeText}>
        {unreadCount > 99 ? "99+" : unreadCount}
      </Text>
    </View>
  );
}

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const { preferences } = usePreferences();
  const [customizerVisible, setCustomizerVisible] = useState(false);

  const tabBarItems = preferences?.tabBarItems ?? [
    "home",
    "search",
    "feeds",
    "notifications",
    "profile",
  ];

  const handleLongPress = useCallback(() => {
    triggerHaptic("medium");
    setCustomizerVisible(true);
  }, []);

  const handleTabPress = useCallback(
    (itemId: string) => {
      triggerHaptic("light");

      // If this is a tab-group route, switch tabs
      const routeName = TAB_ROUTE_MAP[itemId];
      if (routeName) {
        const routeIndex = state.routes.findIndex((r) => r.name === routeName);
        if (routeIndex >= 0) {
          const event = navigation.emit({
            type: "tabPress",
            target: state.routes[routeIndex].key,
            canPreventDefault: true,
          });

          if (!event.defaultPrevented) {
            if (state.index === routeIndex) {
              // Already on this tab — pop stack to root and scroll to top.
              // useScrollToTop in each root screen listens for the tabPress
              // event emitted above and handles scrolling automatically.
              const tabNav = navigation.getState().routes[routeIndex]?.state;
              if (tabNav && tabNav.index && tabNav.index > 0) {
                navigation.dispatch(StackActions.popToTop());
              }
            } else {
              navigation.navigate(state.routes[routeIndex].name);
            }
          }
        }
        return;
      }

      // Otherwise, push-navigate to the route
      const pushRoute = PUSH_ROUTE_MAP[itemId];
      if (pushRoute) {
        navigation.navigate(pushRoute as never);
      }
    },
    [state, navigation],
  );

  // Determine which tab-group route is currently focused
  const activeRouteName = state.routes[state.index]?.name;
  const activeTabId = Object.entries(TAB_ROUTE_MAP).find(
    ([, route]) => route === activeRouteName,
  )?.[0];

  const tabStyles = createTabStyles();

  return (
    <>
      <View
        style={[
          tabStyles.container,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
          },
        ]}
      >
        {tabBarItems.map((itemId) => {
          const def = ALL_NAV_ITEMS.find((n) => n.id === itemId);
          if (!def) return null;

          const isActive = activeTabId === itemId;
          const iconColor = isActive ? colors.info : colors.textTertiary;

          return (
            <Pressable
              key={itemId}
              style={tabStyles.tab}
              onPress={() => handleTabPress(itemId)}
              onLongPress={handleLongPress}
              delayLongPress={500}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${def.label} tab`}
            >
              <View style={tabStyles.iconWrapper}>
                {def.icon({ size: 24, color: iconColor, filled: isActive })}
                {itemId === "notifications" && <NotificationsBadge />}
              </View>
              <Text
                style={[tabStyles.label, { color: iconColor }]}
                numberOfLines={1}
              >
                {def.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TabBarCustomizer
        visible={customizerVisible}
        onClose={() => setCustomizerVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    right: -6,
    top: -3,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
});

const createTabStyles = () =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      borderTopWidth: 1,
      paddingBottom: 34,
      paddingTop: 8,
    },
    tab: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 4,
    },
    iconWrapper: {
      position: "relative",
    },
    label: {
      fontSize: 10,
      marginTop: 2,
      fontWeight: "500",
    },
  });
