import { Stack } from "expo-router";
import { useTheme } from "../../../src/contexts/ThemeContext";

export default function FeedsManageLayout() {
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
      <Stack.Screen name="create" options={{ title: "Create Feed" }} />
      <Stack.Screen name="discover" options={{ title: "Discover Feeds" }} />
      <Stack.Screen name="saved" options={{ title: "My Feeds" }} />
    </Stack>
  );
}
