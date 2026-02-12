import { useRouter } from "expo-router";
import { MutedAccountsScreen } from "../../../src/screens/settings/MutedAccountsScreen";

export default function MutedAccountsRoute() {
  const router = useRouter();

  const handleNavigateToProfile = (handle: string) => {
    router.push(`/(app)/(tabs)/(home)/profile/${handle}`);
  };

  return <MutedAccountsScreen onNavigateToProfile={handleNavigateToProfile} />;
}
