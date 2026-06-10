import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Database, HardDrive, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { useModal } from "../../contexts/ModalContext";
import { usePageVisibility } from "../../hooks/usePageVisibility";
import { IndexedDBCleanupService } from "../../services/indexeddb-cleanup-service";

export const StorageManagementSettings: React.FC = () => {
  const { showConfirm } = useModal();
  const isVisible = usePageVisibility();
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const cleanupService = IndexedDBCleanupService.getInstance();

  // Fetch storage stats
  const { data: storageStats, refetch: refetchStats } = useQuery({
    queryKey: ["storageStats"],
    queryFn: async () => {
      return await cleanupService.getStorageStats();
    },
    refetchInterval: isVisible ? 30000 : false, // Refresh every 30 seconds, paused when tab hidden
  });

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const getStorageStatusColor = (usagePercent: number) => {
    if (usagePercent >= 90) return "text-red-600 dark:text-red-400";
    if (usagePercent >= 70) return "text-yellow-600 dark:text-yellow-400";
    return "text-green-600 dark:text-green-400";
  };

  const getStorageStatusText = (usagePercent: number) => {
    if (usagePercent >= 90) return "Critical";
    if (usagePercent >= 70) return "Warning";
    return "Healthy";
  };

  const handleCleanupOldData = async (retentionDays: number) => {
    await showConfirm(
      `Delete notifications older than ${retentionDays} days?\n\n` +
        "This will permanently remove old notifications to free up storage space. " +
        "You can always fetch them again from Bluesky if needed.",
      async () => {
        setIsCleaningUp(true);
        setMessage(null);

        try {
          const result =
            await cleanupService.cleanupOldNotifications(retentionDays);

          setMessage({
            type: "success",
            text: `Successfully deleted ${result.deletedCount} old notifications. Freed approximately ${formatBytes(result.freedBytes)}.`,
          });

          // Refetch stats to show updated usage
          await refetchStats();
        } catch (error) {
          console.error("Failed to cleanup old data:", error);
          setMessage({
            type: "error",
            text: "Failed to cleanup old data. Please try again.",
          });
        } finally {
          setIsCleaningUp(false);
        }
      },
      {
        variant: "warning",
        title: "Cleanup Old Notifications",
        confirmText: "Delete Old Data",
        cancelText: "Cancel",
      },
    );
  };

  const handleClearAllNotifications = async () => {
    await showConfirm(
      "⚠️ Delete ALL notifications from local storage?\n\n" +
        "This will permanently remove all cached notifications from your device. " +
        "Your notifications will still be available on Bluesky and will be re-fetched " +
        "the next time you load the app.\n\n" +
        "This is a nuclear option that should only be used if you're having storage issues.",
      async () => {
        setIsClearingAll(true);
        setMessage(null);

        try {
          await cleanupService.clearAllNotifications();

          setMessage({
            type: "success",
            text: "Successfully cleared all notifications. Please reload the page to fetch fresh data.",
          });

          // Refetch stats to show updated usage
          await refetchStats();
        } catch (error) {
          console.error("Failed to clear all notifications:", error);
          setMessage({
            type: "error",
            text: "Failed to clear all notifications. Please try again.",
          });
        } finally {
          setIsClearingAll(false);
        }
      },
      {
        variant: "error",
        title: "Clear All Notifications",
        confirmText: "Delete All",
        cancelText: "Cancel",
      },
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold">Storage Management</h1>
        <p className="text-muted-foreground mt-2">
          Monitor and manage your IndexedDB storage to prevent quota issues on
          mobile browsers.
        </p>
      </div>

      {message && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            message.type === "success"
              ? "border-asph-success/30 bg-asph-success/10 text-asph-success"
              : message.type === "error"
                ? "border-asph-error/30 bg-asph-error/10 text-asph-error"
                : "border-asph-info/30 bg-asph-info/10 text-asph-info"
          }`}
        >
          <div className="flex items-center justify-between">
            <span>{message.text}</span>
            {message.type === "success" && message.text.includes("reload") && (
              <button
                onClick={() => window.location.reload()}
                className="touch-target-sm ml-4 rounded-md bg-asph-success px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90"
              >
                Reload Page
              </button>
            )}
          </div>
        </div>
      )}

      {/* Storage Overview */}
      <div
        className="rounded-lg p-6"
        style={{
          backgroundColor: "var(--asph-bg-secondary)",
          border: "1px solid var(--asph-border-primary)",
        }}
      >
        <div className="mb-4 flex items-center gap-3">
          <HardDrive className="h-6 w-6 text-asph-text-tertiary" />
          <h2
            className="text-xl font-semibold"
            style={{ color: "var(--asph-text-primary)" }}
          >
            Storage Overview
          </h2>
        </div>

        {storageStats ? (
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span
                  className="text-sm font-medium"
                  style={{ color: "var(--asph-text-secondary)" }}
                >
                  Total Usage
                </span>
                <span
                  className={`text-sm font-semibold ${getStorageStatusColor(storageStats.usagePercent)}`}
                >
                  {getStorageStatusText(storageStats.usagePercent)}
                </span>
              </div>
              <div className="relative h-4 overflow-hidden rounded-full bg-asph-bg-active">
                <div
                  className={`h-full transition-all duration-300 ${
                    storageStats.usagePercent >= 90
                      ? "bg-red-600"
                      : storageStats.usagePercent >= 70
                        ? "bg-yellow-600"
                        : "bg-green-600"
                  }`}
                  style={{
                    width: `${Math.min(storageStats.usagePercent, 100)}%`,
                  }}
                />
              </div>
              <div
                className="mt-2 flex justify-between text-sm"
                style={{ color: "var(--asph-text-tertiary)" }}
              >
                <span>{formatBytes(storageStats.usage)} used</span>
                <span>{formatBytes(storageStats.quota)} total</span>
              </div>
            </div>

            {storageStats.usagePercent >= 70 && (
              <div className="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-900/20">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
                <div>
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    Storage Usage is High
                  </p>
                  <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-300">
                    Consider cleaning up old notifications to free up space and
                    improve performance.
                  </p>
                </div>
              </div>
            )}

            {/* Database Breakdown */}
            <div className="mt-4">
              <h3
                className="mb-3 text-sm font-semibold"
                style={{ color: "var(--asph-text-primary)" }}
              >
                Database Breakdown
              </h3>
              <div className="space-y-2">
                {storageStats.databases.map((db) => (
                  <div
                    key={db.name}
                    className="flex items-center justify-between rounded-lg p-3"
                    style={{
                      backgroundColor: "var(--asph-bg-tertiary)",
                      border: "1px solid var(--asph-border-secondary)",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-asph-text-tertiary" />
                      <span
                        className="font-mono text-xs"
                        style={{ color: "var(--asph-text-secondary)" }}
                      >
                        {db.name}
                      </span>
                    </div>
                    <span
                      className="text-sm font-medium"
                      style={{ color: "var(--asph-text-primary)" }}
                    >
                      ~{formatBytes(db.estimatedSize)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div
            className="text-center text-sm"
            style={{ color: "var(--asph-text-tertiary)" }}
          >
            Storage information not available. Your browser may not support the
            Storage API.
          </div>
        )}
      </div>

      {/* Cleanup Actions */}
      <div
        className="rounded-lg p-6"
        style={{
          backgroundColor: "var(--asph-bg-secondary)",
          border: "1px solid var(--asph-border-primary)",
        }}
      >
        <div className="mb-4 flex items-center gap-3">
          <Trash2 className="h-6 w-6 text-asph-text-tertiary" />
          <h2
            className="text-xl font-semibold"
            style={{ color: "var(--asph-text-primary)" }}
          >
            Cleanup Options
          </h2>
        </div>

        <div className="space-y-4">
          <div>
            <h3
              className="mb-2 text-sm font-semibold"
              style={{ color: "var(--asph-text-primary)" }}
            >
              Remove Old Notifications
            </h3>
            <p
              className="mb-3 text-sm"
              style={{ color: "var(--asph-text-secondary)" }}
            >
              Delete notifications older than a specified number of days to free
              up storage space.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleCleanupOldData(14)}
                disabled={isCleaningUp}
                className="touch-target-sm rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {isCleaningUp ? "Cleaning..." : "Delete > 2 weeks old"}
              </button>
              <button
                onClick={() => handleCleanupOldData(28)}
                disabled={isCleaningUp}
                className="touch-target-sm rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {isCleaningUp ? "Cleaning..." : "Delete > 4 weeks old"}
              </button>
              <button
                onClick={() => handleCleanupOldData(60)}
                disabled={isCleaningUp}
                className="touch-target-sm rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {isCleaningUp ? "Cleaning..." : "Delete > 2 months old"}
              </button>
            </div>
          </div>

          <div
            className="border-t pt-4"
            style={{ borderColor: "var(--asph-border-primary)" }}
          >
            <h3
              className="mb-2 text-sm font-semibold text-red-600 dark:text-red-400"
              style={{ color: "var(--asph-text-primary)" }}
            >
              Clear All Notifications
            </h3>
            <p
              className="mb-3 text-sm"
              style={{ color: "var(--asph-text-secondary)" }}
            >
              Remove all cached notifications from your device. This is a
              nuclear option that should only be used if you're having serious
              storage issues.
            </p>
            <button
              onClick={handleClearAllNotifications}
              disabled={isClearingAll}
              className="touch-target-sm rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              {isClearingAll ? "Clearing..." : "Clear All Notifications"}
            </button>
          </div>
        </div>
      </div>

      {/* Information */}
      <div
        className="rounded-lg p-4 text-sm"
        style={{
          backgroundColor: "var(--asph-bg-tertiary)",
          border: "1px solid var(--asph-border-primary)",
          color: "var(--asph-text-secondary)",
        }}
      >
        <p className="mb-2 font-medium">About Storage Management:</p>
        <ul className="ml-4 space-y-1">
          <li>
            • The app automatically cleans up notifications older than 4 weeks
            on startup
          </li>
          <li>
            • Target storage limit: 50MB to prevent mobile browser quota issues
          </li>
          <li>
            • Notifications are cached locally for offline access and
            performance
          </li>
          <li>
            • Deleted notifications can be re-fetched from Bluesky at any time
          </li>
          <li>
            • If storage becomes critically full, the app will automatically run
            emergency cleanup
          </li>
        </ul>
      </div>
    </div>
  );
};
