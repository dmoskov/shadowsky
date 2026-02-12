import { Database, HardDrive, Image, Trash2, Video } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useModal } from "../../contexts/ModalContext";
import { MediaCacheService } from "../../services/media-cache-service";

export const MediaCacheSettings: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<{
    totalItems: number;
    totalSize: number;
    maxSize: number;
    usedPercentage: number;
    mediaByType: Record<string, { count: number; size: number }>;
    oldestItem: Date | null;
    newestItem: Date | null;
  } | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [maxSizeValue, setMaxSizeValue] = useState<number>(100); // MB

  const mediaCache = MediaCacheService.getInstance();
  const { showDestructiveConfirm } = useModal();

  // Load cache statistics
  useEffect(() => {
    const loadStats = async () => {
      try {
        await mediaCache.init();
        const cacheStats = await mediaCache.getStats();
        const maxSize = await mediaCache.getMaxSize();
        setStats(cacheStats);
        setMaxSizeValue(Math.round(maxSize / (1024 * 1024))); // Convert to MB
      } catch (error) {
        console.error("Failed to load cache stats:", error);
      }
    };
    loadStats();
  }, []);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const handleClearCache = async () => {
    await showDestructiveConfirm(
      {
        title: "Clear Media Cache",
        message:
          "This will remove all cached images and videos from your browser. The cache will rebuild as you browse.",
        confirmButtonLabel: "Clear Cache",
        severity: "warning",
        canUndo: false,
        warningMessage: stats
          ? `This will free up ${formatBytes(stats.totalSize)} of storage (${stats.totalItems} items).`
          : undefined,
      },
      async () => {
        setIsLoading(true);
        setMessage(null);

        try {
          await mediaCache.clearCache();
          const newStats = await mediaCache.getStats();
          setStats(newStats);
          setMessage({
            type: "success",
            text: "Media cache cleared successfully!",
          });
        } catch (error) {
          console.error("Failed to clear cache:", error);
          setMessage({
            type: "error",
            text: "Failed to clear cache. Please try again.",
          });
        } finally {
          setIsLoading(false);
        }
      },
    );
  };

  const handleClearByType = async (mimeType: string) => {
    setIsLoading(true);
    setMessage(null);

    try {
      const count = await mediaCache.clearCacheByType(mimeType);
      const newStats = await mediaCache.getStats();
      setStats(newStats);
      setMessage({
        type: "success",
        text: `Cleared ${count} items of type ${mimeType}`,
      });
    } catch (error) {
      console.error("Failed to clear cache by type:", error);
      setMessage({
        type: "error",
        text: "Failed to clear cache. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateMaxSize = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const sizeInBytes = maxSizeValue * 1024 * 1024; // Convert MB to bytes
      await mediaCache.setMaxSize(sizeInBytes);
      const newStats = await mediaCache.getStats();
      setStats(newStats);
      setMessage({
        type: "success",
        text: `Max cache size updated to ${maxSizeValue} MB`,
      });
    } catch (error) {
      console.error("Failed to update max size:", error);
      setMessage({
        type: "error",
        text: "Failed to update max size. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getUsageBarColor = (percentage: number): string => {
    if (percentage < 70) return "var(--asph-success-light)";
    if (percentage < 90) return "var(--asph-yellow)";
    return "var(--asph-error)";
  };

  return (
    <div className="space-y-6">
      <div>
        <h2
          className="text-xl font-semibold"
          style={{ color: "var(--asph-text-primary)" }}
        >
          Media Cache
        </h2>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--asph-text-secondary)" }}
        >
          Manage cached media for offline viewing and faster load times
        </p>
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

      {/* Cache Statistics */}
      {stats && (
        <>
          <div
            className="rounded-lg p-4"
            style={{
              backgroundColor: "var(--asph-bg-secondary)",
              border: "1px solid var(--asph-border-primary)",
            }}
          >
            <div className="mb-3 flex items-center gap-2">
              <Database
                size={16}
                style={{ color: "var(--asph-text-secondary)" }}
              />
              <span
                className="text-sm font-medium"
                style={{ color: "var(--asph-text-primary)" }}
              >
                Cache Usage
              </span>
            </div>

            {/* Usage Bar */}
            <div className="mb-2">
              <div
                className="h-2 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
              >
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${Math.min(stats.usedPercentage, 100)}%`,
                    backgroundColor: getUsageBarColor(stats.usedPercentage),
                  }}
                />
              </div>
            </div>

            <div className="space-y-1 text-sm">
              <div
                className="flex justify-between"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                <span>Used</span>
                <span style={{ color: "var(--asph-text-primary)" }}>
                  {formatBytes(stats.totalSize)} / {formatBytes(stats.maxSize)}{" "}
                  ({Math.round(stats.usedPercentage)}%)
                </span>
              </div>
              <div
                className="flex justify-between"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                <span>Total Items</span>
                <span style={{ color: "var(--asph-text-primary)" }}>
                  {stats.totalItems.toLocaleString()}
                </span>
              </div>
              {stats.oldestItem && (
                <div
                  className="flex justify-between"
                  style={{ color: "var(--asph-text-secondary)" }}
                >
                  <span>Oldest Item</span>
                  <span style={{ color: "var(--asph-text-primary)" }}>
                    {stats.oldestItem.toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Media Types Breakdown */}
          {Object.keys(stats.mediaByType).length > 0 && (
            <div
              className="rounded-lg p-4"
              style={{
                backgroundColor: "var(--asph-bg-secondary)",
                border: "1px solid var(--asph-border-primary)",
              }}
            >
              <div className="mb-3 flex items-center gap-2">
                <HardDrive
                  size={16}
                  style={{ color: "var(--asph-text-secondary)" }}
                />
                <span
                  className="text-sm font-medium"
                  style={{ color: "var(--asph-text-primary)" }}
                >
                  Media by Type
                </span>
              </div>

              <div className="space-y-2">
                {Object.entries(stats.mediaByType).map(([type, data]) => (
                  <div
                    key={type}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {type.startsWith("image/") ? (
                        <Image
                          size={14}
                          style={{ color: "var(--asph-text-secondary)" }}
                        />
                      ) : type.startsWith("video/") ? (
                        <Video
                          size={14}
                          style={{ color: "var(--asph-text-secondary)" }}
                        />
                      ) : (
                        <Database
                          size={14}
                          style={{ color: "var(--asph-text-secondary)" }}
                        />
                      )}
                      <span style={{ color: "var(--asph-text-secondary)" }}>
                        {type}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span style={{ color: "var(--asph-text-primary)" }}>
                        {data.count} items • {formatBytes(data.size)}
                      </span>
                      <button
                        onClick={() => handleClearByType(type)}
                        disabled={isLoading}
                        className="rounded px-2 py-1 text-xs transition-colors"
                        style={{
                          backgroundColor: "var(--asph-bg-tertiary)",
                          color: "var(--asph-text-secondary)",
                          border: "1px solid var(--asph-border-primary)",
                        }}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Max Size Setting */}
      <div
        className="rounded-lg p-4"
        style={{
          backgroundColor: "var(--asph-bg-secondary)",
          border: "1px solid var(--asph-border-primary)",
        }}
      >
        <div className="mb-3">
          <label
            className="mb-1 block text-sm font-medium"
            style={{ color: "var(--asph-text-primary)" }}
          >
            Maximum Cache Size (MB)
          </label>
          <p
            className="text-xs"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            The cache will automatically remove old items when this limit is
            reached
          </p>
        </div>

        <div className="flex gap-2">
          <input
            type="number"
            value={maxSizeValue}
            onChange={(e) => setMaxSizeValue(parseInt(e.target.value) || 100)}
            min={10}
            max={1000}
            className="flex-1 rounded-lg px-3 py-2 text-sm"
            style={{
              backgroundColor: "var(--asph-bg-primary)",
              color: "var(--asph-text-primary)",
              border: "1px solid var(--asph-border-primary)",
            }}
          />
          <button
            onClick={handleUpdateMaxSize}
            disabled={isLoading}
            className="rounded-lg px-4 py-2 text-sm transition-colors"
            style={{
              backgroundColor: "var(--asph-accent-blue)",
              color: "white",
              border: "1px solid var(--asph-accent-blue)",
            }}
          >
            Update
          </button>
        </div>
      </div>

      {/* Clear Cache Button */}
      <div
        className="border-t pt-6"
        style={{ borderColor: "var(--asph-border-primary)" }}
      >
        <h3
          className="mb-4 text-lg font-medium"
          style={{ color: "var(--asph-text-primary)" }}
        >
          Cache Management
        </h3>
        <button
          onClick={handleClearCache}
          disabled={isLoading}
          className="border-asph-error/30 bg-asph-error/10 flex items-center gap-2 rounded-lg border px-4 py-2 text-sm text-asph-error transition-colors"
        >
          <Trash2 className="h-4 w-4" />
          {isLoading ? "Clearing..." : "Clear All Cached Media"}
        </button>
        <p
          className="mt-2 text-xs"
          style={{ color: "var(--asph-text-secondary)" }}
        >
          This will remove all cached images and videos. They will be
          re-downloaded when needed.
        </p>
      </div>
    </div>
  );
};
