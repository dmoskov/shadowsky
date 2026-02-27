import { Stack } from "expo-router";
import { HeaderBackButton } from "../../../src/components/HeaderBackButton";
import { useTheme } from "../../../src/contexts/ThemeContext";

export default function ListsLayout() {
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
        options={{ title: "Lists", headerLeft: () => <HeaderBackButton /> }}
      />
      <Stack.Screen name="create" options={{ title: "Create List" }} />
      <Stack.Screen
        name="[uri]/members"
        options={{ title: "List Members" }}
      />
    </Stack>
  );
}
