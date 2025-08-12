import { queryClient } from "@bsky/shared";
import { useQuery } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";

export const NotificationSettings: React.FC = () => {
  const { agent } = useAuth();
  const [notifications, setNotifications] = useState({
    mentions: true,
    replies: true,
    likes: false,
    reposts: false,
    follows: true,
    quotes: true,
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
      const { data } = await agent.getPreferences();
      return data.preferences;
    },
    enabled: !!agent,
  });

  // Update local state when preferences load
  useEffect(() => {
    if (preferences) {
      // Find the notification preferences
      const notifPrefs = preferences.find(
        (p) => p.$type === "app.bsky.actor.defs#notificationsPref",
      );
      if (notifPrefs && notifPrefs.priority) {
        // Map server preferences to our local state
        setNotifications({
          mentions: notifPrefs.priority.includes("mentions"),
          replies: notifPrefs.priority.includes("replies"),
          likes: notifPrefs.priority.includes("likes"),
          reposts: notifPrefs.priority.includes("reposts"),
          follows: notifPrefs.priority.includes("follows"),
          quotes: notifPrefs.priority.includes("quotes"),
        });
      }
    }
  }, [preferences]);

  const handleToggle = (key: keyof typeof notifications) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (!agent) return;

    setIsLoading(true);
    setMessage(null);

    try {
      // Build priority array based on enabled notifications
      const priority = Object.entries(notifications)
        .filter(([_, enabled]) => enabled)
        .map(([key]) => key);

      // Get current preferences and update
      const { data: currentPrefs } = await agent.getPreferences();

      // Filter out old notification preferences
      const otherPrefs = currentPrefs.preferences.filter(
        (p) => p.$type !== "app.bsky.actor.defs#notificationsPref",
      );

      // Add updated notification preferences
      const updatedPrefs = [
        ...otherPrefs,
        {
          $type: "app.bsky.actor.defs#notificationsPref",
          priority,
        },
      ];

      // Update preferences
      await agent.app.bsky.actor.putPreferences({
        preferences: updatedPrefs,
      });

      setMessage({ type: "success", text: "Notification preferences saved!" });

      // Refresh preferences
      await queryClient.invalidateQueries({ queryKey: ["preferences"] });
    } catch (error) {
      console.error("Failed to save notification preferences:", error);
      setMessage({
        type: "error",
        text: "Failed to save preferences. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const notificationTypes = [
    {
      key: "mentions",
      label: "Mentions",
      description: "When someone mentions you in a post",
    },
    {
      key: "replies",
      label: "Replies",
      description: "When someone replies to your posts",
    },
    {
      key: "likes",
      label: "Likes",
      description: "When someone likes your posts",
    },
    {
      key: "reposts",
      label: "Reposts",
      description: "When someone reposts your content",
    },
    {
      key: "follows",
      label: "New Followers",
      description: "When someone follows you",
    },
    {
      key: "quotes",
      label: "Quote Posts",
      description: "When someone quotes your posts",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2
          className="text-xl font-semibold"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          Notification Preferences
        </h2>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--bsky-text-secondary)" }}
        >
          Choose what notifications you want to receive
        </p>
      </div>

      <div>
        {notificationTypes.map((type, index) => (
          <div
            key={type.key}
            className={`flex items-center justify-between py-4 ${
              index !== notificationTypes.length - 1 ? "border-b" : ""
            }`}
            style={{
              borderColor: "var(--bsky-border-primary)",
            }}
          >
            <div className="flex-1">
              <div
                className="font-medium"
                style={{ color: "var(--bsky-text-primary)" }}
              >
                {type.label}
              </div>
              <div
                className="text-sm"
                style={{ color: "var(--bsky-text-secondary)" }}
              >
                {type.description}
              </div>
            </div>
            <button
              onClick={() =>
                handleToggle(type.key as keyof typeof notifications)
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                notifications[type.key as keyof typeof notifications]
                  ? "bg-blue-500"
                  : "bg-gray-300 dark:bg-gray-600"
              }`}
              role="switch"
              aria-checked={
                notifications[type.key as keyof typeof notifications]
              }
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-200 ${
                  notifications[type.key as keyof typeof notifications]
                    ? "translate-x-6"
                    : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        ))}
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
          {isLoading ? "Saving..." : "Save Preferences"}
        </button>
      </div>
    </div>
  );
};
