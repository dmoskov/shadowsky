/**
 * Metric Cache
 *
 * In-memory cache for frequently accessed CloudWatch metrics to reduce API calls.
 * Uses LRU (Least Recently Used) eviction policy when capacity is reached.
 *
 * Configuration:
 * - defaultTTL: Default time-to-live for cached entries (milliseconds)
 * - maxSize: Maximum number of entries in cache
 */

export interface MetricCacheConfig {
  defaultTTL: number;
  maxSize: number;
}

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
}

export interface CacheMetrics {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
}

export class MetricCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private readonly defaultTTL: number;
  private readonly maxSize: number;
  private hits: number = 0;
  private misses: number = 0;
  private evictions: number = 0;

  constructor(config: MetricCacheConfig) {
    this.cache = new Map();
    this.defaultTTL = config.defaultTTL;
    this.maxSize = config.maxSize;
  }

  /**
   * Get value from cache
   * Returns null if not found or expired
   */
  public get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // Update access metadata
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.hits++;

    return entry.value;
  }

  /**
   * Set value in cache with optional custom TTL
   */
  public set(key: string, value: T, ttlMs?: number): void {
    // Evict if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const ttl = ttlMs ?? this.defaultTTL;
    const entry: CacheEntry<T> = {
      value,
      expiresAt: Date.now() + ttl,
      accessCount: 0,
      lastAccessed: Date.now(),
    };

    this.cache.set(key, entry);
  }

  /**
   * Check if key exists and is not expired
   */
  public has(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete specific key from cache
   */
  public delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries from cache
   */
  public clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.evictions++;
    }
  }

  /**
   * Remove all expired entries
   */
  public cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get cache metrics
   */
  public getMetrics(): CacheMetrics {
    const totalRequests = this.hits + this.misses;
    const hitRate =
      totalRequests > 0 ? (this.hits / totalRequests) * 100 : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      hitRate,
    };
  }

  /**
   * Get or set pattern: get from cache, or compute and cache if not found
   */
  public async getOrSet(
    key: string,
    compute: () => Promise<T>,
    ttlMs?: number
  ): Promise<T> {
    const cached = this.get(key);

    if (cached !== null) {
      return cached;
    }

    const value = await compute();
    this.set(key, value, ttlMs);
    return value;
  }

  /**
   * Get all cache keys (for debugging)
   */
  public keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size
   */
  public size(): number {
    return this.cache.size;
  }
}

/**
 * Default metric cache configuration
 *
 * - 5 minute TTL for most metrics (balances freshness vs API calls)
 * - 100 entry maximum (reasonable for Lambda memory constraints)
 */
export const DEFAULT_METRIC_CACHE_CONFIG: MetricCacheConfig = {
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  maxSize: 100,
};

/**
 * Create cache key from metric parameters
 */
export function createMetricCacheKey(
  namespace: string,
  metricName: string,
  dimensions?: Record<string, string>
): string {
  const parts = [namespace, metricName];

  if (dimensions) {
    const sortedDims = Object.keys(dimensions)
      .sort()
      .map((key) => `${key}=${dimensions[key]}`)
      .join(',');
    parts.push(sortedDims);
  }

  return parts.join('::');
}
