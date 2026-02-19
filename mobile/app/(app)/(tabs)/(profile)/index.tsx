import { useRouter } from "expo-router";
import { MyProfileScreenNative } from "../../../../src/screens/profile/MyProfileScreenNative";

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
    <MyProfileScreenNative
      onNavigateToEditProfile={handleNavigateToEditProfile}
      onNavigateToFollowers={handleNavigateToFollowers}
      onNavigateToFollowing={handleNavigateToFollowing}
    />
  );
}
