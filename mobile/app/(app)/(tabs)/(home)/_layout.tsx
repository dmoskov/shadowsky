import { Stack } from "expo-router";
import { ScreenErrorBoundary } from "../../../../src/components/ScreenErrorBoundary";
import { useTheme } from "../../../../src/contexts/ThemeContext";
import { useResetTabOnBlur } from "../../../../src/hooks/useResetTabOnBlur";

export default function HomeLayout() {
  const { colors } = useTheme();
  useResetTabOnBlur();

  return (
    <ScreenErrorBoundary screenName="Home">
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.background },
          headerBackTitle: "Back",
          freezeOnBlur: true,
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            headerShown: false,
          }}
        />
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
        <Stack.Screen
          name="starter-pack/[uri]"
          options={{ title: "Starter Pack" }}
        />
        <Stack.Screen
          name="followers/[actor]"
          options={{ title: "Followers" }}
        />
        <Stack.Screen
          name="following/[actor]"
          options={{ title: "Following" }}
        />
      </Stack>
    </ScreenErrorBoundary>
  );
}
