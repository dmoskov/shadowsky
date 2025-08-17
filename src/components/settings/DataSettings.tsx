import { queryClient } from "@bsky/shared";
import { useQuery } from "@tanstack/react-query";
import { BookmarkIcon, Columns, Settings } from "lucide-react";
import React, { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useModal } from "../../contexts/ModalContext";
import { appPreferencesService } from "../../services/app-preferences-service";
import { bookmarkServiceV2 } from "../../services/bookmark-service-v2";
import { columnService } from "../../services/column-service";

type StorageType = "local" | "custom";

interface DataStorageItem {
  id: string;
  name: string;
  icon: React.FC<{ className?: string }>;
  storageType: StorageType;
  onToggle: (enabled: boolean) => Promise<void>;
  isLoading?: boolean;
  localKey?: string;
  atProtoKey?: string;
}

export const DataSettings: React.FC = () => {
  const { agent } = useAuth();
  const { showConfirm } = useModal();
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>(
    {},
  );
  const [message, setMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  // Get current storage preferences
  const { data: appPreferences } = useQuery({
    queryKey: ["appPreferences"],
    queryFn: async () => {
      if (!agent) return null;
      appPreferencesService.setAgent(agent);
      return await appPreferencesService.getPreferences();
    },
    enabled: !!agent,
  });

  const handleStorageToggle = async (
    dataType: "bookmarks" | "columns" | "settings",
    enabled: boolean,
  ) => {
    if (!agent) {
      setMessage({
        type: "error",
        text: "Authentication required. Please log in again.",
      });
      return;
    }

    const newType: StorageType = enabled ? "custom" : "local";

    // Show warning for enabling custom storage
    if (enabled) {
      if (dataType === "settings" || dataType === "columns") {
        // App settings and columns use private preferences API
        await performStorageChange(dataType, newType);
        return;
      }

      await showConfirm(
        "⚠️ WARNING: Custom records are PUBLIC!\n\n" +
          "Anyone can view this data if you use AT Protocol storage. " +
          "Your data will be visible to anyone who knows how to query AT Protocol records.\n\n" +
          "Are you sure you want to make this data public?",
        async () => {
          await performStorageChange(dataType, newType);
        },
        {
          variant: "warning",
          title: "Public Data Storage",
          confirmText: "Make Public",
          cancelText: "Cancel",
        },
      );
    } else {
      await performStorageChange(dataType, newType);
    }
  };

  const performStorageChange = async (
    dataType: "bookmarks" | "columns" | "settings",
    newType: StorageType,
  ) => {
    if (!agent) return;

    setLoadingStates((prev) => ({ ...prev, [dataType]: true }));
    setMessage(null);

    try {
      // Get current storage type - settings always use preferences API when custom
      let currentType: StorageType = "local";
      if (dataType === "settings") {
        // Settings are stored in preferences API when any preference exists
        currentType = appPreferences ? "custom" : "local";
      } else {
        currentType = (appPreferences?.[`${dataType === "columns" ? "column" : dataType === "bookmarks" ? "bookmark" : dataType}StorageType`] ||
          "local") as StorageType;
      }

      // Migrate data based on type
      switch (dataType) {
        case "bookmarks":
          bookmarkServiceV2.setAgent(agent);
          await bookmarkServiceV2.migrateStorage(currentType, newType);
          break;
        case "columns":
          columnService.setAgent(agent);
          await columnService.migrateStorage(currentType, newType);
          break;
        case "settings":
          // Settings migration handled by preferences service
          break;
      }

      // Update preferences
      appPreferencesService.setAgent(agent);
      if (dataType !== "settings") {
        await appPreferencesService.updatePreferences({
          [`${dataType}StorageType`]: newType,
        });
      }

      setMessage({
        type: "success",
        text: `${dataType.charAt(0).toUpperCase() + dataType.slice(1)} migrated successfully! Reloading page...`,
      });

      // Invalidate queries
      await queryClient.invalidateQueries({ queryKey: ["appPreferences"] });
      await queryClient.invalidateQueries({ queryKey: [dataType] });

      // Reload page after short delay
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error(`Failed to change ${dataType} storage:`, error);
      setMessage({
        type: "error",
        text: `Failed to migrate ${dataType}. Please try again.`,
      });
    } finally {
      setLoadingStates((prev) => ({ ...prev, [dataType]: false }));
    }
  };

  const storageItems: DataStorageItem[] = [
    {
      id: "settings",
      name: "App Settings",
      icon: Settings,
      // Check if preferences are being synced via AT Protocol
      storageType: appPreferences ? "custom" : "local",
      onToggle: (enabled) => handleStorageToggle("settings", enabled),
      isLoading: loadingStates.settings,
      localKey: "shadowsky_app_preferences",
      atProtoKey: "com.shadowsky.prefs",
    },
    {
      id: "bookmarks",
      name: "Bookmarks",
      icon: BookmarkIcon,
      storageType: appPreferences?.bookmarkStorageType || "local",
      onToggle: (enabled) => handleStorageToggle("bookmarks", enabled),
      isLoading: loadingStates.bookmarks,
      localKey: "shadowsky-bookmarks-*",
      atProtoKey: "com.shadowsky.bookmark",
    },
    {
      id: "columns",
      name: "Home Columns",
      icon: Columns,
      storageType: appPreferences?.columnStorageType || "local",
      onToggle: (enabled) => handleStorageToggle("columns", enabled),
      isLoading: loadingStates.columns,
      localKey: "shadowsky_columns",
      atProtoKey: "com.shadowsky.columns",
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold">Data Storage Settings</h1>
        <p className="text-muted-foreground mt-2">
          Choose how your data is stored - locally on your device or synced
          across devices using AT Protocol.
        </p>
      </div>

      {message && (
        <div
          className="rounded-lg p-3 text-sm"
          style={{
            backgroundColor:
              message.type === "success"
                ? "rgba(34, 197, 94, 0.1)"
                : message.type === "error"
                  ? "rgba(239, 68, 68, 0.1)"
                  : "rgba(59, 130, 246, 0.1)",
            color:
              message.type === "success"
                ? "#22c55e"
                : message.type === "error"
                  ? "#ef4444"
                  : "#3b82f6",
            border: `1px solid ${
              message.type === "success"
                ? "rgba(34, 197, 94, 0.3)"
                : message.type === "error"
                  ? "rgba(239, 68, 68, 0.3)"
                  : "rgba(59, 130, 246, 0.3)"
            }`,
          }}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-4">
        {storageItems.map((item) => {
          const Icon = item.icon;
          const isEnabled = item.storageType === "custom";

          return (
            <div
              key={item.id}
              className="rounded-lg p-6"
              style={{
                backgroundColor: "var(--bsky-bg-secondary)",
                border: "1px solid var(--bsky-border-primary)",
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    <h3
                      className="text-lg font-medium"
                      style={{ color: "var(--bsky-text-primary)" }}
                    >
                      {item.name}
                    </h3>
                  </div>
                  <div className="mt-3 space-y-2">
                    <p
                      className="text-sm"
                      style={{ color: "var(--bsky-text-secondary)" }}
                    >
                      {item.id === "settings" ? (
                        isEnabled ? (
                          <>
                            <strong>AT Protocol:</strong> Settings sync across
                            devices using the preferences API.
                          </>
                        ) : (
                          <>
                            <strong>Local Only:</strong> Settings stored on this
                            device only.
                          </>
                        )
                      ) : isEnabled ? (
                        <>
                          <strong style={{ color: "#ef4444" }}>
                            ⚠️ PUBLIC:
                          </strong>{" "}
                          This data is stored in AT Protocol records and can be
                          viewed by anyone.
                        </>
                      ) : (
                        <>
                          <strong>Private:</strong> This data is stored locally
                          on your device and is not synced across devices.
                        </>
                      )}
                    </p>
                    <div
                      className="font-mono text-xs"
                      style={{ color: "var(--bsky-text-tertiary)" }}
                    >
                      <div>
                        Local:{" "}
                        <span className="text-blue-600">{item.localKey}</span>
                      </div>
                      <div>
                        AT Protocol:{" "}
                        <span className="text-blue-600">{item.atProtoKey}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="ml-6">
                  {item.id === "settings" ? (
                    <>
                      <div className="flex items-center gap-2 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
                        <button
                          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                            !isEnabled
                              ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                              : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                          }`}
                          onClick={() => item.onToggle(false)}
                          disabled={item.isLoading || !isEnabled}
                        >
                          Local
                        </button>
                        <button
                          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                            isEnabled
                              ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                              : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                          }`}
                          onClick={() => item.onToggle(true)}
                          disabled={item.isLoading || isEnabled}
                        >
                          AT Protocol
                        </button>
                      </div>
                      {item.isLoading && (
                        <p className="mt-1 text-xs text-gray-500">
                          Migrating...
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
                        <button
                          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                            !isEnabled
                              ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                              : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                          }`}
                          onClick={() => item.onToggle(false)}
                          disabled={item.isLoading || !isEnabled}
                        >
                          Local
                        </button>
                        <button
                          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                            isEnabled
                              ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                              : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                          }`}
                          onClick={() => item.onToggle(true)}
                          disabled={item.isLoading || isEnabled}
                        >
                          AT Protocol
                        </button>
                      </div>
                      {item.isLoading && (
                        <p className="mt-1 text-xs text-gray-500">
                          Migrating...
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="rounded-lg p-4 text-sm"
        style={{
          backgroundColor: "var(--bsky-bg-tertiary)",
          border: "1px solid var(--bsky-border-primary)",
          color: "var(--bsky-text-secondary)",
        }}
      >
        <p className="mb-1 font-medium">About Storage Options:</p>
        <ul className="ml-4 space-y-1">
          <li>
            • <strong>Local Storage:</strong> Fast, private, and works offline.
            Data stays on this device only.
          </li>
          <li>
            • <strong>AT Protocol Storage:</strong> Syncs across devices. App
            settings and columns use the private preferences API, while
            bookmarks use public records.
          </li>
        </ul>
      </div>
    </div>
  );
};
