import { Stack } from "expo-router";
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
      }}
    >
      <Stack.Screen name="[uri]" options={{ title: "Feed" }} />
    </Stack>
  );
}
