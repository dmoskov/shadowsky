import { Stack } from "expo-router";
import { HeaderBackButton } from "../../../src/components/HeaderBackButton";
import { useTheme } from "../../../src/contexts/ThemeContext";

export default function AnalyticsLayout() {
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
      <Stack.Screen
        name="index"
        options={{
          title: "Analytics",
          headerLeft: () => <HeaderBackButton />,
        }}
      />
      <Stack.Screen
        name="thread/[postId]"
        options={{
          title: "Thread",
          headerLeft: () => <HeaderBackButton />,
        }}
      />
    </Stack>
  );
}
