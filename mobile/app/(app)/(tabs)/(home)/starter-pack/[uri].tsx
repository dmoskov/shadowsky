import { useRequiredParam } from "../../../../../src/hooks/useRequiredParam";
import { StarterPackDetailScreen } from "../../../../../src/screens/starter-packs/StarterPackDetailScreen";
import { ErrorState } from "../../../../../src/components/ErrorState";
import { useRouter } from "expo-router";

export default function StarterPackRoute() {
  const { value: uri, isValid } = useRequiredParam("uri");
  const router = useRouter();

  if (!isValid || !uri) {
    return <ErrorState message="Missing starter pack URI" />;
  }

  // Decode the URI since it's passed as a route parameter
  const decodedUri = decodeURIComponent(uri);

  return (
    <StarterPackDetailScreen
      starterPackUri={decodedUri}
      onNavigateToProfile={(handle) => {
        router.push(`/(app)/(tabs)/(home)/profile/${handle}`);
      }}
    />
  );
}
