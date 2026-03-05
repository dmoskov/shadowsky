import { Stack } from "expo-router";
import { HeaderBackButton } from "../../../src/components/HeaderBackButton";
import { useTheme } from "../../../src/contexts/ThemeContext";
import { HeaderBackButton } from "../../../src/components/HeaderBackButton";

export default function PostLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
        headerBackTitle: "Back",
        headerLeft: () => <HeaderBackButton />,
      }}
    />
  );
}
