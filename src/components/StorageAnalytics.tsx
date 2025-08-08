import {
  Activity,
  AlertCircle,
  CheckCircle,
  HardDrive,
  Trash2,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { NotificationCache } from "../utils/notificationCache";
import { StorageManager } from "../utils/storageManager";

export const StorageAnalytics: React.FC = () => {
  const [metrics, setMetrics] = useState<ReturnType<
    typeof StorageManager.getStorageMetrics
  > | null>(null);
  const [health, setHealth] = useState<ReturnType<
    typeof StorageManager.getStorageHealth
  > | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const updateMetrics = () => {
    const newMetrics = StorageManager.getStorageMetrics();
    const newHealth = StorageManager.getStorageHealth();
    setMetrics(newMetrics);
    setHealth(newHealth);
  };

  useEffect(() => {
    updateMetrics();

    // Update metrics when storage changes
    const handleStorageChange = () => updateMetrics();
    window.addEventListener("storage", handleStorageChange);

    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  if (!metrics || !health) return null;

  const getStatusIcon = () => {
    switch (health.status) {
      case "critical":
        return <AlertCircle className="text-red-500" size={20} />;
      case "warning":
        return <AlertCircle className="text-yellow-500" size={20} />;
      default:
        return <CheckCircle className="text-green-500" size={20} />;
    }
  };

  const getStatusColor = () => {
    switch (health.status) {
      case "critical":
        return "var(--bsky-error)";
      case "warning":
        return "#f59e0b";
      default:
        return "var(--bsky-success)";
    }
  };

  const handleCleanup = () => {
    StorageManager.cleanupStorage(7); // Keep only last week
    NotificationCache.clearAll();
    updateMetrics();
  };

  return (
    <div
      className="bsky-card mb-4 p-4"
      style={{
        borderColor:
          health.status !== "healthy"
            ? getStatusColor()
            : "var(--bsky-border-primary)",
        borderWidth: health.status !== "healthy" ? "2px" : "1px",
      }}
    >
      <div
        className="flex cursor-pointer items-center justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <HardDrive size={20} style={{ color: "var(--bsky-primary)" }} />
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              Storage Analytics
              {getStatusIcon()}
            </h3>
            <p
              className="text-xs"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              {health.message}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-semibold">
              {StorageManager.formatBytes(metrics.totalSize)}
            </p>
            <p
              className="text-xs"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              {metrics.usagePercentage.toFixed(1)}% used
            </p>
          </div>

          {health.status !== "healthy" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCleanup();
              }}
              className="bsky-button-secondary flex items-center gap-1 px-2 py-1 text-xs"
              style={{
                borderColor: getStatusColor(),
                color: getStatusColor(),
              }}
            >
              <Trash2 size={14} />
              Clean
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-3">
          {/* Storage usage bar */}
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span>Total Storage Usage</span>
              <span>
                {StorageManager.formatBytes(metrics.totalSize)} / ~5MB
              </span>
            </div>
            <div
              className="h-2 w-full rounded-full"
              style={{ backgroundColor: "var(--bsky-bg-tertiary)" }}
            >
              <div
                className="h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(metrics.usagePercentage, 100)}%`,
                  backgroundColor: getStatusColor(),
                }}
              />
            </div>
          </div>

          {/* Data breakdown */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div
              className="rounded p-2"
              style={{ backgroundColor: "var(--bsky-bg-tertiary)" }}
            >
              <p
                style={{ color: "var(--bsky-text-secondary)" }}
                className="text-xs"
              >
                Notification Data
              </p>
              <p className="font-semibold">
                {StorageManager.formatBytes(metrics.notificationDataSize)}
              </p>
            </div>
            <div
              className="rounded p-2"
              style={{ backgroundColor: "var(--bsky-bg-tertiary)" }}
            >
              <p
                style={{ color: "var(--bsky-text-secondary)" }}
                className="text-xs"
              >
                Other Data
              </p>
              <p className="font-semibold">
                {StorageManager.formatBytes(metrics.otherDataSize)}
              </p>
            </div>
          </div>

          {/* Largest items */}
          {metrics.largestItems.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold">Largest Items</p>
              <div className="space-y-1">
                {metrics.largestItems.slice(0, 3).map((item, index) => (
                  <div key={index} className="flex justify-between text-xs">
                    <span
                      style={{ color: "var(--bsky-text-secondary)" }}
                      className="max-w-[200px] truncate"
                    >
                      {item.key}
                    </span>
                    <span>{StorageManager.formatBytes(item.size)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {health.recommendations.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1 text-xs font-semibold">
                <Activity size={12} />
                Recommendations
              </p>
              <ul
                className="space-y-1 text-xs"
                style={{ color: "var(--bsky-text-secondary)" }}
              >
                {health.recommendations.map((rec, index) => (
                  <li key={index}>• {rec}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleCleanup}
              className="bsky-button-secondary flex items-center gap-1 text-xs"
            >
              <Trash2 size={14} />
              Clear All Caches
            </button>
            <button
              onClick={() => {
                StorageManager.cleanupStorage(30);
                updateMetrics();
              }}
              className="bsky-button-secondary flex items-center gap-1 text-xs"
            >
              Clean Old Data
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
