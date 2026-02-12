import { useRouter } from "expo-router";
import { useCallback } from "react";

export function useAppNavigation() {
  const router = useRouter();

  const navigateToProfile = useCallback(
    (handle: string) => {
      router.push(`/(app)/(tabs)/(home)/profile/${handle}`);
    },
    [router],
  );

  const navigateToThread = useCallback(
    (handle: string, postId: string) => {
      router.push(`/(app)/(tabs)/(home)/thread/${postId}?handle=${handle}`);
    },
    [router],
  );

  const navigateToSearch = useCallback(
    (query?: string) => {
      if (query) {
        router.push(`/(app)/(tabs)/(search)?query=${query}`);
      } else {
        router.push("/(app)/(tabs)/(search)");
      }
    },
    [router],
  );

  const navigateToCompose = useCallback(
    (params?: { replyTo?: any; quoteTo?: any }) => {
      if (params?.replyTo) {
        router.push({
          pathname: "/(app)/compose",
          params: { replyTo: JSON.stringify(params.replyTo) },
        });
      } else if (params?.quoteTo) {
        router.push({
          pathname: "/(app)/compose",
          params: { quoteTo: JSON.stringify(params.quoteTo) },
        });
      } else {
        router.push("/(app)/compose");
      }
    },
    [router],
  );

  const navigateToSettings = useCallback(
    (section?: string) => {
      if (section) {
        router.push(`/(app)/settings?section=${section}`);
      } else {
        router.push("/(app)/settings");
      }
    },
    [router],
  );

  const navigateToHome = useCallback(() => {
    router.push("/(app)/(tabs)/(home)");
  }, [router]);

  const navigateToNotifications = useCallback(() => {
    router.push("/(app)/(tabs)/(notifications)");
  }, [router]);

  const navigateToBookmarks = useCallback(() => {
    router.push("/(app)/(tabs)/(profile)/bookmarks");
  }, [router]);

  const navigateToMessages = useCallback(() => {
    router.push("/(app)/(tabs)/(profile)/messages");
  }, [router]);

  const navigateToList = useCallback(
    (listId: string) => {
      router.push(`/(app)/(tabs)/(home)/list/${listId}`);
    },
    [router],
  );

  const navigateToListMembers = useCallback(
    (listUri: string) => {
      router.push(`/(app)/lists/${encodeURIComponent(listUri)}/members`);
    },
    [router],
  );

  const navigateToCreateList = useCallback(() => {
    router.push("/(app)/lists/create");
  }, [router]);

  const goBack = useCallback(() => {
    router.back();
  }, [router]);

  return {
    router,
    navigateToProfile,
    navigateToThread,
    navigateToSearch,
    navigateToCompose,
    navigateToSettings,
    navigateToHome,
    navigateToNotifications,
    navigateToBookmarks,
    navigateToMessages,
    navigateToList,
    navigateToListMembers,
    navigateToCreateList,
    goBack,
  };
}
