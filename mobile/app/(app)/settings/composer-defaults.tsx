import { useRouter } from "expo-router";
import { ComposerDefaultsScreen } from "../../../src/screens/settings/ComposerDefaultsScreen";

export default function ComposerDefaultsRoute() {
  const router = useRouter();

  return (
    <ComposerDefaultsScreen
      navigation={{
        goBack: () => router.back(),
      }}
    />
  );
}
