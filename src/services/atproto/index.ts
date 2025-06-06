/**
 * Centralized AT Protocol service initialization
 */

import { ATProtoClient } from './client'
import { FeedService } from './feed'

// Create singleton instances
export const atProtoClient = new ATProtoClient({
  service: 'https://bsky.social',
  persistSession: true
})

export const feedService = new FeedService(atProtoClient)

// Export types and classes
export { ATProtoClient } from './client'
export { FeedService } from './feed'
export type { ATProtoConfig } from './client'

// Export interaction services
export { interactionsService } from './interactions'