/**
 * Wrapper for FeedService that adds rate limiting
 */

import { FeedService } from '@bsky/shared'
import { rateLimiters } from './rate-limiter'
import type { TimelineResponse } from '@bsky/shared'

export class RateLimitedFeedService {
  constructor(private feedService: FeedService) {}

  /**
   * Get timeline with rate limiting
   */
  async getTimeline(cursor?: string): Promise<TimelineResponse> {
    return rateLimiters.feed.execute(() => 
      this.feedService.getTimeline(cursor)
    )
  }

  /**
   * Get author feed with rate limiting
   */
  async getAuthorFeed(actor: string, cursor?: string): Promise<TimelineResponse> {
    return rateLimiters.feed.execute(() => 
      this.feedService.getAuthorFeed(actor, cursor)
    )
  }

  /**
   * Get post thread with rate limiting (higher priority)
   */
  async getPostThread(uri: string, depth?: number): Promise<any> {
    return rateLimiters.feed.execute(() => 
      this.feedService.getPostThread(uri, depth),
      1 // Higher priority for individual post views
    )
  }

  /**
   * Search posts with rate limiting
   */
  async searchPosts(query: string, cursor?: string): Promise<any> {
    return rateLimiters.general.execute(() => 
      this.feedService.searchPosts(query, cursor)
    )
  }

  /**
   * Get feed with rate limiting
   */
  async getFeed(feedUri: string, cursor?: string): Promise<TimelineResponse> {
    return rateLimiters.feed.execute(() => 
      this.feedService.getFeed(feedUri, cursor)
    )
  }

  /**
   * Proxy other methods to the underlying service
   */
  initializeDeduplication() {
    return this.feedService.initializeDeduplication()
  }
}