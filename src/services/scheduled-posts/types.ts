/**
 * Scheduled Posts Types
 *
 * Type definitions for the scheduled post queue system.
 * Supports both single posts and multi-post threads with media attachments.
 */

/**
 * Status of a scheduled post in the queue
 */
export type ScheduledPostStatus =
  | "pending" // Waiting to be published at scheduled time
  | "processing" // Currently being published
  | "completed" // Successfully published
  | "failed" // Publication failed after retries
  | "cancelled"; // Cancelled by user

/**
 * Media attachment for a scheduled post
 */
export interface ScheduledPostMedia {
  /** Base64 encoded image or blob URL */
  data: string;
  /** MIME type of the media */
  mimeType: string;
  /** Alt text for accessibility */
  alt: string;
  /** Index of the post this media belongs to (for threads) */
  postIndex?: number;
}

/**
 * A single post within a scheduled thread
 */
export interface ScheduledThreadPost {
  /** Text content of the post */
  text: string;
  /** Media attachments for this specific post */
  media?: ScheduledPostMedia[];
}

/**
 * Configuration for thread posting behavior
 */
export interface ThreadConfig {
  /** Delay between posts in milliseconds */
  delayBetweenPosts: number;
  /** Whether to include post numbering */
  includeNumbering: boolean;
  /** Format for numbering (e.g., "1/5", "[1]", "1.") */
  numberingFormat: "none" | "simple" | "brackets" | "thread" | "dots";
  /** Position of numbering */
  numberingPosition: "beginning" | "end";
}

/**
 * Threadgate configuration for reply restrictions
 */
export interface ThreadgateConfig {
  /** Type of restriction */
  type: "everyone" | "mentioned" | "followed" | "lists" | "none";
  /** List URIs if type is "lists" */
  listUris?: string[];
}

/**
 * Core scheduled post entity
 */
export interface ScheduledPost {
  /** Unique identifier */
  id: string;
  /** User's DID who owns this scheduled post */
  userDid: string;
  /** ISO 8601 timestamp when post should be published */
  scheduledFor: string;
  /** Current status of the scheduled post */
  status: ScheduledPostStatus;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;

  /** Single post content (for non-thread posts) */
  text?: string;
  /** Media for single post */
  media?: ScheduledPostMedia[];

  /** Thread posts (for multi-post threads) */
  threadPosts?: ScheduledThreadPost[];
  /** Thread configuration */
  threadConfig?: ThreadConfig;

  /** Threadgate configuration */
  threadgate?: ThreadgateConfig;

  /** Reply to URI (if this is a reply) */
  replyTo?: {
    uri: string;
    cid: string;
  };

  /** Quote post URI (if this is a quote) */
  quotedPost?: {
    uri: string;
    cid: string;
  };

  /** Reference to original draft ID (for tracking) */
  draftId?: string;

  /** Number of retry attempts */
  retryCount: number;
  /** Maximum retry attempts allowed */
  maxRetries: number;
  /** Last error message if failed */
  lastError?: string;
  /** Timestamp of last attempt */
  lastAttemptAt?: string;

  /** Published post URIs after successful publication */
  publishedUris?: string[];
  /** Published at timestamp */
  publishedAt?: string;

  /** Server time offset in milliseconds (for sync) */
  serverTimeOffset?: number;
}

/**
 * Input for creating a new scheduled post
 */
export interface CreateScheduledPostInput {
  /** When to publish (ISO 8601) */
  scheduledFor: string;

  /** Single post content */
  text?: string;
  media?: ScheduledPostMedia[];

  /** Thread posts */
  threadPosts?: ScheduledThreadPost[];
  threadConfig?: ThreadConfig;

  /** Threadgate */
  threadgate?: ThreadgateConfig;

  /** Reply/Quote */
  replyTo?: { uri: string; cid: string };
  quotedPost?: { uri: string; cid: string };

  /** Source draft ID */
  draftId?: string;
}

/**
 * Input for updating a scheduled post
 */
export interface UpdateScheduledPostInput {
  scheduledFor?: string;
  text?: string;
  media?: ScheduledPostMedia[];
  threadPosts?: ScheduledThreadPost[];
  threadConfig?: ThreadConfig;
  threadgate?: ThreadgateConfig;
  status?: ScheduledPostStatus;
}

/**
 * Statistics about the scheduled post queue
 */
export interface ScheduledPostQueueStats {
  /** Total number of scheduled posts */
  total: number;
  /** Number pending publication */
  pending: number;
  /** Number currently being processed */
  processing: number;
  /** Number that completed successfully */
  completed: number;
  /** Number that failed */
  failed: number;
  /** Number cancelled */
  cancelled: number;
  /** Timestamp of next scheduled post */
  nextScheduledAt?: string;
}

/**
 * Server time sync response
 */
export interface ServerTimeSyncResponse {
  /** Server's current timestamp (ISO 8601) */
  serverTime: string;
  /** Server's Unix timestamp in milliseconds */
  serverTimestamp: number;
}

/**
 * Event emitted when scheduled post status changes
 */
export interface ScheduledPostEvent {
  type:
    | "created"
    | "updated"
    | "deleted"
    | "status_changed"
    | "published"
    | "failed";
  post: ScheduledPost;
  previousStatus?: ScheduledPostStatus;
}

/**
 * Scheduled post filter options for queries
 */
export interface ScheduledPostFilter {
  status?: ScheduledPostStatus | ScheduledPostStatus[];
  scheduledBefore?: string;
  scheduledAfter?: string;
  limit?: number;
  offset?: number;
}

/**
 * Generate a unique ID for a scheduled post
 */
export function generateScheduledPostId(): string {
  return `sched_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}
