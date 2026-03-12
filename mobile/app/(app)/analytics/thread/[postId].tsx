import { useLocalSearchParams } from "expo-router";
import { useRequiredParam } from "../../../../src/hooks/useRequiredParam";
import { ThreadScreenNative } from "../../../../src/screens/shared/ThreadScreenNative";
import { ErrorState } from "../../../../src/components/ErrorState";

export default function AnalyticsThreadRoute() {
  const { value: postId, isValid } = useRequiredParam("postId");
  const { handle, did, focusUri } = useLocalSearchParams<{
    handle?: string;
    did?: string;
    focusUri?: string;
  }>();

  if (!isValid || !postId) {
    return <ErrorState message="Missing post ID" />;
  }

  return (
    <ThreadScreenNative
      postId={postId}
      handle={handle || ""}
      did={did}
      focusedReplyUri={focusUri}
    />
  );
}
