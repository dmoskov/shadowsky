/**
 * Draft Integration Utilities
 *
 * Utilities for converting drafts to scheduled posts and vice versa.
 * Provides seamless workflow between draft editing and scheduling.
 */

import { ThreadDraft } from "../drafts";
import { getDataDrivenPostingTimes } from "../posting-time-recommendations";
import {
  CreateScheduledPostInput,
  ScheduledPost,
  ScheduledPostMedia,
  ScheduledThreadPost,
  ThreadConfig,
  ThreadgateConfig,
} from "./types";

/**
 * Convert a ThreadDraft to a CreateScheduledPostInput
 */
export function draftToScheduledPost(
  draft: ThreadDraft,
  scheduledFor: string,
  options?: {
    threadgate?: ThreadgateConfig;
    replyTo?: { uri: string; cid: string };
    quotedPost?: { uri: string; cid: string };
  },
): CreateScheduledPostInput {
  const input: CreateScheduledPostInput = {
    scheduledFor,
    draftId: draft.id,
    threadgate: options?.threadgate,
    replyTo: options?.replyTo,
    quotedPost: options?.quotedPost,
  };

  // Handle single post vs thread
  if (draft.posts && draft.posts.length > 0) {
    // Multi-post thread
    input.threadPosts = convertDraftPostsToThreadPosts(draft);
    input.threadConfig = getDefaultThreadConfig();
  } else {
    // Single post
    input.text = draft.content;
    input.media = convertDraftMediaToScheduledMedia(draft.media, draft.images);
  }

  return input;
}

/**
 * Convert draft posts array to scheduled thread posts
 */
function convertDraftPostsToThreadPosts(
  draft: ThreadDraft,
): ScheduledThreadPost[] {
  const posts = draft.posts || [draft.content];
  const order = draft.postOrder || posts.map((_, i) => i);

  return order.map((index) => {
    const text = posts[index] || "";
    const postMedia = draft.media?.filter((m) => m.postIndex === index) || [];

    return {
      text,
      media: postMedia.map((m) => ({
        data: m.file,
        mimeType: m.type === "image" ? "image/jpeg" : "video/mp4",
        alt: m.alt,
        postIndex: index,
      })),
    };
  });
}

/**
 * Convert draft media to scheduled post media format
 */
function convertDraftMediaToScheduledMedia(
  media?: ThreadDraft["media"],
  legacyImages?: ThreadDraft["images"],
): ScheduledPostMedia[] | undefined {
  if (media && media.length > 0) {
    return media.map((m) => ({
      data: m.file,
      mimeType: m.type === "image" ? "image/jpeg" : "video/mp4",
      alt: m.alt,
      postIndex: m.postIndex,
    }));
  }

  if (legacyImages && legacyImages.length > 0) {
    return legacyImages.map((img) => ({
      data: img.file,
      mimeType: "image/jpeg",
      alt: img.alt,
    }));
  }

  return undefined;
}

/**
 * Get default thread configuration
 */
function getDefaultThreadConfig(): ThreadConfig {
  return {
    delayBetweenPosts: 3000, // 3 seconds
    includeNumbering: true,
    numberingFormat: "simple",
    numberingPosition: "end",
  };
}

/**
 * Convert a ScheduledPost back to a ThreadDraft for editing
 */
export function scheduledPostToDraft(
  scheduledPost: ScheduledPost,
): ThreadDraft {
  const now = new Date().toISOString();

  const draft: ThreadDraft = {
    id: scheduledPost.draftId || `draft_from_${scheduledPost.id}`,
    title: "",
    content: "",
    createdAt: now,
    updatedAt: now,
    scheduledFor: scheduledPost.scheduledFor,
  };

  if (scheduledPost.threadPosts && scheduledPost.threadPosts.length > 0) {
    // Multi-post thread
    draft.posts = scheduledPost.threadPosts.map((p) => p.text);
    draft.postOrder = scheduledPost.threadPosts.map((_, i) => i);
    draft.media = scheduledPost.threadPosts.flatMap((post, index) =>
      (post.media || []).map((m) => ({
        file: m.data,
        alt: m.alt,
        type: m.mimeType.startsWith("video")
          ? ("video" as const)
          : ("image" as const),
        postIndex: index,
      })),
    );
    draft.content = scheduledPost.threadPosts[0]?.text || "";
  } else {
    // Single post
    draft.content = scheduledPost.text || "";
    if (scheduledPost.media && scheduledPost.media.length > 0) {
      draft.media = scheduledPost.media.map((m) => ({
        file: m.data,
        alt: m.alt,
        type: m.mimeType.startsWith("video")
          ? ("video" as const)
          : ("image" as const),
        postIndex: m.postIndex,
      }));
    }
  }

  return draft;
}

/**
 * Check if a draft has a scheduled time set
 */
export function isDraftScheduled(draft: ThreadDraft): boolean {
  return !!(draft.scheduledFor && new Date(draft.scheduledFor) > new Date());
}

/**
 * Get the scheduled time from a draft, if any
 */
export function getDraftScheduledTime(draft: ThreadDraft): Date | null {
  if (!draft.scheduledFor) return null;
  const date = new Date(draft.scheduledFor);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Calculate suggested optimal posting times based on engagement patterns.
 * Uses cached engagement data when available, falls back to common posting times.
 */
export function getSuggestedPostingTimes(): Date[] {
  // Try to use data-driven recommendations from cached analysis
  const dataDrivenTimes = getDataDrivenPostingTimes();
  if (dataDrivenTimes.length > 0) {
    return dataDrivenTimes;
  }

  const now = new Date();
  const suggestions: Date[] = [];

  // Fallback: common good posting times
  const goodHours = [8, 12, 17, 20]; // 8am, 12pm, 5pm, 8pm

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    for (const hour of goodHours) {
      const suggestedTime = new Date(now);
      suggestedTime.setDate(suggestedTime.getDate() + dayOffset);
      suggestedTime.setHours(hour, 0, 0, 0);

      // Only include future times
      if (suggestedTime > now) {
        suggestions.push(suggestedTime);
      }
    }
  }

  return suggestions.slice(0, 10); // Return top 10 suggestions
}

/**
 * Format a date for display in the scheduler UI
 */
export function formatScheduledTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;

  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const timeStr = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  if (diffDays === 0) {
    return `Today at ${timeStr}`;
  } else if (diffDays === 1) {
    return `Tomorrow at ${timeStr}`;
  } else if (diffDays < 7) {
    const dayName = d.toLocaleDateString(undefined, { weekday: "long" });
    return `${dayName} at ${timeStr}`;
  } else {
    const dateStr = d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    return `${dateStr} at ${timeStr}`;
  }
}

/**
 * Validate a scheduled time
 */
export function validateScheduledTime(
  scheduledFor: string | Date,
  options?: {
    minMinutesInFuture?: number;
    maxDaysInFuture?: number;
  },
): { valid: boolean; error?: string } {
  const date =
    typeof scheduledFor === "string" ? new Date(scheduledFor) : scheduledFor;

  if (isNaN(date.getTime())) {
    return { valid: false, error: "Invalid date format" };
  }

  const now = new Date();
  const minFuture = (options?.minMinutesInFuture || 1) * 60 * 1000;
  const maxFuture = (options?.maxDaysInFuture || 365) * 24 * 60 * 60 * 1000;

  if (date.getTime() < now.getTime() + minFuture) {
    return {
      valid: false,
      error: `Must be at least ${options?.minMinutesInFuture || 1} minute(s) in the future`,
    };
  }

  if (date.getTime() > now.getTime() + maxFuture) {
    return {
      valid: false,
      error: `Cannot schedule more than ${options?.maxDaysInFuture || 365} days in advance`,
    };
  }

  return { valid: true };
}
