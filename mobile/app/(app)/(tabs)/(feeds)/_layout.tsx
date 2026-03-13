import { Stack } from "expo-router";
import { ScreenErrorBoundary } from "../../../../src/components/ScreenErrorBoundary";
import { useTheme } from "../../../../src/contexts/ThemeContext";
import { useResetTabOnBlur } from "../../../../src/hooks/useResetTabOnBlur";

export default function FeedsLayout() {
  const { colors } = useTheme();
  useResetTabOnBlur();

  return (
    <ScreenErrorBoundary screenName="Feeds">
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
            title: "Feeds",
            headerLargeTitle: true,
          }}
        />
        <Stack.Screen name="discover" options={{ title: "Discover" }} />
        <Stack.Screen
          name="thread/[postId]"
          options={{
            title: "Thread",
            animation: "fade",
            animationDuration: 280,
          }}
        />
        <Stack.Screen name="profile/[handle]" options={{ title: "Profile" }} />
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
