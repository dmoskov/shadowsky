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
import { getProfileService } from '@bsky/shared'
import { getSearchService } from '@bsky/shared'

// Create singleton instances
export const atProtoClient = new ATProtoClient({
  service: 'https://bsky.social',
  persistSession: true
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
  getThreadService,
  getProfileService,
  getSearchService
}