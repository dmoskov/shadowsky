import { Stack } from "expo-router";

export default function NotificationsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#0a0a0f" },
        headerTintColor: "#ffffff",
        contentStyle: { backgroundColor: "#0a0a0f" },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false, headerBackTitle: "Back" }} />
      <Stack.Screen
        name="analytics"
        options={{ title: "Notification Analytics" }}
      />
      <Stack.Screen name="thread/[postId]" options={{ title: "Thread" }} />
      <Stack.Screen name="profile/[handle]" options={{ title: "Profile" }} />
    </Stack>
  );
}
