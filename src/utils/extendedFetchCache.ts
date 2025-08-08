import { debug } from "@bsky/shared";

/**
 * Manages metadata for extended notification fetches (4-week downloads)
 * Tracks when the user last performed a full fetch to avoid unnecessary re-prompts
 * Note: Actual notification data is stored in IndexedDB, not localStorage
 */

interface ExtendedFetchMetadata {
  lastFetchTimestamp: number;
  totalNotificationsFetched: number;
  oldestNotificationDate: number;
  newestNotificationDate: number;
  daysReached: number;
  version: string;
}

interface ExtendedFetchData {
  metadata: ExtendedFetchMetadata;
  pages: Array<{
    notifications: any[];
    cursor?: string;
  }>;
  version: string;
}

const METADATA_KEY = "bsky_extended_fetch_metadata_v1";
const DATA_KEY = "bsky_extended_fetch_data_v1";
const REFRESH_THRESHOLD_HOURS = 4; // Consider data stale after 4 hours
const MAX_STORAGE_SIZE = 1024 * 1024; // 1MB limit for localStorage

export class ExtendedFetchCache {
  /**
   * Save metadata about a completed extended fetch
   */
  static saveMetadata(
    totalNotifications: number,
    oldestDate: Date,
    newestDate: Date,
    daysReached: number,
  ): void {
    const metadata: ExtendedFetchMetadata = {
      lastFetchTimestamp: Date.now(),
      totalNotificationsFetched: totalNotifications,
      oldestNotificationDate: oldestDate.getTime(),
      newestNotificationDate: newestDate.getTime(),
      daysReached,
      version: "v1",
    };

    try {
      localStorage.setItem(METADATA_KEY, JSON.stringify(metadata));
      debug.log("📊 Extended fetch metadata saved:", {
        totalNotifications,
        daysReached,
        oldestDate: oldestDate.toLocaleDateString(),
        newestDate: newestDate.toLocaleDateString(),
      });
    } catch (error) {
      debug.error("Failed to save extended fetch metadata:", error);
    }
  }

  /**
   * Check if we have recent extended fetch data
   * Returns metadata if data is fresh, null if stale or missing
   */
  static getRecentMetadata(): ExtendedFetchMetadata | null {
    try {
      const stored = localStorage.getItem(METADATA_KEY);
      if (!stored) return null;

      const metadata = JSON.parse(stored) as ExtendedFetchMetadata;

      // Check version
      if (metadata.version !== "v1") {
        this.clearMetadata();
        return null;
      }

      // Check if data is still fresh
      const hoursSinceLastFetch =
        (Date.now() - metadata.lastFetchTimestamp) / (1000 * 60 * 60);

      if (hoursSinceLastFetch > REFRESH_THRESHOLD_HOURS) {
        debug.log(
          `📊 Extended fetch metadata is stale (${hoursSinceLastFetch.toFixed(1)} hours old)`,
        );
        return null;
      }

      debug.log(
        `📊 Found recent extended fetch metadata (${hoursSinceLastFetch.toFixed(1)} hours old)`,
      );
      return metadata;
    } catch (error) {
      debug.error("Failed to load extended fetch metadata:", error);
      return null;
    }
  }

  /**
   * Check if we should auto-fetch missing notifications
   * Returns true if we have recent metadata and should fetch only new notifications
   */
  static shouldAutoFetchMissing(): boolean {
    const metadata = this.getRecentMetadata();
    if (!metadata) return false;

    // If we fetched 4 weeks of data within the last few hours,
    // we should auto-fetch only the missing recent notifications
    return metadata.daysReached >= 28;
  }

  /**
   * Get info about what needs to be fetched
   */
  static getFetchInfo(): {
    hasRecentFullFetch: boolean;
    metadata: ExtendedFetchMetadata | null;
    shouldAutoFetch: boolean;
    hoursSinceLastFetch: number | null;
  } {
    const metadata = this.getRecentMetadata();
    const hoursSinceLastFetch = metadata
      ? (Date.now() - metadata.lastFetchTimestamp) / (1000 * 60 * 60)
      : null;

    return {
      hasRecentFullFetch: !!metadata,
      metadata,
      shouldAutoFetch: this.shouldAutoFetchMissing(),
      hoursSinceLastFetch,
    };
  }

  /**
   * @deprecated No longer saves data to localStorage - use IndexedDB instead
   * This method is kept only for backward compatibility during migration
   */
  static saveData(
    pages: Array<{ notifications: any[]; cursor?: string }>,
    totalNotifications: number,
    oldestDate: Date,
    newestDate: Date,
    daysReached: number,
  ): boolean {
    try {
      // First save metadata
      this.saveMetadata(
        totalNotifications,
        oldestDate,
        newestDate,
        daysReached,
      );

      // Prepare data for storage
      const data: ExtendedFetchData = {
        metadata: {
          lastFetchTimestamp: Date.now(),
          totalNotificationsFetched: totalNotifications,
          oldestNotificationDate: oldestDate.getTime(),
          newestNotificationDate: newestDate.getTime(),
          daysReached,
          version: "v1",
        },
        pages,
        version: "v1",
      };

      // Check size before saving
      const dataStr = JSON.stringify(data);
      const sizeInBytes = new Blob([dataStr]).size;

      if (sizeInBytes > MAX_STORAGE_SIZE) {
        debug.log(
          `📊 Extended fetch data too large for localStorage (${(sizeInBytes / 1024 / 1024).toFixed(2)}MB > 1MB limit)`,
        );
        // Try to save a truncated version
        const truncatedPages = this.truncateToFitSize(pages, MAX_STORAGE_SIZE);
        if (truncatedPages.length > 0) {
          data.pages = truncatedPages;
          const truncatedStr = JSON.stringify(data);
          localStorage.setItem(DATA_KEY, truncatedStr);
          debug.log(
            `📊 Saved truncated extended fetch data (${truncatedPages.length} pages, ${(new Blob([truncatedStr]).size / 1024).toFixed(1)}KB)`,
          );
          return true;
        }
        return false;
      }

      localStorage.setItem(DATA_KEY, dataStr);
      debug.log(
        `📊 Extended fetch data saved to localStorage (${(sizeInBytes / 1024).toFixed(1)}KB)`,
      );
      return true;
    } catch (error) {
      debug.error("Failed to save extended fetch data:", error);
      // If it's a quota error, try to clear old data and retry
      if (
        error instanceof DOMException &&
        error.name === "QuotaExceededError"
      ) {
        this.clearData();
        return false;
      }
      return false;
    }
  }

  /**
   * @deprecated No longer loads data from localStorage - use IndexedDB instead
   * This method is kept only for backward compatibility during migration
   */
  static loadData(): ExtendedFetchData | null {
    try {
      // First check if we have recent metadata
      const metadata = this.getRecentMetadata();
      if (!metadata) {
        // Data is stale or missing
        this.clearData();
        return null;
      }

      const stored = localStorage.getItem(DATA_KEY);
      if (!stored) return null;

      const data = JSON.parse(stored) as ExtendedFetchData;

      // Validate version
      if (data.version !== "v1") {
        this.clearData();
        return null;
      }

      // Validate that metadata matches
      if (data.metadata.lastFetchTimestamp !== metadata.lastFetchTimestamp) {
        debug.log("📊 Extended fetch data metadata mismatch, clearing");
        this.clearData();
        return null;
      }

      debug.log(
        `📊 Loaded extended fetch data from localStorage (${data.pages.length} pages, ${data.metadata.totalNotificationsFetched} notifications)`,
      );
      return data;
    } catch (error) {
      debug.error("Failed to load extended fetch data:", error);
      this.clearData();
      return null;
    }
  }

  /**
   * Truncate pages array to fit within size limit
   * Keeps most recent notifications
   */
  private static truncateToFitSize(
    pages: Array<{ notifications: any[]; cursor?: string }>,
    maxSize: number,
  ): Array<{ notifications: any[]; cursor?: string }> {
    const truncated: Array<{ notifications: any[]; cursor?: string }> = [];
    let currentSize = 100; // Start with some overhead for metadata

    for (const page of pages) {
      const pageStr = JSON.stringify(page);
      const pageSize = new Blob([pageStr]).size;

      if (currentSize + pageSize > maxSize) {
        break;
      }

      truncated.push(page);
      currentSize += pageSize;
    }

    return truncated;
  }

  /**
   * Clear stored metadata and data
   */
  static clearMetadata(): void {
    try {
      localStorage.removeItem(METADATA_KEY);
      debug.log("📊 Extended fetch metadata cleared");
    } catch (error) {
      debug.error("Failed to clear extended fetch metadata:", error);
    }
  }

  /**
   * Clear stored data
   */
  static clearData(): void {
    try {
      localStorage.removeItem(DATA_KEY);
      debug.log("📊 Extended fetch data cleared");
    } catch (error) {
      debug.error("Failed to clear extended fetch data:", error);
    }
  }

  /**
   * Clear all stored data and metadata
   */
  static clearAll(): void {
    this.clearMetadata();
    this.clearData();
  }
}
