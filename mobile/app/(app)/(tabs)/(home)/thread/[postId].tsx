import { useLocalSearchParams } from "expo-router";
import { useRequiredParam } from "../../../../../src/hooks/useRequiredParam";
import { ThreadScreen } from "../../../../../src/screens/shared/ThreadScreen";
import { ErrorState } from "../../../../../src/components/ErrorState";

export default function ThreadRoute() {
  const { value: postId, isValid } = useRequiredParam("postId");
  const { handle, did } = useLocalSearchParams<{ handle?: string; did?: string }>();

  if (!isValid || !postId) {
    return <ErrorState message="Missing post ID" />;
  }

  return <ThreadScreen postId={postId} handle={handle || ""} did={did} />;
}
