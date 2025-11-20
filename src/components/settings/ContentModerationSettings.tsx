import { getProfileService, queryClient } from "@bsky/shared";
import { useQuery } from "@tanstack/react-query";
import { Plus, Shield, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";

interface MutedUser {
  did: string;
  handle: string;
  displayName?: string;
  mutedUntil?: string;
}

interface BlockedUser {
  did: string;
  handle: string;
  displayName?: string;
  blockUri?: string;
}

interface ModerationPreferences {
  keywordFilters: string[];
  hideReplies: boolean;
  hideReposts: boolean;
  hideQuotePosts: boolean;
  mutedUsers: MutedUser[];
  blockedUsers: BlockedUser[];
  sensitiveMediaBehavior: "blur" | "hide" | "show";
  adultContentEnabled: boolean;
  autoModeration: boolean;
}

export const ContentModerationSettings: React.FC = () => {
  const { agent } = useAuth();
  const [preferences, setPreferences] = useState<ModerationPreferences>({
    keywordFilters: [],
    hideReplies: false,
    hideReposts: false,
    hideQuotePosts: false,
    mutedUsers: [],
    blockedUsers: [],
    sensitiveMediaBehavior: "blur",
    adultContentEnabled: false,
    autoModeration: true,
  });
  const [newKeyword, setNewKeyword] = useState("");
  const [newMuteHandle, setNewMuteHandle] = useState("");
  const [muteDuration, setMuteDuration] = useState<string>("forever");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Fetch muted and blocked users
  const { data: mutedAccounts } = useQuery({
    queryKey: ["mutedAccounts"],
    queryFn: async () => {
      if (!agent) return [];
      const response = await agent.app.bsky.graph.getMutes({ limit: 100 });
      return response.data.mutes;
    },
    enabled: !!agent,
  });

  const { data: blocks } = useQuery({
    queryKey: ["blocks"],
    queryFn: async () => {
      if (!agent) return [];
      const response = await agent.app.bsky.graph.getBlocks({ limit: 100 });
      return response.data.blocks;
    },
    enabled: !!agent,
  });

  // Fetch content filtering preferences from AT Protocol
  const { data: atProtoPref } = useQuery({
    queryKey: ["contentModeration"],
    queryFn: async () => {
      if (!agent) return null;
      try {
        const response = await agent.api.com.atproto.repo.getRecord({
          repo: agent.session?.did || "",
          collection: "com.shadowsky.moderation",
          rkey: "self",
        });
        return response.data.value as any;
      } catch (error: any) {
        if (error?.status === 400) return null;
        throw error;
      }
    },
    enabled: !!agent,
  });

  // Update local state when data loads
  useEffect(() => {
    if (atProtoPref) {
      setPreferences((prev) => ({
        ...prev,
        keywordFilters: atProtoPref.keywordFilters || [],
        hideReplies: atProtoPref.hideReplies || false,
        hideReposts: atProtoPref.hideReposts || false,
        hideQuotePosts: atProtoPref.hideQuotePosts || false,
        sensitiveMediaBehavior: atProtoPref.sensitiveMediaBehavior || "blur",
        adultContentEnabled: atProtoPref.adultContentEnabled || false,
        autoModeration: atProtoPref.autoModeration !== false,
      }));
    }
  }, [atProtoPref]);

  useEffect(() => {
    if (mutedAccounts) {
      setPreferences((prev) => ({
        ...prev,
        mutedUsers: mutedAccounts.map((user) => ({
          did: user.did,
          handle: user.handle,
          displayName: user.displayName,
        })),
      }));
    }
  }, [mutedAccounts]);

  useEffect(() => {
    if (blocks) {
      setPreferences((prev) => ({
        ...prev,
        blockedUsers: blocks.map((user) => ({
          did: user.did,
          handle: user.handle,
          displayName: user.displayName,
          blockUri: user.viewer?.blocking,
        })),
      }));
    }
  }, [blocks]);

  const handleAddKeyword = () => {
    const trimmed = newKeyword.trim().toLowerCase();
    if (trimmed && !preferences.keywordFilters.includes(trimmed)) {
      setPreferences({
        ...preferences,
        keywordFilters: [...preferences.keywordFilters, trimmed],
      });
      setNewKeyword("");
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setPreferences({
      ...preferences,
      keywordFilters: preferences.keywordFilters.filter((k) => k !== keyword),
    });
  };

  const handleMuteUser = async () => {
    if (!agent || !newMuteHandle.trim()) return;

    setIsLoading(true);
    setMessage(null);

    try {
      const handle = newMuteHandle.trim().replace("@", "");
      const profileService = getProfileService(agent);
      const profile = await profileService.getProfile(handle);

      await profileService.mute(profile.did);
      setNewMuteHandle("");
      setMessage({
        type: "success",
        text: `Muted @${profile.handle}`,
      });

      await queryClient.invalidateQueries({ queryKey: ["mutedAccounts"] });
    } catch (_error) {
      setMessage({
        type: "error",
        text: "Failed to mute user. Please check the handle and try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnmuteUser = async (did: string, handle: string) => {
    if (!agent) return;

    setIsLoading(true);
    setMessage(null);

    try {
      const profileService = getProfileService(agent);
      await profileService.unmute(did);
      setMessage({
        type: "success",
        text: `Unmuted @${handle}`,
      });

      await queryClient.invalidateQueries({ queryKey: ["mutedAccounts"] });
    } catch (_error) {
      setMessage({
        type: "error",
        text: "Failed to unmute user. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnblockUser = async (blockUri: string, handle: string) => {
    if (!agent) return;

    setIsLoading(true);
    setMessage(null);

    try {
      const profileService = getProfileService(agent);
      await profileService.unblock(blockUri);
      setMessage({
        type: "success",
        text: `Unblocked @${handle}`,
      });

      await queryClient.invalidateQueries({ queryKey: ["blocks"] });
    } catch (_error) {
      setMessage({
        type: "error",
        text: "Failed to unblock user. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!agent) return;

    setIsLoading(true);
    setMessage(null);

    try {
      const moderationPref = {
        $type: "com.shadowsky.moderation",
        keywordFilters: preferences.keywordFilters,
        hideReplies: preferences.hideReplies,
        hideReposts: preferences.hideReposts,
        hideQuotePosts: preferences.hideQuotePosts,
        sensitiveMediaBehavior: preferences.sensitiveMediaBehavior,
        adultContentEnabled: preferences.adultContentEnabled,
        autoModeration: preferences.autoModeration,
        version: 1,
        updatedAt: new Date().toISOString(),
      };

      const did = agent.session?.did;
      if (!did) throw new Error("No DID available");

      try {
        await agent.api.com.atproto.repo.putRecord({
          repo: did,
          collection: "com.shadowsky.moderation",
          rkey: "self",
          record: moderationPref,
        });
      } catch (putError: any) {
        if (putError?.status === 400) {
          await agent.api.com.atproto.repo.createRecord({
            repo: did,
            collection: "com.shadowsky.moderation",
            rkey: "self",
            record: moderationPref,
          });
        } else {
          throw putError;
        }
      }

      setMessage({
        type: "success",
        text: "Content moderation settings saved successfully!",
      });

      await queryClient.invalidateQueries({ queryKey: ["contentModeration"] });
    } catch (_error) {
      setMessage({
        type: "error",
        text: "Failed to save settings. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2
          className="text-xl font-semibold"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          Content Moderation
        </h2>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--bsky-text-secondary)" }}
        >
          Control what content you see in your feeds
        </p>
      </div>

      {/* Keyword Filters */}
      <div>
        <label
          className="mb-2 flex items-center gap-2 text-sm font-medium"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          <Shield size={16} />
          Keyword Filters
        </label>
        <p
          className="mb-3 text-sm"
          style={{ color: "var(--bsky-text-secondary)" }}
        >
          Hide posts containing these keywords or phrases
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddKeyword()}
            placeholder="Add keyword or phrase"
            className="flex-1 rounded-lg px-4 py-2 text-sm"
            style={{
              backgroundColor: "var(--bsky-bg-secondary)",
              color: "var(--bsky-text-primary)",
              border: "1px solid var(--bsky-border-primary)",
            }}
          />
          <button
            onClick={handleAddKeyword}
            disabled={!newKeyword.trim()}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{
              backgroundColor: "var(--bsky-primary)",
            }}
          >
            <Plus size={16} />
          </button>
        </div>

        {preferences.keywordFilters.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {preferences.keywordFilters.map((keyword) => (
              <div
                key={keyword}
                className="flex items-center gap-2 rounded-full px-3 py-1 text-sm"
                style={{
                  backgroundColor: "var(--bsky-bg-secondary)",
                  border: "1px solid var(--bsky-border-primary)",
                }}
              >
                <span style={{ color: "var(--bsky-text-primary)" }}>
                  {keyword}
                </span>
                <button
                  onClick={() => handleRemoveKeyword(keyword)}
                  className="transition-colors hover:text-red-500"
                  style={{ color: "var(--bsky-text-secondary)" }}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Content Warning Preferences */}
      <div className="space-y-3">
        <label
          className="mb-2 block text-sm font-medium"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          Content Preferences
        </label>

        <div
          className="flex items-center justify-between rounded-lg p-4"
          style={{
            backgroundColor: "var(--bsky-bg-secondary)",
            border: "1px solid var(--bsky-border-primary)",
          }}
        >
          <div>
            <div
              className="font-medium"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              Hide replies
            </div>
            <div
              className="text-sm"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              Don't show reply posts in your feed
            </div>
          </div>
          <button
            onClick={() =>
              setPreferences({
                ...preferences,
                hideReplies: !preferences.hideReplies,
              })
            }
            className={`relative h-6 w-11 rounded-full transition-colors ${
              preferences.hideReplies ? "bg-blue-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                preferences.hideReplies ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        <div
          className="flex items-center justify-between rounded-lg p-4"
          style={{
            backgroundColor: "var(--bsky-bg-secondary)",
            border: "1px solid var(--bsky-border-primary)",
          }}
        >
          <div>
            <div
              className="font-medium"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              Hide reposts
            </div>
            <div
              className="text-sm"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              Don't show reposted content in your feed
            </div>
          </div>
          <button
            onClick={() =>
              setPreferences({
                ...preferences,
                hideReposts: !preferences.hideReposts,
              })
            }
            className={`relative h-6 w-11 rounded-full transition-colors ${
              preferences.hideReposts ? "bg-blue-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                preferences.hideReposts ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        <div
          className="flex items-center justify-between rounded-lg p-4"
          style={{
            backgroundColor: "var(--bsky-bg-secondary)",
            border: "1px solid var(--bsky-border-primary)",
          }}
        >
          <div>
            <div
              className="font-medium"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              Hide quote posts
            </div>
            <div
              className="text-sm"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              Don't show quote posts in your feed
            </div>
          </div>
          <button
            onClick={() =>
              setPreferences({
                ...preferences,
                hideQuotePosts: !preferences.hideQuotePosts,
              })
            }
            className={`relative h-6 w-11 rounded-full transition-colors ${
              preferences.hideQuotePosts ? "bg-blue-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                preferences.hideQuotePosts ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Sensitive Media Settings */}
      <div>
        <label
          className="mb-2 block text-sm font-medium"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          Sensitive Media
        </label>
        <p
          className="mb-3 text-sm"
          style={{ color: "var(--bsky-text-secondary)" }}
        >
          Control how sensitive or adult content is displayed
        </p>

        <div
          className="space-y-3 rounded-lg p-4"
          style={{
            backgroundColor: "var(--bsky-bg-secondary)",
            border: "1px solid var(--bsky-border-primary)",
          }}
        >
          <div>
            <label
              className="mb-2 block text-sm font-medium"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              Sensitive media behavior
            </label>
            <select
              value={preferences.sensitiveMediaBehavior}
              onChange={(e) =>
                setPreferences({
                  ...preferences,
                  sensitiveMediaBehavior: e.target.value as
                    | "blur"
                    | "hide"
                    | "show",
                })
              }
              className="w-full rounded-lg px-4 py-2 text-sm"
              style={{
                backgroundColor: "var(--bsky-bg-tertiary)",
                color: "var(--bsky-text-primary)",
                border: "1px solid var(--bsky-border-primary)",
              }}
            >
              <option value="blur">
                Blur sensitive media (show with warning)
              </option>
              <option value="hide">Hide sensitive media completely</option>
              <option value="show">Always show sensitive media</option>
            </select>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              <div
                className="font-medium"
                style={{ color: "var(--bsky-text-primary)" }}
              >
                Enable adult content
              </div>
              <div
                className="text-sm"
                style={{ color: "var(--bsky-text-secondary)" }}
              >
                Show posts marked as adult content
              </div>
            </div>
            <button
              onClick={() =>
                setPreferences({
                  ...preferences,
                  adultContentEnabled: !preferences.adultContentEnabled,
                })
              }
              className={`relative h-6 w-11 rounded-full transition-colors ${
                preferences.adultContentEnabled ? "bg-blue-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  preferences.adultContentEnabled
                    ? "translate-x-5"
                    : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Automated Moderation */}
      <div>
        <label
          className="mb-2 block text-sm font-medium"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          Automated Moderation
        </label>
        <p
          className="mb-3 text-sm"
          style={{ color: "var(--bsky-text-secondary)" }}
        >
          Use Bluesky's labeling services for automated content filtering
        </p>

        <div
          className="flex items-center justify-between rounded-lg p-4"
          style={{
            backgroundColor: "var(--bsky-bg-secondary)",
            border: "1px solid var(--bsky-border-primary)",
          }}
        >
          <div>
            <div
              className="font-medium"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              Enable automated moderation
            </div>
            <div
              className="text-sm"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              Filter spam, harassment, and other harmful content automatically
            </div>
          </div>
          <button
            onClick={() =>
              setPreferences({
                ...preferences,
                autoModeration: !preferences.autoModeration,
              })
            }
            className={`relative h-6 w-11 rounded-full transition-colors ${
              preferences.autoModeration ? "bg-blue-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                preferences.autoModeration ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Muted Users */}
      <div>
        <label
          className="mb-2 block text-sm font-medium"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          Muted Users
        </label>
        <p
          className="mb-3 text-sm"
          style={{ color: "var(--bsky-text-secondary)" }}
        >
          You won't see posts from muted users in your feeds
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
              backgroundColor: "var(--bsky-bg-secondary)",
              color: "var(--bsky-text-primary)",
              border: "1px solid var(--bsky-border-primary)",
            }}
          />
          <select
            value={muteDuration}
            onChange={(e) => setMuteDuration(e.target.value)}
            className="rounded-lg px-4 py-2 text-sm"
            style={{
              backgroundColor: "var(--bsky-bg-secondary)",
              color: "var(--bsky-text-primary)",
              border: "1px solid var(--bsky-border-primary)",
            }}
          >
            <option value="forever">Forever</option>
            <option value="24h">24 hours</option>
            <option value="7d">7 days</option>
            <option value="30d">30 days</option>
          </select>
          <button
            onClick={handleMuteUser}
            disabled={!newMuteHandle.trim() || isLoading}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{
              backgroundColor: "var(--bsky-primary)",
            }}
          >
            Mute
          </button>
        </div>

        {preferences.mutedUsers.length > 0 ? (
          <div className="space-y-2">
            {preferences.mutedUsers.map((user) => (
              <div
                key={user.did}
                className="flex items-center justify-between rounded-lg p-3"
                style={{
                  backgroundColor: "var(--bsky-bg-secondary)",
                  border: "1px solid var(--bsky-border-primary)",
                }}
              >
                <div>
                  <div
                    className="font-medium"
                    style={{ color: "var(--bsky-text-primary)" }}
                  >
                    {user.displayName || user.handle}
                  </div>
                  <div
                    className="text-sm"
                    style={{ color: "var(--bsky-text-secondary)" }}
                  >
                    @{user.handle}
                  </div>
                </div>
                <button
                  onClick={() => handleUnmuteUser(user.did, user.handle)}
                  disabled={isLoading}
                  className="rounded-lg px-3 py-1 text-sm font-medium transition-colors disabled:opacity-50"
                  style={{
                    backgroundColor: "var(--bsky-bg-tertiary)",
                    color: "var(--bsky-text-primary)",
                    border: "1px solid var(--bsky-border-primary)",
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
            style={{ color: "var(--bsky-text-tertiary)" }}
          >
            No muted users
          </p>
        )}
      </div>

      {/* Blocked Users */}
      <div>
        <label
          className="mb-2 block text-sm font-medium"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          Blocked Users
        </label>
        <p
          className="mb-3 text-sm"
          style={{ color: "var(--bsky-text-secondary)" }}
        >
          Blocked users cannot see your posts or interact with you
        </p>

        {preferences.blockedUsers.length > 0 ? (
          <div className="space-y-2">
            {preferences.blockedUsers.map((user) => (
              <div
                key={user.did}
                className="flex items-center justify-between rounded-lg p-3"
                style={{
                  backgroundColor: "var(--bsky-bg-secondary)",
                  border: "1px solid var(--bsky-border-primary)",
                }}
              >
                <div>
                  <div
                    className="font-medium"
                    style={{ color: "var(--bsky-text-primary)" }}
                  >
                    {user.displayName || user.handle}
                  </div>
                  <div
                    className="text-sm"
                    style={{ color: "var(--bsky-text-secondary)" }}
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
                  className="rounded-lg px-3 py-1 text-sm font-medium transition-colors disabled:opacity-50"
                  style={{
                    backgroundColor: "var(--bsky-bg-tertiary)",
                    color: "var(--bsky-text-primary)",
                    border: "1px solid var(--bsky-border-primary)",
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
            style={{ color: "var(--bsky-text-tertiary)" }}
          >
            No blocked users
          </p>
        )}
      </div>

      {message && (
        <div
          className="rounded-lg p-3 text-sm"
          style={{
            backgroundColor:
              message.type === "success"
                ? "rgba(34, 197, 94, 0.1)"
                : "rgba(239, 68, 68, 0.1)",
            color: message.type === "success" ? "#22c55e" : "#ef4444",
            border: `1px solid ${message.type === "success" ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
          }}
        >
          {message.text}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isLoading}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
          style={{
            backgroundColor: "var(--bsky-primary)",
          }}
        >
          {isLoading ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
};
