import { useLocalSearchParams } from "expo-router";
import { OAuthCallbackScreen } from "../../src/screens/auth/OAuthCallbackScreen";

export default function OAuthCallbackRoute() {
  const { code, state, error, iss } = useLocalSearchParams<{
    code?: string;
    state?: string;
    error?: string;
    iss?: string;
  }>();
  return (
    <OAuthCallbackScreen code={code} state={state} error={error} iss={iss} />
  );
}
