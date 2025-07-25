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

// Create singleton instances with app-specific session storage
export const atProtoClient = new ATProtoClient({
  service: 'https://bsky.social',
  persistSession: true,
  sessionPrefix: 'notifications_' // This will use 'notifications_bsky_session' as the storage key
})

export const feedService = new FeedService(atProtoClient)
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