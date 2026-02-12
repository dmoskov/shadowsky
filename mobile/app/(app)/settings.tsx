import { useLocalSearchParams, useRouter } from "expo-router";
import { SettingsScreen } from "../../src/screens/settings/SettingsScreen";

export default function SettingsRoute() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  const router = useRouter();

  const handleNavigateToBlockedAccounts = () => {
    router.push("/(app)/settings/blocked");
  };

  const handleNavigateToMutedAccounts = () => {
    router.push("/(app)/settings/muted");
  };

  return (
    <SettingsScreen
      section={section}
      onNavigateToBlockedAccounts={handleNavigateToBlockedAccounts}
      onNavigateToMutedAccounts={handleNavigateToMutedAccounts}
    />
  );
}
