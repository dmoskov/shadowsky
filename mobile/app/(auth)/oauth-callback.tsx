import { useLocalSearchParams } from "expo-router";
import { OAuthCallbackScreen } from "../../src/screens/auth/OAuthCallbackScreen";

export default function OAuthCallbackRoute() {
  const { code, state, error } = useLocalSearchParams<{
    code?: string;
    state?: string;
    error?: string;
  }>();
  return <OAuthCallbackScreen code={code} state={state} error={error} />;
}
