import { Drawer } from "expo-router/drawer";
import { CustomDrawerContent } from "../../src/components/CustomDrawerContent";
import { NotificationSetup } from "../../src/components/NotificationSetup";

export default function AppLayout() {
  return (
    <>
      <NotificationSetup />
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
    </>
  );
}
