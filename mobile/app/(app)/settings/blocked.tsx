import { useRouter } from "expo-router";
import { BlockedAccountsScreen } from "../../../src/screens/settings/BlockedAccountsScreen";

export default function BlockedAccountsRoute() {
  const router = useRouter();

  const handleNavigateToProfile = (handle: string) => {
    router.push(`/(app)/(tabs)/(home)/profile/${handle}`);
  };

  return <BlockedAccountsScreen onNavigateToProfile={handleNavigateToProfile} />;
}
