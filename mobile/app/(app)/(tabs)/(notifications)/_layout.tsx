import { Stack } from "expo-router";
import { useTheme } from "../../../../src/contexts/ThemeContext";

export default function NotificationsLayout() {
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
      <Stack.Screen
        name="analytics"
        options={{ title: "Notification Analytics" }}
      />
      <Stack.Screen
        name="thread/[postId]"
        options={{
          title: "Thread",
          animation: "fade",
          animationDuration: 280,
        }}
      />
      <Stack.Screen name="profile/[handle]" options={{ title: "Profile" }} />
    </Stack>
  );
}
