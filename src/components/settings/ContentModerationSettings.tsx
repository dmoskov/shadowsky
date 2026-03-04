import type { AppBskyActorDefs } from "@atproto/api";
import { getProfileService } from "@bsky/shared";
import { useQuery } from "@tanstack/react-query";
import { Clock, Plus, Shield, Tag, Users, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { moderationHistoryDB } from "../../services/moderation-history-db";

// Muted/blocked user interfaces
interface MutedUser {
  did: string;
  handle: string;
  displayName?: string;
}

interface BlockedUser {
  did: string;
  handle: string;
  displayName?: string;
  blockUri?: string;
}

// Native AT Protocol muted word type
type MutedWordTarget = "content" | "tag";
type ActorTarget = "all" | "exclude-following";

interface NativeMutedWord {
  id?: string;
  value: string;
  targets: MutedWordTarget[];
  actorTarget: ActorTarget;
  expiresAt?: string;
}

// Native AT Protocol content label preferences
// Note: AT Protocol uses 'ignore' | 'warn' | 'hide' for LabelPreference
type LabelVisibility = "ignore" | "warn" | "hide";

// Known content labels from AT Protocol
const CONTENT_LABELS = [
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
  {
    id: "gore",
    name: "Gore",
    description: "Graphic depictions of violence or injury",
  },
  {
    id: "nsfl",
    name: "NSFL",
    description: "Not safe for life content",
  },
];

export const ContentModerationSettings: React.FC = () => {
  const { agent } = useAuth();

  // Native AT Protocol muted words state
  const [mutedWords, setMutedWords] = useState<NativeMutedWord[]>([]);
  const [newMutedWord, setNewMutedWord] = useState("");
  const [newWordTargets, setNewWordTargets] = useState<MutedWordTarget[]>([
    "content",
    "tag",
  ]);
  const [newWordActorTarget, setNewWordActorTarget] =
    useState<ActorTarget>("all");
  const [newWordExpiration, setNewWordExpiration] = useState<string>("never");

  // Content label preferences state
  const [labelPrefs, setLabelPrefs] = useState<Map<string, LabelVisibility>>(
    new Map(),
  );
  const [adultContentEnabled, setAdultContentEnabled] = useState(false);

  // Muted/blocked users state
  const [mutedUsers, setMutedUsers] = useState<MutedUser[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [newMuteHandle, setNewMuteHandle] = useState("");

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Fetch native AT Protocol preferences
  const { data: preferences, refetch: refetchPreferences } = useQuery({
    queryKey: ["nativePreferences"],
    queryFn: async () => {
      if (!agent) return null;
      const response = await agent.app.bsky.actor.getPreferences();
      return response.data.preferences;
    },
    enabled: !!agent,
  });

  // Fetch muted users from AT Protocol
  const { data: mutedAccounts, refetch: refetchMutes } = useQuery({
    queryKey: ["mutedAccounts"],
    queryFn: async () => {
      if (!agent) return [];
      const response = await agent.app.bsky.graph.getMutes({ limit: 100 });
      return response.data.mutes;
    },
    enabled: !!agent,
  });

  // Fetch blocked users from AT Protocol
  const { data: blocks, refetch: refetchBlocks } = useQuery({
    queryKey: ["blocks"],
    queryFn: async () => {
      if (!agent) return [];
      const response = await agent.app.bsky.graph.getBlocks({ limit: 100 });
      return response.data.blocks;
    },
    enabled: !!agent,
  });

  // Parse native preferences when loaded
  useEffect(() => {
    if (!preferences || !Array.isArray(preferences)) return;

    // Extract muted words
    const mutedWordsPref = preferences.find(
      (p: unknown) =>
        (p as { $type?: string }).$type ===
        "app.bsky.actor.defs#mutedWordsPref",
    ) as AppBskyActorDefs.MutedWordsPref | undefined;

    if (mutedWordsPref?.items) {
      setMutedWords(
        mutedWordsPref.items.map((item) => ({
          id: item.id,
          value: item.value,
          targets: (item.targets || ["content", "tag"]) as MutedWordTarget[],
          actorTarget: (item.actorTarget || "all") as ActorTarget,
          expiresAt: item.expiresAt,
        })),
      );
    }

    // Extract adult content preference
    const adultContentPref = preferences.find(
      (p: unknown) =>
        (p as { $type?: string }).$type ===
        "app.bsky.actor.defs#adultContentPref",
    ) as AppBskyActorDefs.AdultContentPref | undefined;

    if (adultContentPref) {
      setAdultContentEnabled(adultContentPref.enabled);
    }

    // Extract content label preferences
    const newLabelPrefs = new Map<string, LabelVisibility>();
    preferences.forEach((p: unknown) => {
      const pref = p as {
        $type?: string;
        labelerDid?: string;
        label?: string;
        visibility?: string;
      };
      if (
        pref.$type === "app.bsky.actor.defs#contentLabelPref" &&
        !pref.labelerDid
      ) {
        newLabelPrefs.set(pref.label || "", pref.visibility as LabelVisibility);
      }
    });
    setLabelPrefs(newLabelPrefs);
  }, [preferences]);

  // Update muted users state
  useEffect(() => {
    if (mutedAccounts) {
      setMutedUsers(
        mutedAccounts.map((user) => ({
          did: user.did,
          handle: user.handle,
          displayName: user.displayName,
        })),
      );
    }
  }, [mutedAccounts]);

  // Update blocked users state
  useEffect(() => {
    if (blocks) {
      setBlockedUsers(
        blocks.map((user) => ({
          did: user.did,
          handle: user.handle,
          displayName: user.displayName,
          blockUri: user.viewer?.blocking,
        })),
      );
    }
  }, [blocks]);

  // Calculate expiration date based on selection
  const getExpirationDate = (duration: string): string | undefined => {
    if (duration === "never") return undefined;
    const now = new Date();
    switch (duration) {
      case "1h":
        now.setHours(now.getHours() + 1);
        break;
      case "24h":
        now.setHours(now.getHours() + 24);
        break;
      case "7d":
        now.setDate(now.getDate() + 7);
        break;
      case "30d":
        now.setDate(now.getDate() + 30);
        break;
      default:
        return undefined;
    }
    return now.toISOString();
  };

  // Add a new muted word using native AT Protocol
  const handleAddMutedWord = async () => {
    if (!agent || !newMutedWord.trim()) return;

    setIsLoading(true);
    setMessage(null);

    try {
      const wordToAdd: Pick<
        AppBskyActorDefs.MutedWord,
        "value" | "targets" | "actorTarget" | "expiresAt"
      > = {
        value: newMutedWord.trim().toLowerCase(),
        targets: newWordTargets,
        actorTarget: newWordActorTarget,
        expiresAt: getExpirationDate(newWordExpiration),
      };

      await agent.addMutedWord(wordToAdd);

      setNewMutedWord("");
      setNewWordTargets(["content", "tag"]);
      setNewWordActorTarget("all");
      setNewWordExpiration("never");

      setMessage({
        type: "success",
        text: `Added muted word: "${wordToAdd.value}"`,
      });

      await refetchPreferences();
    } catch (_error) {
      setMessage({
        type: "error",
        text: "Failed to add muted word. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Remove a muted word using native AT Protocol
  const handleRemoveMutedWord = async (word: NativeMutedWord) => {
    if (!agent) return;

    setIsLoading(true);
    setMessage(null);

    try {
      await agent.removeMutedWord({
        value: word.value,
        targets: word.targets,
        actorTarget: word.actorTarget,
      } as AppBskyActorDefs.MutedWord);

      setMessage({
        type: "success",
        text: `Removed muted word: "${word.value}"`,
      });

      await refetchPreferences();
    } catch (_error) {
      setMessage({
        type: "error",
        text: "Failed to remove muted word. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Update a content label preference using native AT Protocol
  const handleUpdateLabelPref = async (
    label: string,
    visibility: LabelVisibility,
  ) => {
    if (!agent) return;

    setIsLoading(true);
    setMessage(null);

    try {
      await agent.setContentLabelPref(label, visibility);

      setLabelPrefs((prev) => new Map(prev).set(label, visibility));

      setMessage({
        type: "success",
        text: `Updated "${label}" preference`,
      });

      await refetchPreferences();
    } catch (_error) {
      setMessage({
        type: "error",
        text: "Failed to update content label preference.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Update adult content setting
  const handleToggleAdultContent = async () => {
    if (!agent) return;

    setIsLoading(true);
    setMessage(null);

    try {
      // Get current preferences and update adult content setting
      const currentPrefs = await agent.app.bsky.actor.getPreferences();
      const otherPrefs = currentPrefs.data.preferences.filter(
        (p: unknown) =>
          (p as { $type?: string }).$type !==
          "app.bsky.actor.defs#adultContentPref",
      );

      const newEnabled = !adultContentEnabled;
      const updatedPrefs = [
        ...otherPrefs,
        {
          $type: "app.bsky.actor.defs#adultContentPref",
          enabled: newEnabled,
        },
      ];

      await agent.app.bsky.actor.putPreferences({
        preferences: updatedPrefs,
      });

      setAdultContentEnabled(newEnabled);
      setMessage({
        type: "success",
        text: `Adult content ${newEnabled ? "enabled" : "disabled"}`,
      });

      await refetchPreferences();
    } catch (_error) {
      setMessage({
        type: "error",
        text: "Failed to update adult content setting.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Mute a user
  const handleMuteUser = async () => {
    if (!agent || !newMuteHandle.trim()) return;

    setIsLoading(true);
    setMessage(null);

    try {
      const handle = newMuteHandle.trim().replace("@", "");
      const profileService = getProfileService(agent);
      const profile = await profileService.getProfile(handle);

      await profileService.mute(profile.did);

      // Record mute to history
      try {
        await moderationHistoryDB.init();
        await moderationHistoryDB.recordMute({
          subjectDid: profile.did,
          subjectHandle: profile.handle,
          subjectDisplayName: profile.displayName,
          subjectAvatar: profile.avatar,
          createdAt: Date.now(),
        });
      } catch (historyErr) {
        console.warn("Failed to record mute to history:", historyErr);
      }

      setNewMuteHandle("");
      setMessage({
        type: "success",
        text: `Muted @${profile.handle}`,
      });

      await refetchMutes();
    } catch (_error) {
      setMessage({
        type: "error",
        text: "Failed to mute user. Please check the handle and try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Unmute a user
  const handleUnmuteUser = async (did: string, handle: string) => {
    if (!agent) return;

    setIsLoading(true);
    setMessage(null);

    try {
      const profileService = getProfileService(agent);
      await profileService.unmute(did);

      // Record unmute to history
      try {
        await moderationHistoryDB.init();
        await moderationHistoryDB.recordUnmute(did);
      } catch (historyErr) {
        console.warn("Failed to record unmute to history:", historyErr);
      }

      setMessage({
        type: "success",
        text: `Unmuted @${handle}`,
      });

      await refetchMutes();
    } catch (_error) {
      setMessage({
        type: "error",
        text: "Failed to unmute user. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Unblock a user
  const handleUnblockUser = async (blockUri: string, handle: string) => {
    if (!agent) return;

    setIsLoading(true);
    setMessage(null);

    try {
      const profileService = getProfileService(agent);
      await profileService.unblock(blockUri);

      // Record unblock to history
      try {
        await moderationHistoryDB.init();
        await moderationHistoryDB.recordUnblock(blockUri);
      } catch (historyErr) {
        console.warn("Failed to record unblock to history:", historyErr);
      }

      setMessage({
        type: "success",
        text: `Unblocked @${handle}`,
      });

      await refetchBlocks();
    } catch (_error) {
      setMessage({
        type: "error",
        text: "Failed to unblock user. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to get label visibility
  const getLabelVisibility = (label: string): LabelVisibility => {
    return labelPrefs.get(label) || "warn";
  };

  // Helper to format expiration
  const formatExpiration = (expiresAt?: string): string => {
    if (!expiresAt) return "Never";
    const expDate = new Date(expiresAt);
    if (expDate < new Date()) return "Expired";
    return expDate.toLocaleDateString();
  };

  // Toggle target in selection
  const toggleTarget = (target: MutedWordTarget) => {
    setNewWordTargets((prev) =>
      prev.includes(target)
        ? prev.filter((t) => t !== target)
        : [...prev, target],
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2
          className="text-xl font-semibold"
          style={{ color: "var(--asph-text-primary)" }}
        >
          Content Moderation
        </h2>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--asph-text-secondary)" }}
        >
          Manage your content filtering using AT Protocol native features
        </p>
      </div>

      {/* Muted Words Section */}
      <div>
        <label
          className="mb-2 flex items-center gap-2 text-sm font-medium"
          style={{ color: "var(--asph-text-primary)" }}
        >
          <Shield size={16} />
          Muted Words
        </label>
        <p
          className="mb-3 text-sm"
          style={{ color: "var(--asph-text-secondary)" }}
        >
          Hide posts containing these words or phrases. Syncs across all Bluesky
          apps.
        </p>

        {/* Add new muted word */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={newMutedWord}
              onChange={(e) => setNewMutedWord(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddMutedWord()}
              placeholder="Add word or phrase to mute"
              className="flex-1 rounded-lg px-4 py-2 text-sm"
              style={{
                backgroundColor: "var(--asph-bg-secondary)",
                color: "var(--asph-text-primary)",
                border: "1px solid var(--asph-border-primary)",
              }}
            />
            <button
              onClick={handleAddMutedWord}
              disabled={!newMutedWord.trim() || isLoading}
              className="touch-target-sm rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
              style={{
                backgroundColor: "var(--asph-primary)",
              }}
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Muted word options */}
          <div
            className="rounded-lg p-3"
            style={{
              backgroundColor: "var(--asph-bg-secondary)",
              border: "1px solid var(--asph-border-primary)",
            }}
          >
            <div className="flex flex-wrap gap-4">
              {/* Target options */}
              <div className="flex items-center gap-2">
                <Tag
                  size={14}
                  style={{ color: "var(--asph-text-secondary)" }}
                />
                <span
                  className="text-xs"
                  style={{ color: "var(--asph-text-secondary)" }}
                >
                  Match in:
                </span>
                <button
                  onClick={() => toggleTarget("content")}
                  className={`touch-target rounded-full px-2 py-0.5 text-xs ${
                    newWordTargets.includes("content")
                      ? "bg-blue-500 text-white"
                      : ""
                  }`}
                  style={
                    !newWordTargets.includes("content")
                      ? {
                          backgroundColor: "var(--asph-bg-tertiary)",
                          color: "var(--asph-text-secondary)",
                        }
                      : {}
                  }
                >
                  Text
                </button>
                <button
                  onClick={() => toggleTarget("tag")}
                  className={`touch-target rounded-full px-2 py-0.5 text-xs ${
                    newWordTargets.includes("tag")
                      ? "bg-blue-500 text-white"
                      : ""
                  }`}
                  style={
                    !newWordTargets.includes("tag")
                      ? {
                          backgroundColor: "var(--asph-bg-tertiary)",
                          color: "var(--asph-text-secondary)",
                        }
                      : {}
                  }
                >
                  Tags
                </button>
              </div>

              {/* Actor target */}
              <div className="flex items-center gap-2">
                <Users
                  size={14}
                  style={{ color: "var(--asph-text-secondary)" }}
                />
                <select
                  value={newWordActorTarget}
                  onChange={(e) =>
                    setNewWordActorTarget(e.target.value as ActorTarget)
                  }
                  className="rounded px-2 py-0.5 text-xs"
                  style={{
                    backgroundColor: "var(--asph-bg-tertiary)",
                    color: "var(--asph-text-primary)",
                    border: "1px solid var(--asph-border-primary)",
                  }}
                >
                  <option value="all">Everyone</option>
                  <option value="exclude-following">
                    Except people I follow
                  </option>
                </select>
              </div>

              {/* Expiration */}
              <div className="flex items-center gap-2">
                <Clock
                  size={14}
                  style={{ color: "var(--asph-text-secondary)" }}
                />
                <select
                  value={newWordExpiration}
                  onChange={(e) => setNewWordExpiration(e.target.value)}
                  className="rounded px-2 py-0.5 text-xs"
                  style={{
                    backgroundColor: "var(--asph-bg-tertiary)",
                    color: "var(--asph-text-primary)",
                    border: "1px solid var(--asph-border-primary)",
                  }}
                >
                  <option value="never">Forever</option>
                  <option value="1h">1 hour</option>
                  <option value="24h">24 hours</option>
                  <option value="7d">7 days</option>
                  <option value="30d">30 days</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* List of muted words */}
        {mutedWords.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {mutedWords.map((word, index) => (
              <div
                key={word.id || `${word.value}-${index}`}
                className="flex items-center gap-2 rounded-full px-3 py-1 text-sm"
                style={{
                  backgroundColor: "var(--asph-bg-secondary)",
                  border: "1px solid var(--asph-border-primary)",
                }}
                title={`Targets: ${word.targets.join(", ")} | Applies to: ${word.actorTarget === "all" ? "Everyone" : "Except following"} | Expires: ${formatExpiration(word.expiresAt)}`}
              >
                <span style={{ color: "var(--asph-text-primary)" }}>
                  {word.value}
                </span>
                {word.expiresAt && (
                  <Clock
                    size={12}
                    style={{ color: "var(--asph-text-tertiary)" }}
                  />
                )}
                <button
                  onClick={() => handleRemoveMutedWord(word)}
                  disabled={isLoading}
                  className="touch-target transition-colors hover:text-red-500 disabled:opacity-50"
                  style={{ color: "var(--asph-text-secondary)" }}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Content Label Preferences */}
      <div>
        <label
          className="mb-2 block text-sm font-medium"
          style={{ color: "var(--asph-text-primary)" }}
        >
          Content Labels
        </label>
        <p
          className="mb-3 text-sm"
          style={{ color: "var(--asph-text-secondary)" }}
        >
          Control how labeled content is displayed. These settings sync with
          Bluesky.
        </p>

        <div className="space-y-2">
          {CONTENT_LABELS.map((label) => (
            <div
              key={label.id}
              className="flex items-center justify-between rounded-lg p-3"
              style={{
                backgroundColor: "var(--asph-bg-secondary)",
                border: "1px solid var(--asph-border-primary)",
              }}
            >
              <div>
                <div
                  className="font-medium"
                  style={{ color: "var(--asph-text-primary)" }}
                >
                  {label.name}
                </div>
                <div
                  className="text-sm"
                  style={{ color: "var(--asph-text-secondary)" }}
                >
                  {label.description}
                </div>
              </div>
              <select
                value={getLabelVisibility(label.id)}
                onChange={(e) =>
                  handleUpdateLabelPref(
                    label.id,
                    e.target.value as LabelVisibility,
                  )
                }
                disabled={isLoading}
                className="rounded-lg px-3 py-1.5 text-sm"
                style={{
                  backgroundColor: "var(--asph-bg-tertiary)",
                  color: "var(--asph-text-primary)",
                  border: "1px solid var(--asph-border-primary)",
                }}
              >
                <option value="hide">Hide</option>
                <option value="warn">Warn (blur)</option>
                <option value="ignore">Show</option>
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Adult Content Toggle */}
      <div>
        <div
          className="flex items-center justify-between rounded-lg p-4"
          style={{
            backgroundColor: "var(--asph-bg-secondary)",
            border: "1px solid var(--asph-border-primary)",
          }}
        >
          <div>
            <div
              className="font-medium"
              style={{ color: "var(--asph-text-primary)" }}
            >
              Enable Adult Content
            </div>
            <div
              className="text-sm"
              style={{ color: "var(--asph-text-secondary)" }}
            >
              Allow viewing of adult-only content (you must be 18+)
            </div>
          </div>
          <button
            onClick={handleToggleAdultContent}
            disabled={isLoading}
            className={`touch-target relative h-6 w-11 rounded-full transition-colors disabled:opacity-50 ${
              adultContentEnabled ? "bg-blue-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                adultContentEnabled ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Muted Users */}
      <div>
        <label
          className="mb-2 block text-sm font-medium"
          style={{ color: "var(--asph-text-primary)" }}
        >
          Muted Users
        </label>
        <p
          className="mb-3 text-sm"
          style={{ color: "var(--asph-text-secondary)" }}
        >
          You won&apos;t see posts from muted users in your feeds
        </p>

        <div className="mb-3 flex gap-2">
          <input
            type="text"
            value={newMuteHandle}
            onChange={(e) => setNewMuteHandle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleMuteUser()}
            placeholder="@handle"
            className="flex-1 rounded-lg px-4 py-2 text-sm"
            style={{
              backgroundColor: "var(--asph-bg-secondary)",
              color: "var(--asph-text-primary)",
              border: "1px solid var(--asph-border-primary)",
            }}
          />
          <button
            onClick={handleMuteUser}
            disabled={!newMuteHandle.trim() || isLoading}
            className="touch-target-sm rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{
              backgroundColor: "var(--asph-primary)",
            }}
          >
            Mute
          </button>
        </div>

        {mutedUsers.length > 0 ? (
          <div className="space-y-2">
            {mutedUsers.map((user) => (
              <div
                key={user.did}
                className="flex items-center justify-between rounded-lg p-3"
                style={{
                  backgroundColor: "var(--asph-bg-secondary)",
                  border: "1px solid var(--asph-border-primary)",
                }}
              >
                <div>
                  <div
                    className="font-medium"
                    style={{ color: "var(--asph-text-primary)" }}
                  >
                    {user.displayName || user.handle}
                  </div>
                  <div
                    className="text-sm"
                    style={{ color: "var(--asph-text-secondary)" }}
                  >
                    @{user.handle}
                  </div>
                </div>
                <button
                  onClick={() => handleUnmuteUser(user.did, user.handle)}
                  disabled={isLoading}
                  className="touch-target-sm rounded-lg px-3 py-1 text-sm font-medium transition-colors disabled:opacity-50"
                  style={{
                    backgroundColor: "var(--asph-bg-tertiary)",
                    color: "var(--asph-text-primary)",
                    border: "1px solid var(--asph-border-primary)",
                  }}
                >
                  Unmute
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p
            className="text-center text-sm"
            style={{ color: "var(--asph-text-tertiary)" }}
          >
            No muted users
          </p>
        )}
      </div>

      {/* Blocked Users */}
      <div>
        <label
          className="mb-2 block text-sm font-medium"
          style={{ color: "var(--asph-text-primary)" }}
        >
          Blocked Users
        </label>
        <p
          className="mb-3 text-sm"
          style={{ color: "var(--asph-text-secondary)" }}
        >
          Blocked users cannot see your posts or interact with you
        </p>

        {blockedUsers.length > 0 ? (
          <div className="space-y-2">
            {blockedUsers.map((user) => (
              <div
                key={user.did}
                className="flex items-center justify-between rounded-lg p-3"
                style={{
                  backgroundColor: "var(--asph-bg-secondary)",
                  border: "1px solid var(--asph-border-primary)",
                }}
              >
                <div>
                  <div
                    className="font-medium"
                    style={{ color: "var(--asph-text-primary)" }}
                  >
                    {user.displayName || user.handle}
                  </div>
                  <div
                    className="text-sm"
                    style={{ color: "var(--asph-text-secondary)" }}
                  >
                    @{user.handle}
                  </div>
                </div>
                <button
                  onClick={() =>
                    user.blockUri &&
                    handleUnblockUser(user.blockUri, user.handle)
                  }
                  disabled={isLoading || !user.blockUri}
                  className="touch-target-sm rounded-lg px-3 py-1 text-sm font-medium transition-colors disabled:opacity-50"
                  style={{
                    backgroundColor: "var(--asph-bg-tertiary)",
                    color: "var(--asph-text-primary)",
                    border: "1px solid var(--asph-border-primary)",
                  }}
                >
                  Unblock
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p
            className="text-center text-sm"
            style={{ color: "var(--asph-text-tertiary)" }}
          >
            No blocked users
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
