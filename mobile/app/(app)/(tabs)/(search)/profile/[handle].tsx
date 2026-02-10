import { useLocalSearchParams } from "expo-router";
import { ProfileScreen } from "../../../../../src/screens/profile/ProfileScreen";

export default function ProfileRoute() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  return <ProfileScreen handle={handle!} />;
}
