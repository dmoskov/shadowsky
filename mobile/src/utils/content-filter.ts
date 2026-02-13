import { AppBskyFeedDefs } from "@atproto/api";
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
 * Check if text contains a muted word/phrase
 * Case-insensitive matching with support for phrases and hashtags
 */
function containsMutedWord(text: string, mutedWord: MutedWord): boolean {
  if (isMutedWordExpired(mutedWord)) {
    return false;
  }

  const searchValue = mutedWord.value.toLowerCase().trim();
  const searchText = text.toLowerCase();

  // Handle hashtag matching
  if (searchValue.startsWith("#")) {
    // Match hashtag exactly with word boundaries
    const tag = searchValue.slice(1);
    const hashtagPattern = new RegExp(`#${tag}(?![\\w])`, "i");
    return hashtagPattern.test(text);
  }

  // For phrases (multi-word), check if the entire phrase exists
  if (searchValue.includes(" ")) {
    return searchText.includes(searchValue);
  }

  // For single words, match with word boundaries to avoid partial matches
  // e.g., "cat" should not match "category"
  const wordPattern = new RegExp(`\\b${searchValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  return wordPattern.test(text);
}

/**
 * Extract text content from a post for filtering
 */
function extractPostText(post: AppBskyFeedDefs.FeedViewPost): string {
  const record = post.post.record as any;
  let text = "";

  // Add post text
  if (record.text) {
    text += record.text + " ";
  }

  // Add alt text from images
  if (record.embed?.images) {
    for (const image of record.embed.images) {
      if (image.alt) {
        text += image.alt + " ";
      }
    }
  }

  // Add quoted post text
  if (post.post.embed && "record" in post.post.embed) {
    const embeddedRecord = (post.post.embed as any).record;
    if (embeddedRecord?.value?.text) {
      text += embeddedRecord.value.text + " ";
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
function extractNotificationText(notification: any): string {
  let text = "";

  // Add notification record text (for replies, mentions, quotes)
  if (notification.record?.text) {
    text += notification.record.text + " ";
  }

  // Add alt text from embedded images
  if (notification.record?.embed?.images) {
    for (const image of notification.record.embed.images) {
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
  notification: any,
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
  notifications: any[],
  mutedWords: MutedWord[],
): any[] {
  if (!mutedWords || mutedWords.length === 0) {
    return notifications;
  }

  return notifications.filter((notification) => !isNotificationMuted(notification, mutedWords));
}
