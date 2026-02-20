import { useLocalSearchParams } from "expo-router";
import { useRequiredParam } from "../../../../../src/hooks/useRequiredParam";
import { ThreadScreenNative } from "../../../../../src/screens/shared/ThreadScreenNative";
import { ErrorState } from "../../../../../src/components/ErrorState";

export default function ThreadRoute() {
  const { value: postId, isValid } = useRequiredParam("postId");
  const { handle, focusUri } = useLocalSearchParams<{
    handle?: string;
    focusUri?: string;
  }>();

  if (!isValid || !postId) {
    return <ErrorState message="Missing post ID" />;
  }

  return (
    <ThreadScreenNative
      postId={postId}
      handle={handle || ""}
      focusedReplyUri={focusUri}
    />
  );
}
