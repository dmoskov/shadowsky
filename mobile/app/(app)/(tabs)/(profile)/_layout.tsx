import { Stack } from "expo-router";
import { useTheme } from "../../../../src/contexts/ThemeContext";
import { DrawerMenuButton } from "../../../../src/components/DrawerMenuButton";
import { ScreenErrorBoundary } from "../../../../src/components/ScreenErrorBoundary";
import { useResetTabOnBlur } from "../../../../src/hooks/useResetTabOnBlur";

export default function ProfileLayout() {
  const { colors } = useTheme();
  useResetTabOnBlur();

  return (
    <ScreenErrorBoundary screenName="Profile">
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
          title: "Profile",
          headerLeft: () => <DrawerMenuButton />,
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
        }}
      />
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
