import { debug } from "@bsky/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Hash, Heart, Star, TrendingUp, Users } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { columnService } from "../services/column-service";
import type {
  FeedGenerator,
  FeedOption,
  FeedType,
  SavedFeed,
} from "./Home.types";

interface UseFeedSelectionOptions {
  initialFeedUri?: string;
  columnId?: string;
  onFeedChange?: (
    feed: FeedType,
    label: string,
    feedOptions: FeedOption[],
  ) => void;
  onRefreshRequest?: number;
}

/**
 * Feed selection state for the home timeline: the selected feed, the list of
 * available feeds (defaults + the user's saved/pinned feed generators, in the
 * user's saved order), and parent-driven sync (initialFeedUri, refresh).
 * Extracted from Home.tsx.
 */
export function useFeedSelection({
  initialFeedUri,
  columnId,
  onFeedChange,
  onRefreshRequest,
}: UseFeedSelectionOptions) {
  const { agent } = useAuth();
  const queryClient = useQueryClient();

  // Use initialFeedUri if provided, otherwise get from column preferences
  const [selectedFeed, setSelectedFeed] = useState<FeedType>(() => {
    // Use the feed from the column data or default to following
    return (initialFeedUri as FeedType) || "following";
  });
  const [feedOrder, setFeedOrder] = useState<string[]>([]);

  // Update selectedFeed when initialFeedUri changes from parent
  useEffect(() => {
    if (initialFeedUri && initialFeedUri !== selectedFeed) {
      setSelectedFeed(initialFeedUri as FeedType);
      // Also save to column preferences
      if (columnId) {
        columnService.updateColumnFeedPreference(columnId, initialFeedUri);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFeedUri, columnId]);

  // Fetch user's saved/pinned feeds
  const { data: userPrefs } = useQuery({
    queryKey: ["userPreferences"],
    queryFn: async () => {
      if (!agent) throw new Error("Not authenticated");
      const prefs = await agent.getPreferences();
      debug.log("User preferences:", prefs);
      return prefs;
    },
    enabled: !!agent,
    staleTime: 30 * 60 * 1000, // 30 minutes
    refetchOnMount: false,
  });

  // Fetch feed generator details for saved feeds
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

  // Build feed options including user's saved feeds
  const feedOptions = React.useMemo(() => {
    const defaultFeeds = [
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

    // Add pinned feeds first, then other saved feeds
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

    // Initialize feed order if not set
    if (feedOrder.length === 0) {
      const savedOrder = localStorage.getItem("feedOrder");
      if (savedOrder) {
        const parsedOrder = JSON.parse(savedOrder);
        // Validate saved order includes all current feeds
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

    // Sort feeds by the saved order
    return allFeeds.sort((a, b) => {
      const aIndex = feedOrder.indexOf(a.type);
      const bIndex = feedOrder.indexOf(b.type);
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }, [userPrefs, feedGenerators, feedOrder]);

  const currentFeedOption = feedOptions.find(
    (opt) => opt.type === selectedFeed,
  );

  // Notify parent of current feed on mount and feed change
  useEffect(() => {
    if (onFeedChange && currentFeedOption) {
      onFeedChange(selectedFeed, currentFeedOption.label, feedOptions);
    }
  }, [selectedFeed, currentFeedOption, feedOptions, onFeedChange]);

  // Handle refresh request from parent
  useEffect(() => {
    if (onRefreshRequest && onRefreshRequest > 0) {
      queryClient.invalidateQueries({ queryKey: ["timeline", selectedFeed] });
    }
  }, [onRefreshRequest, queryClient, selectedFeed]);

  return { selectedFeed, setSelectedFeed, feedOptions, currentFeedOption };
}
