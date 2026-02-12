import { useRouter } from "expo-router";
import { MyProfileScreen } from "../../../../src/screens/profile/MyProfileScreen";

export default function MyProfileRoute() {
  const router = useRouter();

  const handleNavigateToEditProfile = () => {
    router.push("/(app)/(tabs)/(profile)/edit");
  };

  return <MyProfileScreen onNavigateToEditProfile={handleNavigateToEditProfile} />;
}
