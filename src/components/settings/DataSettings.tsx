import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookmarkIcon, Columns, Settings } from "lucide-react";
import React, { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useModal } from "../../contexts/ModalContext";
import { appPreferencesService } from "../../services/app-preferences-service";
import { columnService } from "../../services/column-service";
import { getStoragePrefKey } from "../../services/storage/storage-constants";

type StorageType = "local" | "custom" | "official";

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
  const queryClient = useQueryClient();
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>(
    {},
  );
  const [message, setMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [missingRecords, setMissingRecords] = useState<{
    columns?: boolean;
    bookmarks?: boolean;
  }>({});
  const [successfulMigrations, setSuccessfulMigrations] = useState<
    Record<string, StorageType>
  >({});
  const [recordCounts, setRecordCounts] = useState<Record<string, number>>({});
  const [localColumnCount, setLocalColumnCount] = useState<number>(0);
  const [showMigrationPrompt, setShowMigrationPrompt] =
    useState<boolean>(false);
  // Note: Bookmark state variables removed - bookmarks now use only official API

  // Get current storage preferences
  const { data: appPreferences } = useQuery({
    queryKey: ["appPreferences"],
    queryFn: async () => {
      if (!agent) return null;
      appPreferencesService.setAgent(agent);
      const prefs = await appPreferencesService.getPreferences();
      return prefs;
    },
    enabled: !!agent,
  });

  // Note: Bookmarks now use only the official AT Protocol API
  // No need to check for existing bookmarks in different storage types

  // Fetch record counts for AT Protocol storage
  useQuery({
    queryKey: ["atProtocolRecordCounts", appPreferences],
    queryFn: async () => {
      if (!agent || !appPreferences) return;

      const counts: Record<string, number> = {};

      try {
        // Note: Bookmarks now use only the official AT Protocol API
        // No custom storage counting needed

        // Count drafts if using AT Protocol
        if (appPreferences.draftStorageType === "custom") {
          const draftResponse = await agent.api.com.atproto.repo.listRecords({
            repo: agent.session?.did || "",
            collection: "com.shadowsky.draft",
            limit: 100,
          });
          counts.drafts = draftResponse.data.records.length;
        }

        // Columns use singleton record containing array of columns
        if (appPreferences.columnStorageType === "atproto") {
          try {
            const columnsData = await appPreferencesService.getColumns();
            counts.columns = columnsData?.columns?.length || 0;
            // Check if the record actually exists
            await agent.api.com.atproto.repo.getRecord({
              repo: agent.session?.did || "",
              collection: "com.shadowsky.columns",
              rkey: "self",
            });
            setMissingRecords((prev) => ({ ...prev, columns: false }));

            // Check local storage for comparison
            const { ColumnLocalStorageBackend } = await import(
              "../../services/storage/column-local-storage-backend"
            );
            const localBackend = new ColumnLocalStorageBackend();
            const localColumns = await localBackend.loadColumns();
            setLocalColumnCount(localColumns.length);

            // If AT Protocol has 0 columns but local has columns, show migration prompt
            if (counts.columns === 0 && localColumns.length > 0) {
              setShowMigrationPrompt(true);
            }
          } catch (error: any) {
            if (error?.status === 400) {
              setMissingRecords((prev) => ({ ...prev, columns: true }));
              counts.columns = 0;
            }
          }
        }

        if (appPreferences.isStoredInAtProto) {
          counts.settings = 1;
        }

        setRecordCounts(counts);
        return counts; // Return the counts to avoid undefined warning
      } catch (error) {
        console.error("Failed to fetch AT Protocol record counts:", error);
        return null; // Return null on error instead of undefined
      }
    },
    enabled: !!agent && !!appPreferences,
  });

  const handleMigrateLocalColumns = async () => {
    if (!agent) return;

    setLoadingStates((prev) => ({ ...prev, migrate_columns: true }));
    setMessage(null);

    try {
      // Load columns from local storage
      const { ColumnLocalStorageBackend } = await import(
        "../../services/storage/column-local-storage-backend"
      );
      const localBackend = new ColumnLocalStorageBackend();
      const localColumns = await localBackend.loadColumns();

      // Save to AT Protocol
      const columnData = localColumns.map((col) => ({
        id: col.id,
        type: col.type as string,
        title: col.title,
        data: col.data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      await appPreferencesService.updateColumns(columnData);

      setShowMigrationPrompt(false);
      setMessage({
        type: "success",
        text: `Successfully migrated ${localColumns.length} columns to AT Protocol`,
      });

      // Refetch counts
      queryClient.invalidateQueries({ queryKey: ["atProtocolRecordCounts"] });
    } catch (error) {
      console.error("Failed to migrate columns:", error);
      setMessage({
        type: "error",
        text: "Failed to migrate columns",
      });
    } finally {
      setLoadingStates((prev) => ({ ...prev, migrate_columns: false }));
    }
  };

  const handleCreateMissingRecord = async (
    dataType: "columns" | "bookmarks",
  ) => {
    if (!agent) return;

    setLoadingStates((prev) => ({ ...prev, [`create_${dataType}`]: true }));
    setMessage(null);

    try {
      if (dataType === "columns") {
        // Create empty columns record
        await appPreferencesService.updateColumns([]);
        setMissingRecords((prev) => ({ ...prev, columns: false }));
        setMessage({
          type: "success",
          text: "Columns record created successfully",
        });
        // Refetch counts
        queryClient.invalidateQueries({ queryKey: ["atProtocolRecordCounts"] });
      } else if (dataType === "bookmarks") {
        // Create empty bookmarks record
        const bookmarksData = {
          $type: "com.shadowsky.bookmarks",
          bookmarks: [],
          version: 1,
        };

        await agent.api.com.atproto.repo.createRecord({
          repo: agent.session?.did || "",
          collection: "com.shadowsky.bookmarks",
          rkey: "self",
          record: bookmarksData,
        });

        setMissingRecords((prev) => ({ ...prev, bookmarks: false }));
        setMessage({
          type: "success",
          text: "Bookmarks record created successfully",
        });
        // Refetch counts and invalidate bookmarks queries
        queryClient.invalidateQueries({ queryKey: ["atProtocolRecordCounts"] });
        queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      }
    } catch (error) {
      console.error(`Failed to create ${dataType} record:`, error);
      setMessage({
        type: "error",
        text: `Failed to create ${dataType} record`,
      });
    } finally {
      setLoadingStates((prev) => ({ ...prev, [`create_${dataType}`]: false }));
    }
  };

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

    // Note: Bookmarks now use only the official AT Protocol API
    // For other data types, use custom when enabled
    const newType: StorageType = enabled ? "custom" : "local";

    // Show warning for enabling custom storage (but not for official bookmarks or private APIs)
    if (enabled) {
      if (
        dataType === "settings" ||
        dataType === "columns" ||
        dataType === "bookmarks"
      ) {
        // App settings, columns use private preferences API, bookmarks use official private API
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
      const currentType: StorageType =
        dataType === "settings"
          ? appPreferences
            ? "custom"
            : "local"
          : dataType === "columns"
            ? (appPreferences?.columnStorageType === "atproto"
              ? "custom"
              : (appPreferences?.columnStorageType as StorageType)) || "local"
            : "local";

      // Migrate data based on type
      switch (dataType) {
        case "bookmarks":
          // Bookmarks now use only the official AT Protocol API
          // No migration needed
          break;
        case "columns":
          columnService.setAgent(agent);
          await columnService.migrateStorage(currentType, newType);
          // Ensure the columns record exists in AT Protocol
          if (newType === "custom") {
            const columns = await columnService.getColumns();
            await appPreferencesService.updateColumns(
              columns.map((col) => ({
                id: col.id,
                type: col.type as string,
                title: col.title,
                data: col.data,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              })),
            );
          }
          break;
        case "settings":
          // Settings migration handled by preferences service
          break;
      }

      // Update preferences
      appPreferencesService.setAgent(agent);
      if (dataType === "settings") {
        // For settings, we need to ensure preferences are saved to AT Protocol
        if (newType === "custom") {
          // Force save to AT Protocol by updating preferences
          await appPreferencesService.updatePreferences({});
        } else {
          // Can't migrate back to local only - AT Protocol records persist
          throw new Error("Cannot disable AT Protocol sync once enabled");
        }
      } else {
        // Use the correct storage preference key
        // Convert plural to singular for the helper function
        const singularType =
          dataType === "bookmarks"
            ? "bookmark"
            : dataType === "columns"
              ? "column"
              : dataType === "drafts"
                ? "draft"
                : dataType;
        const prefKey = getStoragePrefKey(
          singularType as "bookmark" | "column" | "draft",
        );
        // For columns, convert "custom" to "atproto" to match the preference type
        const storageTypeValue =
          dataType === "columns" && newType === "custom" ? "atproto" : newType;
        await appPreferencesService.updatePreferences({
          [prefKey]: storageTypeValue,
        });
      }

      setMessage({
        type: "success",
        text: `${dataType.charAt(0).toUpperCase() + dataType.slice(1)} migrated successfully! Please reload the page to complete the changes.`,
      });

      // Track successful migration to update UI immediately
      setSuccessfulMigrations((prev) => ({ ...prev, [dataType]: newType }));

      // Clear cache before invalidating queries
      appPreferencesService.clearCache();

      // Force refetch by removing and invalidating queries
      queryClient.removeQueries({ queryKey: ["appPreferences"] });
      await queryClient.invalidateQueries({ queryKey: ["appPreferences"] });
      await queryClient.invalidateQueries({ queryKey: [dataType] });
      await queryClient.invalidateQueries({
        queryKey: ["atProtocolRecordCounts"],
      });
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
      storageType:
        successfulMigrations.settings ||
        (appPreferences?.isStoredInAtProto ? "custom" : "local"),
      onToggle: (enabled) => handleStorageToggle("settings", enabled),
      isLoading: loadingStates.settings,
      localKey: "shadowsky_app_preferences",
      atProtoKey: "com.shadowsky.preferences",
    },
    {
      id: "bookmarks",
      name: "Bookmarks",
      icon: BookmarkIcon,
      storageType: "official", // Bookmarks always use official AT Protocol API
      onToggle: (enabled) => handleStorageToggle("bookmarks", enabled),
      isLoading: loadingStates.bookmarks,
      localKey: "shadowsky-bookmarks-*",
      atProtoKey: "app.bsky.bookmark",
    },
    {
      id: "columns",
      name: "Home Columns",
      icon: Columns,
      storageType:
        successfulMigrations.columns ||
        (appPreferences?.columnStorageType === "atproto"
          ? "custom"
          : appPreferences?.columnStorageType || "local"),
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
          <div className="flex items-center justify-between">
            <span>{message.text}</span>
            {message.type === "success" && (
              <button
                onClick={() => window.location.reload()}
                className="ml-4 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700"
              >
                Reload Page
              </button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {storageItems.map((item) => {
          const Icon = item.icon;
          const isEnabled =
            item.storageType === "custom" ||
            (item.id === "bookmarks" && item.storageType === "official");

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
                      ) : item.id === "bookmarks" &&
                        item.storageType === "official" ? (
                        <>
                          <strong style={{ color: "#10b981" }}>
                            🔒 PRIVATE (Official):
                          </strong>{" "}
                          Your bookmarks are stored privately using the official
                          Bluesky bookmarks API and are visible on Bluesky.
                        </>
                      ) : item.id === "bookmarks" &&
                        item.storageType === "custom" ? (
                        <>
                          <strong style={{ color: "#f59e0b" }}>
                            ⚠️ CUSTOM AT Protocol:
                          </strong>{" "}
                          Your bookmarks are stored in a custom AT Protocol
                          record, visible only in ShadowSky. Toggle to migrate
                          to official Bluesky bookmarks.
                        </>
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
                        {isEnabled && recordCounts[item.id] !== undefined && (
                          <span
                            className={`ml-2 ${recordCounts[item.id] > 0 ? "text-green-600 dark:text-green-400" : "text-gray-500 dark:text-gray-400"}`}
                          >
                            ({recordCounts[item.id]}{" "}
                            {item.id === "columns"
                              ? recordCounts[item.id] === 1
                                ? "column"
                                : "columns"
                              : item.id === "bookmarks"
                                ? recordCounts[item.id] === 1
                                  ? "bookmark"
                                  : "bookmarks"
                                : recordCounts[item.id] === 1
                                  ? "record"
                                  : "records"}
                            )
                          </span>
                        )}
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
                              : "cursor-not-allowed text-gray-600 opacity-50 dark:text-gray-400"
                          }`}
                          onClick={() => item.onToggle(false)}
                          disabled={item.isLoading || isEnabled}
                          title={
                            isEnabled
                              ? "Cannot disable AT Protocol sync once enabled"
                              : undefined
                          }
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
                          disabled={item.isLoading}
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
                          disabled={item.isLoading}
                        >
                          {item.id === "bookmarks" &&
                          item.storageType === "custom"
                            ? "Migrate to Official"
                            : item.id === "bookmarks"
                              ? "Official"
                              : "AT Protocol"}
                        </button>
                      </div>
                      {item.isLoading && (
                        <p className="mt-1 text-xs text-gray-500">
                          Migrating...
                        </p>
                      )}
                      {/* Show create record button if missing */}
                      {item.id === "columns" &&
                        missingRecords.columns &&
                        isEnabled && (
                          <div className="mt-2">
                            <button
                              onClick={() =>
                                handleCreateMissingRecord("columns")
                              }
                              disabled={loadingStates[`create_columns`]}
                              className="flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                            >
                              {loadingStates[`create_columns`] ? (
                                <>Creating...</>
                              ) : (
                                <>Create Missing Record</>
                              )}
                            </button>
                            <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-500">
                              ⚠️ Column record not found. Click to create it.
                            </p>
                          </div>
                        )}
                      {/* Show info when record exists but is empty */}
                      {item.id === "columns" &&
                        !missingRecords.columns &&
                        isEnabled &&
                        recordCounts.columns === 0 &&
                        !showMigrationPrompt && (
                          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            ✓ Column record exists. Add columns in the main app
                            to see them here.
                          </p>
                        )}
                      {/* Show migration prompt */}
                      {item.id === "columns" &&
                        showMigrationPrompt &&
                        isEnabled && (
                          <div className="mt-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-900/20">
                            <p className="mb-2 text-xs font-medium text-yellow-800 dark:text-yellow-200">
                              Found {localColumnCount} columns in local storage
                            </p>
                            <p className="mb-3 text-xs text-yellow-700 dark:text-yellow-300">
                              Your AT Protocol storage is empty but you have
                              columns saved locally. Would you like to migrate
                              them?
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={handleMigrateLocalColumns}
                                disabled={loadingStates.migrate_columns}
                                className="flex items-center gap-2 rounded-md bg-yellow-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-yellow-700 disabled:opacity-50"
                              >
                                {loadingStates.migrate_columns ? (
                                  <>Migrating...</>
                                ) : (
                                  <>Migrate {localColumnCount} Columns</>
                                )}
                              </button>
                              <button
                                onClick={() => setShowMigrationPrompt(false)}
                                className="rounded-md px-3 py-1.5 text-xs font-medium text-yellow-700 transition-colors hover:bg-yellow-100 dark:text-yellow-300 dark:hover:bg-yellow-900/30"
                              >
                                Dismiss
                              </button>
                            </div>
                          </div>
                        )}
                      {/* Show create record button for bookmarks if missing */}
                      {item.id === "bookmarks" &&
                        missingRecords.bookmarks &&
                        isEnabled && (
                          <div className="mt-2">
                            <button
                              onClick={() =>
                                handleCreateMissingRecord("bookmarks")
                              }
                              disabled={loadingStates[`create_bookmarks`]}
                              className="flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                            >
                              {loadingStates[`create_bookmarks`] ? (
                                <>Creating...</>
                              ) : (
                                <>Create Missing Record</>
                              )}
                            </button>
                            <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-500">
                              ⚠️ Bookmarks record not found. Click to create it.
                            </p>
                          </div>
                        )}
                      {/* Show info when bookmarks record exists */}
                      {item.id === "bookmarks" &&
                        !missingRecords.bookmarks &&
                        isEnabled &&
                        recordCounts.bookmarks !== undefined && (
                          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            ✓ Bookmarks record exists
                            {recordCounts.bookmarks === 0
                              ? ". Add bookmarks to see them here."
                              : "."}
                          </p>
                        )}
                      {/* Bookmark info UI */}
                      {item.id === "bookmarks" &&
                        item.storageType === "official" && (
                          <div className="mt-2">
                            <div className="rounded-lg border border-green-200 bg-green-50 p-2 dark:border-green-800 dark:bg-green-900/20">
                              <p className="text-xs text-green-700 dark:text-green-300">
                                ✅ Using official private bookmark storage.
                                Your bookmarks are private and synced across
                                devices.
                              </p>
                            </div>
                          </div>
                        )}
                      {/* Show privacy info for non-official bookmark storage */}
                      {item.id === "bookmarks" &&
                        item.storageType !== "official" && (
                          <div className="mt-2 rounded-lg border border-yellow-200 bg-yellow-50 p-2 dark:border-yellow-800 dark:bg-yellow-900/20">
                            <p className="text-xs text-yellow-700 dark:text-yellow-300">
                              <strong>Note:</strong> Official private bookmarks
                              are now available! Switch to AT Protocol storage
                              to use them.
                            </p>
                          </div>
                        )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* AT Protocol Preferences Display */}
      {appPreferences && (
        <div
          className="rounded-lg p-6"
          style={{
            backgroundColor: "var(--bsky-bg-secondary)",
            border: "1px solid var(--bsky-border-primary)",
          }}
        >
          <h3
            className="mb-4 text-lg font-medium"
            style={{ color: "var(--bsky-text-primary)" }}
          >
            AT Protocol Preferences Record
          </h3>
          <div
            className="space-y-3 font-mono text-sm"
            style={{ color: "var(--bsky-text-secondary)" }}
          >
            <div className="grid grid-cols-2 gap-2">
              <span className="font-semibold">Collection:</span>
              <span>com.shadowsky.preferences</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="font-semibold">Record Key:</span>
              <span>self</span>
            </div>
            <div
              className="border-t pt-3"
              style={{ borderColor: "var(--bsky-border-primary)" }}
            >
              <span className="mb-2 block font-semibold">Current Values:</span>
              <div className="space-y-2 pl-4">
                <div className="grid grid-cols-2 gap-2">
                  <span>columnStorageType:</span>
                  <span className="font-medium">
                    {appPreferences.columnStorageType}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <span>draftStorageType:</span>
                  <span className="font-medium">
                    {appPreferences.draftStorageType}
                  </span>
                </div>
                {appPreferences.aiSettings && (
                  <div
                    className="mt-2 border-t pt-2"
                    style={{ borderColor: "var(--bsky-border-primary)" }}
                  >
                    <span className="mb-1 block">AI Settings:</span>
                    <div className="space-y-1 pl-4">
                      <div className="grid grid-cols-2 gap-2">
                        <span>autoGenerateAltText:</span>
                        <span className="font-medium">
                          {appPreferences.aiSettings.autoGenerateAltText
                            ? "true"
                            : "false"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span>enableHashtagSuggestions:</span>
                        <span className="font-medium">
                          {appPreferences.aiSettings.enableHashtagSuggestions
                            ? "true"
                            : "false"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
            • <strong>Browser Storage:</strong> Fast, private, and works
            offline. Data stays on this device only.
          </li>
          <li>
            • <strong>Custom AT Protocol:</strong> Uses custom record types we
            created. Syncs across devices. App settings and columns use private
            preferences, while bookmarks and drafts use PUBLIC records.
          </li>
          <li>
            • <strong>Standard AT Protocol:</strong> Uses official Bluesky
            record types. Currently available for bookmarks using private
            storage.
          </li>
        </ul>
      </div>
    </div>
  );
};
