import { AppBskyFeedDefs, AppBskyFeedPost, AppBskyEmbedRecord, AppBskyNotificationListNotifications } from "@atproto/api";
import { MutedWord } from "../services/preferences";

/**
 * Check if a muted word has expired
 */
function isMutedWordExpired(mutedWord: MutedWord): boolean {
  if (!mutedWord.expiresAt || mutedWord.duration === "forever") {
    return false;
  }
  return Date.now() > mutedWord.expiresAt;
}

/**
 * Calculate expiration timestamp for a muted word based on duration
 */
export function calculateExpirationTime(duration: MutedWord["duration"]): number | undefined {
  if (!duration || duration === "forever") {
    return undefined;
  }

  const now = Date.now();
  const durations = {
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
  };

  return now + durations[duration];
}

/**
 * Pre-compiled muted word matcher.
 * Compiles regex patterns once and caches them, keyed by the muted word value.
 * Avoids creating new RegExp objects on every post×word check during scroll
 * (see ISSUE-CPU-1 in profiling report).
 */
interface CompiledMutedWord {
  type: "hashtag" | "phrase" | "word";
  pattern?: RegExp;
  lowerValue: string;
}

const compiledCache = new Map<string, CompiledMutedWord>();

function getCompiledMutedWord(mutedWord: MutedWord): CompiledMutedWord {
  const cacheKey = mutedWord.value;
  const cached = compiledCache.get(cacheKey);
  if (cached) return cached;

  const searchValue = mutedWord.value.toLowerCase().trim();
  let compiled: CompiledMutedWord;

  if (searchValue.startsWith("#")) {
    const tag = searchValue.slice(1);
    compiled = {
      type: "hashtag",
      pattern: new RegExp(`#${tag}(?![\\w])`, "i"),
      lowerValue: searchValue,
    };
  } else if (searchValue.includes(" ")) {
    compiled = {
      type: "phrase",
      lowerValue: searchValue,
    };
  } else {
    compiled = {
      type: "word",
      pattern: new RegExp(`\\b${searchValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
      lowerValue: searchValue,
    };
  }

  compiledCache.set(cacheKey, compiled);
  return compiled;
}

/**
 * Check if text contains a muted word/phrase
 * Case-insensitive matching with support for phrases and hashtags.
 * Uses pre-compiled regex patterns for performance.
 */
function containsMutedWord(text: string, mutedWord: MutedWord): boolean {
  if (isMutedWordExpired(mutedWord)) {
    return false;
  }

  const compiled = getCompiledMutedWord(mutedWord);

  if (compiled.type === "hashtag" && compiled.pattern) {
    return compiled.pattern.test(text);
  }

  if (compiled.type === "phrase") {
    return text.toLowerCase().includes(compiled.lowerValue);
  }

  // Single word with word boundary regex
  if (compiled.pattern) {
    return compiled.pattern.test(text);
  }

  return false;
}

/**
 * Extract text content from a post for filtering
 */
function extractPostText(post: AppBskyFeedDefs.FeedViewPost): string {
  const record = post.post.record as AppBskyFeedPost.Record;
  let text = "";

  // Add post text
  if (record.text) {
    text += record.text + " ";
  }

  // Add alt text from images
  if (record.embed && 'images' in record.embed) {
    for (const image of (record.embed as { images: Array<{ alt?: string }> }).images) {
      if (image.alt) {
        text += image.alt + " ";
      }
    }
  }

  // Add quoted post text
  if (post.post.embed && "record" in post.post.embed) {
    const embedView = post.post.embed as AppBskyEmbedRecord.View;
    const viewRecord = embedView.record as AppBskyEmbedRecord.ViewRecord;
    if (viewRecord?.value && (viewRecord.value as { text?: string }).text) {
      text += (viewRecord.value as { text?: string }).text + " ";
    }
  }

  return text;
}

/**
 * Check if a post should be muted based on muted words
 */
export function isPostMuted(
  post: AppBskyFeedDefs.FeedViewPost,
  mutedWords: MutedWord[],
  feedType?: "home" | "other",
): boolean {
  if (!mutedWords || mutedWords.length === 0) {
    return false;
  }

  const postText = extractPostText(post);

  // Check each muted word
  for (const mutedWord of mutedWords) {
    // Skip if muted word only applies to home feed and we're in another feed
    if (mutedWord.appliesTo === "home" && feedType !== "home") {
      continue;
    }

    // Skip if expired
    if (isMutedWordExpired(mutedWord)) {
      continue;
    }

    // Check if post contains muted word
    if (containsMutedWord(postText, mutedWord)) {
      return true;
    }
  }

  return false;
}

/**
 * Filter a list of posts based on muted words
 */
export function filterMutedPosts(
  posts: AppBskyFeedDefs.FeedViewPost[],
  mutedWords: MutedWord[],
  feedType?: "home" | "other",
): AppBskyFeedDefs.FeedViewPost[] {
  if (!mutedWords || mutedWords.length === 0) {
    return posts;
  }

  return posts.filter((post) => !isPostMuted(post, mutedWords, feedType));
}

/**
 * Get list of active (non-expired) muted words
 */
export function getActiveMutedWords(mutedWords: MutedWord[]): MutedWord[] {
  return mutedWords.filter((word) => !isMutedWordExpired(word));
}

/**
 * Extract text from a notification for filtering
 */
function extractNotificationText(notification: AppBskyNotificationListNotifications.Notification): string {
  let text = "";

  // Add notification record text (for replies, mentions, quotes)
  const record = notification.record as { text?: string; embed?: { images?: Array<{ alt?: string }> } } | undefined;
  if (record?.text) {
    text += record.text + " ";
  }

  // Add alt text from embedded images
  if (record?.embed?.images) {
    for (const image of record.embed.images) {
      if (image.alt) {
        text += image.alt + " ";
      }
    }
  }

  return text;
}

/**
 * Check if a notification should be muted based on muted words
 */
export function isNotificationMuted(
  notification: AppBskyNotificationListNotifications.Notification,
  mutedWords: MutedWord[],
): boolean {
  if (!mutedWords || mutedWords.length === 0) {
    return false;
  }

  // Skip filtering for follows (no text content)
  if (notification.reason === "follow") {
    return false;
  }

  const notificationText = extractNotificationText(notification);

  // Check each muted word
  for (const mutedWord of mutedWords) {
    // Skip if expired
    if (isMutedWordExpired(mutedWord)) {
      continue;
    }

    // Check if notification contains muted word
    if (containsMutedWord(notificationText, mutedWord)) {
      return true;
    }
  }

  return false;
}

/**
 * Filter a list of notifications based on muted words
 */
export function filterMutedNotifications(
  notifications: AppBskyNotificationListNotifications.Notification[],
  mutedWords: MutedWord[],
): AppBskyNotificationListNotifications.Notification[] {
  if (!mutedWords || mutedWords.length === 0) {
    return notifications;
  }

  return notifications.filter((notification) => !isNotificationMuted(notification, mutedWords));
}
