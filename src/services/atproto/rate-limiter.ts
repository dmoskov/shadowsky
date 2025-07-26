/**
 * Rate limiter for AT Protocol API requests
 * Implements a token bucket algorithm with queuing
 */

interface RateLimiterConfig {
  maxRequests: number // Maximum requests per window
  windowMs: number // Time window in milliseconds
  maxQueueSize?: number // Maximum queue size (default: 100)
}

interface QueuedRequest<T> {
  execute: () => Promise<T>
  resolve: (value: T) => void
  reject: (error: any) => void
  priority?: number
}

export class RateLimiter {
  private tokens: number
  private lastRefill: number
  private queue: QueuedRequest<any>[] = []
  private processing = false

  constructor(private config: RateLimiterConfig) {
    this.tokens = config.maxRequests
    this.lastRefill = Date.now()
  }

  /**
   * Execute a function with rate limiting
   */
  async execute<T>(fn: () => Promise<T>, priority = 0): Promise<T> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest<T> = {
        execute: fn,
        resolve,
        reject,
        priority
      }

      // Check queue size limit
      const maxQueueSize = this.config.maxQueueSize ?? 100
      if (this.queue.length >= maxQueueSize) {
        reject(new Error('Rate limiter queue is full'))
        return
      }

      // Add to queue
      this.queue.push(request)
      
      // Sort by priority (higher priority first)
      this.queue.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
      
      // Process queue
      this.processQueue()
    })
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return
    }

    this.processing = true

    while (this.queue.length > 0) {
      // Refill tokens based on time passed
      this.refillTokens()

      if (this.tokens > 0) {
        // We have tokens, execute the next request
        const request = this.queue.shift()!
        this.tokens--

        try {
          const result = await request.execute()
          request.resolve(result)
        } catch (error) {
          request.reject(error)
        }
      } else {
        // No tokens available, wait until next refill
        const msUntilNextToken = this.getMsUntilNextToken()
        await this.sleep(msUntilNextToken)
      }
    }

    this.processing = false
  }

  private refillTokens() {
    const now = Date.now()
    const timePassed = now - this.lastRefill
    
    // For a rate of X requests per Y ms, we should add X * (timePassed / Y) tokens
    const tokensToAdd = (this.config.maxRequests * timePassed) / this.config.windowMs
    
    if (tokensToAdd >= 1) {
      // Only refill whole tokens
      const wholeTokens = Math.floor(tokensToAdd)
      this.tokens = Math.min(this.config.maxRequests, this.tokens + wholeTokens)
      // Update lastRefill to account for the tokens we added
      this.lastRefill = now - ((tokensToAdd - wholeTokens) * this.config.windowMs / this.config.maxRequests)
    }
  }

  private getMsUntilNextToken(): number {
    const now = Date.now()
    const timePassed = now - this.lastRefill
    
    // Calculate how many tokens we would have accumulated
    const tokensAccumulated = (this.config.maxRequests * timePassed) / this.config.windowMs
    
    // If we haven't accumulated even 1 token yet, calculate time until we do
    if (tokensAccumulated < 1) {
      const msPerToken = this.config.windowMs / this.config.maxRequests
      const msUntilNextToken = msPerToken - (timePassed % msPerToken)
      return Math.max(0, msUntilNextToken)
    }
    
    return 0 // We already have tokens available
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.queue.length
  }

  /**
   * Clear all queued requests
   */
  clearQueue(): void {
    this.queue.forEach(request => {
      request.reject(new Error('Queue cleared'))
    })
    this.queue = []
  }
}

/**
 * Global rate limiter - enforces absolute maximum of 20 requests per second
 */
const globalRateLimiter = new RateLimiter({
  maxRequests: 20,
  windowMs: 1000, // 1 second
  maxQueueSize: 300
})

/**
 * Wrapper that enforces both global and endpoint-specific rate limits
 */
class GlobalRateLimitedWrapper {
  constructor(private endpointLimiter: RateLimiter) {}

  async execute<T>(fn: () => Promise<T>, priority = 0): Promise<T> {
    // First check global limit
    return globalRateLimiter.execute(async () => {
      // Then check endpoint-specific limit
      return this.endpointLimiter.execute(fn, priority)
    }, priority)
  }

  getQueueSize(): number {
    return this.endpointLimiter.getQueueSize() + globalRateLimiter.getQueueSize()
  }
}

/**
 * Create rate limiters for different API endpoints
 * AGGRESSIVE RATE LIMITING: No more than 20 requests per second total
 * Individual endpoint limits ensure fair distribution
 */
export const rateLimiters = {
  // Profile fetching: 5 requests per second (conservative)
  profile: new GlobalRateLimitedWrapper(new RateLimiter({
    maxRequests: 5,
    windowMs: 1000, // 1 second
    maxQueueSize: 200
  })),

  // Feed fetching: 8 requests per second
  feed: new GlobalRateLimitedWrapper(new RateLimiter({
    maxRequests: 8,
    windowMs: 1000, // 1 second
    maxQueueSize: 50
  })),

  // General API calls: 7 requests per second
  general: new GlobalRateLimitedWrapper(new RateLimiter({
    maxRequests: 7,
    windowMs: 1000, // 1 second
    maxQueueSize: 100
  }))
}

/**
 * Get global rate limiter stats
 */
export function getGlobalRateLimiterStats() {
  return {
    queueSize: globalRateLimiter.getQueueSize(),
    maxRequestsPerSecond: 20
  }
}