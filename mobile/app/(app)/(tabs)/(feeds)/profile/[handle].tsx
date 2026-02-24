import { useRouter } from "expo-router";
import { ErrorState } from "../../../../../src/components/ErrorState";
import { useRequiredParam } from "../../../../../src/hooks/useRequiredParam";
import { ProfileScreenNative } from "../../../../../src/screens/profile/ProfileScreenNative";

export default function ProfileRoute() {
  const { value: handle, isValid } = useRequiredParam("handle");
  const router = useRouter();

  if (!isValid || !handle) {
    return <ErrorState message="Missing profile handle" />;
  }

  const handleNavigateToFollowers = (actor: string) => {
    router.push(`/(app)/(tabs)/(profile)/followers/${actor}`);
  };

  const handleNavigateToFollowing = (actor: string) => {
    router.push(`/(app)/(tabs)/(profile)/following/${actor}`);
  };

  const handleNavigateToMessages = (_conversationId: string) => {
    router.push("/(app)/messages");
  };

  return (
    <ProfileScreenNative
      handle={handle}
      onNavigateToFollowers={handleNavigateToFollowers}
      onNavigateToFollowing={handleNavigateToFollowing}
      onNavigateToMessages={handleNavigateToMessages}
    />
  );
}
