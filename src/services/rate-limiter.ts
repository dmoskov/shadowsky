/**
 * Rate Limiter Service
 * 
 * Implements a token bucket algorithm to rate limit API calls
 * Ensures the app never makes abusive requests to Bluesky
 */

interface RateLimiterConfig {
  maxTokens: number          // Maximum tokens in bucket
  refillRate: number         // Tokens added per second
  initialTokens?: number     // Starting tokens (defaults to maxTokens)
  minDelay?: number         // Minimum delay between requests in ms
  adaptive?: boolean        // Whether to use adaptive rate limiting
  burstTokens?: number      // Extra tokens for initial burst (adaptive mode)
  slowdownAfter?: number    // Number of requests before slowing down (adaptive mode)
}

interface RateLimiterStats {
  availableTokens: number
  maxTokens: number
  lastRefill: Date
  totalRequests: number
  throttledRequests: number
  queueLength: number
}

class RateLimiter {
  private tokens: number
  private maxTokens: number
  private refillRate: number
  private lastRefill: number
  private minDelay: number
  private lastRequest: number = 0
  private queue: Array<() => void> = []
  private totalRequests: number = 0
  private throttledRequests: number = 0
  private adaptive: boolean
  private burstTokens: number
  private slowdownAfter: number
  private baseMinDelay: number
  private baseRefillRate: number

  constructor(config: RateLimiterConfig) {
    this.maxTokens = config.maxTokens
    this.tokens = config.initialTokens ?? config.maxTokens
    this.refillRate = config.refillRate
    this.minDelay = config.minDelay ?? 0
    this.lastRefill = Date.now()
    
    // Adaptive rate limiting settings
    this.adaptive = config.adaptive ?? false
    this.burstTokens = config.burstTokens ?? 0
    this.slowdownAfter = config.slowdownAfter ?? 50
    this.baseMinDelay = this.minDelay
    this.baseRefillRate = this.refillRate
    
    // If adaptive, start with burst tokens
    if (this.adaptive && this.burstTokens > 0) {
      this.tokens += this.burstTokens
    }
  }

  private refillTokens() {
    const now = Date.now()
    const timePassed = (now - this.lastRefill) / 1000 // Convert to seconds
    const tokensToAdd = timePassed * this.refillRate
    
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd)
    this.lastRefill = now
  }

  private processQueue() {
    if (this.queue.length === 0) return
    
    this.refillTokens()
    
    if (this.tokens >= 1) {
      const resolve = this.queue.shift()
      if (resolve) {
        this.tokens -= 1
        this.lastRequest = Date.now()
        resolve()
        
        // Process next item after minimum delay
        if (this.queue.length > 0) {
          setTimeout(() => this.processQueue(), this.minDelay)
        }
      }
    } else {
      // Calculate wait time until we have a token
      const waitTime = (1 - this.tokens) / this.refillRate * 1000
      setTimeout(() => this.processQueue(), Math.max(waitTime, this.minDelay))
    }
  }

  async acquire(): Promise<void> {
    this.totalRequests++
    
    // Adaptive rate limiting: slow down after initial burst
    if (this.adaptive) {
      if (this.totalRequests > this.slowdownAfter) {
        // Gradually increase delay and decrease refill rate
        const factor = Math.min(3, 1 + (this.totalRequests - this.slowdownAfter) / 100)
        this.minDelay = Math.floor(this.baseMinDelay * factor)
        this.refillRate = this.baseRefillRate / factor
      }
    }
    
    return new Promise((resolve) => {
      // Check minimum delay
      const now = Date.now()
      const timeSinceLastRequest = now - this.lastRequest
      const delayNeeded = Math.max(0, this.minDelay - timeSinceLastRequest)
      
      if (delayNeeded > 0) {
        this.throttledRequests++
        setTimeout(() => {
          this.queue.push(resolve)
          this.processQueue()
        }, delayNeeded)
      } else {
        this.refillTokens()
        
        if (this.tokens >= 1) {
          this.tokens -= 1
          this.lastRequest = now
          resolve()
        } else {
          this.throttledRequests++
          this.queue.push(resolve)
          this.processQueue()
        }
      }
    })
  }

  getStats(): RateLimiterStats {
    this.refillTokens()
    return {
      availableTokens: Math.floor(this.tokens),
      maxTokens: this.maxTokens,
      lastRefill: new Date(this.lastRefill),
      totalRequests: this.totalRequests,
      throttledRequests: this.throttledRequests,
      queueLength: this.queue.length
    }
  }

  reset() {
    this.tokens = this.maxTokens
    this.lastRefill = Date.now()
    this.queue = []
  }
}

// Create rate limiters for different API endpoints
// Conservative limits to ensure we're never abusive

// General API rate limiter - 30 requests per minute (0.5/sec)
export const apiRateLimiter = new RateLimiter({
  maxTokens: 30,
  refillRate: 0.5,
  minDelay: 100 // 100ms minimum between requests
})

// Profile fetch rate limiter - 20 requests per minute
export const profileRateLimiter = new RateLimiter({
  maxTokens: 20,
  refillRate: 0.33,
  minDelay: 200 // 200ms minimum between requests
})

// Post fetch rate limiter - Adaptive: fast initial burst, then slows down
export const postRateLimiter = new RateLimiter({
  maxTokens: 20,
  refillRate: 0.5,  // Start faster
  minDelay: 50,     // Start with 50ms minimum delay
  adaptive: true,
  burstTokens: 30,  // Allow 50 total tokens initially (20 + 30)
  slowdownAfter: 25 // Start slowing down after 25 requests
})

// Notification fetch rate limiter - Adaptive for initial load
export const notificationRateLimiter = new RateLimiter({
  maxTokens: 60,
  refillRate: 2,    // Start at 2 requests per second
  minDelay: 200,    // Start with 200ms minimum delay
  adaptive: true,
  burstTokens: 40,  // Allow 100 total tokens initially
  slowdownAfter: 50 // Start slowing down after 50 requests
})

// Export stats function for UI
export function getRateLimiterStats() {
  return {
    api: apiRateLimiter.getStats(),
    profile: profileRateLimiter.getStats(),
    post: postRateLimiter.getStats(),
    notification: notificationRateLimiter.getStats()
  }
}

// Wrapper function to rate limit any async function
export async function rateLimited<T>(
  fn: () => Promise<T>,
  limiter: RateLimiter = apiRateLimiter
): Promise<T> {
  await limiter.acquire()
  return fn()
}

// Specific wrappers for common operations
export async function rateLimitedProfileFetch<T>(fn: () => Promise<T>): Promise<T> {
  await profileRateLimiter.acquire()
  return fn()
}

export async function rateLimitedPostFetch<T>(fn: () => Promise<T>): Promise<T> {
  await postRateLimiter.acquire()
  return fn()
}

export async function rateLimitedNotificationFetch<T>(fn: () => Promise<T>): Promise<T> {
  await notificationRateLimiter.acquire()
  return fn()
}