import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Hash, Plus, Search, Sparkles, Users } from "lucide-react";
import React, { useContext, useState } from "react";
import { CURATED_FEED_URIS } from "../../config/curated-feeds";
import { AuthContext } from "../../contexts/AuthContext";
import { proxifyBskyImage } from "../../utils/image-proxy";

interface FeedGenerator {
  uri: string;
  cid: string;
  did: string;
  creator: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  displayName: string;
  description?: string;
  avatar?: string;
  likeCount?: number;
  viewer?: {
    like?: string;
  };
}

type FeedSubTab = "picks" | "suggested" | "popular";

export const DiscoverFeeds: React.FC = () => {
  const authContext = useContext(AuthContext);
  const agent = authContext?.agent ?? null;
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSubTab, setActiveSubTab] = useState<FeedSubTab>("picks");

  const { data: userPrefs } = useQuery({
    queryKey: ["userPreferences"],
    queryFn: async () => {
      if (!agent) throw new Error("Not authenticated");
      return await agent.getPreferences();
    },
    enabled: !!agent,
  });

  const { data: feeds, isLoading } = useQuery({
    queryKey: ["feedDiscovery", activeSubTab],
    queryFn: async () => {
      if (!agent) throw new Error("Not authenticated");

      if (activeSubTab === "picks") {
        const response = await agent.app.bsky.feed.getFeedGenerators({
          feeds: CURATED_FEED_URIS,
        });
        return response.data.feeds;
      } else if (activeSubTab === "suggested") {
        const response = await agent.app.bsky.feed.getSuggestedFeeds({
          limit: 50,
        });
        return response.data.feeds;
      } else {
        const response =
          await agent.app.bsky.unspecced.getPopularFeedGenerators({
            limit: 50,
          });
        return response.data.feeds;
      }
    },
    enabled: !!agent,
  });

  const addFeedMutation = useMutation({
    mutationFn: async (feedUri: string) => {
      if (!agent) throw new Error("Not authenticated");
      const newSavedFeed = {
        id: `feed-${Date.now()}`,
        type: "feed" as const,
        value: feedUri,
        pinned: false,
      };
      await agent.addSavedFeeds([newSavedFeed]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userPreferences"] });
    },
  });

  const removeFeedMutation = useMutation({
    mutationFn: async (feedUri: string) => {
      if (!agent || !userPrefs?.savedFeeds)
        throw new Error("Not authenticated");
      const feedToRemove = userPrefs.savedFeeds.find(
        (f: any) => f.value === feedUri,
      );
      if (feedToRemove) {
        await agent.removeSavedFeeds([feedToRemove.id]);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userPreferences"] });
    },
  });

  const isFeedSaved = (feedUri: string) => {
    return (
      userPrefs?.savedFeeds?.some((f: any) => f.value === feedUri) || false
    );
  };

  const handleToggleFeed = async (feed: FeedGenerator) => {
    if (isFeedSaved(feed.uri)) {
      await removeFeedMutation.mutateAsync(feed.uri);
    } else {
      await addFeedMutation.mutateAsync(feed.uri);
    }
  };

  const filteredFeeds = feeds?.filter(
    (feed: FeedGenerator) =>
      feed.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      feed.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      feed.creator.handle.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 transform"
          style={{ color: "var(--asph-text-secondary)" }}
        />
        <input
          type="text"
          placeholder="Search feeds..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border py-2.5 pl-10 pr-4 focus-visible:outline-none focus-visible:ring-2"
          style={{
            backgroundColor: "var(--asph-bg-secondary)",
            borderColor: "var(--asph-border-primary)",
            color: "var(--asph-text-primary)",
          }}
        />
      </div>

      <div className="flex gap-2">
        {(
          [
            {
              key: "picks" as FeedSubTab,
              label: "Our Picks",
              icon: Sparkles as React.ElementType | undefined,
            },
            {
              key: "suggested" as FeedSubTab,
              label: "Suggested",
              icon: undefined as React.ElementType | undefined,
            },
            {
              key: "popular" as FeedSubTab,
              label: "Popular",
              icon: undefined as React.ElementType | undefined,
            },
          ] as const
        ).map(({ key, label, icon: TabIcon }) => (
          <button
            key={key}
            onClick={() => setActiveSubTab(key)}
            className="touch-target flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
            style={{
              backgroundColor:
                activeSubTab === key
                  ? "var(--asph-primary)"
                  : "var(--asph-bg-secondary)",
              color:
                activeSubTab === key ? "white" : "var(--asph-text-secondary)",
            }}
          >
            {TabIcon && <TabIcon size={14} />}
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div
          className="py-8 text-center"
          style={{ color: "var(--asph-text-secondary)" }}
        >
          Loading feeds...
        </div>
      ) : filteredFeeds && filteredFeeds.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {filteredFeeds.map((feed: FeedGenerator) => (
            <div
              key={feed.uri}
              className="flex items-start gap-3 rounded-xl border p-4 transition-all duration-200 hover:shadow-md"
              style={{
                borderColor: "var(--asph-border-primary)",
                backgroundColor: "var(--asph-bg-secondary)",
              }}
            >
              {feed.avatar ? (
                <img
                  src={proxifyBskyImage(feed.avatar)}
                  alt={feed.displayName}
                  className="h-12 w-12 rounded-lg object-cover"
                />
              ) : (
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "var(--asph-bg-primary)" }}
                >
                  <Hash
                    size={20}
                    style={{ color: "var(--asph-text-secondary)" }}
                  />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3
                      className="truncate font-semibold"
                      style={{ color: "var(--asph-text-primary)" }}
                    >
                      {feed.displayName}
                    </h3>
                    <p
                      className="truncate text-xs"
                      style={{ color: "var(--asph-text-secondary)" }}
                    >
                      by @{feed.creator.handle}
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleFeed(feed)}
                    disabled={
                      addFeedMutation.isPending || removeFeedMutation.isPending
                    }
                    className="flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                    style={{
                      backgroundColor: isFeedSaved(feed.uri)
                        ? "transparent"
                        : "var(--asph-primary)",
                      border: isFeedSaved(feed.uri)
                        ? "1px solid var(--asph-border-primary)"
                        : "1px solid transparent",
                      color: isFeedSaved(feed.uri)
                        ? "var(--asph-text-secondary)"
                        : "white",
                    }}
                  >
                    {isFeedSaved(feed.uri) ? (
                      <>
                        <Check size={12} className="mr-1 inline" />
                        Saved
                      </>
                    ) : (
                      <>
                        <Plus size={12} className="mr-1 inline" />
                        Save
                      </>
                    )}
                  </button>
                </div>

                {feed.description && (
                  <p
                    className="mt-1.5 line-clamp-2 text-xs"
                    style={{ color: "var(--asph-text-tertiary)" }}
                  >
                    {feed.description}
                  </p>
                )}

                <div className="mt-2 flex items-center gap-1">
                  <Users
                    size={12}
                    style={{ color: "var(--asph-text-tertiary)" }}
                  />
                  <span
                    className="text-xs"
                    style={{ color: "var(--asph-text-tertiary)" }}
                  >
                    {(feed.likeCount || 0).toLocaleString()} likes
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="py-8 text-center"
          style={{ color: "var(--asph-text-secondary)" }}
        >
          No feeds found
        </div>
      )}
    </div>
  );
};
