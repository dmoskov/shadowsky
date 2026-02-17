import { useEffect } from "react";
import { Platform, View } from "react-native";
import { Drawer } from "expo-router/drawer";
import { Slot } from "expo-router";
import * as QuickActions from "expo-quick-actions";
import { useQuickActionRouting } from "expo-quick-actions/router";
import { CustomDrawerContent } from "../../src/components/CustomDrawerContent";
import { NotificationSetup } from "../../src/components/NotificationSetup";
import { IPadSidebar } from "../../src/components/IPadSidebar";
import { IPadDetailPanel } from "../../src/components/IPadDetailPanel";
import { useIPadLayout } from "../../src/contexts/IPadLayoutContext";

function IPadAppLayout() {
  const { detailContent } = useIPadLayout();

  return (
    <View style={{ flex: 1, flexDirection: "row" }}>
      <IPadSidebar />
      <View style={{ flex: 1 }}>
        <Slot />
      </View>
      {detailContent && <IPadDetailPanel />}
    </View>
  );
}

function PhoneAppLayout() {
  return (
    <Drawer
      drawerContent={() => <CustomDrawerContent />}
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          backgroundColor: "#0a0a0f",
          width: 280,
        },
        drawerType: "front",
        overlayColor: "rgba(0, 0, 0, 0.7)",
        swipeEnabled: true,
        swipeEdgeWidth: 50,
      }}
    >
      <Drawer.Screen name="(tabs)" options={{ headerShown: false }} />
      <Drawer.Screen
        name="compose"
        options={{
          headerShown: false,
          drawerItemStyle: { display: "none" },
        }}
      />
      <Drawer.Screen
        name="settings"
        options={{
          headerShown: true,
          title: "Settings",
          headerStyle: { backgroundColor: "#0a0a0f" },
          headerTintColor: "#ffffff",
        }}
      />
      <Drawer.Screen
        name="analytics"
        options={{
          headerShown: true,
          title: "Analytics",
          headerStyle: { backgroundColor: "#0a0a0f" },
          headerTintColor: "#ffffff",
        }}
      />
      <Drawer.Screen
        name="scheduled"
        options={{
          headerShown: true,
          title: "Scheduled Posts",
          headerStyle: { backgroundColor: "#0a0a0f" },
          headerTintColor: "#ffffff",
        }}
      />
      <Drawer.Screen
        name="lists"
        options={{
          headerShown: true,
          title: "Lists",
          headerStyle: { backgroundColor: "#0a0a0f" },
          headerTintColor: "#ffffff",
        }}
      />
    </Drawer>
  );
}

export default function AppLayout() {
  const { isMultiColumn } = useIPadLayout();

  // Handle quick action routing (navigates to params.href when a shortcut is tapped)
  useQuickActionRouting();

  // Register dynamic quick actions on mount (supplements static Info.plist shortcuts)
  useEffect(() => {
    if (Platform.OS === "web") return;

    QuickActions.setItems([
      {
        id: "compose",
        title: "New Post",
        icon: "compose",
        params: { href: "/(app)/compose" },
      },
      {
        id: "search",
        title: "Search",
        icon: "search",
        params: { href: "/(app)/(tabs)/(search)" },
      },
      {
        id: "notifications",
        title: "Notifications",
        icon: "symbol:bell.fill",
        params: { href: "/(app)/(tabs)/(notifications)" },
      },
      {
        id: "messages",
        title: "Messages",
        icon: "message",
        params: { href: "/(app)/(tabs)/(profile)/messages" },
      },
    ]);
  }, []);

  return (
    <>
      <NotificationSetup />
      {isMultiColumn ? <IPadAppLayout /> : <PhoneAppLayout />}
    </>
  );
}
