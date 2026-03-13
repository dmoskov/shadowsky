import { useRouter } from "expo-router";
import { useCallback } from "react";
import { useRequiredParam } from "../../../../src/hooks/useRequiredParam";
import { ProfileScreenNative } from "../../../../src/screens/profile/ProfileScreenNative";
import { ErrorState } from "../../../../src/components/ErrorState";

export default function ProfileRoute() {
  const { value: handle, isValid } = useRequiredParam("handle");
  const router = useRouter();

  if (!isValid || !handle) {
    return <ErrorState message="Missing profile handle" />;
  }

  const handleNavigateToFollowers = (actor: string) => {
    router.push(`/(app)/(tabs)/(profile)/followers/${actor}`);
  };

  const handleNavigateToFollowing = (actor: string) => {
    router.push(`/(app)/(tabs)/(profile)/following/${actor}`);
  };

  const handleNavigateToMessages = (_conversationId: string) => {
    router.push("/(app)/messages");
  };

  const handleNavigateToPost = useCallback(
    (uri: string) => {
      const parts = uri.split("/");
      const postId = parts[parts.length - 1];
      const did = parts[2] || "";
      if (postId) {
        router.push(
          `/(app)/feed/thread/${postId}?handle=${did}&did=${encodeURIComponent(did)}`,
        );
      }
    },
    [router],
  );

  const handleNavigateToProfile = useCallback(
    (profileHandle: string) => {
      router.push(`/(app)/feed/profile/${profileHandle}`);
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
    <ProfileScreenNative
      handle={handle}
      onNavigateToFollowers={handleNavigateToFollowers}
      onNavigateToFollowing={handleNavigateToFollowing}
      onNavigateToMessages={handleNavigateToMessages}
      onNavigateToPost={handleNavigateToPost}
      onNavigateToProfile={handleNavigateToProfile}
      onNavigateToHashtag={handleNavigateToHashtag}
    />
  );
}
