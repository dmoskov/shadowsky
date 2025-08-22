import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookmarkIcon, Columns, Settings } from "lucide-react";
import React, { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useModal } from "../../contexts/ModalContext";
import { appPreferencesService } from "../../services/app-preferences-service";
import { bookmarkServiceV2 } from "../../services/bookmark-service-v2";
import { columnService } from "../../services/column-service";
import { getStoragePrefKey } from "../../services/storage/storage-constants";

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
  const [successfulMigrations, setSuccessfulMigrations] = useState<Record<string, StorageType>>(
    {},
  );
  const [recordCounts, setRecordCounts] = useState<Record<string, number>>({});
  const [localColumnCount, setLocalColumnCount] = useState<number>(0);
  const [showMigrationPrompt, setShowMigrationPrompt] = useState<boolean>(false);
  const [showDebugView, setShowDebugView] = useState<boolean>(false);
  const [debugData, setDebugData] = useState<Record<string, { local: any; atproto: any }>>({});

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


  // Fetch record counts for AT Protocol storage
  useQuery({
    queryKey: ["atProtocolRecordCounts", appPreferences],
    queryFn: async () => {
      if (!agent || !appPreferences) return;
      
      const counts: Record<string, number> = {};
      
      try {
        // Count bookmarks if using AT Protocol
        if (appPreferences.bookmarkStorageType === "custom") {
          const bookmarkResponse = await agent.api.com.atproto.repo.listRecords({
            repo: agent.session?.did || "",
            collection: "com.shadowsky.bookmark",
            limit: 1,
          });
          counts.bookmarks = bookmarkResponse.data.records.length;
          
          // If there are more records, get the actual count
          if (bookmarkResponse.data.cursor) {
            let totalCount = bookmarkResponse.data.records.length;
            let cursor: string | undefined = bookmarkResponse.data.cursor;
            
            while (cursor && totalCount < 1000) { // Limit to prevent infinite loops
              const nextResponse = await agent.api.com.atproto.repo.listRecords({
                repo: agent.session?.did || "",
                collection: "com.shadowsky.bookmark",
                cursor,
                limit: 100,
              });
              totalCount += nextResponse.data.records.length;
              cursor = nextResponse.data.cursor;
            }
            counts.bookmarks = totalCount;
          }
        }
        
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
        if ((appPreferences.columnStorageType as string) === "atproto" || appPreferences.columnStorageType === "custom") {
          try {
            const columnsData = await appPreferencesService.getColumns();
            counts.columns = columnsData?.columns?.length || 0;
            // Check if the record actually exists
            await agent.api.com.atproto.repo.getRecord({
              repo: agent.session?.did || "",
              collection: "com.shadowsky.columns",
              rkey: "self",
            });
            setMissingRecords(prev => ({ ...prev, columns: false }));
            
            // Check local storage for comparison
            const { ColumnLocalStorageBackend } = await import("../../services/storage/column-local-storage-backend");
            const localBackend = new ColumnLocalStorageBackend();
            const localColumns = await localBackend.loadColumns();
            setLocalColumnCount(localColumns.length);
            
            // If AT Protocol has 0 columns but local has columns, show migration prompt
            if (counts.columns === 0 && localColumns.length > 0) {
              setShowMigrationPrompt(true);
            }
          } catch (error: any) {
            if (error?.status === 400) {
              setMissingRecords(prev => ({ ...prev, columns: true }));
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
      const { ColumnLocalStorageBackend } = await import("../../services/storage/column-local-storage-backend");
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

  const handleCreateMissingRecord = async (dataType: "columns" | "bookmarks") => {
    if (!agent) return;

    setLoadingStates((prev) => ({ ...prev, [`create_${dataType}`]: true }));
    setMessage(null);

    try {
      if (dataType === "columns") {
        // Create empty columns record
        await appPreferencesService.updateColumns([]);
        setMissingRecords(prev => ({ ...prev, columns: false }));
        setMessage({
          type: "success",
          text: "Columns record created successfully",
        });
        // Refetch counts
        queryClient.invalidateQueries({ queryKey: ["atProtocolRecordCounts"] });
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

  const handleForceSwitch = async (
    dataType: "bookmarks" | "columns" | "settings",
    newType: StorageType,
  ) => {
    if (!agent) return;

    setLoadingStates((prev) => ({ ...prev, [`force_${dataType}`]: true }));
    setMessage(null);

    try {
      // Just update the preference without any data migration
      appPreferencesService.setAgent(agent);
      
      if (dataType === "settings") {
        if (newType === "custom") {
          // Force save to AT Protocol by updating preferences
          await appPreferencesService.updatePreferences({});
        } else {
          // Can't switch back to local storage for settings
          throw new Error("Cannot disable AT Protocol sync once enabled");
        }
      } else {
        // Get current preferences to ensure we have all fields
        const currentPrefs = await appPreferencesService.getPreferences();
        
        // Update the storage preference without migration
        // Convert plural to singular for the helper function
        const singularType = dataType === "bookmarks" ? "bookmark" : 
                           dataType === "columns" ? "column" : 
                           dataType === "drafts" ? "draft" : dataType;
        const prefKey = getStoragePrefKey(singularType as "bookmark" | "column" | "draft");
        
        // Force update with all current preferences to ensure AT Protocol record is created
        const updateData = {
          bookmarkStorageType: currentPrefs?.bookmarkStorageType || "local",
          columnStorageType: currentPrefs?.columnStorageType || "local",
          draftStorageType: currentPrefs?.draftStorageType || "local",
          [prefKey]: newType,
        };
        
        await appPreferencesService.updatePreferences(updateData);
      }

      setMessage({
        type: "success",
        text: `Storage location for ${dataType} changed to ${newType === 'custom' ? 'AT Protocol' : 'Local'}. Please reload the page.`,
      });

      // Track successful switch
      setSuccessfulMigrations((prev) => ({ ...prev, [dataType]: newType }));

      // Clear cache and invalidate queries
      appPreferencesService.clearCache();
      
      // Force refetch by also removing the query data
      queryClient.removeQueries({ queryKey: ["appPreferences"] });
      await queryClient.invalidateQueries({ queryKey: ["appPreferences"] });
      await queryClient.invalidateQueries({ queryKey: ["atProtocolRecordCounts"] });
    } catch (error) {
      console.error(`Failed to switch ${dataType} storage:`, error);
      setMessage({
        type: "error",
        text: `Failed to switch ${dataType} storage location.`,
      });
    } finally {
      setLoadingStates((prev) => ({ ...prev, [`force_${dataType}`]: false }));
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
        const rawType = appPreferences?.[
          `${dataType === "columns" ? "column" : dataType === "bookmarks" ? "bookmark" : dataType}StorageType`
        ] || "local";
        // Normalize "atproto" to "custom" for columns
        currentType = ((rawType as string) === "atproto" ? "custom" : rawType) as StorageType;
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
          // Ensure the columns record exists in AT Protocol
          if (newType === "custom") {
            const columns = await columnService.getColumns();
            await appPreferencesService.updateColumns(columns.map(col => ({
              id: col.id,
              type: col.type as string,
              title: col.title,
              data: col.data,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })));
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
        const singularType = dataType === "bookmarks" ? "bookmark" : 
                           dataType === "columns" ? "column" : 
                           dataType === "drafts" ? "draft" : dataType;
        const prefKey = getStoragePrefKey(singularType as "bookmark" | "column" | "draft");
        await appPreferencesService.updatePreferences({
          [prefKey]: newType,
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
      await queryClient.invalidateQueries({ queryKey: ["atProtocolRecordCounts"] });
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

  const fetchDebugData = async () => {
    if (!agent) return;

    const data: Record<string, { local: any; atproto: any }> = {};

    try {
      // Settings data
      const localSettings = localStorage.getItem("shadowsky_app_preferences");
      data.settings = {
        local: localSettings ? JSON.parse(localSettings) : null,
        atproto: null,
      };

      try {
        const settingsResponse = await agent.api.com.atproto.repo.getRecord({
          repo: agent.session?.did || "",
          collection: "com.shadowsky.preferences",
          rkey: "self",
        });
        data.settings.atproto = settingsResponse.data.value;
      } catch (e: any) {
        data.settings.atproto = e?.status === 400 ? "Record not found" : `Error: ${e?.message}`;
      }

      // Columns data - check both possible keys
      const localColumns = localStorage.getItem("shadowsky_columns");
      const skyDeckColumns = localStorage.getItem("skyDeckColumns");
      data.columns = {
        local: {
          shadowsky_columns: localColumns ? JSON.parse(localColumns) : null,
          skyDeckColumns: skyDeckColumns ? JSON.parse(skyDeckColumns) : null,
          note: "App uses 'skyDeckColumns' key, migration to 'shadowsky_columns' may be needed"
        },
        atproto: null,
      };

      try {
        const columnsResponse = await agent.api.com.atproto.repo.getRecord({
          repo: agent.session?.did || "",
          collection: "com.shadowsky.columns",
          rkey: "self",
        });
        data.columns.atproto = columnsResponse.data.value;
      } catch (e: any) {
        data.columns.atproto = e?.status === 400 ? "Record not found" : `Error: ${e?.message}`;
      }

      // Bookmarks data (sample - first few)
      const bookmarkKeys = Object.keys(localStorage).filter(key => key.startsWith("shadowsky-bookmarks-"));
      const localBookmarks: any[] = [];
      bookmarkKeys.slice(0, 3).forEach(key => {
        const value = localStorage.getItem(key);
        if (value) {
          localBookmarks.push({ key, value: JSON.parse(value) });
        }
      });

      data.bookmarks = {
        local: {
          count: bookmarkKeys.length,
          sample: localBookmarks,
        },
        atproto: null,
      };

      try {
        const bookmarksResponse = await agent.api.com.atproto.repo.getRecord({
          repo: agent.session?.did || "",
          collection: "com.shadowsky.bookmarks",
          rkey: "self",
        });
        const bookmarksData = bookmarksResponse.data.value as any;
        data.bookmarks.atproto = {
          count: bookmarksData?.bookmarks?.length || 0,
          sample: bookmarksData?.bookmarks?.slice(0, 3) || [],
          version: bookmarksData?.version,
        };
      } catch (e: any) {
        data.bookmarks.atproto = e?.status === 400 ? "Record not found" : `Error: ${e?.message}`;
      }

      // Drafts data - check both possible keys
      const localDrafts = localStorage.getItem("shadowsky_drafts");
      const threadDrafts = localStorage.getItem("bsky_thread_drafts");
      data.drafts = {
        local: {
          shadowsky_drafts: localDrafts ? JSON.parse(localDrafts) : null,
          bsky_thread_drafts: threadDrafts ? JSON.parse(threadDrafts) : null,
          note: "App uses 'bsky_thread_drafts' key"
        },
        atproto: null,
      };

      try {
        const draftsResponse = await agent.api.com.atproto.repo.getRecord({
          repo: agent.session?.did || "",
          collection: "com.shadowsky.drafts",
          rkey: "self",
        });
        const draftsData = draftsResponse.data.value as any;
        data.drafts.atproto = {
          count: draftsData?.drafts?.length || 0,
          sample: draftsData?.drafts?.slice(0, 3) || [],
          version: draftsData?.version,
        };
      } catch (e: any) {
        data.drafts.atproto = e?.status === 400 ? "Record not found" : `Error: ${e?.message}`;
      }

      setDebugData(data);
    } catch (error) {
      console.error("Failed to fetch debug data:", error);
    }
  };

  const storageItems: DataStorageItem[] = [
    {
      id: "settings",
      name: "App Settings",
      icon: Settings,
      // Check if preferences are being synced via AT Protocol
      storageType: successfulMigrations.settings || (appPreferences?.isStoredInAtProto ? "custom" : "local"),
      onToggle: (enabled) => handleStorageToggle("settings", enabled),
      isLoading: loadingStates.settings,
      localKey: "shadowsky_app_preferences",
      atProtoKey: "com.shadowsky.preferences",
    },
    {
      id: "bookmarks",
      name: "Bookmarks",
      icon: BookmarkIcon,
      storageType: successfulMigrations.bookmarks || appPreferences?.bookmarkStorageType || "local",
      onToggle: (enabled) => handleStorageToggle("bookmarks", enabled),
      isLoading: loadingStates.bookmarks,
      localKey: "shadowsky-bookmarks-*",
      atProtoKey: "com.shadowsky.bookmark",
    },
    {
      id: "columns",
      name: "Home Columns",
      icon: Columns,
      storageType: successfulMigrations.columns || (appPreferences?.columnStorageType === "custom" || (appPreferences?.columnStorageType as string) === "atproto" ? "custom" : "local"),
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
                className="ml-4 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors"
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
                        {isEnabled && recordCounts[item.id] !== undefined && (
                          <span className={`ml-2 ${recordCounts[item.id] > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                            ({recordCounts[item.id]} {
                              item.id === 'columns' ? (recordCounts[item.id] === 1 ? 'column' : 'columns') :
                              item.id === 'bookmarks' ? (recordCounts[item.id] === 1 ? 'bookmark' : 'bookmarks') :
                              (recordCounts[item.id] === 1 ? 'record' : 'records')
                            })
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
                              : "text-gray-600 dark:text-gray-400 cursor-not-allowed opacity-50"
                          }`}
                          onClick={() => item.onToggle(false)}
                          disabled={item.isLoading || isEnabled}
                          title={isEnabled ? "Cannot disable AT Protocol sync once enabled" : undefined}
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
                      {isEnabled && (
                        <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-500">
                          ⚠️ Disabling AT Protocol sync will make remote data temporarily unavailable
                        </p>
                      )}
                      {/* Force switch button - show for both directions for QA testing */}
                      <button
                        onClick={() => {
                          const targetType = isEnabled ? "local" : "custom";
                          showConfirm(
                            `Force switch ${item.name} to ${targetType === 'custom' ? 'AT Protocol' : 'Local'} without migrating data? This is useful for QA testing and fixing broken states.`,
                            () => handleForceSwitch("settings", targetType),
                            {
                              variant: "info",
                              title: `Force Switch ${item.name}`,
                              confirmText: "Force Switch",
                              cancelText: "Cancel",
                            }
                          );
                        }}
                        disabled={loadingStates[`force_settings`]}
                        className="mt-2 flex items-center gap-2 rounded-md bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700 transition-colors disabled:opacity-50"
                      >
                        {loadingStates[`force_settings`] ? "Switching..." : `Force Switch to ${isEnabled ? 'Local' : 'AT Protocol'}`}
                      </button>
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
                          AT Protocol
                        </button>
                      </div>
                      {item.isLoading && (
                        <p className="mt-1 text-xs text-gray-500">
                          Migrating...
                        </p>
                      )}
                      {/* Force switch button */}
                      <button
                        onClick={() => {
                          const targetType = isEnabled ? "local" : "custom";
                          showConfirm(
                            `Force switch ${item.name} to ${targetType === 'custom' ? 'AT Protocol' : 'Local'} without migrating data? This is useful for fixing broken states during development.`,
                            () => handleForceSwitch(item.id as "bookmarks" | "columns", targetType),
                            {
                              variant: "info",
                              title: `Force Switch ${item.name}`,
                              confirmText: "Force Switch",
                              cancelText: "Cancel",
                            }
                          );
                        }}
                        disabled={loadingStates[`force_${item.id}`]}
                        className="mt-2 flex items-center gap-2 rounded-md bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700 transition-colors disabled:opacity-50"
                      >
                        {loadingStates[`force_${item.id}`] ? "Switching..." : `Force Switch to ${isEnabled ? 'Local' : 'AT Protocol'}`}
                      </button>
                      {/* Show create record button if missing */}
                      {item.id === "columns" && missingRecords.columns && isEnabled && (
                        <div className="mt-2">
                          <button
                            onClick={() => handleCreateMissingRecord("columns")}
                            disabled={loadingStates[`create_columns`]}
                            className="flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
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
                      {item.id === "columns" && !missingRecords.columns && isEnabled && recordCounts.columns === 0 && !showMigrationPrompt && (
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          ✓ Column record exists. Add columns in the main app to see them here.
                        </p>
                      )}
                      {/* Show migration prompt */}
                      {item.id === "columns" && showMigrationPrompt && isEnabled && (
                        <div className="mt-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                          <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                            Found {localColumnCount} columns in local storage
                          </p>
                          <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-3">
                            Your AT Protocol storage is empty but you have columns saved locally. Would you like to migrate them?
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={handleMigrateLocalColumns}
                              disabled={loadingStates.migrate_columns}
                              className="flex items-center gap-2 rounded-md bg-yellow-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-700 transition-colors disabled:opacity-50"
                            >
                              {loadingStates.migrate_columns ? (
                                <>Migrating...</>
                              ) : (
                                <>Migrate {localColumnCount} Columns</>
                              )}
                            </button>
                            <button
                              onClick={() => setShowMigrationPrompt(false)}
                              className="rounded-md px-3 py-1.5 text-xs font-medium text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
                            >
                              Dismiss
                            </button>
                          </div>
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

      {/* Debug View */}
      <div
        className="rounded-lg p-4"
        style={{
          backgroundColor: "var(--bsky-bg-secondary)",
          border: "1px solid var(--bsky-border-primary)",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium" style={{ color: "var(--bsky-text-primary)" }}>
            Debug Storage View
          </h3>
          <button
            onClick={async () => {
              if (!showDebugView) {
                await fetchDebugData();
              }
              setShowDebugView(!showDebugView);
            }}
            className="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
            style={{
              backgroundColor: showDebugView ? "var(--bsky-bg-primary)" : "var(--bsky-bg-tertiary)",
              color: "var(--bsky-text-primary)",
              border: "1px solid var(--bsky-border-primary)",
            }}
          >
            {showDebugView ? "Hide Debug Data" : "Show Debug Data"}
          </button>
        </div>

        {showDebugView && (
          <div className="space-y-4">
            {Object.entries(debugData).map(([key, data]) => (
              <div key={key} className="space-y-2">
                <h4 className="font-medium text-sm" style={{ color: "var(--bsky-text-primary)" }}>
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h5 className="text-xs font-medium mb-1" style={{ color: "var(--bsky-text-secondary)" }}>
                      Local Storage:
                    </h5>
                    <pre
                      className="text-xs overflow-auto p-2 rounded"
                      style={{
                        backgroundColor: "var(--bsky-bg-primary)",
                        border: "1px solid var(--bsky-border-primary)",
                        maxHeight: "200px",
                      }}
                    >
                      {data.local ? JSON.stringify(data.local, null, 2) : "No data"}
                    </pre>
                  </div>
                  <div>
                    <h5 className="text-xs font-medium mb-1" style={{ color: "var(--bsky-text-secondary)" }}>
                      AT Protocol:
                    </h5>
                    <pre
                      className="text-xs overflow-auto p-2 rounded"
                      style={{
                        backgroundColor: "var(--bsky-bg-primary)",
                        border: "1px solid var(--bsky-border-primary)",
                        maxHeight: "200px",
                      }}
                    >
                      {typeof data.atproto === "string" 
                        ? data.atproto 
                        : JSON.stringify(data.atproto || "No data", null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
            <button
              onClick={fetchDebugData}
              className="mt-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                backgroundColor: "var(--bsky-bg-tertiary)",
                color: "var(--bsky-text-primary)",
                border: "1px solid var(--bsky-border-primary)",
              }}
            >
              Refresh Debug Data
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
