import { useRouter } from "expo-router";
import { NotificationPreferencesScreen } from "../../../src/screens/settings/NotificationPreferencesScreen";

export default function NotificationPreferencesRoute() {
  const router = useRouter();

  return (
    <NotificationPreferencesScreen
      navigation={{
        goBack: () => router.back(),
      }}
    />
  );
}
