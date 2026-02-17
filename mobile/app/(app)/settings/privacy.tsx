import { useRouter } from "expo-router";
import { PrivacySettingsScreen } from "../../../src/screens/settings/PrivacySettingsScreen";

export default function PrivacyRoute() {
  const router = useRouter();

  return (
    <PrivacySettingsScreen
      navigation={{
        goBack: () => router.back(),
      }}
    />
  );
}
