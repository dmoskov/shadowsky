import { Stack } from "expo-router";
import { HeaderBackButton } from "../../../src/components/HeaderBackButton";
import { useTheme } from "../../../src/contexts/ThemeContext";

export default function FeedLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
        headerBackTitle: "Back",
        headerLeft: () => <HeaderBackButton />,
        freezeOnBlur: true,
      }}
    >
      <Stack.Screen name="[uri]" options={{ title: "Feed" }} />
      <Stack.Screen name="profile/[handle]" options={{ title: "Profile" }} />
      <Stack.Screen
        name="thread/[postId]"
        options={{
          title: "Thread",
          animation: "fade",
          animationDuration: 280,
        }}
      />
    </Stack>
  );
}
