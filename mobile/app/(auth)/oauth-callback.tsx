import { useLocalSearchParams } from "expo-router";
import { OAuthCallbackScreen } from "../../src/screens/auth/OAuthCallbackScreen";

export default function OAuthCallbackRoute() {
  const { error } = useLocalSearchParams<{ error?: string }>();
  return <OAuthCallbackScreen error={error} />;
}
