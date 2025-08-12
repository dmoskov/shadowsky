import { queryClient } from "@bsky/shared";
import { useQuery } from "@tanstack/react-query";
import { BookmarkIcon, Cloud, Database } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useModal } from "../../contexts/ModalContext";
import { appPreferencesService } from "../../services/app-preferences-service";
import { bookmarkServiceV2 } from "../../services/bookmark-service-v2";

type BookmarkStorageType = "local" | "custom";

export const BookmarkSettings: React.FC = () => {
  const { agent } = useAuth();
  const { showConfirm } = useModal();
  const [storageType, setStorageType] = useState<BookmarkStorageType>("local");
  const [isLoading, setIsLoading] = useState(false);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Get current storage type from app preferences
  const { data: appPreferences } = useQuery({
    queryKey: ["appPreferences"],
    queryFn: async () => {
      if (!agent) return null;
      appPreferencesService.setAgent(agent);
      return await appPreferencesService.getPreferences();
    },
    enabled: !!agent,
  });

  // Load storage type from preferences
  useEffect(() => {
    if (appPreferences) {
      setStorageType(appPreferences.bookmarkStorageType);
    }
  }, [appPreferences]);

  // Load bookmark count
  useEffect(() => {
    const loadCount = async () => {
      try {
        const count = await bookmarkServiceV2.getBookmarkCount();
        setBookmarkCount(count);
      } catch (error) {
        console.error("Failed to load bookmark count:", error);
      }
    };
    loadCount();
  }, [storageType]);

  const handleStorageChange = async (newType: BookmarkStorageType) => {
    if (!agent) {
      setMessage({
        type: "error",
        text: "Authentication required. Please log in again.",
      });
      return;
    }

    // Show warning for custom records
    if (newType === "custom") {
      await showConfirm(
        "⚠️ WARNING: Custom records are PUBLIC!\n\n" +
          "Anyone can view your bookmarks if you use this storage method. " +
          "Your bookmarks will be visible to anyone who knows how to query AT Protocol records.\n\n" +
          "Are you sure you want to make your bookmarks public?",
        async () => {
          // User confirmed - proceed with storage change
          await performStorageChange(newType);
        },
        {
          variant: "warning",
          title: "Public Bookmark Storage",
          confirmText: "Make Public",
          cancelText: "Cancel",
        },
      );
      return;
    }

    // For non-custom storage, proceed directly
    await performStorageChange(newType);
  };

  const performStorageChange = async (newType: BookmarkStorageType) => {
    if (!agent) return;

    setIsLoading(true);
    setMessage(null);

    try {
      // Ensure bookmark service has the current agent
      bookmarkServiceV2.setAgent(agent);

      // First, migrate existing bookmarks to new storage
      await bookmarkServiceV2.migrateStorage(storageType, newType);

      // Update app preferences in PDS
      appPreferencesService.setAgent(agent);
      await appPreferencesService.updatePreferences({
        bookmarkStorageType: newType,
      });

      setStorageType(newType);
      setMessage({
        type: "success",
        text: `Bookmarks migrated to ${getStorageName(newType)} successfully! Reloading page...`,
      });

      // Refresh preferences and bookmarks
      await queryClient.invalidateQueries({ queryKey: ["appPreferences"] });
      await queryClient.invalidateQueries({ queryKey: ["bookmarks"] });

      // Update bookmark count
      const count = await bookmarkServiceV2.getBookmarkCount();
      setBookmarkCount(count);

      // Reload the page to ensure the bookmark service reinitializes with new storage
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error("Failed to change bookmark storage:", error);
      setMessage({
        type: "error",
        text: "Failed to migrate bookmarks. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStorageName = (type: BookmarkStorageType) => {
    switch (type) {
      case "local":
        return "Local Storage";
      case "custom":
        return "Custom Records";
    }
  };

  const storageOptions = [
    {
      type: "local" as BookmarkStorageType,
      name: "Local Storage",
      icon: Database,
      description: "Store bookmarks on this device only. Private and fast.",
      pros: ["Private", "Works offline", "No sync"],
      cons: ["No cross-device sync", "Lost if browser data cleared"],
    },
    {
      type: "custom" as BookmarkStorageType,
      name: "Custom Records (PUBLIC)",
      icon: Cloud,
      description:
        "Store bookmarks as AT Protocol records. WARNING: These are publicly visible to anyone!",
      pros: ["Cross-device sync"],
      cons: [
        "PUBLIC - Anyone can see your bookmarks!",
        "Experimental",
        "May not work with other clients",
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2
          className="text-xl font-semibold"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          Bookmark Storage
        </h2>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--bsky-text-secondary)" }}
        >
          Choose how your bookmarks are stored
        </p>
      </div>

      <div className="space-y-4">
        {storageOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = storageType === option.type;

          return (
            <button
              key={option.type}
              onClick={() => handleStorageChange(option.type)}
              disabled={isLoading || isSelected}
              className={`w-full rounded-lg p-4 text-left transition-all ${
                isSelected ? "ring-2 ring-offset-2" : "hover:brightness-110"
              } ${isLoading ? "opacity-50" : ""}`}
              style={{
                backgroundColor: "var(--bsky-bg-secondary)",
                border: `2px solid ${
                  isSelected
                    ? "var(--bsky-primary)"
                    : "var(--bsky-border-primary)"
                }`,
              }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="rounded-lg p-2"
                  style={{
                    backgroundColor: isSelected
                      ? "var(--bsky-primary)"
                      : "var(--bsky-bg-tertiary)",
                  }}
                >
                  <Icon
                    size={20}
                    style={{
                      color: isSelected
                        ? "white"
                        : "var(--bsky-text-secondary)",
                    }}
                  />
                </div>

                <div className="flex-1">
                  <h3
                    className="font-medium"
                    style={{ color: "var(--bsky-text-primary)" }}
                  >
                    {option.name}
                  </h3>
                  <p
                    className="mt-1 text-sm"
                    style={{ color: "var(--bsky-text-secondary)" }}
                  >
                    {option.description}
                  </p>

                  <div className="mt-3 flex gap-4 text-xs">
                    <div>
                      <span style={{ color: "var(--bsky-text-tertiary)" }}>
                        Pros:
                      </span>
                      <ul className="mt-1" style={{ color: "#22c55e" }}>
                        {option.pros.map((pro, i) => (
                          <li key={i}>• {pro}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <span style={{ color: "var(--bsky-text-tertiary)" }}>
                        Cons:
                      </span>
                      <ul className="mt-1" style={{ color: "#ef4444" }}>
                        {option.cons.map((con, i) => (
                          <li
                            key={i}
                            className={
                              con.includes("PUBLIC") ? "font-bold" : ""
                            }
                          >
                            • {con}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {isSelected && (
                  <div
                    className="flex items-center gap-1 text-sm font-semibold"
                    style={{ color: "var(--bsky-primary)" }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle
                        cx="8"
                        cy="8"
                        r="8"
                        fill="currentColor"
                        opacity="0.2"
                      />
                      <path
                        d="M12 5L6.5 10.5L4 8"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Active
                  </div>
                )}
              </div>
            </button>
          );
        })}
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
            border: `1px solid ${
              message.type === "success"
                ? "rgba(34, 197, 94, 0.3)"
                : "rgba(239, 68, 68, 0.3)"
            }`,
          }}
        >
          {message.text}
        </div>
      )}

      <div
        className="rounded-lg p-4"
        style={{
          backgroundColor: "var(--bsky-bg-secondary)",
          border: "1px solid var(--bsky-border-primary)",
        }}
      >
        <div className="flex items-center gap-2">
          <BookmarkIcon
            size={16}
            style={{ color: "var(--bsky-text-secondary)" }}
          />
          <span
            className="text-sm font-medium"
            style={{ color: "var(--bsky-text-primary)" }}
          >
            Current Bookmarks
          </span>
        </div>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--bsky-text-secondary)" }}
        >
          You have {bookmarkCount} bookmarks stored using{" "}
          {getStorageName(storageType)}.
        </p>
      </div>
    </div>
  );
};
