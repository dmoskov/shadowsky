import { useRouter } from "expo-router";
import { useRequiredParam } from "../../../../../src/hooks/useRequiredParam";
import { ProfileScreen } from "../../../../../src/screens/profile/ProfileScreen";
import { ErrorState } from "../../../../../src/components/ErrorState";

export default function UserProfileRoute() {
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

  return (
    <ProfileScreen
      handle={handle}
      onNavigateToFollowers={handleNavigateToFollowers}
      onNavigateToFollowing={handleNavigateToFollowing}
    />
  );
}
