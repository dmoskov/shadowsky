import type { AppBskyActorDefs } from "@atproto/api";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import type { Column } from "../types/column";
import { createLogger } from "../utils/logger";

const logger = createLogger("useDeckFeeds");

/**
 * Order saved feeds the way Bluesky presents them: pinned first, then the rest
 * of the library, each group keeping the order the user arranged it in.
 */
function byPinnedThenSavedOrder(
  savedFeeds: AppBskyActorDefs.SavedFeed[],
): AppBskyActorDefs.SavedFeed[] {
  return [
    ...savedFeeds.filter((feed) => feed.pinned),
    ...savedFeeds.filter((feed) => !feed.pinned),
  ];
}

/**
 * The user's saved feeds, as deck columns.
 *
 * Feed columns are derived on every load rather than stored. Pin or unpin a
 * feed in Bluesky (or add one from Manage feeds) and the deck follows, which is
 * what the old one-time snapshot could never do — it captured whatever was
 * pinned the first time the deck was opened and then drifted forever.
 *
 * @param limit How many feeds to show. Undefined shows all of them.
 */
export function useDeckFeeds(limit?: number) {
  const { agent } = useAuth();

  const { data: userPrefs, isLoading: prefsLoading } = useQuery({
    queryKey: ["userPreferences"],
    queryFn: async () => {
      if (!agent) throw new Error("Not authenticated");
      return agent.getPreferences();
    },
    enabled: !!agent,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: "always",
  });

  // The saved feeds we actually need to render, before any title lookups.
  const visibleFeeds = useMemo(() => {
    const savedFeeds = userPrefs?.savedFeeds ?? [];
    const ordered = byPinnedThenSavedOrder(savedFeeds);
    return limit == null ? ordered : ordered.slice(0, limit);
  }, [userPrefs?.savedFeeds, limit]);

  const generatorUris = useMemo(
    () => visibleFeeds.filter((f) => f.type === "feed").map((f) => f.value),
    [visibleFeeds],
  );
  const listUris = useMemo(
    () => visibleFeeds.filter((f) => f.type === "list").map((f) => f.value),
    [visibleFeeds],
  );

  // Display names for feed generators. Returns null (rather than an empty
  // list) if the lookup itself fails, so a network blip doesn't make every
  // feed look deleted.
  const { data: generators, isLoading: generatorsLoading } = useQuery({
    queryKey: ["deckFeedGenerators", generatorUris],
    queryFn: async () => {
      if (!agent) throw new Error("Not authenticated");
      try {
        const response = await agent.app.bsky.feed.getFeedGenerators({
          feeds: generatorUris,
        });
        return response.data.feeds;
      } catch (error) {
        logger.error("Failed to resolve feed generators:", error);
        return null;
      }
    },
    enabled: !!agent && generatorUris.length > 0,
    staleTime: 30 * 60 * 1000,
  });

  // Saved lists can belong to anyone, so resolve them by URI rather than
  // reading the user's own lists.
  const { data: lists, isLoading: listsLoading } = useQuery({
    queryKey: ["deckFeedLists", listUris],
    queryFn: async () => {
      if (!agent) throw new Error("Not authenticated");
      const resolved = await Promise.all(
        listUris.map(async (uri) => {
          try {
            const response = await agent.app.bsky.graph.getList({
              list: uri,
              limit: 1,
            });
            return [uri, response.data.list.name] as const;
          } catch (error) {
            logger.error(`Failed to resolve list ${uri}:`, error);
            return [uri, null] as const;
          }
        }),
      );
      return new Map(resolved);
    },
    enabled: !!agent && listUris.length > 0,
    staleTime: 30 * 60 * 1000,
  });

  const isLoading =
    prefsLoading ||
    (generatorUris.length > 0 && generatorsLoading) ||
    (listUris.length > 0 && listsLoading);

  const feeds = useMemo((): Column[] => {
    return visibleFeeds.map((savedFeed) => {
      const base = {
        id: `feed:${savedFeed.id}`,
        type: "feed" as const,
        data: savedFeed.value,
        savedFeedId: savedFeed.id,
      };

      if (savedFeed.type === "timeline") {
        return { ...base, title: "Following" };
      }

      if (savedFeed.type === "list") {
        const name = lists?.get(savedFeed.value);
        return {
          ...base,
          title: name ?? "List",
          // Only call it unavailable once the lookup has come back and said so.
          unavailable: lists != null && name == null,
        };
      }

      const generator = generators?.find((g) => g.uri === savedFeed.value);
      return {
        ...base,
        title: generator?.displayName ?? "Feed",
        unavailable: generators != null && generator == null,
      };
    });
  }, [visibleFeeds, generators, lists]);

  return { feeds, isLoading };
}
