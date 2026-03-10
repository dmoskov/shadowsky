/**
 * Trending Topic Aggregator
 *
 * Maintains sliding-window frequency counts for hashtags and topics.
 * Uses an in-memory store with periodic DynamoDB persistence for
 * durability and cross-instance sharing.
 *
 * Time windows: 1 hour, 6 hours, 24 hours
 * Each window maintains a series of buckets (5-minute intervals)
 * that are summed to compute the window total.
 */

const TIME_WINDOWS = {
  "1h": { duration: 60 * 60 * 1000, bucketSize: 5 * 60 * 1000, buckets: 12 },
  "6h": {
    duration: 6 * 60 * 60 * 1000,
    bucketSize: 30 * 60 * 1000,
    buckets: 12,
  },
  "24h": {
    duration: 24 * 60 * 60 * 1000,
    bucketSize: 2 * 60 * 60 * 1000,
    buckets: 12,
  },
};

const DEFAULT_TOP_N = 20;
const MAX_TRACKED_ITEMS = 10000; // Max unique items per window before pruning
const PRUNE_THRESHOLD = 8000; // Start pruning at this count
const MIN_COUNT_THRESHOLD = 2; // Minimum count to keep during pruning

class TrendingAggregator {
  constructor(options = {}) {
    this.topN = options.topN || DEFAULT_TOP_N;
    this.dynamoClient = options.dynamoClient || null;
    this.tableName = options.tableName || "shadowsky-trending";
    this.persistInterval = options.persistInterval || 60000; // 1 minute
    this.persistTimer = null;

    // In-memory store: Map<windowName, Map<item, { buckets: Map<bucketKey, count>, total: number }>>
    this.windows = new Map();
    for (const windowName of Object.keys(TIME_WINDOWS)) {
      this.windows.set(windowName, new Map());
    }

    // Cache for API responses (avoid recomputing on every request)
    this.cache = new Map();
    this.cacheMaxAge = 15000; // 15 seconds

    // Metrics
    this.metrics = {
      itemsRecorded: 0,
      pruneOps: 0,
      persistOps: 0,
      persistErrors: 0,
    };
  }

  /**
   * Start the aggregator (periodic persistence and cleanup)
   */
  start() {
    // Periodic persistence to DynamoDB
    if (this.dynamoClient) {
      this.persistTimer = setInterval(() => {
        this._persistToDynamo().catch((err) => {
          this.metrics.persistErrors++;
        });
      }, this.persistInterval);
    }

    // Periodic bucket cleanup
    this._cleanupTimer = setInterval(() => {
      this._cleanupExpiredBuckets();
    }, 60000); // Every minute

    return this;
  }

  /**
   * Stop the aggregator
   */
  stop() {
    if (this.persistTimer) {
      clearInterval(this.persistTimer);
      this.persistTimer = null;
    }
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }
  }

  /**
   * Record hashtags and topics from a post event
   * @param {Object} postData - { hashtags: string[], topics: string[], createdAt: string }
   */
  record(postData) {
    const { hashtags = [], topics = [] } = postData;
    const now = Date.now();

    // Record hashtags with higher weight
    for (const tag of hashtags) {
      const key = `#${tag}`;
      this._increment(key, now, "hashtag");
    }

    // Record topics with lower weight
    for (const topic of topics) {
      this._increment(topic, now, "topic");
    }

    this.metrics.itemsRecorded++;

    // Invalidate cache
    this.cache.clear();
  }

  /**
   * Get trending items for a specific time window
   * @param {string} window - "1h", "6h", or "24h"
   * @param {number} limit - Number of items to return
   * @returns {Array<{ item: string, count: number, type: string }>}
   */
  getTrending(window = "1h", limit = this.topN) {
    if (!TIME_WINDOWS[window]) {
      throw new Error(`Invalid window: ${window}. Use: 1h, 6h, 24h`);
    }

    // Check cache
    const cacheKey = `${window}:${limit}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheMaxAge) {
      return cached.data;
    }

    // Clean expired buckets first
    this._cleanupExpiredBuckets(window);

    const windowData = this.windows.get(window);
    if (!windowData || windowData.size === 0) {
      return [];
    }

    // Compute totals and sort
    const items = [];
    for (const [item, data] of windowData) {
      let total = 0;
      for (const count of data.buckets.values()) {
        total += count;
      }
      if (total > 0) {
        items.push({
          item,
          count: total,
          type: item.startsWith("#") ? "hashtag" : "topic",
        });
      }
    }

    items.sort((a, b) => b.count - a.count);
    const result = items.slice(0, limit);

    // Update cache
    this.cache.set(cacheKey, { data: result, timestamp: Date.now() });

    return result;
  }

  /**
   * Get trending data for all windows
   * @param {number} limit - Number of items per window
   * @returns {Object} { "1h": [...], "6h": [...], "24h": [...] }
   */
  getAllTrending(limit = this.topN) {
    const result = {};
    for (const window of Object.keys(TIME_WINDOWS)) {
      result[window] = this.getTrending(window, limit);
    }
    return result;
  }

  /**
   * Get aggregator metrics
   */
  getMetrics() {
    const windowSizes = {};
    for (const [name, data] of this.windows) {
      windowSizes[name] = data.size;
    }
    return {
      ...this.metrics,
      windowSizes,
      cacheSize: this.cache.size,
    };
  }

  /**
   * Increment count for an item across all applicable windows
   * @private
   */
  _increment(item, timestamp, type) {
    for (const [windowName, config] of Object.entries(TIME_WINDOWS)) {
      const windowData = this.windows.get(windowName);
      const bucketKey = Math.floor(timestamp / config.bucketSize);

      if (!windowData.has(item)) {
        windowData.set(item, { buckets: new Map(), type });
      }

      const itemData = windowData.get(item);
      const currentCount = itemData.buckets.get(bucketKey) || 0;
      itemData.buckets.set(bucketKey, currentCount + 1);

      // Prune if needed
      if (windowData.size > MAX_TRACKED_ITEMS) {
        this._pruneWindow(windowName);
      }
    }
  }

  /**
   * Remove expired time buckets from all windows
   * @private
   */
  _cleanupExpiredBuckets(targetWindow = null) {
    const now = Date.now();
    const windowsToClean = targetWindow
      ? [[targetWindow, TIME_WINDOWS[targetWindow]]]
      : Object.entries(TIME_WINDOWS);

    for (const [windowName, config] of windowsToClean) {
      const windowData = this.windows.get(windowName);
      if (!windowData) continue;

      const oldestValidBucket = Math.floor(
        (now - config.duration) / config.bucketSize,
      );

      for (const [item, data] of windowData) {
        for (const bucketKey of data.buckets.keys()) {
          if (bucketKey < oldestValidBucket) {
            data.buckets.delete(bucketKey);
          }
        }
        // Remove item if all buckets expired
        if (data.buckets.size === 0) {
          windowData.delete(item);
        }
      }
    }
  }

  /**
   * Prune low-count items from a window to stay under memory limits
   * @private
   */
  _pruneWindow(windowName) {
    const windowData = this.windows.get(windowName);
    if (!windowData || windowData.size < PRUNE_THRESHOLD) return;

    this.metrics.pruneOps++;

    // Remove items with count below threshold
    for (const [item, data] of windowData) {
      let total = 0;
      for (const count of data.buckets.values()) {
        total += count;
      }
      if (total < MIN_COUNT_THRESHOLD) {
        windowData.delete(item);
      }
    }

    // If still too large, remove lowest-count items
    if (windowData.size > PRUNE_THRESHOLD) {
      const items = [];
      for (const [item, data] of windowData) {
        let total = 0;
        for (const count of data.buckets.values()) {
          total += count;
        }
        items.push({ item, total });
      }
      items.sort((a, b) => a.total - b.total);

      const toRemove = items.slice(0, windowData.size - PRUNE_THRESHOLD);
      for (const { item } of toRemove) {
        windowData.delete(item);
      }
    }
  }

  /**
   * Persist current trending data to DynamoDB
   * @private
   */
  async _persistToDynamo() {
    if (!this.dynamoClient) return;

    const now = Date.now();
    const ttlOffsets = {
      "1h": 2 * 60 * 60, // TTL: 2 hours
      "6h": 12 * 60 * 60, // TTL: 12 hours
      "24h": 48 * 60 * 60, // TTL: 48 hours
    };

    for (const window of Object.keys(TIME_WINDOWS)) {
      const trending = this.getTrending(window, 50); // Persist top 50
      if (trending.length === 0) continue;

      const ttl = Math.floor(now / 1000) + ttlOffsets[window];

      const item = {
        pk: { S: `TRENDING#${window}` },
        sk: { S: `SNAPSHOT#${now}` },
        window: { S: window },
        items: {
          L: trending.map((t) => ({
            M: {
              item: { S: t.item },
              count: { N: String(t.count) },
              type: { S: t.type },
            },
          })),
        },
        updatedAt: { S: new Date(now).toISOString() },
        ttl: { N: String(ttl) },
      };

      try {
        await this.dynamoClient.send(
          new (require("@aws-sdk/client-dynamodb").PutItemCommand)({
            TableName: this.tableName,
            Item: item,
          }),
        );
        this.metrics.persistOps++;
      } catch (err) {
        this.metrics.persistErrors++;
        throw err;
      }
    }
  }

  /**
   * Load latest trending data from DynamoDB (for cold start)
   */
  async loadFromDynamo() {
    if (!this.dynamoClient) return;

    const { QueryCommand } = require("@aws-sdk/client-dynamodb");

    for (const window of Object.keys(TIME_WINDOWS)) {
      try {
        const result = await this.dynamoClient.send(
          new QueryCommand({
            TableName: this.tableName,
            KeyConditionExpression: "pk = :pk",
            ExpressionAttributeValues: {
              ":pk": { S: `TRENDING#${window}` },
            },
            ScanIndexForward: false,
            Limit: 1,
          }),
        );

        if (result.Items && result.Items.length > 0) {
          const snapshot = result.Items[0];
          const items = snapshot.items?.L || [];

          // We don't restore into buckets (those will rebuild from firehose)
          // but we can use this for immediate API responses on cold start
          this.cache.set(`${window}:${this.topN}`, {
            data: items.map((i) => ({
              item: i.M.item.S,
              count: parseInt(i.M.count.N, 10),
              type: i.M.type.S,
            })),
            timestamp: Date.now(),
          });
        }
      } catch (err) {
        // DynamoDB not available - continue with empty state
      }
    }
  }
}

module.exports = { TrendingAggregator, TIME_WINDOWS };
