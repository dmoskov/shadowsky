import { Stack } from "expo-router";

export default function HomeLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#0a0a0f" },
        headerTintColor: "#ffffff",
        contentStyle: { backgroundColor: "#0a0a0f" },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="timeline" options={{ title: "Timeline" }} />
      <Stack.Screen name="thread/[postId]" options={{ title: "Thread" }} />
      <Stack.Screen name="profile/[handle]" options={{ title: "Profile" }} />
      <Stack.Screen name="list/[listId]" options={{ title: "List" }} />
    </Stack>
  );
}
