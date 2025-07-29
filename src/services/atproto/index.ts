/**
 * Centralized AT Protocol service initialization
 */

import { 
  ATProtoClient, 
  FeedService,
  AnalyticsService,
  type ATProtoConfig
} from '@bsky/shared'
import { getInteractionsService } from '@bsky/shared'
import { getThreadService } from '@bsky/shared'
import { ATProtoClientWith2FA } from './client-with-2fa'

// Create base client instance
const baseClient = new ATProtoClient({
  service: 'https://bsky.social',
  persistSession: true,
  sessionPrefix: 'notifications_', // This will use 'notifications_bsky_session' as the storage key
  enableRateLimiting: true // Rate limiting is handled by our custom rate limiters
})

// Create a proxy that adds 2FA support while preserving all other functionality
const clientWith2FA = new Proxy(baseClient, {
  get(target, prop) {
    // Override the login method to support 2FA
    if (prop === 'login') {
      return async (identifier: string, password: string, authFactorToken?: string) => {
        const wrapper = new ATProtoClientWith2FA(target)
        return wrapper.login(identifier, password, authFactorToken)
      }
    }
    // Delegate everything else to the base client
    return target[prop as keyof typeof target]
  }
})

export const atProtoClient = clientWith2FA

export const feedService = new FeedService(baseClient)
// Initialize deduplication after service creation
feedService.initializeDeduplication()

// Re-export types and classes from shared
export { 
  ATProtoClient, 
  FeedService, 
  AnalyticsService,
  type ATProtoConfig,
  getInteractionsService,
  getThreadService
}