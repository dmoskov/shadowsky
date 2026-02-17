import { useRouter } from "expo-router";
import { LabelersSettingsScreen } from "../../../src/screens/settings/LabelersSettingsScreen";

export default function LabelersRoute() {
  const router = useRouter();

  return (
    <LabelersSettingsScreen
      navigation={{
        goBack: () => router.back(),
      }}
    />
  );
}
