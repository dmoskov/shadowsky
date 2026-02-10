import { Tabs } from "expo-router";
import { Text } from "react-native";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0a0a0f",
          borderTopColor: "#1f2937",
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: "#3b82f6",
        tabBarInactiveTintColor: "#6b7280",
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>H</Text>,
        }}
      />
      <Tabs.Screen
        name="(search)"
        options={{
          title: "Search",
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>S</Text>,
        }}
      />
      <Tabs.Screen
        name="(notifications)"
        options={{
          title: "Notifications",
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>N</Text>,
        }}
      />
      <Tabs.Screen
        name="(profile)"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>P</Text>,
        }}
      />
    </Tabs>
  );
}
