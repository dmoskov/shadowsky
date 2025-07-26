/**
 * Rate-limited wrapper for BskyAgent
 * Intercepts all API calls and applies rate limiting
 */

import { BskyAgent } from '@atproto/api'
import { rateLimiters, withRateLimit } from './rate-limiter'
import { mapATProtoError } from './errors'

/**
 * Proxy handler that intercepts all method calls and applies rate limiting
 */
class RateLimitedProxy implements ProxyHandler<any> {
  constructor(
    private limiterType: keyof typeof rateLimiters = 'general',
    private keyPrefix: string = ''
  ) {}

  get(target: any, prop: string | symbol, receiver: any): any {
    const value = Reflect.get(target, prop, receiver)
    
    // If it's a function, wrap it with rate limiting
    if (typeof value === 'function') {
      return (...args: any[]) => {
        const key = this.keyPrefix ? `${this.keyPrefix}:${String(prop)}` : String(prop)
        return withRateLimit(
          rateLimiters[this.limiterType],
          key,
          () => value.apply(target, args)
        ).catch(error => {
          // Re-map rate limit errors to AT Protocol errors
          if (error.message?.includes('Rate limited')) {
            // Extract wait time from error message
            const waitMatch = error.message.match(/wait (\d+) seconds/)
            const waitSeconds = waitMatch ? parseInt(waitMatch[1]) : 60
            const resetAt = new Date(Date.now() + waitSeconds * 1000)
            
            throw mapATProtoError({
              status: 429,
              error: 'RateLimitExceeded',
              message: `Rate limit exceeded for ${this.limiterType} API. Please wait ${waitSeconds} seconds.`,
              headers: {
                'ratelimit-reset': String(Math.floor(resetAt.getTime() / 1000))
              }
            })
          }
          throw error
        })
      }
    }
    
    // If it's an object (like app.bsky.feed), apply proxy recursively
    if (value && typeof value === 'object') {
      return new Proxy(value, new RateLimitedProxy(this.limiterType, String(prop)))
    }
    
    return value
  }
}

/**
 * Create a rate-limited BskyAgent
 * All API calls through this agent will be rate limited
 */
export function createRateLimitedAgent(agent: BskyAgent): BskyAgent {
  // Apply different rate limits to different namespaces
  const appProxy = new Proxy(agent.app, {
    get(target: any, namespace: string) {
      const value = target[namespace]
      if (!value) return value
      
      // Apply specific rate limits based on namespace
      switch (namespace) {
        case 'bsky':
          // Further differentiate by sub-namespace
          return new Proxy(value, {
            get(bskyTarget: any, subNamespace: string) {
              const subValue = bskyTarget[subNamespace]
              if (!subValue) return subValue
              
              let limiterType: keyof typeof rateLimiters = 'general'
              
              switch (subNamespace) {
                case 'feed':
                  limiterType = 'feed'
                  break
                case 'graph':
                case 'actor':
                  limiterType = 'interactions'
                  break
                default:
                  limiterType = 'general'
              }
              
              return new Proxy(subValue, new RateLimitedProxy(limiterType, `${namespace}.${subNamespace}`))
            }
          })
        default:
          return new Proxy(value, new RateLimitedProxy('general', namespace))
      }
    }
  })
  
  // Create a new agent-like object with rate-limited app namespace
  return new Proxy(agent, {
    get(target: any, prop: string) {
      if (prop === 'app') {
        return appProxy
      }
      return target[prop]
    }
  })
}

/**
 * Get rate limit status for monitoring
 */
export function getRateLimitStatus() {
  return {
    general: {
      available: rateLimiters.general.canMakeRequest('status-check'),
      waitTime: rateLimiters.general.getTimeUntilNextRequest('status-check')
    },
    feed: {
      available: rateLimiters.feed.canMakeRequest('status-check'),
      waitTime: rateLimiters.feed.getTimeUntilNextRequest('status-check')
    },
    interactions: {
      available: rateLimiters.interactions.canMakeRequest('status-check'),
      waitTime: rateLimiters.interactions.getTimeUntilNextRequest('status-check')
    },
    search: {
      available: rateLimiters.search.canMakeRequest('status-check'),
      waitTime: rateLimiters.search.getTimeUntilNextRequest('status-check')
    }
  }
}

/**
 * Reset all rate limits (useful for testing)
 */
export function resetAllRateLimits() {
  Object.values(rateLimiters).forEach(limiter => {
    limiter.reset('default')
  })
}