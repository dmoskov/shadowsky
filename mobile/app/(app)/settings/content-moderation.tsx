import { useRouter } from "expo-router";
import { ContentModerationSettingsScreen } from "../../../src/screens/settings/ContentModerationSettingsScreen";

export default function ContentModerationRoute() {
  const router = useRouter();

  return (
    <ContentModerationSettingsScreen
      navigation={{
        goBack: () => router.back(),
      }}
    />
  );
}
