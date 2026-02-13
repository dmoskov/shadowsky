import { differenceInHours, differenceInMinutes } from "date-fns";
import { AggregatedEvent } from "./types";

// Smart aggregation based on notification type and context
export function aggregateNotifications(
  allNotifications: any[],
  postMap: Map<string, any>,
): AggregatedEvent[] {
  if (!allNotifications || allNotifications.length === 0) return [];

  const events: AggregatedEvent[] = [];
  const sorted = [...allNotifications].sort(
    (a, b) => new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime(),
  );

  // First pass: Group notifications by user to identify user activity bursts
  const userActivityGroups = new Map<string, any[]>();
  const userActivityTimeWindows = new Map<string, { start: Date; end: Date }>();

  sorted.forEach((notification) => {
    const userKey =
      notification.author?.handle || notification.author?.did || "unknown";
    const notifTime = new Date(notification.indexedAt);

    if (!userActivityGroups.has(userKey)) {
      userActivityGroups.set(userKey, []);
      userActivityTimeWindows.set(userKey, {
        start: notifTime,
        end: notifTime,
      });
    } else {
      const timeWindow = userActivityTimeWindows.get(userKey)!;
      // Check if this notification is within 30 minutes of the previous activity from this user
      if (differenceInMinutes(timeWindow.end, notifTime) <= 30) {
        // Part of the same activity burst
        userActivityGroups.get(userKey)!.push(notification);
        timeWindow.start =
          notifTime < timeWindow.start ? notifTime : timeWindow.start;
        timeWindow.end =
          notifTime > timeWindow.end ? notifTime : timeWindow.end;
      } else {
        // Too far apart, treat as separate activity
        // Process the previous burst if it qualifies
        const userNotifs = userActivityGroups.get(userKey)!;
        if (userNotifs.length >= 3) {
          // Create user activity event for previous burst
          const affectedPosts = new Map<string, any>();
          userNotifs.forEach((n) => {
            const postUri =
              (n.reason === "repost" || n.reason === "like") && n.reasonSubject
                ? n.reasonSubject
                : n.uri;
            if (postUri && !affectedPosts.has(postUri)) {
              const post = postMap.get(postUri);
              const hasImages =
                post?.embed?.$type === "app.bsky.embed.images#view" ||
                (post?.embed?.$type === "app.bsky.embed.recordWithMedia#view" &&
                  post?.embed?.media?.$type === "app.bsky.embed.images#view");
              const hasVideo =
                post?.embed?.$type === "app.bsky.embed.video#view" ||
                (post?.embed?.$type === "app.bsky.embed.recordWithMedia#view" &&
                  post?.embed?.media?.$type === "app.bsky.embed.video#view");
              const hasExternal =
                post?.embed?.$type === "app.bsky.embed.external#view" ||
                (post?.embed?.$type === "app.bsky.embed.recordWithMedia#view" &&
                  post?.embed?.media?.$type === "app.bsky.embed.external#view");
              affectedPosts.set(postUri, {
                uri: postUri,
                text: post?.record?.text,
                hasImages,
                hasVideo,
                hasExternal,
              });
            }
          });

          events.push({
            time: timeWindow.end,
            notifications: [...userNotifs],
            types: new Set(userNotifs.map((n) => n.reason)),
            actors: new Set([userKey]),
            aggregationType: "user-activity",
            earliestTime: timeWindow.start,
            latestTime: timeWindow.end,
            primaryActor: {
              handle: userNotifs[0].author?.handle || "unknown",
              displayName: userNotifs[0].author?.displayName,
              avatar: userNotifs[0].author?.avatar,
            },
            affectedPosts: Array.from(affectedPosts.values()),
          });
        }
        // Start new burst
        userActivityGroups.set(userKey, [notification]);
        userActivityTimeWindows.set(userKey, {
          start: notifTime,
          end: notifTime,
        });
      }
    }
  });

  // Process remaining user activity bursts
  userActivityGroups.forEach((notifications, userKey) => {
    if (notifications.length >= 3) {
      const timeWindow = userActivityTimeWindows.get(userKey)!;
      const affectedPosts = new Map<string, any>();
      notifications.forEach((n) => {
        const postUri =
          (n.reason === "repost" || n.reason === "like") && n.reasonSubject
            ? n.reasonSubject
            : n.uri;
        if (postUri && !affectedPosts.has(postUri)) {
          const post = postMap.get(postUri);
          const hasImages =
            post?.embed?.$type === "app.bsky.embed.images#view" ||
            (post?.embed?.$type === "app.bsky.embed.recordWithMedia#view" &&
              post?.embed?.media?.$type === "app.bsky.embed.images#view");
          const hasVideo =
            post?.embed?.$type === "app.bsky.embed.video#view" ||
            (post?.embed?.$type === "app.bsky.embed.recordWithMedia#view" &&
              post?.embed?.media?.$type === "app.bsky.embed.video#view");
          const hasExternal =
            post?.embed?.$type === "app.bsky.embed.external#view" ||
            (post?.embed?.$type === "app.bsky.embed.recordWithMedia#view" &&
              post?.embed?.media?.$type === "app.bsky.embed.external#view");
          affectedPosts.set(postUri, {
            uri: postUri,
            text: post?.record?.text,
            hasImages,
            hasVideo,
            hasExternal,
          });
        }
      });

      events.push({
        time: timeWindow.end,
        notifications: [...notifications],
        types: new Set(notifications.map((n) => n.reason)),
        actors: new Set([userKey]),
        aggregationType: "user-activity",
        earliestTime: timeWindow.start,
        latestTime: timeWindow.end,
        primaryActor: {
          handle: notifications[0].author?.handle || "unknown",
          displayName: notifications[0].author?.displayName,
          avatar: notifications[0].author?.avatar,
        },
        affectedPosts: Array.from(affectedPosts.values()),
      });
    }
  });

  // Now handle remaining notifications that aren't part of user activity bursts
  const handledNotifications = new Set<string>();
  events.forEach((event) => {
    event.notifications.forEach((n) => handledNotifications.add(n.uri));
  });

  // Group remaining notifications by post URI to identify post bursts
  const postGroups = new Map<string, any[]>();
  const followGroups: any[] = [];
  const otherNotifications: any[] = [];

  sorted.forEach((notification) => {
    if (handledNotifications.has(notification.uri)) return;

    if (["like", "repost", "quote", "reply"].includes(notification.reason)) {
      // For likes and reposts, use reasonSubject which contains the original post URI
      const postUri =
        (notification.reason === "repost" || notification.reason === "like") &&
        notification.reasonSubject
          ? notification.reasonSubject
          : notification.uri;

      if (postUri) {
        if (!postGroups.has(postUri)) {
          postGroups.set(postUri, []);
        }
        postGroups.get(postUri)!.push(notification);
      }
    } else if (notification.reason === "follow") {
      followGroups.push(notification);
    } else {
      otherNotifications.push(notification);
    }
  });

  // Process post groups to create burst events
  postGroups.forEach((notifications, postUri) => {
    if (notifications.length >= 3) {
      // This is a burst of activity on a single post
      const times = notifications.map((n) => new Date(n.indexedAt).getTime());
      const earliestTime = new Date(Math.min(...times));
      const latestTime = new Date(Math.max(...times));
      const timeSpanHours = differenceInHours(latestTime, earliestTime);

      // Determine burst intensity based on notification count and time span
      let burstIntensity: "low" | "medium" | "high" = "low";
      if (notifications.length >= 10 && timeSpanHours <= 6) {
        burstIntensity = "high";
      } else if (notifications.length >= 5 && timeSpanHours <= 12) {
        burstIntensity = "medium";
      }

      // Get post text from post map if available
      const post = postMap.get(postUri);
      const postText = post?.record?.text;

      const burstEvent: AggregatedEvent = {
        time: latestTime, // Use latest time for sorting
        notifications: notifications,
        types: new Set(notifications.map((n) => n.reason)),
        actors: new Set(
          notifications.map((n) => n.author?.handle || "unknown"),
        ),
        postUri: postUri,
        aggregationType: "post-burst",
        earliestTime: earliestTime,
        latestTime: latestTime,
        burstIntensity: burstIntensity,
        postText: postText,
      };
      events.push(burstEvent);
    } else {
      // Too few notifications for a burst, create individual or small grouped events
      notifications.forEach((notification) => {
        events.push({
          time: new Date(notification.indexedAt),
          notifications: [notification],
          types: new Set([notification.reason]),
          actors: new Set([notification.author?.handle || "unknown"]),
          postUri: postUri,
          aggregationType: "post",
        });
      });
    }
  });

  // Process follow notifications with wider time window
  const followBursts: any[] = [];
  let currentFollowBurst: any[] = [];

  followGroups.forEach((notification, index) => {
    if (currentFollowBurst.length === 0) {
      currentFollowBurst.push(notification);
    } else {
      const lastTime = new Date(
        currentFollowBurst[currentFollowBurst.length - 1].indexedAt,
      );
      const currentTime = new Date(notification.indexedAt);

      // Group follows within 2 hours
      if (differenceInHours(lastTime, currentTime) <= 2) {
        currentFollowBurst.push(notification);
      } else {
        // Save current burst and start new one
        if (currentFollowBurst.length > 0) {
          followBursts.push([...currentFollowBurst]);
        }
        currentFollowBurst = [notification];
      }
    }

    // Save last burst
    if (index === followGroups.length - 1 && currentFollowBurst.length > 0) {
      followBursts.push(currentFollowBurst);
    }
  });

  // Create events for follow bursts
  followBursts.forEach((burst) => {
    if (burst.length >= 2) {
      const times = burst.map((n: any) => new Date(n.indexedAt).getTime());
      const latestTime = new Date(Math.max(...times));

      events.push({
        time: latestTime,
        notifications: burst,
        types: new Set(["follow"]),
        actors: new Set(burst.map((n: any) => n.author?.handle || "unknown")),
        aggregationType: "follow",
        earliestTime: new Date(Math.min(...times)),
        latestTime: latestTime,
      });
    } else {
      // Single follow
      events.push({
        time: new Date(burst[0].indexedAt),
        notifications: burst,
        types: new Set(["follow"]),
        actors: new Set([burst[0].author?.handle || "unknown"]),
        aggregationType: "follow",
      });
    }
  });

  // Group recent comments (replies and quotes) by time window
  const recentCommentWindow = 30; // 30 minutes window for comment grouping
  const commentNotifications = otherNotifications.filter(
    (n) => n.reason === "reply" || n.reason === "quote",
  );
  const nonCommentNotifications = otherNotifications.filter(
    (n) => n.reason !== "reply" && n.reason !== "quote",
  );

  // Sort comments by time for proper grouping
  commentNotifications.sort(
    (a, b) => new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime(),
  );

  const commentGroups: any[] = [];
  const processedComments = new Set<string>();

  commentNotifications.forEach((notification) => {
    if (processedComments.has(notification.uri)) return;

    // Start a new group with this comment
    const group = [notification];
    processedComments.add(notification.uri);

    // Find other comments within the time window
    const notifTime = new Date(notification.indexedAt);

    commentNotifications.forEach((otherNotif) => {
      if (processedComments.has(otherNotif.uri)) return;

      const otherTime = new Date(otherNotif.indexedAt);
      const timeDiff = Math.abs(differenceInMinutes(notifTime, otherTime));

      if (timeDiff <= recentCommentWindow) {
        group.push(otherNotif);
        processedComments.add(otherNotif.uri);
      }
    });

    if (group.length >= 3) {
      // Only aggregate if 3 or more comments
      commentGroups.push(group);
    } else {
      // Add back as individual notifications
      group.forEach((n) => {
        processedComments.delete(n.uri); // Remove from processed so they can be added individually
      });
    }
  });

  // Create aggregated comment events
  commentGroups.forEach((group) => {
    const times = group.map((n: any) => new Date(n.indexedAt).getTime());
    const latestTime = new Date(Math.max(...times));
    const earliestTime = new Date(Math.min(...times));

    events.push({
      time: latestTime,
      notifications: group,
      types: new Set(group.map((n: any) => n.reason)),
      actors: new Set(group.map((n: any) => n.author?.handle || "unknown")),
      aggregationType: "recent-comments",
      earliestTime: earliestTime,
      latestTime: latestTime,
    });
  });

  // Add non-aggregated comments and other notifications as individual events
  [
    ...commentNotifications.filter((n) => !processedComments.has(n.uri)),
    ...nonCommentNotifications,
  ].forEach((notification) => {
    events.push({
      time: new Date(notification.indexedAt),
      notifications: [notification],
      types: new Set([notification.reason]),
      actors: new Set([notification.author?.handle || "unknown"]),
      aggregationType: "mixed",
    });
  });

  // Sort all events by time (newest first)
  events.sort((a, b) => b.time.getTime() - a.time.getTime());

  return events;
}

// Group events by day
export function groupEventsByDay(
  aggregatedEvents: AggregatedEvent[],
  getTimeLabel: (date: Date) => string,
) {
  const groups: {
    [key: string]: { label: string; events: AggregatedEvent[] };
  } = {};

  aggregatedEvents.forEach((event) => {
    const dayKey = getTimeLabel(event.time);
    if (!groups[dayKey]) {
      groups[dayKey] = { label: dayKey, events: [] };
    }
    groups[dayKey].events.push(event);
  });

  return Object.values(groups);
}
