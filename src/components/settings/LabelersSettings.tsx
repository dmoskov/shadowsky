/**
 * Labelers Settings Component
 *
 * Allows users to browse, search, and subscribe to third-party labelers
 * and configure per-label preferences for each labeler.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Heart, Plus, Search, Shield, Tag, X } from "lucide-react";
import React, { useCallback, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  getLabelerInfo,
  getLabelerLabelPreferences,
  getPopularLabelers,
  getSubscribedLabelers,
  LABELER_CATEGORIES,
  likeLabeler,
  searchLabelers,
  setLabelerLabelPreference,
  subscribeToLabeler,
  unlikeLabeler,
  unsubscribeFromLabeler,
  type LabelerCategory,
  type LabelerInfo,
  type LabelerLabelPreference,
  type LabelerSubscription,
} from "../../services/atproto/labelers";

// Common labels that labelers might use
const COMMON_LABELS = [
  { id: "porn", name: "Pornography", description: "Explicit sexual content" },
  {
    id: "sexual",
    name: "Sexually Suggestive",
    description: "Suggestive but not explicit",
  },
  { id: "nudity", name: "Nudity", description: "Non-sexual nudity" },
  {
    id: "graphic-media",
    name: "Graphic Media",
    description: "Graphic violence or gore",
  },
  { id: "spam", name: "Spam", description: "Spam or misleading content" },
  {
    id: "impersonation",
    name: "Impersonation",
    description: "Impersonating someone else",
  },
  {
    id: "misinformation",
    name: "Misinformation",
    description: "False or misleading information",
  },
  {
    id: "political",
    name: "Political Content",
    description: "Political posts and discussions",
  },
];

/** Reusable labeler card for both directory and search results */
const LabelerCard: React.FC<{
  labeler: LabelerInfo;
  isSubscribedTo: boolean;
  isLoading: boolean;
  onSubscribe: (did: string) => void;
  onLike: (labeler: LabelerInfo) => void;
}> = ({ labeler, isSubscribedTo, isLoading, onSubscribe, onLike }) => {
  const isLiked = !!labeler.viewer?.like;
  return (
    <div
      className="flex items-center gap-3 rounded-lg p-3"
      style={{
        backgroundColor: "var(--asph-bg-secondary)",
        border: "1px solid var(--asph-border-primary)",
      }}
    >
      {labeler.creator.avatar ? (
        <img
          src={labeler.creator.avatar}
          alt=""
          className="h-10 w-10 flex-shrink-0 rounded-full"
        />
      ) : (
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
          style={{ backgroundColor: "var(--asph-primary)" }}
        >
          {(labeler.creator.displayName || labeler.creator.handle || "?")
            .charAt(0)
            .toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div
          className="truncate font-medium"
          style={{ color: "var(--asph-text-primary)" }}
        >
          {labeler.creator.displayName || labeler.creator.handle}
        </div>
        <div
          className="truncate text-sm"
          style={{ color: "var(--asph-text-secondary)" }}
        >
          @{labeler.creator.handle}
        </div>
        {labeler.creator.description && (
          <div
            className="mt-1 line-clamp-2 text-sm"
            style={{ color: "var(--asph-text-tertiary)" }}
          >
            {labeler.creator.description}
          </div>
        )}
        <div className="mt-1 flex items-center gap-3">
          <button
            onClick={() => onLike(labeler)}
            disabled={isLoading}
            className="flex items-center gap-1 text-xs transition-colors hover:opacity-80 disabled:opacity-50"
            style={{ color: isLiked ? "#ec4899" : "var(--asph-text-tertiary)" }}
          >
            <Heart size={14} fill={isLiked ? "#ec4899" : "none"} />
            <span>
              {labeler.likeCount != null
                ? labeler.likeCount.toLocaleString()
                : "0"}
            </span>
          </button>
        </div>
      </div>
      <button
        onClick={() => onSubscribe(labeler.did)}
        disabled={isLoading || isSubscribedTo}
        className="touch-target-sm flex-shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
        style={{
          backgroundColor: isSubscribedTo
            ? "var(--asph-bg-tertiary)"
            : "var(--asph-primary)",
          color: isSubscribedTo ? "var(--asph-text-primary)" : "white",
          border: isSubscribedTo
            ? "1px solid var(--asph-border-primary)"
            : "none",
        }}
      >
        {isSubscribedTo ? "Subscribed" : "Subscribe"}
      </button>
    </div>
  );
};

export const LabelersSettings: React.FC = () => {
  const { agent } = useAuth();
  const queryClient = useQueryClient();

  // State
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [newLabelerDid, setNewLabelerDid] = useState("");
  const [expandedLabeler, setExpandedLabeler] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] =
    useState<LabelerCategory>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<LabelerInfo[] | null>(
    null,
  );
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch subscribed labelers
  const {
    data: subscribedLabelers = [],
    refetch: refetchSubscribed,
    isLoading: isLoadingSubscribed,
  } = useQuery<LabelerSubscription[]>({
    queryKey: ["subscribedLabelers"],
    queryFn: async () => {
      if (!agent) return [];
      return getSubscribedLabelers(agent);
    },
    enabled: !!agent,
  });

  // Fetch directory labelers filtered by category
  const { data: directoryLabelers = [], isLoading: isLoadingDirectory } =
    useQuery<LabelerInfo[]>({
      queryKey: ["directoryLabelers", selectedCategory],
      queryFn: async () => {
        if (!agent) return [];
        return getPopularLabelers(agent, selectedCategory);
      },
      enabled: !!agent,
    });

  // Fetch labeler info for subscribed labelers
  const { data: labelerInfoMap = new Map() } = useQuery({
    queryKey: ["labelerInfo", subscribedLabelers],
    queryFn: async () => {
      if (!agent) return new Map();
      const infoMap = new Map<string, LabelerInfo>();
      for (const sub of subscribedLabelers) {
        const info = await getLabelerInfo(agent, sub.did);
        if (info) {
          infoMap.set(sub.did, info);
        }
      }
      return infoMap;
    },
    enabled: !!agent && subscribedLabelers.length > 0,
  });

  // Fetch label preferences for expanded labeler
  const { data: labelPreferences = [], refetch: refetchPreferences } = useQuery<
    LabelerLabelPreference[]
  >({
    queryKey: ["labelerLabelPreferences", expandedLabeler],
    queryFn: async () => {
      if (!agent || !expandedLabeler) return [];
      return getLabelerLabelPreferences(agent, expandedLabeler);
    },
    enabled: !!agent && !!expandedLabeler,
  });

  // Search handler with debounce
  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (!query.trim()) {
        setSearchResults(null);
        setIsSearching(false);
        return;
      }
      setIsSearching(true);
      searchTimeoutRef.current = setTimeout(async () => {
        if (!agent) return;
        try {
          const results = await searchLabelers(agent, query);
          setSearchResults(results);
        } catch {
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 400);
    },
    [agent],
  );

  // Like/unlike a labeler
  const handleLike = async (labeler: LabelerInfo) => {
    if (!agent || !labeler.uri || !labeler.cid) return;

    setIsLoading(true);
    try {
      if (labeler.viewer?.like) {
        await unlikeLabeler(agent, labeler.viewer.like);
      } else {
        await likeLabeler(agent, labeler.uri, labeler.cid);
      }
      // Refetch to update like counts and viewer state
      await queryClient.invalidateQueries({ queryKey: ["directoryLabelers"] });
      await refetchSubscribed();
    } catch {
      setMessage({
        type: "error",
        text: "Failed to update like. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Subscribe to a labeler
  const handleSubscribe = async (labelerDid: string) => {
    if (!agent) return;

    setIsLoading(true);
    setMessage(null);

    try {
      await subscribeToLabeler(agent, labelerDid);
      setMessage({
        type: "success",
        text: "Successfully subscribed to labeler",
      });
      await refetchSubscribed();
    } catch (_error) {
      setMessage({
        type: "error",
        text: "Failed to subscribe to labeler. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Unsubscribe from a labeler
  const handleUnsubscribe = async (labelerDid: string) => {
    if (!agent) return;

    setIsLoading(true);
    setMessage(null);

    try {
      await unsubscribeFromLabeler(agent, labelerDid);
      setMessage({
        type: "success",
        text: "Successfully unsubscribed from labeler",
      });
      await refetchSubscribed();
      if (expandedLabeler === labelerDid) {
        setExpandedLabeler(null);
      }
    } catch (_error) {
      setMessage({
        type: "error",
        text: "Failed to unsubscribe from labeler. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Add labeler by DID
  const handleAddLabelerByDid = async () => {
    if (!agent || !newLabelerDid.trim()) return;

    setIsLoading(true);
    setMessage(null);

    try {
      const did = newLabelerDid.trim();
      // Validate DID format
      if (!did.startsWith("did:")) {
        setMessage({
          type: "error",
          text: "Invalid DID format. Must start with 'did:'",
        });
        setIsLoading(false);
        return;
      }

      await subscribeToLabeler(agent, did);
      setNewLabelerDid("");
      setMessage({
        type: "success",
        text: "Successfully subscribed to labeler",
      });
      await refetchSubscribed();
    } catch (_error) {
      setMessage({
        type: "error",
        text: "Failed to subscribe to labeler. Please check the DID and try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Update label preference
  const handleUpdateLabelPreference = async (
    labelerDid: string,
    label: string,
    visibility: "show" | "warn" | "hide",
  ) => {
    if (!agent) return;

    setIsLoading(true);
    setMessage(null);

    try {
      await setLabelerLabelPreference(agent, labelerDid, label, visibility);
      setMessage({
        type: "success",
        text: `Updated "${label}" preference`,
      });
      await refetchPreferences();
    } catch (_error) {
      setMessage({
        type: "error",
        text: "Failed to update label preference. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Get visibility for a label
  const getLabelVisibility = (label: string): "show" | "warn" | "hide" => {
    const pref = labelPreferences.find((p) => p.label === label);
    return pref?.visibility || "warn";
  };

  // Check if a labeler is subscribed
  const isSubscribed = (labelerDid: string): boolean => {
    return subscribedLabelers.some((sub) => sub.did === labelerDid);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2
          className="text-xl font-semibold"
          style={{ color: "var(--asph-text-primary)" }}
        >
          Labeler Subscriptions
        </h2>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--asph-text-secondary)" }}
        >
          Browse, search, and subscribe to content labeling services
        </p>
      </div>

      {/* Browse Labelers */}
      <div>
        <label
          className="mb-2 flex items-center gap-2 text-sm font-medium"
          style={{ color: "var(--asph-text-primary)" }}
        >
          <Search size={16} />
          Browse Labelers
        </label>

        {/* Search input */}
        <div className="relative mb-3">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--asph-text-tertiary)" }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search labelers by name or handle..."
            className="w-full rounded-lg py-2 pl-10 pr-4 text-sm"
            style={{
              backgroundColor: "var(--asph-bg-secondary)",
              color: "var(--asph-text-primary)",
              border: "1px solid var(--asph-border-primary)",
            }}
          />
          {searchQuery && (
            <button
              onClick={() => handleSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--asph-text-tertiary)" }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category filter pills (only shown when not searching) */}
        {!searchQuery && (
          <div className="mb-3 flex flex-wrap gap-2">
            {LABELER_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                style={{
                  backgroundColor:
                    selectedCategory === cat
                      ? "var(--asph-primary)"
                      : "var(--asph-bg-secondary)",
                  color:
                    selectedCategory === cat
                      ? "white"
                      : "var(--asph-text-secondary)",
                  border:
                    selectedCategory === cat
                      ? "1px solid var(--asph-primary)"
                      : "1px solid var(--asph-border-primary)",
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Search results */}
        {searchQuery ? (
          isSearching ? (
            <div
              className="py-4 text-center text-sm"
              style={{ color: "var(--asph-text-tertiary)" }}
            >
              Searching...
            </div>
          ) : searchResults && searchResults.length > 0 ? (
            <div className="space-y-2">
              <p
                className="text-xs"
                style={{ color: "var(--asph-text-tertiary)" }}
              >
                {searchResults.length} labeler
                {searchResults.length !== 1 ? "s" : ""} found
              </p>
              {searchResults.map((labeler) => (
                <LabelerCard
                  key={labeler.did}
                  labeler={labeler}
                  isSubscribedTo={isSubscribed(labeler.did)}
                  isLoading={isLoading}
                  onSubscribe={handleSubscribe}
                  onLike={handleLike}
                />
              ))}
            </div>
          ) : searchResults !== null ? (
            <div
              className="py-4 text-center text-sm"
              style={{ color: "var(--asph-text-tertiary)" }}
            >
              No labelers found for &ldquo;{searchQuery}&rdquo;. Not all
              accounts are labelers &mdash; try a different search or browse the
              directory below.
            </div>
          ) : null
        ) : /* Directory listing */
        isLoadingDirectory ? (
          <div
            className="py-4 text-center text-sm"
            style={{ color: "var(--asph-text-tertiary)" }}
          >
            Loading labelers...
          </div>
        ) : directoryLabelers.length > 0 ? (
          <div className="space-y-2">
            {directoryLabelers.map((labeler) => (
              <LabelerCard
                key={labeler.did}
                labeler={labeler}
                isSubscribedTo={isSubscribed(labeler.did)}
                isLoading={isLoading}
                onSubscribe={handleSubscribe}
                onLike={handleLike}
              />
            ))}
          </div>
        ) : (
          <p
            className="py-4 text-center text-sm"
            style={{ color: "var(--asph-text-tertiary)" }}
          >
            No labelers available in this category
          </p>
        )}
      </div>

      {/* Add labeler by DID */}
      <div>
        <label
          className="mb-2 flex items-center gap-2 text-sm font-medium"
          style={{ color: "var(--asph-text-primary)" }}
        >
          <Plus size={16} />
          Add by DID
        </label>
        <p
          className="mb-3 text-sm"
          style={{ color: "var(--asph-text-secondary)" }}
        >
          Know a labeler&apos;s DID? Subscribe directly
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            value={newLabelerDid}
            onChange={(e) => setNewLabelerDid(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddLabelerByDid()}
            placeholder="did:plc:..."
            className="flex-1 rounded-lg px-4 py-2 text-sm"
            style={{
              backgroundColor: "var(--asph-bg-secondary)",
              color: "var(--asph-text-primary)",
              border: "1px solid var(--asph-border-primary)",
            }}
          />
          <button
            onClick={handleAddLabelerByDid}
            disabled={!newLabelerDid.trim() || isLoading}
            className="touch-target-sm rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{
              backgroundColor: "var(--asph-primary)",
            }}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Subscribed Labelers */}
      <div>
        <label
          className="mb-2 flex items-center gap-2 text-sm font-medium"
          style={{ color: "var(--asph-text-primary)" }}
        >
          <Shield size={16} />
          Subscribed Labelers
        </label>
        <p
          className="mb-3 text-sm"
          style={{ color: "var(--asph-text-secondary)" }}
        >
          Manage your subscribed labelers and configure label preferences
        </p>

        {isLoadingSubscribed ? (
          <div
            className="text-center text-sm"
            style={{ color: "var(--asph-text-tertiary)" }}
          >
            Loading subscribed labelers...
          </div>
        ) : subscribedLabelers.length > 0 ? (
          <div className="space-y-2">
            {subscribedLabelers.map((subscription) => {
              const info = labelerInfoMap.get(subscription.did);
              const isExpanded = expandedLabeler === subscription.did;

              return (
                <div
                  key={subscription.did}
                  className="rounded-lg"
                  style={{
                    backgroundColor: "var(--asph-bg-secondary)",
                    border: "1px solid var(--asph-border-primary)",
                  }}
                >
                  {/* Labeler header */}
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      {info?.creator.avatar ? (
                        <img
                          src={info.creator.avatar}
                          alt=""
                          className="h-8 w-8 flex-shrink-0 rounded-full"
                        />
                      ) : (
                        <div
                          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                          style={{ backgroundColor: "var(--asph-primary)" }}
                        >
                          {(
                            info?.creator.displayName ||
                            info?.creator.handle ||
                            "?"
                          )
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1">
                        <div
                          className="font-medium"
                          style={{ color: "var(--asph-text-primary)" }}
                        >
                          {info?.creator.displayName ||
                            info?.creator.handle ||
                            "Unknown Labeler"}
                        </div>
                        {info?.creator.handle && (
                          <div
                            className="text-sm"
                            style={{ color: "var(--asph-text-secondary)" }}
                          >
                            @{info.creator.handle}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setExpandedLabeler(
                            isExpanded ? null : subscription.did,
                          )
                        }
                        className="touch-target-sm rounded-lg px-3 py-1 text-sm font-medium transition-colors"
                        style={{
                          backgroundColor: "var(--asph-bg-tertiary)",
                          color: "var(--asph-text-primary)",
                          border: "1px solid var(--asph-border-primary)",
                        }}
                      >
                        {isExpanded ? (
                          <>
                            <EyeOff size={14} className="mr-1 inline" />
                            Hide
                          </>
                        ) : (
                          <>
                            <Eye size={14} className="mr-1 inline" />
                            Configure
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleUnsubscribe(subscription.did)}
                        disabled={isLoading}
                        className="touch-target-sm rounded-lg px-3 py-1 text-sm font-medium transition-colors disabled:opacity-50"
                        style={{
                          backgroundColor: "var(--asph-bg-tertiary)",
                          color: "var(--asph-text-primary)",
                          border: "1px solid var(--asph-border-primary)",
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Label preferences (expanded) */}
                  {isExpanded && (
                    <div
                      className="border-t p-3"
                      style={{
                        borderColor: "var(--asph-border-primary)",
                      }}
                    >
                      {info?.creator.description && (
                        <div
                          className="mb-3 text-sm"
                          style={{ color: "var(--asph-text-tertiary)" }}
                        >
                          {info.creator.description}
                        </div>
                      )}
                      <div
                        className="mb-2 flex items-center gap-2 text-sm font-medium"
                        style={{ color: "var(--asph-text-primary)" }}
                      >
                        <Tag size={14} />
                        Label Preferences
                      </div>
                      <p
                        className="mb-3 text-sm"
                        style={{ color: "var(--asph-text-secondary)" }}
                      >
                        Configure how labels from this labeler are displayed
                      </p>

                      <div className="space-y-2">
                        {COMMON_LABELS.map((label) => (
                          <div
                            key={label.id}
                            className="flex items-center justify-between rounded-lg p-2"
                            style={{
                              backgroundColor: "var(--asph-bg-tertiary)",
                            }}
                          >
                            <div className="flex-1">
                              <div
                                className="text-sm font-medium"
                                style={{ color: "var(--asph-text-primary)" }}
                              >
                                {label.name}
                              </div>
                              <div
                                className="text-xs"
                                style={{ color: "var(--asph-text-secondary)" }}
                              >
                                {label.description}
                              </div>
                            </div>
                            <select
                              value={getLabelVisibility(label.id)}
                              onChange={(e) =>
                                handleUpdateLabelPreference(
                                  subscription.did,
                                  label.id,
                                  e.target.value as "show" | "warn" | "hide",
                                )
                              }
                              disabled={isLoading}
                              className="rounded-lg px-2 py-1 text-sm"
                              style={{
                                backgroundColor: "var(--asph-bg-secondary)",
                                color: "var(--asph-text-primary)",
                                border: "1px solid var(--asph-border-primary)",
                              }}
                            >
                              <option value="hide">Hide</option>
                              <option value="warn">Warn</option>
                              <option value="show">Show</option>
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p
            className="text-center text-sm"
            style={{ color: "var(--asph-text-tertiary)" }}
          >
            No subscribed labelers
          </p>
        )}
      </div>

      {/* Status Message */}
      {message && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            message.type === "success"
              ? "border-asph-success/30 bg-asph-success/10 text-asph-success"
              : "border-asph-error/30 bg-asph-error/10 text-asph-error"
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
};
