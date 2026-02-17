import * as Notifications from 'expo-notifications';
import {AppBskyFeedDefs} from '@atproto/api';
import {getAtProtoClient} from './atproto/client';
import {likePost, createPost} from './atproto/posts';
import {createLogger} from '../utils/logger';

const logger = createLogger('NotificationCategories');

// Category identifiers
export const NOTIFICATION_CATEGORY = {
  REPLY: 'REPLY_NOTIFICATION',
  MENTION: 'MENTION_NOTIFICATION',
  LIKE: 'LIKE_NOTIFICATION',
  REPOST: 'REPOST_NOTIFICATION',
  QUOTE: 'QUOTE_NOTIFICATION',
  FOLLOW: 'FOLLOW_NOTIFICATION',
} as const;

// Action identifiers
export const NOTIFICATION_ACTION = {
  REPLY: 'REPLY_ACTION',
  LIKE: 'LIKE_ACTION',
} as const;

/**
 * Register notification categories with iOS/Android action buttons.
 * Must be called once during app initialization.
 */
export async function registerNotificationCategories(): Promise<void> {
  try {
    // Category for reply/mention notifications: reply inline + like
    await Notifications.setNotificationCategoryAsync(
      NOTIFICATION_CATEGORY.REPLY,
      [
        {
          identifier: NOTIFICATION_ACTION.REPLY,
          buttonTitle: 'Reply',
          textInput: {
            submitButtonTitle: 'Send',
            placeholder: 'Write a reply...',
          },
          options: {
            opensAppToForeground: false,
          },
        },
        {
          identifier: NOTIFICATION_ACTION.LIKE,
          buttonTitle: 'Like',
          options: {
            opensAppToForeground: false,
          },
        },
      ],
    );

    await Notifications.setNotificationCategoryAsync(
      NOTIFICATION_CATEGORY.MENTION,
      [
        {
          identifier: NOTIFICATION_ACTION.REPLY,
          buttonTitle: 'Reply',
          textInput: {
            submitButtonTitle: 'Send',
            placeholder: 'Write a reply...',
          },
          options: {
            opensAppToForeground: false,
          },
        },
        {
          identifier: NOTIFICATION_ACTION.LIKE,
          buttonTitle: 'Like',
          options: {
            opensAppToForeground: false,
          },
        },
      ],
    );

    // Category for like/repost/quote notifications: like the original post
    await Notifications.setNotificationCategoryAsync(
      NOTIFICATION_CATEGORY.LIKE,
      [
        {
          identifier: NOTIFICATION_ACTION.LIKE,
          buttonTitle: 'Like',
          options: {
            opensAppToForeground: false,
          },
        },
      ],
    );

    await Notifications.setNotificationCategoryAsync(
      NOTIFICATION_CATEGORY.REPOST,
      [
        {
          identifier: NOTIFICATION_ACTION.LIKE,
          buttonTitle: 'Like',
          options: {
            opensAppToForeground: false,
          },
        },
      ],
    );

    await Notifications.setNotificationCategoryAsync(
      NOTIFICATION_CATEGORY.QUOTE,
      [
        {
          identifier: NOTIFICATION_ACTION.REPLY,
          buttonTitle: 'Reply',
          textInput: {
            submitButtonTitle: 'Send',
            placeholder: 'Write a reply...',
          },
          options: {
            opensAppToForeground: false,
          },
        },
        {
          identifier: NOTIFICATION_ACTION.LIKE,
          buttonTitle: 'Like',
          options: {
            opensAppToForeground: false,
          },
        },
      ],
    );

    // Follow notifications get no actions (nothing actionable from banner)
    await Notifications.setNotificationCategoryAsync(
      NOTIFICATION_CATEGORY.FOLLOW,
      [],
    );

    logger.log('Notification categories registered');
  } catch (error) {
    logger.error('Failed to register notification categories:', error);
  }
}

/**
 * Resolve a post URI to its full record (uri + cid) by fetching from the API.
 * Needed for reply references and like targets.
 */
async function resolvePost(
  postUri: string,
): Promise<{uri: string; cid: string} | null> {
  try {
    const client = getAtProtoClient();
    const agent = client.getAgent();
    const response = await agent.getPostThread({uri: postUri, depth: 0});
    const thread = response.data.thread;

    if (AppBskyFeedDefs.isThreadViewPost(thread)) {
      return {uri: thread.post.uri, cid: thread.post.cid};
    }
    return null;
  } catch (error) {
    logger.error('Failed to resolve post:', error);
    return null;
  }
}

/**
 * Find the root of a thread given a post URI.
 * Returns the root post reference for constructing reply records.
 */
async function resolveThreadRoot(
  postUri: string,
): Promise<{uri: string; cid: string} | null> {
  try {
    const client = getAtProtoClient();
    const agent = client.getAgent();
    const response = await agent.getPostThread({uri: postUri, depth: 0});
    const thread = response.data.thread;

    if (AppBskyFeedDefs.isThreadViewPost(thread)) {
      const post = thread.post;
      // If the post itself has a reply parent, follow to root
      const record = post.record as {reply?: {root: {uri: string; cid: string}}};
      if (record.reply?.root) {
        return record.reply.root;
      }
      // This post is itself the root
      return {uri: post.uri, cid: post.cid};
    }
    return null;
  } catch (error) {
    logger.error('Failed to resolve thread root:', error);
    return null;
  }
}

/**
 * Handle a notification action response (reply or like from the banner).
 * Returns true if the action was handled successfully.
 */
export async function handleNotificationAction(
  response: Notifications.NotificationResponse,
): Promise<boolean> {
  const actionId = response.actionIdentifier;

  // Ignore the default tap action — that's handled by navigation
  if (actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
    return false;
  }

  const data = response.notification.request.content.data as
    | Record<string, string>
    | undefined;

  if (!data) {
    logger.error('Notification action received with no data');
    return false;
  }

  try {
    switch (actionId) {
      case NOTIFICATION_ACTION.LIKE:
        return await handleLikeAction(data);

      case NOTIFICATION_ACTION.REPLY:
        return await handleReplyAction(response, data);

      default:
        logger.warn('Unknown notification action:', actionId);
        return false;
    }
  } catch (error) {
    logger.error('Error handling notification action:', error);
    return false;
  }
}

/**
 * Handle "Like" action from notification banner.
 * Likes the post referenced in the notification data.
 */
async function handleLikeAction(
  data: Record<string, string>,
): Promise<boolean> {
  // The notification data should contain the post URI to like.
  // For reply/mention notifications: like the post that replied to / mentioned us
  // For like/repost/quote: like the actor's post (the notification subject)
  const postUri = data.postUri || data.reasonSubject;

  if (!postUri) {
    logger.error('Like action: no post URI in notification data');
    return false;
  }

  const resolved = await resolvePost(postUri);
  if (!resolved) {
    logger.error('Like action: could not resolve post', postUri);
    return false;
  }

  await likePost(resolved.uri, resolved.cid);
  logger.log('Like action completed for', resolved.uri);
  return true;
}

/**
 * Handle "Reply" action from notification banner (inline text input).
 * Creates a reply post with the user's text.
 */
async function handleReplyAction(
  response: Notifications.NotificationResponse,
  data: Record<string, string>,
): Promise<boolean> {
  // Get the text the user typed in the inline input
  const userInput =
    response.userText ??
    (response as any).notification?.request?.content?.data?.userText;

  if (!userInput || userInput.trim().length === 0) {
    logger.log('Reply action: no text provided, ignoring');
    return false;
  }

  // The post we're replying to
  const postUri = data.postUri || data.reasonSubject;

  if (!postUri) {
    logger.error('Reply action: no post URI in notification data');
    return false;
  }

  // Resolve the parent post (the one we're replying to)
  const parent = await resolvePost(postUri);
  if (!parent) {
    logger.error('Reply action: could not resolve parent post', postUri);
    return false;
  }

  // Resolve the thread root
  const root = await resolveThreadRoot(postUri);
  if (!root) {
    logger.error('Reply action: could not resolve thread root', postUri);
    return false;
  }

  await createPost({
    text: userInput.trim(),
    reply: {
      root,
      parent,
    },
  });

  logger.log('Reply action completed');
  return true;
}
