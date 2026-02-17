import { useRouter } from "expo-router";
import { PerformanceSettingsScreen } from "../../../src/screens/settings/PerformanceSettingsScreen";

export default function PerformanceRoute() {
  const router = useRouter();

  return (
    <PerformanceSettingsScreen
      navigation={{
        goBack: () => router.back(),
      }}
    />
  );
}
