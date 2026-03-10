import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Search, Shield } from "lucide-react";
import React, { useContext, useState } from "react";
import { AuthContext } from "../../contexts/AuthContext";
import {
  type LabelerCategory,
  type LabelerInfo,
  LABELER_CATEGORIES,
  getPopularLabelers,
  getSubscribedLabelers,
  searchLabelers,
  subscribeToLabeler,
  unsubscribeFromLabeler,
} from "../../services/atproto/labelers";
import { proxifyBskyImage } from "../../utils/image-proxy";

export const DiscoverLabelers: React.FC = () => {
  const authContext = useContext(AuthContext);
  const agent = authContext?.agent ?? null;
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<LabelerCategory>("All");

  // Get user's subscribed labelers
  const { data: subscribedLabelers } = useQuery({
    queryKey: ["subscribedLabelers"],
    queryFn: async () => {
      if (!agent) throw new Error("Not authenticated");
      return getSubscribedLabelers(agent);
    },
    enabled: !!agent,
  });

  // Get curated labelers by category
  const { data: curatedLabelers, isLoading: isCuratedLoading } = useQuery({
    queryKey: ["curatedLabelers", activeCategory],
    queryFn: async () => {
      if (!agent) throw new Error("Not authenticated");
      return getPopularLabelers(agent, activeCategory);
    },
    enabled: !!agent && !searchQuery.trim(),
  });

  // Search labelers
  const { data: searchResults, isLoading: isSearchLoading } = useQuery({
    queryKey: ["searchLabelers", searchQuery],
    queryFn: async () => {
      if (!agent || !searchQuery.trim()) return [];
      return searchLabelers(agent, searchQuery);
    },
    enabled: !!agent && !!searchQuery.trim(),
  });

  const subscribeMutation = useMutation({
    mutationFn: async (labelerDid: string) => {
      if (!agent) throw new Error("Not authenticated");
      await subscribeToLabeler(agent, labelerDid);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscribedLabelers"] });
    },
  });

  const unsubscribeMutation = useMutation({
    mutationFn: async (labelerDid: string) => {
      if (!agent) throw new Error("Not authenticated");
      await unsubscribeFromLabeler(agent, labelerDid);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscribedLabelers"] });
    },
  });

  const isSubscribed = (labelerDid: string) => {
    return subscribedLabelers?.some((l) => l.did === labelerDid) || false;
  };

  const handleToggleSubscription = async (labeler: LabelerInfo) => {
    if (isSubscribed(labeler.did)) {
      await unsubscribeMutation.mutateAsync(labeler.did);
    } else {
      await subscribeMutation.mutateAsync(labeler.did);
    }
  };

  const isLoading = searchQuery.trim() ? isSearchLoading : isCuratedLoading;
  const labelers = searchQuery.trim() ? searchResults : curatedLabelers;

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
          placeholder="Search labelers..."
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

      {!searchQuery.trim() && (
        <div className="flex flex-wrap gap-2">
          {LABELER_CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
              style={{
                backgroundColor:
                  activeCategory === category
                    ? "var(--asph-primary)"
                    : "var(--asph-bg-secondary)",
                color:
                  activeCategory === category
                    ? "white"
                    : "var(--asph-text-secondary)",
              }}
            >
              {category}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div
          className="py-8 text-center"
          style={{ color: "var(--asph-text-secondary)" }}
        >
          Loading labelers...
        </div>
      ) : labelers && labelers.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {labelers.map((labeler) => (
            <div
              key={labeler.did}
              className="rounded-xl border p-4 transition-all duration-200 hover:shadow-md"
              style={{
                borderColor: "var(--asph-border-primary)",
                backgroundColor: "var(--asph-bg-secondary)",
              }}
            >
              <div className="mb-3 flex items-start gap-3">
                {labeler.creator.avatar ? (
                  <img
                    src={proxifyBskyImage(labeler.creator.avatar)}
                    alt={labeler.creator.displayName || labeler.creator.handle}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full"
                    style={{ backgroundColor: "var(--asph-bg-primary)" }}
                  >
                    <Shield
                      size={20}
                      style={{ color: "var(--asph-text-secondary)" }}
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3
                    className="truncate font-semibold"
                    style={{ color: "var(--asph-text-primary)" }}
                  >
                    {labeler.creator.displayName || labeler.creator.handle}
                  </h3>
                  <p
                    className="truncate text-xs"
                    style={{ color: "var(--asph-text-secondary)" }}
                  >
                    @{labeler.creator.handle}
                  </p>
                </div>
                <button
                  onClick={() => handleToggleSubscription(labeler)}
                  disabled={
                    subscribeMutation.isPending || unsubscribeMutation.isPending
                  }
                  className="flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: isSubscribed(labeler.did)
                      ? "transparent"
                      : "var(--asph-primary)",
                    border: isSubscribed(labeler.did)
                      ? "1px solid var(--asph-border-primary)"
                      : "1px solid transparent",
                    color: isSubscribed(labeler.did)
                      ? "var(--asph-text-secondary)"
                      : "white",
                  }}
                >
                  {isSubscribed(labeler.did) ? (
                    <>
                      <Check size={12} className="mr-1 inline" />
                      Subscribed
                    </>
                  ) : (
                    <>
                      <Plus size={12} className="mr-1 inline" />
                      Subscribe
                    </>
                  )}
                </button>
              </div>

              {labeler.creator.description && (
                <p
                  className="mb-2 line-clamp-2 text-xs"
                  style={{ color: "var(--asph-text-tertiary)" }}
                >
                  {labeler.creator.description}
                </p>
              )}

              <div className="flex items-center gap-3">
                {labeler.category && (
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: "var(--asph-bg-primary)",
                      color: "var(--asph-primary)",
                    }}
                  >
                    {labeler.category}
                  </span>
                )}
                {labeler.likeCount !== undefined && (
                  <span
                    className="text-xs"
                    style={{ color: "var(--asph-text-tertiary)" }}
                  >
                    {labeler.likeCount.toLocaleString()} likes
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="py-8 text-center"
          style={{ color: "var(--asph-text-secondary)" }}
        >
          {searchQuery.trim()
            ? "No labelers found matching your search"
            : "No labelers available"}
        </div>
      )}
    </div>
  );
};
