import { Stack } from "expo-router";
import { useTheme } from "../../../src/contexts/ThemeContext";

export default function SettingsLayout() {
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
          title: "Settings",
        }}
      />
      <Stack.Screen name="accessibility" options={{ title: "Accessibility" }} />
      <Stack.Screen name="blocked" options={{ title: "Blocked Accounts" }} />
      <Stack.Screen name="muted" options={{ title: "Muted Accounts" }} />
      <Stack.Screen name="muted-words" options={{ title: "Muted Words" }} />
      <Stack.Screen
        name="composer-defaults"
        options={{ title: "Composer Defaults" }}
      />
      <Stack.Screen
        name="content-moderation"
        options={{ title: "Content Moderation" }}
      />
      <Stack.Screen name="data-export" options={{ title: "Data Export" }} />
      <Stack.Screen name="labelers" options={{ title: "Labelers" }} />
      <Stack.Screen name="media-cache" options={{ title: "Media Cache" }} />
      <Stack.Screen
        name="moderation-history"
        options={{ title: "Moderation History" }}
      />
      <Stack.Screen
        name="notification-preferences"
        options={{ title: "Notification Preferences" }}
      />
      <Stack.Screen name="performance" options={{ title: "Performance" }} />
      <Stack.Screen name="privacy" options={{ title: "Privacy" }} />
      <Stack.Screen
        name="alt-text-backfill"
        options={{ title: "Add Missing Alt Text" }}
      />
    </Stack>
  );
}
