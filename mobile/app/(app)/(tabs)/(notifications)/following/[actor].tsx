import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { FollowingScreen } from "../../../../../src/screens/profile/FollowingScreen";
import { ErrorState } from "../../../../../src/components/ErrorState";

export default function FollowingRoute() {
  const { actor } = useLocalSearchParams<{ actor: string }>();
  const router = useRouter();

  if (!actor) {
    return <ErrorState message="Missing actor parameter" />;
  }

  const handleNavigateToProfile = (handle: string) => {
    router.push(`/(app)/(tabs)/(notifications)/profile/${handle}`);
  };

  return (
    <>
      <Stack.Screen options={{ title: "Following", headerShown: true }} />
      <FollowingScreen actor={actor} onNavigateToProfile={handleNavigateToProfile} />
    </>
  );
}
