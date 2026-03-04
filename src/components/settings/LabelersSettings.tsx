/**
 * Labelers Settings Component
 *
 * Allows users to subscribe to third-party labelers and configure
 * per-label preferences for each labeler.
 */

import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, Plus, Shield, Tag, X } from "lucide-react";
import React, { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  getLabelerInfo,
  getLabelerLabelPreferences,
  getPopularLabelers,
  getSubscribedLabelers,
  setLabelerLabelPreference,
  subscribeToLabeler,
  unsubscribeFromLabeler,
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

export const LabelersSettings: React.FC = () => {
  const { agent } = useAuth();

  // State
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [newLabelerDid, setNewLabelerDid] = useState("");
  const [expandedLabeler, setExpandedLabeler] = useState<string | null>(null);

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

  // Fetch popular labelers
  const { data: popularLabelers = [], isLoading: isLoadingPopular } = useQuery<
    LabelerInfo[]
  >({
    queryKey: ["popularLabelers"],
    queryFn: async () => {
      if (!agent) return [];
      return getPopularLabelers(agent);
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
          Subscribe to third-party moderation services to apply custom content
          labels
        </p>
      </div>

      {/* Add labeler by DID */}
      <div>
        <label
          className="mb-2 flex items-center gap-2 text-sm font-medium"
          style={{ color: "var(--asph-text-primary)" }}
        >
          <Plus size={16} />
          Add Labeler
        </label>
        <p
          className="mb-3 text-sm"
          style={{ color: "var(--asph-text-secondary)" }}
        >
          Subscribe to a labeler by entering its DID
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
                      {info?.creator.description && (
                        <div
                          className="mt-1 text-sm"
                          style={{ color: "var(--asph-text-tertiary)" }}
                        >
                          {info.creator.description}
                        </div>
                      )}
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

      {/* Popular Labelers */}
      <div>
        <label
          className="mb-2 flex items-center gap-2 text-sm font-medium"
          style={{ color: "var(--asph-text-primary)" }}
        >
          <Shield size={16} />
          Discover Labelers
        </label>
        <p
          className="mb-3 text-sm"
          style={{ color: "var(--asph-text-secondary)" }}
        >
          Popular and recommended labelers you can subscribe to
        </p>

        {isLoadingPopular ? (
          <div
            className="text-center text-sm"
            style={{ color: "var(--asph-text-tertiary)" }}
          >
            Loading labelers...
          </div>
        ) : popularLabelers.length > 0 ? (
          <div className="space-y-2">
            {popularLabelers.map((labeler) => (
              <div
                key={labeler.did}
                className="flex items-center justify-between rounded-lg p-3"
                style={{
                  backgroundColor: "var(--asph-bg-secondary)",
                  border: "1px solid var(--asph-border-primary)",
                }}
              >
                <div className="flex-1">
                  <div
                    className="font-medium"
                    style={{ color: "var(--asph-text-primary)" }}
                  >
                    {labeler.creator.displayName || labeler.creator.handle}
                  </div>
                  <div
                    className="text-sm"
                    style={{ color: "var(--asph-text-secondary)" }}
                  >
                    @{labeler.creator.handle}
                  </div>
                  {labeler.creator.description && (
                    <div
                      className="mt-1 text-sm"
                      style={{ color: "var(--asph-text-tertiary)" }}
                    >
                      {labeler.creator.description}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleSubscribe(labeler.did)}
                  disabled={isLoading || isSubscribed(labeler.did)}
                  className="touch-target-sm rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
                  style={{
                    backgroundColor: isSubscribed(labeler.did)
                      ? "var(--asph-bg-tertiary)"
                      : "var(--asph-primary)",
                    color: isSubscribed(labeler.did)
                      ? "var(--asph-text-primary)"
                      : "white",
                    border: isSubscribed(labeler.did)
                      ? "1px solid var(--asph-border-primary)"
                      : "none",
                  }}
                >
                  {isSubscribed(labeler.did) ? "Subscribed" : "Subscribe"}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p
            className="text-center text-sm"
            style={{ color: "var(--asph-text-tertiary)" }}
          >
            No labelers available
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
