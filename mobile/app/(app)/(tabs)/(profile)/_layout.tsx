import { Stack } from "expo-router";

export default function ProfileLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#0a0a0f" },
        headerTintColor: "#ffffff",
        contentStyle: { backgroundColor: "#0a0a0f" },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false, headerBackTitle: "Back" }} />
      <Stack.Screen name="edit" options={{ title: "Edit Profile" }} />
      <Stack.Screen name="user/[handle]" options={{ title: "Profile" }} />
      <Stack.Screen
        name="thread/[postId]"
        options={{
          title: "Thread",
          animation: "fade",
          animationDuration: 280,
        }}
      />
      <Stack.Screen name="bookmarks" options={{ title: "Bookmarks" }} />
      <Stack.Screen name="messages" options={{ title: "Messages" }} />
    </Stack>
  );
}
