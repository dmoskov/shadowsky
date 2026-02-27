import { Stack } from "expo-router";
import { HeaderBackButton } from "../../../src/components/HeaderBackButton";
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
      <Stack.Screen
        name="discover"
        options={{
          title: "Discover Feeds",
          headerLeft: () => <HeaderBackButton />,
        }}
      />
      <Stack.Screen
        name="saved"
        options={{
          title: "My Feeds",
          headerLeft: () => <HeaderBackButton />,
        }}
      />
    </Stack>
  );
}
