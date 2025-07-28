/**
 * Centralized AT Protocol service initialization
 */

import { 
  ATProtoClient, 
  FeedService,
  AnalyticsService,
  type ATProtoConfig,
  getInteractionsService,
  getThreadService,
  getSearchService
} from '@bsky/shared/services/atproto'
import { getNotificationService } from './notifications'
import { getProfileService } from './profile'
import { RateLimitedFeedService } from './feed-wrapper'

// Create singleton instances
export const atProtoClient = new ATProtoClient({
  service: 'https://bsky.social',
  persistSession: true,
  sessionPrefix: 'main_' // Use 'main_bsky_session' as the storage key for main app
})

// Create base feed service and wrap with rate limiting
const baseFeedService = new FeedService(atProtoClient)
export const feedService = new RateLimitedFeedService(baseFeedService)
// Initialize deduplication after service creation
feedService.initializeDeduplication()

// Re-export types and classes from shared
export { 
  ATProtoClient, 
  FeedService, 
  AnalyticsService,
  type ATProtoConfig,
  getInteractionsService,
  getThreadService,
  getSearchService,
  getNotificationService,
  getProfileService
}