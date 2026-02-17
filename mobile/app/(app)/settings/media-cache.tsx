import { useRouter } from "expo-router";
import { MediaCacheScreen } from "../../../src/screens/settings/MediaCacheScreen";

export default function MediaCacheRoute() {
  const router = useRouter();

  return (
    <MediaCacheScreen
      navigation={{
        goBack: () => router.back(),
      }}
    />
  );
}
