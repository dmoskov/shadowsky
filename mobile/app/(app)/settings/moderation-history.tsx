import { useRouter } from "expo-router";
import { ModerationHistoryScreen } from "../../../src/screens/settings/ModerationHistoryScreen";

export default function ModerationHistoryRoute() {
  const router = useRouter();

  return (
    <ModerationHistoryScreen
      navigation={{
        goBack: () => router.back(),
      }}
    />
  );
}
