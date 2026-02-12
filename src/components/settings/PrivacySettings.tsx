import { queryClient } from "@bsky/shared";
import { useQuery } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";

export const PrivacySettings: React.FC = () => {
  const { agent } = useAuth();
  const [privacy, setPrivacy] = useState({
    profileVisibility: "public",
    allowMessages: "everyone",
    allowMentions: "everyone",
    hideFromSearch: false,
    filterContent: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Fetch current preferences
  const { data: preferences } = useQuery({
    queryKey: ["preferences"],
    queryFn: async () => {
      if (!agent) return null;
      const response = await agent.app.bsky.actor.getPreferences();
      return response.data.preferences; // Extract preferences array from API response
    },
    enabled: !!agent,
  });

  // Update local state when preferences load
  useEffect(() => {
    if (preferences && Array.isArray(preferences)) {
      // Check for content filtering preferences
      const adultContentPref = preferences.find(
        (p: any) => p.$type === "app.bsky.actor.defs#adultContentPref",
      );
      if (adultContentPref && "enabled" in adultContentPref) {
        setPrivacy((prev) => ({
          ...prev,
          filterContent: !adultContentPref.enabled,
        }));
      }
    }
  }, [preferences]);

  const handleSave = async () => {
    if (!agent) return;

    setIsLoading(true);
    setMessage(null);

    try {
      // Get current preferences and update
      const currentPrefs = await agent.getPreferences();

      // Filter out old adult content preferences
      const otherPrefs = (currentPrefs as any).filter(
        (p: any) => p.$type !== "app.bsky.actor.defs#adultContentPref",
      );

      // Add updated adult content preference (inverse of filterContent)
      const updatedPrefs = [
        ...otherPrefs,
        {
          $type: "app.bsky.actor.defs#adultContentPref",
          enabled: !privacy.filterContent,
        },
      ];

      // Update preferences
      await agent.app.bsky.actor.putPreferences({
        preferences: updatedPrefs,
      });

      // Note: Other privacy settings like messages, mentions, search visibility
      // are not currently available in the Bluesky API

      setMessage({
        type: "success",
        text: "Privacy settings saved! Note: Some settings are not yet available in Bluesky.",
      });

      // Refresh preferences
      await queryClient.invalidateQueries({ queryKey: ["preferences"] });
    } catch (error) {
      console.error("Failed to save privacy settings:", error);
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
          style={{ color: "var(--asph-text-primary)" }}
        >
          Privacy & Safety
        </h2>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--asph-text-secondary)" }}
        >
          Control who can interact with you and your content
        </p>
      </div>

      <div>
        <label
          className="mb-2 block text-sm font-medium"
          style={{ color: "var(--asph-text-primary)" }}
        >
          Profile Visibility
        </label>
        <select
          value={privacy.profileVisibility}
          onChange={(e) =>
            setPrivacy({ ...privacy, profileVisibility: e.target.value })
          }
          className="w-full rounded-lg px-4 py-2 text-sm"
          style={{
            backgroundColor: "var(--asph-bg-secondary)",
            color: "var(--asph-text-primary)",
            border: "1px solid var(--asph-border-primary)",
          }}
        >
          <option value="public">Public - Anyone can view</option>
          <option value="followers">Followers only</option>
          <option value="private">Private - Only you</option>
        </select>
      </div>

      <div>
        <label
          className="mb-2 block text-sm font-medium"
          style={{ color: "var(--asph-text-primary)" }}
        >
          Who can message you
        </label>
        <select
          value={privacy.allowMessages}
          onChange={(e) =>
            setPrivacy({ ...privacy, allowMessages: e.target.value })
          }
          className="w-full rounded-lg px-4 py-2 text-sm"
          style={{
            backgroundColor: "var(--asph-bg-secondary)",
            color: "var(--asph-text-primary)",
            border: "1px solid var(--asph-border-primary)",
          }}
        >
          <option value="everyone">Everyone</option>
          <option value="followers">People you follow</option>
          <option value="none">No one</option>
        </select>
      </div>

      <div>
        <label
          className="mb-2 block text-sm font-medium"
          style={{ color: "var(--asph-text-primary)" }}
        >
          Who can mention you
        </label>
        <select
          value={privacy.allowMentions}
          onChange={(e) =>
            setPrivacy({ ...privacy, allowMentions: e.target.value })
          }
          className="w-full rounded-lg px-4 py-2 text-sm"
          style={{
            backgroundColor: "var(--asph-bg-secondary)",
            color: "var(--asph-text-primary)",
            border: "1px solid var(--asph-border-primary)",
          }}
        >
          <option value="everyone">Everyone</option>
          <option value="followers">People you follow</option>
          <option value="none">No one</option>
        </select>
      </div>

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
            Hide from search
          </div>
          <div
            className="text-sm"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            Prevent your profile from appearing in search results
          </div>
        </div>
        <button
          onClick={() =>
            setPrivacy({ ...privacy, hideFromSearch: !privacy.hideFromSearch })
          }
          className={`relative h-6 w-11 rounded-full transition-colors ${
            privacy.hideFromSearch ? "bg-blue-500" : "bg-gray-300"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
              privacy.hideFromSearch ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

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
            Content filtering
          </div>
          <div
            className="text-sm"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            Automatically hide potentially sensitive content
          </div>
        </div>
        <button
          onClick={() =>
            setPrivacy({ ...privacy, filterContent: !privacy.filterContent })
          }
          className={`relative h-6 w-11 rounded-full transition-colors ${
            privacy.filterContent ? "bg-blue-500" : "bg-gray-300"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
              privacy.filterContent ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

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

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isLoading}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
          style={{
            backgroundColor: "var(--asph-primary)",
          }}
        >
          {isLoading ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
};
