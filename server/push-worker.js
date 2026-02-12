/**
 * Push Notification Worker
 *
 * Polls Bluesky notifications for users and sends push notifications via Expo Push Service
 */

const { BskyAgent } = require('@atproto/api');
const fetch = require('node-fetch');
require('dotenv').config();

// Configuration
const POLL_INTERVAL = 30000; // 30 seconds (much faster than 60s polling)
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const MAX_BATCH_SIZE = 100; // Expo allows up to 100 notifications per request

// In-memory cache of user notification states
// In production, this should be stored in Redis or a database
const userNotificationStates = new Map();

/**
 * Get all push token records from AT Protocol
 * This is a simplified version - in production, you'd maintain a database of tokens
 */
async function getUserPushTokens() {
  // For now, return empty array
  // In a full implementation, you would:
  // 1. Maintain a database of user DIDs and their push tokens
  // 2. Users would register their tokens when they log in
  // 3. This function would query that database
  return [];
}

/**
 * Get unread notification count for a user
 */
async function getUnreadCount(agent) {
  try {
    const response = await agent.countUnreadNotifications();
    return response.data.count || 0;
  } catch (error) {
    console.error('Error getting unread count:', error.message);
    return 0;
  }
}

/**
 * Get recent notifications for a user
 */
async function getRecentNotifications(agent, limit = 10) {
  try {
    const response = await agent.listNotifications({
      limit,
    });
    return response.data.notifications || [];
  } catch (error) {
    console.error('Error getting notifications:', error.message);
    return [];
  }
}

/**
 * Send push notification via Expo Push Service
 */
async function sendExpoPushNotification(pushToken, notification) {
  try {
    const message = {
      to: pushToken,
      sound: 'default',
      title: notification.title,
      body: notification.body,
      data: notification.data,
      badge: notification.badge,
      priority: 'high',
      channelId: 'default',
    };

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();

    if (result.data && result.data.status === 'error') {
      console.error('Expo push error:', result.data.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending push notification:', error.message);
    return false;
  }
}

/**
 * Send batch of push notifications via Expo Push Service
 */
async function sendBatchExpoPushNotifications(messages) {
  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error('Error sending batch push notifications:', error.message);
    return [];
  }
}

/**
 * Process notifications for a user
 */
async function processUserNotifications(userConfig) {
  const { did, handle, pushToken, credentials } = userConfig;

  try {
    // Create agent for this user
    const agent = new BskyAgent({
      service: 'https://bsky.social',
    });

    // Resume session
    if (credentials && credentials.accessJwt) {
      agent.session = credentials;
    } else {
      console.log(`No valid session for user ${handle}`);
      return;
    }

    // Get current unread count
    const currentCount = await getUnreadCount(agent);

    // Get last known count from cache
    const lastState = userNotificationStates.get(did) || {
      count: 0,
      lastCheck: null,
    };

    // If count increased, we have new notifications
    if (currentCount > lastState.count) {
      const newCount = currentCount - lastState.count;

      // Get recent notifications to build a meaningful message
      const recentNotifications = await getRecentNotifications(agent, 5);

      let title = 'New Notifications';
      let body = `You have ${newCount} new ${newCount === 1 ? 'notification' : 'notifications'}`;

      // If we have recent notifications, show the most recent one
      if (recentNotifications.length > 0) {
        const latest = recentNotifications[0];
        const author = latest.author?.handle || 'Someone';

        switch (latest.reason) {
          case 'like':
            title = `${author} liked your post`;
            break;
          case 'repost':
            title = `${author} reposted your post`;
            break;
          case 'follow':
            title = `${author} followed you`;
            break;
          case 'mention':
            title = `${author} mentioned you`;
            break;
          case 'reply':
            title = `${author} replied to your post`;
            break;
          case 'quote':
            title = `${author} quoted your post`;
            break;
          default:
            title = 'New Notification';
        }

        if (newCount > 1) {
          body = `${title} and ${newCount - 1} more`;
          title = 'New Notifications';
        }
      }

      // Send push notification
      const sent = await sendExpoPushNotification(pushToken, {
        title,
        body,
        data: {
          type: 'notification',
          count: currentCount,
        },
        badge: currentCount,
      });

      if (sent) {
        console.log(`Sent push notification to ${handle} (${newCount} new)`);
      }
    }

    // Update cache
    userNotificationStates.set(did, {
      count: currentCount,
      lastCheck: new Date().toISOString(),
    });

  } catch (error) {
    console.error(`Error processing notifications for ${handle}:`, error.message);
  }
}

/**
 * Poll all users for new notifications
 */
async function pollAllUsers() {
  try {
    const users = await getUserPushTokens();

    if (users.length === 0) {
      return;
    }

    console.log(`Polling notifications for ${users.length} users...`);

    // Process users in parallel (with reasonable concurrency)
    const CONCURRENCY = 10;
    for (let i = 0; i < users.length; i += CONCURRENCY) {
      const batch = users.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(processUserNotifications));
    }

  } catch (error) {
    console.error('Error in poll cycle:', error.message);
  }
}

/**
 * Start the push notification worker
 */
function startWorker() {
  console.log('Push Notification Worker starting...');
  console.log(`Poll interval: ${POLL_INTERVAL}ms`);

  // Initial poll
  pollAllUsers();

  // Set up interval
  setInterval(pollAllUsers, POLL_INTERVAL);

  console.log('Push Notification Worker started');
}

/**
 * Graceful shutdown
 */
function shutdown() {
  console.log('Push Notification Worker shutting down...');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start the worker if this is the main module
if (require.main === module) {
  startWorker();
}

module.exports = {
  startWorker,
  processUserNotifications,
  sendExpoPushNotification,
  getUserPushTokens,
};
