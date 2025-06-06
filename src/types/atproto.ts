/**
 * AT Protocol type definitions
 * Re-exports official types from @atproto/api for type safety
 */

export type {
  AppBskyFeedPost,
  AppBskyFeedDefs,
  AppBskyActorDefs,
  AppBskyGraphDefs,
  AppBskyNotificationListNotifications,
  AppBskyEmbedImages,
  AppBskyEmbedExternal,
  AppBskyEmbedRecord,
  AppBskyEmbedRecordWithMedia,
  AppBskyRichtextFacet,
  ComAtprotoSyncSubscribeRepos,
  AtUri
} from '@atproto/api'

import type { AppBskyFeedDefs, AppBskyActorDefs } from '@atproto/api'

// App-specific type extensions
export interface Post extends AppBskyFeedDefs.PostView {
  // Additional app-specific fields can be added here
}

export interface Author extends AppBskyActorDefs.ProfileViewDetailed {
  // Additional app-specific fields can be added here
}

export interface FeedItem {
  post: Post
  reply?: {
    root: Post
    parent: Post
  }
  reason?: AppBskyFeedDefs.ReasonRepost | AppBskyFeedDefs.ReasonPin
}

export interface TimelineResponse {
  cursor?: string
  feed: FeedItem[]
}

// Properly typed session
export interface Session {
  did: string
  handle: string
  email?: string
  emailConfirmed?: boolean
  emailAuthFactor?: boolean
  accessJwt: string
  refreshJwt: string
  active?: boolean
  
  // Additional fields from the service
  didDoc?: unknown
}

// API Error types
export interface ATProtoErrorResponse {
  error: string
  message: string
  status?: number
}