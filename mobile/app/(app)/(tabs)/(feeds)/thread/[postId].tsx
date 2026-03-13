import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback } from "react";
import { ErrorState } from "../../../../../src/components/ErrorState";
import { useRequiredParam } from "../../../../../src/hooks/useRequiredParam";
import { ThreadScreenNative } from "../../../../../src/screens/shared/ThreadScreenNative";

export default function ThreadRoute() {
  const { value: postId, isValid } = useRequiredParam("postId");
  const { handle, did, focusUri } = useLocalSearchParams<{
    handle?: string;
    did?: string;
    focusUri?: string;
  }>();
  const router = useRouter();

  if (!isValid || !postId) {
    return <ErrorState message="Missing post ID" />;
  }

  const handleNavigateToPost = useCallback(
    (uri: string) => {
      const parts = uri.split("/");
      const rkey = parts[parts.length - 1];
      const postDid = parts[2] || "";
      if (rkey) {
        router.push(
          `/(app)/(tabs)/(feeds)/thread/${rkey}?handle=${postDid}&did=${encodeURIComponent(postDid)}`,
        );
      }
    },
    [router],
  );

  const handleNavigateToProfile = useCallback(
    (profileHandle: string) => {
      router.push(`/(app)/(tabs)/(feeds)/profile/${profileHandle}`);
    },
    [router],
  );

  const handleNavigateToHashtag = useCallback(
    (tag: string) => {
      router.push({ pathname: "/(app)/(tabs)/(search)", params: { q: "#" + tag } } as any);
    },
    [router],
  );

  return (
    <ThreadScreenNative
      postId={postId}
      handle={handle || ""}
      did={did}
      focusedReplyUri={focusUri}
      onNavigateToPost={handleNavigateToPost}
      onNavigateToProfile={handleNavigateToProfile}
      onNavigateToHashtag={handleNavigateToHashtag}
    />
  );
}
