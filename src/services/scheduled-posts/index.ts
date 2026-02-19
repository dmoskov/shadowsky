/**
 * Scheduled Posts Module
 *
 * Core infrastructure for scheduling posts for future publication.
 * Includes server-primary architecture with local IndexedDB caching.
 *
 * @example
 * ```typescript
 * import { schedulerService, draftToScheduledPost } from '@/services/scheduled-posts';
 *
 * // Initialize the service
 * await schedulerService.init(userDid);
 *
 * // Convert a draft to a scheduled post
 * const input = draftToScheduledPost(draft, scheduledTime.toISOString());
 *
 * // Create the scheduled post
 * const post = await schedulerService.create(input);
 *
 * // Get all pending scheduled posts
 * const pending = await schedulerService.getAll({ status: 'pending' });
 *
 * // Cancel a scheduled post
 * await schedulerService.cancel(post.id);
 * ```
 */

// Types
export type {
  CreateScheduledPostInput,
  ScheduledPost,
  ScheduledPostEvent,
  ScheduledPostFilter,
  ScheduledPostMedia,
  ScheduledPostQueueStats,
  ScheduledPostStatus,
  ScheduledThreadPost,
  ServerTimeSyncResponse,
  ThreadConfig,
  ThreadgateConfig,
  UpdateScheduledPostInput,
} from "./types";

export { generateScheduledPostId } from "./types";

// Database
export { scheduledPostDB } from "./scheduled-post-db";

// Service
export { schedulerService } from "./scheduler-service";

// AT Proto Sync
export { ScheduledPostAtProtoSync } from "./atproto-sync";

// Draft Integration
export {
  draftToScheduledPost,
  formatScheduledTime,
  getDraftScheduledTime,
  getSuggestedPostingTimes,
  isDraftScheduled,
  scheduledPostToDraft,
  validateScheduledTime,
} from "./draft-integration";
