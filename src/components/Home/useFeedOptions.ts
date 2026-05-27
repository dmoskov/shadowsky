import { debug } from "@bsky/shared";
import type { BskyAgent } from "@atproto/api";
import { useQuery } from "@tanstack/react-query";
import { Clock, Hash, Heart, Star, TrendingUp, Users } from "lucide-react";
import React, { useState } from "react";
import type {
  FeedGenerator,
  FeedOption,
  FeedType,
  SavedFeed,
} from "./types";

interface UseFeedOptionsParams {
  agent: BskyAgent | null | undefined;
}

export function useFeedOptions({ agent }: UseFeedOptionsParams) {
  const [feedOrder, setFeedOrder] = useState<string[]>([]);

  const { data: userPrefs } = useQuery({
    queryKey: ["userPreferences"],
    queryFn: async () => {
      if (!agent) throw new Error("Not authenticated");
      const prefs = await agent.getPreferences();
      debug.log("User preferences:", prefs);
      return prefs;
    },
    enabled: !!agent,
    staleTime: 30 * 60 * 1000,
    refetchOnMount: false,
  });

  const { data: feedGenerators } = useQuery({
    queryKey: ["feedGenerators", userPrefs?.savedFeeds],
    queryFn: async () => {
      if (!agent || !userPrefs?.savedFeeds?.length) return [];

      const feedUris = userPrefs.savedFeeds
        .filter((feed) => feed.type === "feed")
        .map((feed) => feed.value);

      if (feedUris.length === 0) return [];

      try {
        const response = await agent.app.bsky.feed.getFeedGenerators({
          feeds: feedUris,
        });
        debug.log("Feed generators:", response.data);
        return response.data.feeds;
      } catch (error) {
        debug.error("Failed to fetch feed generators:", error);
        return [];
      }
    },
    enabled: !!agent && !!userPrefs?.savedFeeds,
  });

  const feedOptions = React.useMemo(() => {
    const defaultFeeds: FeedOption[] = [
      {
        type: "following" as FeedType,
        label: "Following",
        icon: Users,
        uri: "following",
        isDefault: true,
      },
      {
        type: "whats-hot" as FeedType,
        label: "What's Hot",
        icon: TrendingUp,
        uri: "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot",
        isDefault: true,
      },
      {
        type: "popular-with-friends" as FeedType,
        label: "Popular w/ Friends",
        icon: Heart,
        uri: "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/with-friends",
        isDefault: true,
      },
      {
        type: "recent" as FeedType,
        label: "Recent",
        icon: Clock,
        uri: "recent",
        isDefault: true,
      },
    ];

    const savedFeeds: FeedOption[] = [];
    if (userPrefs?.savedFeeds && feedGenerators) {
      const pinnedFeeds = userPrefs.savedFeeds.filter(
        (feed) => feed.pinned && feed.type === "feed",
      );
      const unpinnedFeeds = userPrefs.savedFeeds.filter(
        (feed) => !feed.pinned && feed.type === "feed",
      );

      const addFeedOption = (savedFeed: SavedFeed) => {
        const generator = feedGenerators.find(
          (g: FeedGenerator) => g.uri === savedFeed.value,
        );
        if (generator) {
          savedFeeds.push({
            type: savedFeed.value,
            label: generator.displayName,
            icon: savedFeed.pinned ? Star : Hash,
            uri: savedFeed.value,
            pinned: savedFeed.pinned,
            generator,
            isDefault: false,
          });
        }
      };

      pinnedFeeds.forEach((feed) => addFeedOption(feed));
      unpinnedFeeds.forEach((feed) => addFeedOption(feed));
    }

    const allFeeds = [...defaultFeeds, ...savedFeeds];

    if (feedOrder.length === 0) {
      const savedOrder = localStorage.getItem("feedOrder");
      if (savedOrder) {
        const parsedOrder = JSON.parse(savedOrder);
        const currentTypes = allFeeds.map((f) => f.type);
        const validOrder = parsedOrder.filter((type: string) =>
          currentTypes.includes(type),
        );
        const missingTypes = currentTypes.filter(
          (type) => !validOrder.includes(type),
        );
        setFeedOrder([...validOrder, ...missingTypes]);
      } else {
        setFeedOrder(allFeeds.map((f) => f.type));
      }
    }

    return allFeeds.sort((a, b) => {
      const aIndex = feedOrder.indexOf(a.type);
      const bIndex = feedOrder.indexOf(b.type);
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }, [userPrefs, feedGenerators, feedOrder]);

  return { feedOptions, feedOrder, setFeedOrder };
}
