import { queryClient } from "@bsky/shared";
import { useQuery } from "@tanstack/react-query";
import { BookmarkIcon, Cloud, Database, FileDown, FileUp } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useModal } from "../../contexts/ModalContext";
import { appPreferencesService } from "../../services/app-preferences-service";
import { bookmarkServiceV2 } from "../../services/bookmark-service-v2";
import {
  StorageOption,
  StorageOptionSelector,
  StorageType,
} from "./StorageOptionSelector";

export const BookmarkStorageSettings: React.FC = () => {
  const { agent } = useAuth();
  const { showConfirm } = useModal();
  const [storageType, setStorageType] = useState<StorageType>("local");
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

  const handleStorageChange = async (newType: StorageType) => {
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

  const performStorageChange = async (newType: StorageType) => {
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

  const getStorageName = (type: StorageType) => {
    switch (type) {
      case "local":
        return "Local Storage";
      case "custom":
        return "Custom Records";
    }
  };

  const handleExport = async () => {
    try {
      const bookmarks = await bookmarkServiceV2.exportBookmarks();
      const dataStr = JSON.stringify(bookmarks, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `bluesky-bookmarks-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setMessage({
        type: "success",
        text: `Exported ${bookmarks.length} bookmarks successfully!`,
      });
    } catch (error) {
      console.error("Failed to export bookmarks:", error);
      setMessage({
        type: "error",
        text: "Failed to export bookmarks. Please try again.",
      });
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const bookmarks = JSON.parse(text);

      if (!Array.isArray(bookmarks)) {
        throw new Error("Invalid bookmark file format");
      }

      const count = await bookmarkServiceV2.importBookmarks(bookmarks);

      setMessage({
        type: "success",
        text: `Imported ${count} bookmarks successfully!`,
      });

      // Update bookmark count
      const newCount = await bookmarkServiceV2.getBookmarkCount();
      setBookmarkCount(newCount);

      // Refresh bookmarks
      await queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
    } catch (error) {
      console.error("Failed to import bookmarks:", error);
      setMessage({
        type: "error",
        text: "Failed to import bookmarks. Please check the file format.",
      });
    }

    // Reset input
    event.target.value = "";
  };

  const storageOptions: StorageOption[] = [
    {
      type: "local",
      name: "Local Storage",
      icon: Database,
      description: "Store bookmarks on this device only. Private and fast.",
      pros: ["Private", "Works offline", "No sync"],
      cons: ["No cross-device sync", "Lost if browser data cleared"],
    },
    {
      type: "custom",
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
      warning: "Anyone can view your bookmarks with this storage method!",
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

      <StorageOptionSelector
        options={storageOptions}
        selectedType={storageType}
        onSelect={handleStorageChange}
        isLoading={isLoading}
      />

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

      <div
        className="border-t pt-6"
        style={{ borderColor: "var(--bsky-border-primary)" }}
      >
        <h3
          className="mb-4 text-lg font-medium"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          Import / Export
        </h3>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors"
            style={{
              backgroundColor: "var(--bsky-bg-tertiary)",
              color: "var(--bsky-text-primary)",
              border: "1px solid var(--bsky-border-primary)",
            }}
          >
            <FileDown className="h-4 w-4" />
            Export Bookmarks
          </button>
          <label>
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
            <button
              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors"
              style={{
                backgroundColor: "var(--bsky-bg-tertiary)",
                color: "var(--bsky-text-primary)",
                border: "1px solid var(--bsky-border-primary)",
              }}
            >
              <FileUp className="h-4 w-4" />
              Import Bookmarks
            </button>
          </label>
        </div>
      </div>
    </div>
  );
};
