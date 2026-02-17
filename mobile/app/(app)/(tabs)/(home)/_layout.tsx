import { Stack } from "expo-router";
import { useTheme } from "../../../../src/contexts/ThemeContext";

export default function HomeLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
        headerBackTitle: "Back",
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="timeline" options={{ title: "Timeline" }} />
      <Stack.Screen
        name="thread/[postId]"
        options={{
          title: "Thread",
          animation: "fade",
          animationDuration: 280,
        }}
      />
      <Stack.Screen name="profile/[handle]" options={{ title: "Profile" }} />
      <Stack.Screen name="list/[listId]" options={{ title: "List" }} />
    </Stack>
  );
}
