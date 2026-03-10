import { Tabs } from "expo-router";
import React from "react";
import { CustomTabBar } from "../../../src/components/CustomTabBar";
import { useIPadLayout } from "../../../src/contexts/IPadLayoutContext";
import { ScrollChromeProvider } from "../../../src/contexts/ScrollChromeContext";
import { useTheme } from "../../../src/contexts/ThemeContext";

export default function TabsLayout() {
  const { isMultiColumn } = useIPadLayout();
  const { colors } = useTheme();

  return (
    <ScrollChromeProvider>
      <Tabs
        initialRouteName="(home)"
        tabBar={(props) => (isMultiColumn ? null : <CustomTabBar {...props} />)}
        screenOptions={{
          headerShown: false,
          lazy: true,
          animation: "fade",
          tabBarStyle: isMultiColumn ? { display: "none" } : undefined,
          tabBarActiveTintColor: colors.info,
          tabBarInactiveTintColor: colors.textTertiary,
        }}
      >
        <Tabs.Screen
          name="(home)"
          options={{
            title: "Home",
            tabBarAccessibilityLabel: "Home tab",
          }}
        />
        <Tabs.Screen
          name="(search)"
          options={{
            title: "Search",
            tabBarAccessibilityLabel: "Search tab",
          }}
        />
        <Tabs.Screen
          name="(feeds)"
          options={{
            title: "Feeds",
            tabBarAccessibilityLabel: "Feeds tab",
          }}
        />
        <Tabs.Screen
          name="(notifications)"
          options={{
            title: "Notifications",
            tabBarAccessibilityLabel: "Notifications tab",
          }}
        />
        <Tabs.Screen
          name="(profile)"
          options={{
            title: "Profile",
            tabBarAccessibilityLabel: "Profile tab",
          }}
        />
      </Tabs>
    </ScrollChromeProvider>
  );
}
