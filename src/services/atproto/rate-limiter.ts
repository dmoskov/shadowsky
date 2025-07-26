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
    const tokensToAdd = Math.floor(timePassed / this.config.windowMs) * this.config.maxRequests
    
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.config.maxRequests, this.tokens + tokensToAdd)
      this.lastRefill = now
    }
  }

  private getMsUntilNextToken(): number {
    const timeSinceLastRefill = Date.now() - this.lastRefill
    const msUntilNextRefill = this.config.windowMs - timeSinceLastRefill
    return Math.max(0, msUntilNextRefill)
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
 * Create rate limiters for different API endpoints
 */
export const rateLimiters = {
  // Profile fetching: 30 requests per minute (conservative)
  profile: new RateLimiter({
    maxRequests: 30,
    windowMs: 60 * 1000, // 1 minute
    maxQueueSize: 200
  }),

  // Feed fetching: 60 requests per minute
  feed: new RateLimiter({
    maxRequests: 60,
    windowMs: 60 * 1000,
    maxQueueSize: 50
  }),

  // General API calls: 100 requests per minute
  general: new RateLimiter({
    maxRequests: 100,
    windowMs: 60 * 1000,
    maxQueueSize: 100
  })
}