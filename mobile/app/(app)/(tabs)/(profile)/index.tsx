import { useRouter } from "expo-router";
import { MyProfileScreen } from "../../../../src/screens/profile/MyProfileScreen";

export default function MyProfileRoute() {
  const router = useRouter();

  const handleNavigateToEditProfile = () => {
    router.push("/(app)/(tabs)/(profile)/edit");
  };

  const handleNavigateToFollowers = (actor: string) => {
    router.push(`/(app)/(tabs)/(profile)/followers/${actor}`);
  };

  const handleNavigateToFollowing = (actor: string) => {
    router.push(`/(app)/(tabs)/(profile)/following/${actor}`);
  };

  return (
    <MyProfileScreen
      onNavigateToEditProfile={handleNavigateToEditProfile}
      onNavigateToFollowers={handleNavigateToFollowers}
      onNavigateToFollowing={handleNavigateToFollowing}
    />
  );
}
