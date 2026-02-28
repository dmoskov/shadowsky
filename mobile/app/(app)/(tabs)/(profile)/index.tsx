import { useRouter } from "expo-router";
import { useCallback } from "react";
import { MyProfileScreenNative } from "../../../../src/screens/profile/MyProfileScreenNative";

export default function MyProfileRoute() {
  const router = useRouter();

  const handleNavigateToEditProfile = () => {
    router.push("/(app)/(tabs)/(profile)/edit");
  };

  const handleNavigateToFollowers = (actor: string) => {
    router.push(`/(app)/(tabs)/(profile)/followers/${actor}`);
  };

  const handleNavigateToFollowing = (actor: string) => {
    router.push(`/(app)/(tabs)/(profile)/following/${actor}`);
  };

  const handleNavigateToPost = useCallback(
    (uri: string) => {
      // AT URI format: at://did:plc:xxx/app.bsky.feed.post/rkey
      const parts = uri.split("/");
      const postId = parts[parts.length - 1];
      const did = parts[2] || "";
      if (postId) {
        router.push(
          `/(app)/(tabs)/(profile)/thread/${postId}?handle=${did}&did=${encodeURIComponent(did)}`,
        );
      }
    },
    [router],
  );

  const handleNavigateToProfile = useCallback(
    (handle: string) => {
      router.push(`/(app)/(tabs)/(profile)/user/${handle}`);
    },
    [router],
  );

  return (
    <MyProfileScreenNative
      onNavigateToEditProfile={handleNavigateToEditProfile}
      onNavigateToFollowers={handleNavigateToFollowers}
      onNavigateToFollowing={handleNavigateToFollowing}
      onNavigateToPost={handleNavigateToPost}
      onNavigateToProfile={handleNavigateToProfile}
    />
  );
}
