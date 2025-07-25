/**
 * Rate limiter for API requests
 * Implements a token bucket algorithm to respect API rate limits
 */

interface RateLimiterOptions {
  maxRequests: number;  // Maximum requests allowed
  windowMs: number;     // Time window in milliseconds
  namespace?: string;   // Optional namespace for different rate limits
}

class RateLimiter {
  private buckets: Map<string, { tokens: number; lastRefill: number }> = new Map();
  
  constructor(private options: RateLimiterOptions) {}
  
  /**
   * Check if a request can be made
   * @returns true if request is allowed, false if rate limited
   */
  canMakeRequest(key: string = 'default'): boolean {
    const bucketKey = this.options.namespace ? `${this.options.namespace}:${key}` : key;
    const now = Date.now();
    
    let bucket = this.buckets.get(bucketKey);
    
    if (!bucket) {
      bucket = { tokens: this.options.maxRequests, lastRefill: now };
      this.buckets.set(bucketKey, bucket);
    }
    
    // Refill tokens based on time passed
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor(timePassed / this.options.windowMs * this.options.maxRequests);
    
    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(this.options.maxRequests, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }
    
    // Check if we have tokens available
    if (bucket.tokens > 0) {
      bucket.tokens--;
      return true;
    }
    
    return false;
  }
  
  /**
   * Get time until next available request
   */
  getTimeUntilNextRequest(key: string = 'default'): number {
    const bucketKey = this.options.namespace ? `${this.options.namespace}:${key}` : key;
    const bucket = this.buckets.get(bucketKey);
    
    if (!bucket || bucket.tokens > 0) return 0;
    
    const now = Date.now();
    const timePassed = now - bucket.lastRefill;
    const timeUntilNextToken = this.options.windowMs / this.options.maxRequests - timePassed;
    
    return Math.max(0, Math.ceil(timeUntilNextToken));
  }
  
  /**
   * Reset rate limit for a specific key
   */
  reset(key: string = 'default'): void {
    const bucketKey = this.options.namespace ? `${this.options.namespace}:${key}` : key;
    this.buckets.delete(bucketKey);
  }
}

// Create rate limiters for different API endpoints
export const rateLimiters = {
  // General API calls: 300 requests per 5 minutes
  general: new RateLimiter({
    maxRequests: 300,
    windowMs: 5 * 60 * 1000,
    namespace: 'general'
  }),
  
  // Timeline/feed calls: 100 requests per 5 minutes
  feed: new RateLimiter({
    maxRequests: 100,
    windowMs: 5 * 60 * 1000,
    namespace: 'feed'
  }),
  
  // Post interactions: 500 requests per 5 minutes
  interactions: new RateLimiter({
    maxRequests: 500,
    windowMs: 5 * 60 * 1000,
    namespace: 'interactions'
  }),
  
  // Search: 50 requests per minute
  search: new RateLimiter({
    maxRequests: 50,
    windowMs: 60 * 1000,
    namespace: 'search'
  })
};

/**
 * Middleware for API calls with rate limiting
 */
export async function withRateLimit<T>(
  limiter: RateLimiter,
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!limiter.canMakeRequest(key)) {
    const waitTime = limiter.getTimeUntilNextRequest(key);
    throw new Error(`Rate limited. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
  }
  
  return fn();
}