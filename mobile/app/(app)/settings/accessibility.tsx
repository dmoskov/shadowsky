import { useRouter } from "expo-router";
import { AccessibilitySettingsScreen } from "../../../src/screens/settings/AccessibilitySettingsScreen";

export default function AccessibilityRoute() {
  const router = useRouter();

  return (
    <AccessibilitySettingsScreen
      navigation={{
        goBack: () => router.back(),
      }}
    />
  );
}
