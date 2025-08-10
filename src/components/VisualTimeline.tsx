import { useQuery } from "@tanstack/react-query";
import {
  differenceInHours,
  differenceInMinutes,
  format,
  formatDistanceToNow,
  isToday,
  isYesterday,
} from "date-fns";
import {
  ExternalLink,
  Heart,
  MessageCircle,
  Quote,
  Repeat2,
  UserPlus,
} from "lucide-react";
import React from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNotificationPosts } from "../hooks/useNotificationPosts";
import { proxifyBskyImage } from "../utils/image-proxy";
import { ThreadModal } from "./ThreadModal";

interface AggregatedEvent {
  time: Date;
  notifications: any[];
  types: Set<string>;
  actors: Set<string>;
  postUri?: string; // For post-specific aggregations
  aggregationType: "post" | "follow" | "mixed" | "post-burst" | "user-activity"; // Type of aggregation
  earliestTime?: Date; // Track the earliest notification in the group
  latestTime?: Date; // Track the latest notification in the group
  burstIntensity?: "low" | "medium" | "high"; // For post bursts
  postText?: string; // Cache the post text for burst events
  primaryActor?: {
    // For user activity aggregation
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  affectedPosts?: Array<{
    // Posts affected by user activity
    uri: string;
    text?: string;
  }>;
}

// Helper function to extract handle and rkey from AT URI
const parseAtUri = (uri: string) => {
  const match = uri.match(/at:\/\/(.+?)\/(.+?)\/(.+)/);
  if (!match) return null;
  return {
    did: match[1],
    collection: match[2],
    rkey: match[3],
  };
};

// Helper function to generate Bluesky app URL for a post
const getPostUrl = (uri: string, authorHandle?: string) => {
  const parsed = parseAtUri(uri);
  if (!parsed || !authorHandle) return null;

  // Bluesky post URLs follow the pattern: https://bsky.app/profile/{handle}/post/{rkey}
  return `https://bsky.app/profile/${authorHandle}/post/${parsed.rkey}`;
};

// Helper function to generate Bluesky app URL for a profile
const getProfileUrl = (handle: string) => {
  // Remove @ if present
  const cleanHandle = handle.startsWith("@") ? handle.slice(1) : handle;
  return `https://bsky.app/profile/${cleanHandle}`;
};

interface VisualTimelineProps {
  hideTimeLabels?: boolean;
  isInSkyDeck?: boolean;
  isFocused?: boolean;
  onClose?: () => void;
}

export const VisualTimeline: React.FC<VisualTimelineProps> = ({
  hideTimeLabels = false,
  isInSkyDeck = false,
  isFocused = true,
}) => {
  const { agent } = useAuth();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const timelineItemsRef = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const [selectedItemIndex, setSelectedItemIndex] = React.useState<number>(-1);
  const [selectedPostUri, setSelectedPostUri] = React.useState<string | null>(
    null,
  );
  const [dayGroupColors, setDayGroupColors] = React.useState<
    Map<string, { color: string; position: number }>
  >(new Map());
  // Removed expandedItems state - cards are always expanded

  const { data, isLoading } = useQuery({
    queryKey: ["notifications-visual-timeline"],
    queryFn: async () => {
      if (!agent) throw new Error("Not authenticated");
      const response = await agent.listNotifications({ limit: 100 });
      return response.data;
    },
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: "always", // Always fetch fresh data on mount
    refetchInterval: 60 * 1000, // Poll every 60 seconds after initial load
    enabled: !!agent, // Only run when agent is available
  });

  // Get notifications from the response
  const notifications = data?.notifications || [];

  // Fetch posts for notifications to show richer content
  const { data: posts } = useNotificationPosts(notifications);

  // Create a map for quick post lookup
  const postMap = React.useMemo(() => {
    if (!posts) return new Map();
    return new Map(posts.map((post) => [post.uri, post]));
  }, [posts]);

  // Smart aggregation based on notification type and context
  const aggregatedEvents = React.useMemo(() => {
    if (!data?.notifications) return [];

    const events: AggregatedEvent[] = [];
    const sorted = [...data.notifications].sort(
      (a, b) =>
        new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime(),
    );

    // First pass: Group notifications by user to identify user activity bursts
    const userActivityGroups = new Map<string, any[]>();
    const userActivityTimeWindows = new Map<
      string,
      { start: Date; end: Date }
    >();

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
                (n.reason === "repost" || n.reason === "like") &&
                n.reasonSubject
                  ? n.reasonSubject
                  : n.uri;
              if (postUri && !affectedPosts.has(postUri)) {
                const post = postMap.get(postUri);
                affectedPosts.set(postUri, {
                  uri: postUri,
                  text: post?.record?.text,
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
            affectedPosts.set(postUri, {
              uri: postUri,
              text: post?.record?.text,
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
          (notification.reason === "repost" ||
            notification.reason === "like") &&
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

    // Add other notifications as individual events
    otherNotifications.forEach((notification) => {
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
  }, [data, postMap]);

  // Calculate visual spacing based on time gaps
  const getSpacingClass = (currentTime: Date, previousTime?: Date) => {
    if (!previousTime) return "";

    const hoursDiff = differenceInHours(previousTime, currentTime);

    if (hoursDiff >= 24) return "mt-12";
    if (hoursDiff >= 12) return "mt-8";
    if (hoursDiff >= 6) return "mt-6";
    if (hoursDiff >= 3) return "mt-4";
    if (hoursDiff >= 1) return "mt-3";
    return "mt-2";
  };

  const getTimeLabel = (date: Date) => {
    if (isToday(date)) return "Today";
    if (isYesterday(date)) return "Yesterday";
    return format(date, "EEEE, MMMM d");
  };

  const getTimeOfDay = (date: Date) => {
    const hour = date.getHours();

    if (hour >= 5 && hour < 9) return "Early morning";
    if (hour >= 9 && hour < 12) return "Morning";
    if (hour >= 12 && hour < 14) return "Noon";
    if (hour >= 14 && hour < 17) return "Afternoon";
    if (hour >= 17 && hour < 20) return "Evening";
    if (hour >= 20 && hour < 24) return "Night";
    return "Late night";
  };

  const isDayTime = (date: Date) => {
    const hour = date.getHours();
    return hour >= 6 && hour < 18;
  };

  // Get a color based on the time of day with smooth transitions
  const getTimeOfDayColor = (date: Date) => {
    const hour = date.getHours();
    const minute = date.getMinutes();
    const timeValue = hour + minute / 60; // Convert to decimal hours

    // Define color stops for different times of day (REVERSED for newest-first display)
    const colorStops = [
      {
        time: 0,
        bg: "rgba(25, 39, 77, 0.15)",
        border: "rgba(55, 65, 81, 0.3)",
        shadow: "rgba(17, 24, 39, 0.2)",
      }, // Midnight - deep blue
      {
        time: 4,
        bg: "rgba(99, 102, 241, 0.1)",
        border: "rgba(79, 70, 229, 0.25)",
        shadow: "rgba(67, 56, 202, 0.15)",
      }, // Early morning - purple (was evening)
      {
        time: 6,
        bg: "rgba(165, 180, 252, 0.1)",
        border: "rgba(129, 140, 248, 0.25)",
        shadow: "rgba(99, 102, 241, 0.15)",
      }, // Dawn - light purple (was dusk)
      {
        time: 8,
        bg: "rgba(251, 207, 232, 0.1)",
        border: "rgba(244, 114, 182, 0.25)",
        shadow: "rgba(236, 72, 153, 0.15)",
      }, // Early morning - pink (was sunset)
      {
        time: 10,
        bg: "rgba(254, 215, 170, 0.1)",
        border: "rgba(251, 191, 36, 0.25)",
        shadow: "rgba(245, 158, 11, 0.15)",
      }, // Morning - orange (was afternoon)
      {
        time: 12,
        bg: "rgba(254, 240, 138, 0.1)",
        border: "rgba(253, 224, 71, 0.3)",
        shadow: "rgba(250, 204, 21, 0.2)",
      }, // Noon - bright yellow
      {
        time: 15,
        bg: "rgba(254, 243, 199, 0.1)",
        border: "rgba(252, 211, 77, 0.25)",
        shadow: "rgba(251, 191, 36, 0.15)",
      }, // Afternoon - warm yellow (was morning)
      {
        time: 17,
        bg: "rgba(251, 207, 232, 0.1)",
        border: "rgba(249, 168, 212, 0.25)",
        shadow: "rgba(236, 72, 153, 0.15)",
      }, // Sunset - light pink (was early morning)
      {
        time: 19,
        bg: "rgba(236, 72, 153, 0.1)",
        border: "rgba(244, 114, 182, 0.25)",
        shadow: "rgba(219, 39, 119, 0.15)",
      }, // Dusk - pink (was dawn)
      {
        time: 21,
        bg: "rgba(49, 46, 129, 0.15)",
        border: "rgba(79, 70, 229, 0.25)",
        shadow: "rgba(55, 48, 163, 0.2)",
      }, // Evening - indigo (was early morning)
      {
        time: 24,
        bg: "rgba(25, 39, 77, 0.15)",
        border: "rgba(55, 65, 81, 0.3)",
        shadow: "rgba(17, 24, 39, 0.2)",
      }, // Back to midnight
    ];

    // Find the two color stops we're between
    let prevStop = colorStops[0];
    let nextStop = colorStops[1];

    for (let i = 0; i < colorStops.length - 1; i++) {
      if (
        timeValue >= colorStops[i].time &&
        timeValue < colorStops[i + 1].time
      ) {
        prevStop = colorStops[i];
        nextStop = colorStops[i + 1];
        break;
      }
    }

    // Calculate interpolation factor
    const factor =
      (timeValue - prevStop.time) / (nextStop.time - prevStop.time);

    // Helper function to interpolate between two rgba values
    const interpolateRgba = (start: string, end: string, factor: number) => {
      // Extract rgba values using regex
      const startMatch = start.match(
        /rgba?\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/,
      );
      const endMatch = end.match(
        /rgba?\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/,
      );

      if (!startMatch || !endMatch) return start;

      const r = Math.round(
        parseInt(startMatch[1]) +
          (parseInt(endMatch[1]) - parseInt(startMatch[1])) * factor,
      );
      const g = Math.round(
        parseInt(startMatch[2]) +
          (parseInt(endMatch[2]) - parseInt(startMatch[2])) * factor,
      );
      const b = Math.round(
        parseInt(startMatch[3]) +
          (parseInt(endMatch[3]) - parseInt(startMatch[3])) * factor,
      );
      const a =
        parseFloat(startMatch[4]) +
        (parseFloat(endMatch[4]) - parseFloat(startMatch[4])) * factor;

      return `rgba(${r}, ${g}, ${b}, ${a})`;
    };

    return {
      backgroundColor: interpolateRgba(prevStop.bg, nextStop.bg, factor),
      borderColor: interpolateRgba(prevStop.border, nextStop.border, factor),
      shadowColor: interpolateRgba(prevStop.shadow, nextStop.shadow, factor),
    };
  };

  const getReasonIcon = (reason: string) => {
    switch (reason) {
      case "like":
        return (
          <Heart size={14} style={{ color: "var(--bsky-text-secondary)" }} />
        );
      case "repost":
        return (
          <Repeat2 size={14} style={{ color: "var(--bsky-text-secondary)" }} />
        );
      case "follow":
        return (
          <UserPlus size={14} style={{ color: "var(--bsky-text-secondary)" }} />
        );
      case "reply":
        return (
          <MessageCircle
            size={14}
            style={{ color: "var(--bsky-text-secondary)" }}
          />
        );
      case "quote":
        return (
          <Quote size={14} style={{ color: "var(--bsky-text-secondary)" }} />
        );
      case "starterpack-joined":
        return (
          <UserPlus size={14} style={{ color: "var(--bsky-text-secondary)" }} />
        );
      case "verified":
        return (
          <MessageCircle
            size={14}
            style={{ color: "var(--bsky-text-secondary)" }}
          />
        );
      case "unverified":
        return (
          <MessageCircle
            size={14}
            style={{ color: "var(--bsky-text-secondary)" }}
          />
        );
      case "like-via-repost":
        return (
          <Heart size={14} style={{ color: "var(--bsky-text-secondary)" }} />
        );
      case "repost-via-repost":
        return (
          <Repeat2 size={14} style={{ color: "var(--bsky-text-secondary)" }} />
        );
      default:
        return (
          <MessageCircle
            size={14}
            style={{ color: "var(--bsky-text-secondary)" }}
          />
        );
    }
  };

  // Group events by day - must be before conditional returns
  const eventsByDay = React.useMemo(() => {
    const groups: {
      [key: string]: { label: string; events: typeof aggregatedEvents };
    } = {};

    aggregatedEvents.forEach((event) => {
      const dayLabel = getTimeLabel(event.time);
      if (!groups[dayLabel]) {
        groups[dayLabel] = { label: dayLabel, events: [] };
      }
      groups[dayLabel].events.push(event);
    });

    return Object.values(groups);
  }, [aggregatedEvents]);

  // Flatten all events for keyboard navigation
  const allEvents = React.useMemo(() => {
    return eventsByDay.flatMap((day) => day.events);
  }, [eventsByDay]);

  // Generate unique key for each event
  const getEventKey = React.useCallback(
    (event: AggregatedEvent, index: number) => {
      return `${event.time.toISOString()}-${index}`;
    },
    [],
  );

  // Handle keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // In SkyDeck mode, check if this column is focused
      if (isInSkyDeck && !isFocused) return;

      // Only handle keyboard navigation if not in SkyDeck or focus is within the timeline
      if (
        !isInSkyDeck &&
        !containerRef.current?.contains(document.activeElement)
      )
        return;

      // Don't interfere with input fields or when modals are open
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        document.body.classList.contains("thread-modal-open") ||
        document.body.classList.contains("conversation-modal-open")
      ) {
        return;
      }

      let handled = false;
      const currentIndex = selectedItemIndex;

      switch (e.key) {
        case "ArrowDown":
        case "j": // vim-style down
          e.preventDefault();
          handled = true;
          if (currentIndex < allEvents.length - 1) {
            setSelectedItemIndex(currentIndex + 1);
          }
          break;

        case "ArrowUp":
        case "k": // vim-style up
          e.preventDefault();
          handled = true;
          if (currentIndex > 0) {
            setSelectedItemIndex(currentIndex - 1);
          } else if (currentIndex === -1 && allEvents.length > 0) {
            // If nothing selected, select last item when going up
            setSelectedItemIndex(allEvents.length - 1);
          }
          break;

        case "ArrowLeft":
        case "h": // vim-style left
          e.preventDefault();
          handled = true;
          // Scroll horizontally left
          if (containerRef.current) {
            containerRef.current.scrollBy({ left: -200, behavior: "smooth" });
          }
          break;

        case "ArrowRight":
        case "l": // vim-style right
          e.preventDefault();
          handled = true;
          // Scroll horizontally right
          if (containerRef.current) {
            containerRef.current.scrollBy({ left: 200, behavior: "smooth" });
          }
          break;

        case "Enter":
        case " ": // Space bar
          e.preventDefault();
          handled = true;
          // Open thread viewer for the selected item
          if (currentIndex >= 0 && currentIndex < allEvents.length) {
            const event = allEvents[currentIndex];
            let postUriToOpen: string | null = null;

            // For post bursts and post aggregations, use the postUri
            if (event.postUri) {
              postUriToOpen = event.postUri;
            } else if (
              event.notifications.length > 0 &&
              event.notifications[0].reason !== "follow"
            ) {
              // For single notifications or other aggregations
              const notification = event.notifications[0];
              postUriToOpen =
                (notification.reason === "repost" ||
                  notification.reason === "like") &&
                notification.reasonSubject
                  ? notification.reasonSubject
                  : notification.uri;
            }

            if (postUriToOpen) {
              setSelectedPostUri(postUriToOpen);
            }
          }
          break;

        case "Home":
          e.preventDefault();
          handled = true;
          if (allEvents.length > 0) {
            setSelectedItemIndex(0);
          }
          break;

        case "End":
          e.preventDefault();
          handled = true;
          if (allEvents.length > 0) {
            setSelectedItemIndex(allEvents.length - 1);
          }
          break;

        case "PageUp":
          e.preventDefault();
          handled = true;
          // Jump up by 5 items
          setSelectedItemIndex(Math.max(0, currentIndex - 5));
          break;

        case "PageDown":
          e.preventDefault();
          handled = true;
          // Jump down by 5 items
          setSelectedItemIndex(
            Math.min(allEvents.length - 1, currentIndex + 5),
          );
          break;

        case "Escape":
          // Clear selection
          setSelectedItemIndex(-1);
          handled = true;
          break;
      }

      // Prevent default browser scrolling if we handled the key
      if (handled) {
        e.stopPropagation();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedItemIndex, allEvents, getEventKey, isInSkyDeck, isFocused]);

  // Track visible events for dynamic dot color with smooth transitions
  React.useEffect(() => {
    const updateDayColors = () => {
      const newDayColors = new Map<
        string,
        { color: string; position: number }
      >();
      const viewportHeight = window.innerHeight;
      const viewportCenter = viewportHeight / 2;

      // Get all day groups
      const dayGroups = document.querySelectorAll("[data-day-group]");

      dayGroups.forEach((dayGroup) => {
        const dayLabel = dayGroup.getAttribute("data-day-group");
        if (!dayLabel) return;

        const events = dayGroup.querySelectorAll("[data-event-time]");
        let closestEvent: {
          element: Element;
          distance: number;
          time: string;
        } | null = null;
        let totalWeight = 0;
        let weightedR = 0;
        let weightedG = 0;
        let weightedB = 0;
        let weightedA = 0;

        // Find events near the viewport center and blend their colors
        events.forEach((event) => {
          const rect = event.getBoundingClientRect();
          const eventCenter = rect.top + rect.height / 2;
          const distance = Math.abs(eventCenter - viewportCenter);

          // Only consider events within viewport or slightly outside
          if (rect.bottom > -100 && rect.top < viewportHeight + 100) {
            const eventTime = event.getAttribute("data-event-time");
            if (eventTime) {
              // Calculate weight based on distance from viewport center
              const maxDistance = viewportHeight / 2;
              const weight = Math.max(0, 1 - distance / maxDistance);

              if (weight > 0) {
                const colors = getTimeOfDayColor(new Date(eventTime));
                const colorMatch = colors.borderColor.match(
                  /rgba?\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/,
                );

                if (colorMatch) {
                  totalWeight += weight;
                  weightedR += parseInt(colorMatch[1]) * weight;
                  weightedG += parseInt(colorMatch[2]) * weight;
                  weightedB += parseInt(colorMatch[3]) * weight;
                  weightedA += parseFloat(colorMatch[4]) * weight;
                }

                if (!closestEvent || distance < closestEvent.distance) {
                  closestEvent = { element: event, distance, time: eventTime };
                }
              }
            }
          }
        });

        if (totalWeight > 0) {
          // Calculate weighted average color
          const avgR = Math.round(weightedR / totalWeight);
          const avgG = Math.round(weightedG / totalWeight);
          const avgB = Math.round(weightedB / totalWeight);
          const avgA = weightedA / totalWeight;

          const blendedColor = `rgba(${avgR}, ${avgG}, ${avgB}, ${avgA})`;

          // Get the position of the day banner for smooth scrolling effect
          const dayBanner = dayGroup.querySelector(".timeline-sticky-banner");
          const bannerRect = dayBanner?.getBoundingClientRect();
          const bannerPosition = bannerRect ? bannerRect.top : 0;

          newDayColors.set(dayLabel, {
            color: blendedColor,
            position: bannerPosition,
          });
        }
      });

      setDayGroupColors(newDayColors);
    };

    // Update colors on scroll with throttling
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          updateDayColors();
          ticking = false;
        });
        ticking = true;
      }
    };

    // Initial update
    updateDayColors();

    // Listen to scroll events
    window.addEventListener("scroll", handleScroll, { passive: true });
    document
      .querySelector("main")
      ?.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      document
        .querySelector("main")
        ?.removeEventListener("scroll", handleScroll);
    };
  }, [allEvents]);

  // Make container focusable for keyboard navigation in SkyDeck
  React.useEffect(() => {
    if (containerRef.current && isInSkyDeck && isFocused) {
      // Focus container when column becomes focused in SkyDeck
      // This ensures keyboard events are captured
      containerRef.current.focus();
    }
  }, [isInSkyDeck, isFocused]);

  // Scroll selected item into view
  React.useEffect(() => {
    if (selectedItemIndex >= 0 && selectedItemIndex < allEvents.length) {
      const event = allEvents[selectedItemIndex];
      const eventKey = getEventKey(event, selectedItemIndex);
      const element = timelineItemsRef.current.get(eventKey);

      if (element) {
        element.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        });
      }
    }
  }, [selectedItemIndex, allEvents, getEventKey]);

  // Make timeline container focusable
  React.useEffect(() => {
    if (
      containerRef.current &&
      !containerRef.current.hasAttribute("tabindex")
    ) {
      containerRef.current.setAttribute("tabindex", "0");
      containerRef.current.style.outline = "none";

      // Auto-focus in standalone mode or when focused in SkyDeck
      if (!isInSkyDeck || (isInSkyDeck && isFocused)) {
        containerRef.current.focus();
      }
    }
  }, [isInSkyDeck, isFocused]);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4">
              <div
                className="h-6 w-24 rounded"
                style={{ backgroundColor: "var(--bsky-bg-tertiary)" }}
              ></div>
              <div
                className="h-20 flex-1 rounded"
                style={{ backgroundColor: "var(--bsky-bg-tertiary)" }}
              ></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={isInSkyDeck ? "flex h-full flex-col" : "mx-auto max-w-4xl"}
      ref={containerRef}
      tabIndex={-1}
      style={{ outline: "none" }}
    >
      {/* Scrollable content wrapper */}
      <div className={isInSkyDeck ? "flex-1 overflow-y-auto" : ""}>
        <div className="relative">
          {/* Timeline line */}
          <div
            className="absolute bottom-0 left-[1.5rem] top-0 w-0.5 sm:left-[6.5rem]"
            style={{
              background:
                "linear-gradient(to bottom, var(--bsky-border-color) 0%, var(--bsky-border-color) 100%)",
              position: "relative",
            }}
          />

          {eventsByDay.map((dayGroup, dayIndex) => (
            <div key={dayGroup.label} data-day-group={dayGroup.label}>
              {/* Sticky day label */}
              <div
                className={`mb-2 px-4 py-1.5 backdrop-blur-md sm:px-6 ${!isInSkyDeck ? "timeline-sticky-banner" : "sticky"}`}
                style={{
                  ...(isInSkyDeck
                    ? {
                        position: "sticky",
                        WebkitPosition: "-webkit-sticky",
                        top: "0",
                        zIndex: 30,
                      }
                    : {}),
                  backgroundColor: "var(--bsky-bg-primary)",
                  borderBottom: "1px solid var(--bsky-border-color)",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                  // iOS Safari fixes
                  transform: "translateZ(0)",
                  willChange: "transform",
                }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 w-2 rounded-full transition-all duration-700 ease-out"
                    style={{
                      backgroundColor: dayGroupColors.get(dayGroup.label)?.color
                        ? dayGroupColors
                            .get(dayGroup.label)!
                            .color.replace(/[\d.]+\)$/, "1)")
                        : dayGroup.events.length > 0
                          ? getTimeOfDayColor(
                              dayGroup.events[0].time,
                            ).borderColor.replace(/[\d.]+\)$/, "1)")
                          : "var(--bsky-primary)",
                      boxShadow: dayGroupColors.get(dayGroup.label)?.color
                        ? `0 0 8px ${dayGroupColors.get(dayGroup.label)!.color.replace(/[\d.]+\)$/, "0.4)")}`
                        : "none",
                      transform: "scale(1)",
                    }}
                  />
                  <h2
                    className="text-sm font-semibold uppercase tracking-wide"
                    style={{ color: "var(--bsky-text-secondary)" }}
                  >
                    {dayGroup.label}
                  </h2>
                </div>
              </div>

              {/* Events for this day */}
              {dayGroup.events.map((event, eventIndex) => {
                const previousEvent =
                  eventIndex > 0
                    ? dayGroup.events[eventIndex - 1]
                    : dayIndex > 0
                      ? eventsByDay[dayIndex - 1].events[
                          eventsByDay[dayIndex - 1].events.length - 1
                        ]
                      : null;
                const spacingClass = getSpacingClass(
                  event.time,
                  previousEvent?.time,
                );

                // Calculate the global index for this event
                let globalIndex = 0;
                for (let i = 0; i < dayIndex; i++) {
                  globalIndex += eventsByDay[i].events.length;
                }
                globalIndex += eventIndex;

                const eventKey = getEventKey(event, globalIndex);
                const isSelected = selectedItemIndex === globalIndex;
                const isExpanded = true; // Cards are always expanded

                return (
                  <div
                    key={eventKey}
                    className={`relative ${spacingClass} transition-transform duration-200 ease-out ${isSelected ? "z-10" : ""}`}
                    data-day-label={dayGroup.label}
                    data-event-time={event.time.toISOString()}
                    ref={(el) => {
                      if (el) {
                        timelineItemsRef.current.set(eventKey, el);
                      } else {
                        timelineItemsRef.current.delete(eventKey);
                      }
                    }}
                  >
                    {/* Time and event */}
                    <div className="flex animate-fade-in-up items-start gap-2 px-4 sm:gap-4 sm:px-6">
                      {/* Time - hide text on mobile, show only on desktop */}
                      <div
                        className={`${hideTimeLabels ? "w-3" : "w-3 sm:w-20"} pt-2 text-right font-mono text-xs tracking-wider sm:text-sm`}
                      >
                        {!hideTimeLabels && (
                          <span
                            className="hidden font-medium sm:inline"
                            style={{
                              color: isDayTime(event.time)
                                ? "#d97706"
                                : "#6366f1",
                              opacity: 0.8,
                            }}
                          >
                            {getTimeOfDay(event.time)}
                          </span>
                        )}
                      </div>

                      {/* Timeline dot */}
                      <div
                        className="relative flex-shrink-0 px-1 sm:px-0"
                        style={{ paddingTop: "14px" }}
                      >
                        <div
                          className={`${event.aggregationType === "post-burst" ? "h-3 w-3" : "h-2 w-2"} rounded-full`}
                          style={{
                            backgroundColor: getTimeOfDayColor(
                              event.time,
                            ).borderColor.replace(/[\d.]+\)$/, "1)"), // Use solid color for dot
                            opacity:
                              event.aggregationType === "post-burst"
                                ? "0.9"
                                : "0.7",
                          }}
                        />
                      </div>

                      {/* Event card */}
                      <div
                        className={`flex-1 cursor-pointer rounded-lg p-3 transition-all duration-200 ease-out ${
                          event.notifications.length > 1
                            ? "bg-bsky-bg-secondary"
                            : ""
                        } ${
                          event.aggregationType === "follow"
                            ? "border-l-[3px] border-l-bsky-follow pl-3"
                            : event.aggregationType === "post" ||
                                event.aggregationType === "post-burst"
                              ? "border-l-[3px] border-l-bsky-primary pl-3"
                              : event.aggregationType === "user-activity"
                                ? "relative overflow-hidden bg-bsky-bg-secondary"
                                : ""
                        } ${isSelected ? "relative translate-x-1 transform before:absolute before:-left-1 before:bottom-0 before:top-0 before:w-[3px] before:rounded-r-[3px] before:bg-bsky-primary before:opacity-80 before:content-['']" : ""} hover:translate-x-0.5 hover:transform hover:shadow-lg`}
                        style={{
                          backgroundColor: getTimeOfDayColor(event.time)
                            .backgroundColor,
                          border: `1px solid ${isSelected ? "var(--bsky-primary)" : getTimeOfDayColor(event.time).borderColor}`,
                          borderRadius: "8px",
                          boxShadow: isSelected
                            ? `0 0 0 2px var(--bsky-primary), 0 1px 3px ${getTimeOfDayColor(event.time).shadowColor}`
                            : `0 1px 3px ${getTimeOfDayColor(event.time).shadowColor}`,
                        }}
                        tabIndex={isSelected ? 0 : -1}
                        aria-selected={isSelected}
                        aria-expanded={isExpanded}
                        role="button"
                        onClick={() => {
                          setSelectedItemIndex(globalIndex);
                          // Open thread viewer for post notifications
                          let postUriToOpen: string | null = null;

                          // For post bursts and post aggregations, use the postUri
                          if (event.postUri) {
                            postUriToOpen = event.postUri;
                          } else if (
                            event.notifications.length > 0 &&
                            event.notifications[0].reason !== "follow"
                          ) {
                            // For single notifications or other aggregations
                            const notification = event.notifications[0];
                            postUriToOpen =
                              (notification.reason === "repost" ||
                                notification.reason === "like") &&
                              notification.reasonSubject
                                ? notification.reasonSubject
                                : notification.uri;
                          }

                          if (postUriToOpen) {
                            setSelectedPostUri(postUriToOpen);
                          }
                        }}
                        onKeyDown={(e) => {
                          // Handle Enter/Space on the element itself
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            // Open thread viewer for post notifications
                            let postUriToOpen: string | null = null;

                            // For post bursts and post aggregations, use the postUri
                            if (event.postUri) {
                              postUriToOpen = event.postUri;
                            } else if (
                              event.notifications.length > 0 &&
                              event.notifications[0].reason !== "follow"
                            ) {
                              // For single notifications or other aggregations
                              const notification = event.notifications[0];
                              postUriToOpen =
                                (notification.reason === "repost" ||
                                  notification.reason === "like") &&
                                notification.reasonSubject
                                  ? notification.reasonSubject
                                  : notification.uri;
                            }

                            if (postUriToOpen) {
                              setSelectedPostUri(postUriToOpen);
                            }
                          }
                        }}
                      >
                        {/* Single notification */}
                        {event.notifications.length === 1 ? (
                          <div>
                            <div className="flex items-center gap-3">
                              {/* Removed expand/collapse indicator - cards are always expanded */}
                              <a
                                href={getProfileUrl(
                                  event.notifications[0].author?.handle ||
                                    "unknown",
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-shrink-0 transition-all duration-200 ease-out hover:opacity-80"
                              >
                                <img
                                  src={proxifyBskyImage(
                                    event.notifications[0].author.avatar,
                                  )}
                                  alt={
                                    event.notifications[0].author?.handle ||
                                    "unknown"
                                  }
                                  className="h-8 w-8 rounded-full"
                                />
                              </a>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  {getReasonIcon(event.notifications[0].reason)}
                                  <a
                                    href={getProfileUrl(
                                      event.notifications[0].author?.handle ||
                                        "unknown",
                                    )}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-medium hover:underline"
                                    style={{ color: "var(--bsky-primary)" }}
                                  >
                                    {event.notifications[0].author
                                      ?.displayName ||
                                      event.notifications[0].author?.handle ||
                                      "Unknown"}
                                  </a>
                                </div>
                                <div
                                  className="mt-0.5 text-xs sm:text-sm"
                                  style={{
                                    color: "var(--bsky-text-secondary)",
                                  }}
                                >
                                  {getActionText(event.notifications[0].reason)}
                                </div>
                              </div>
                            </div>
                            {/* Show post preview for single notifications too */}
                            {event.notifications[0].reason !== "follow" &&
                              isExpanded &&
                              (() => {
                                const notification = event.notifications[0];

                                // Try to get full post data first
                                // For reposts and likes, use reasonSubject which contains the original post URI
                                const postUri =
                                  (notification.reason === "repost" ||
                                    notification.reason === "like") &&
                                  notification.reasonSubject
                                    ? notification.reasonSubject
                                    : notification.uri;
                                const post = [
                                  "like",
                                  "repost",
                                  "reply",
                                  "quote",
                                ].includes(notification.reason)
                                  ? postMap.get(postUri)
                                  : undefined;

                                if (post) {
                                  // We have full post data
                                  const postUrl = getPostUrl(
                                    postUri,
                                    post.author?.handle,
                                  );
                                  return (
                                    <a
                                      href={postUrl || "#"}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="relative ml-11 mt-2 block overflow-hidden rounded p-3 transition-all duration-200 ease-out before:absolute before:bottom-0 before:left-0 before:top-0 before:w-[3px] before:bg-bsky-primary before:opacity-50 before:content-[''] hover:-translate-y-0.5 hover:opacity-90 hover:shadow-md"
                                      style={{
                                        backgroundColor:
                                          "var(--bsky-bg-tertiary)",
                                        border:
                                          "1px solid var(--bsky-border-primary)",
                                        textDecoration: "none",
                                      }}
                                    >
                                      <p
                                        className="mb-1 flex items-center gap-1 text-xs font-medium"
                                        style={{
                                          color: "var(--bsky-text-tertiary)",
                                        }}
                                      >
                                        {notification.reason === "reply"
                                          ? "Replying to your post:"
                                          : notification.reason === "quote"
                                            ? "Quoting your post:"
                                            : "Your post:"}
                                        <ExternalLink size={10} />
                                      </p>
                                      <p
                                        className="line-clamp-2 text-xs"
                                        style={{
                                          color: "var(--bsky-text-primary)",
                                        }}
                                      >
                                        {post.record?.text ||
                                          "[Post with no text]"}
                                      </p>
                                    </a>
                                  );
                                }

                                // Fallback for mentions or when post data isn't available
                                const postText =
                                  notification.record?.text ||
                                  (notification.record &&
                                  typeof notification.record === "object" &&
                                  "text" in notification.record
                                    ? (notification.record as { text?: string })
                                        .text
                                    : null);

                                if (!postText) return null;

                                return (
                                  <div
                                    className="relative ml-11 mt-2 overflow-hidden rounded p-3 before:absolute before:bottom-0 before:left-0 before:top-0 before:w-[3px] before:bg-bsky-primary before:opacity-50 before:content-['']"
                                    style={{
                                      backgroundColor:
                                        "var(--bsky-bg-tertiary)",
                                      border:
                                        "1px solid var(--bsky-border-primary)",
                                    }}
                                  >
                                    <p
                                      className="mb-1 text-xs font-medium"
                                      style={{
                                        color: "var(--bsky-text-tertiary)",
                                      }}
                                    >
                                      {notification.reason === "mention"
                                        ? "Mentioned you in:"
                                        : "Post:"}
                                    </p>
                                    <p
                                      className="line-clamp-2 text-xs"
                                      style={{
                                        color: "var(--bsky-text-primary)",
                                      }}
                                    >
                                      {postText}
                                    </p>
                                  </div>
                                );
                              })()}
                          </div>
                        ) : (
                          /* Aggregated notifications */
                          <div>
                            {/* Removed expand/collapse indicator - cards are always expanded */}
                            {event.aggregationType === "user-activity" ? (
                              // Special layout for user activity bursts
                              <div>
                                <div className="mb-3 flex items-start gap-3">
                                  <a
                                    href={getProfileUrl(
                                      event.primaryActor!.handle,
                                    )}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-shrink-0 transition-all duration-200 ease-out hover:opacity-80"
                                  >
                                    <img
                                      src={proxifyBskyImage(
                                        event.primaryActor!.avatar,
                                      )}
                                      alt={event.primaryActor!.handle}
                                      className="h-10 w-10 rounded-full"
                                      style={{
                                        border:
                                          "1px solid var(--bsky-border-color)",
                                      }}
                                    />
                                  </a>
                                  <div className="flex-1">
                                    <div className="mb-1 flex items-center gap-2">
                                      <a
                                        href={getProfileUrl(
                                          event.primaryActor!.handle,
                                        )}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-base font-bold hover:underline"
                                        style={{ color: "var(--bsky-primary)" }}
                                      >
                                        {event.primaryActor!.displayName ||
                                          event.primaryActor!.handle}
                                      </a>
                                      <span
                                        className="text-xs"
                                        style={{
                                          color: "var(--bsky-text-tertiary)",
                                        }}
                                      >
                                        • active
                                      </span>
                                    </div>
                                    <p
                                      className="text-sm"
                                      style={{
                                        color: "var(--bsky-text-secondary)",
                                      }}
                                    >
                                      {event.notifications.length} interactions
                                      over{" "}
                                      {event.earliestTime && event.latestTime
                                        ? formatDistanceToNow(
                                            event.earliestTime,
                                            { addSuffix: false },
                                          )
                                        : "time"}
                                    </p>
                                  </div>
                                </div>

                                {/* Engagement breakdown */}
                                <div
                                  className="mb-3 flex flex-wrap gap-3 text-sm"
                                  style={{
                                    color: "var(--bsky-text-secondary)",
                                  }}
                                >
                                  {event.notifications.filter(
                                    (n) => n.reason === "like",
                                  ).length > 0 && (
                                    <span>
                                      {
                                        event.notifications.filter(
                                          (n) => n.reason === "like",
                                        ).length
                                      }{" "}
                                      likes
                                    </span>
                                  )}
                                  {event.notifications.filter(
                                    (n) => n.reason === "repost",
                                  ).length > 0 && (
                                    <span>
                                      {
                                        event.notifications.filter(
                                          (n) => n.reason === "repost",
                                        ).length
                                      }{" "}
                                      reposts
                                    </span>
                                  )}
                                  {event.notifications.filter(
                                    (n) => n.reason === "reply",
                                  ).length > 0 && (
                                    <span>
                                      {
                                        event.notifications.filter(
                                          (n) => n.reason === "reply",
                                        ).length
                                      }{" "}
                                      replies
                                    </span>
                                  )}
                                  {event.notifications.filter(
                                    (n) => n.reason === "quote",
                                  ).length > 0 && (
                                    <span>
                                      {
                                        event.notifications.filter(
                                          (n) => n.reason === "quote",
                                        ).length
                                      }{" "}
                                      quotes
                                    </span>
                                  )}
                                </div>

                                {/* Affected posts */}
                                {event.affectedPosts &&
                                  event.affectedPosts.length > 0 &&
                                  isExpanded && (
                                    <div className="space-y-2">
                                      <p
                                        className="text-xs font-medium"
                                        style={{
                                          color: "var(--bsky-text-tertiary)",
                                        }}
                                      >
                                        Posts they interacted with:
                                      </p>
                                      <div className="space-y-1.5">
                                        {event.affectedPosts
                                          .slice(0, 3)
                                          .map((post, i) => {
                                            // Get the post from postMap to find its author
                                            const fullPost = postMap.get(
                                              post.uri,
                                            );
                                            const postUrl = fullPost
                                              ? getPostUrl(
                                                  post.uri,
                                                  fullPost.author?.handle,
                                                )
                                              : null;
                                            return (
                                              <a
                                                key={`${post.uri}-${i}`}
                                                href={postUrl || "#"}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="line-clamp-2 block rounded p-2 text-xs transition-all duration-200 ease-out hover:opacity-90"
                                                style={{
                                                  backgroundColor:
                                                    "var(--bsky-bg-tertiary)",
                                                  border:
                                                    "1px solid var(--bsky-border-primary)",
                                                  textDecoration: "none",
                                                  color:
                                                    "var(--bsky-text-primary)",
                                                }}
                                              >
                                                {post.text ||
                                                  "[Post with no text]"}
                                              </a>
                                            );
                                          })}
                                        {event.affectedPosts.length > 3 && (
                                          <p
                                            className="text-xs"
                                            style={{
                                              color:
                                                "var(--bsky-text-tertiary)",
                                            }}
                                          >
                                            ...and{" "}
                                            {event.affectedPosts.length - 3}{" "}
                                            more posts
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  )}
                              </div>
                            ) : event.aggregationType === "post-burst" ? (
                              // Special layout for post bursts
                              <div>
                                <div className="mb-3 flex items-start gap-3">
                                  <div className="flex-shrink-0">
                                    <div
                                      className="flex h-10 w-10 items-center justify-center rounded-full"
                                      style={{
                                        backgroundColor:
                                          "var(--bsky-bg-tertiary)",
                                        border:
                                          "1px solid var(--bsky-border-color)",
                                      }}
                                    >
                                      <MessageCircle
                                        size={20}
                                        style={{
                                          color: "var(--bsky-text-secondary)",
                                        }}
                                      />
                                    </div>
                                  </div>
                                  <div className="flex-1">
                                    <div className="mb-1 flex items-center gap-2">
                                      <span
                                        className="text-sm font-medium"
                                        style={{
                                          color: "var(--bsky-text-primary)",
                                        }}
                                      >
                                        Popular Post
                                      </span>
                                      {event.notifications.length >= 10 && (
                                        <span
                                          className="rounded-full px-2 py-0.5 text-xs font-medium"
                                          style={{
                                            backgroundColor:
                                              "var(--bsky-bg-tertiary)",
                                            color: "var(--bsky-text-secondary)",
                                            border:
                                              "1px solid var(--bsky-border-color)",
                                          }}
                                        >
                                          {event.notifications.length}+
                                          interactions
                                        </span>
                                      )}
                                    </div>
                                    <p
                                      className="text-sm"
                                      style={{
                                        color: "var(--bsky-text-secondary)",
                                      }}
                                    >
                                      {event.actors.size}{" "}
                                      {event.actors.size === 1
                                        ? "person"
                                        : "people"}{" "}
                                      engaged over{" "}
                                      {event.earliestTime && event.latestTime
                                        ? formatDistanceToNow(
                                            event.earliestTime,
                                            { addSuffix: false },
                                          )
                                        : "time"}
                                    </p>
                                  </div>
                                </div>

                                {/* Engagement breakdown */}
                                <div className="mb-3 flex flex-wrap gap-3">
                                  {event.notifications.filter(
                                    (n) => n.reason === "like",
                                  ).length > 0 && (
                                    <div className="flex items-center gap-1 text-sm">
                                      <Heart
                                        size={16}
                                        style={{
                                          color: "var(--bsky-text-secondary)",
                                        }}
                                      />
                                      <span
                                        style={{
                                          color: "var(--bsky-text-secondary)",
                                        }}
                                      >
                                        {
                                          event.notifications.filter(
                                            (n) => n.reason === "like",
                                          ).length
                                        }
                                      </span>
                                    </div>
                                  )}
                                  {event.notifications.filter(
                                    (n) => n.reason === "repost",
                                  ).length > 0 && (
                                    <div className="flex items-center gap-1 text-sm">
                                      <Repeat2
                                        size={16}
                                        style={{
                                          color: "var(--bsky-text-secondary)",
                                        }}
                                      />
                                      <span
                                        style={{
                                          color: "var(--bsky-text-secondary)",
                                        }}
                                      >
                                        {
                                          event.notifications.filter(
                                            (n) => n.reason === "repost",
                                          ).length
                                        }
                                      </span>
                                    </div>
                                  )}
                                  {event.notifications.filter(
                                    (n) => n.reason === "reply",
                                  ).length > 0 && (
                                    <div className="flex items-center gap-1 text-sm">
                                      <MessageCircle
                                        size={16}
                                        style={{
                                          color: "var(--bsky-text-secondary)",
                                        }}
                                      />
                                      <span
                                        style={{
                                          color: "var(--bsky-text-secondary)",
                                        }}
                                      >
                                        {
                                          event.notifications.filter(
                                            (n) => n.reason === "reply",
                                          ).length
                                        }
                                      </span>
                                    </div>
                                  )}
                                  {event.notifications.filter(
                                    (n) => n.reason === "quote",
                                  ).length > 0 && (
                                    <div className="flex items-center gap-1 text-sm">
                                      <Quote
                                        size={16}
                                        style={{
                                          color: "var(--bsky-text-secondary)",
                                        }}
                                      />
                                      <span
                                        style={{
                                          color: "var(--bsky-text-secondary)",
                                        }}
                                      >
                                        {
                                          event.notifications.filter(
                                            (n) => n.reason === "quote",
                                          ).length
                                        }
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* Actor avatars in a grid for bursts */}
                                <div className="mb-3">
                                  <div className="flex flex-wrap gap-1">
                                    {event.notifications
                                      .slice(0, 12)
                                      .map((notif, i) => (
                                        <a
                                          key={`${notif.uri}-${i}`}
                                          href={getProfileUrl(
                                            notif.author?.handle || "unknown",
                                          )}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="transition-all duration-200 ease-out hover:opacity-80"
                                        >
                                          <img
                                            src={proxifyBskyImage(
                                              notif.author.avatar,
                                            )}
                                            alt={
                                              notif.author?.handle || "unknown"
                                            }
                                            className="h-8 w-8 rounded-full"
                                            title={
                                              notif.author?.displayName ||
                                              notif.author?.handle ||
                                              "Unknown"
                                            }
                                          />
                                        </a>
                                      ))}
                                    {event.notifications.length > 12 && (
                                      <div
                                        className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
                                        style={{
                                          backgroundColor:
                                            "var(--bsky-bg-tertiary)",
                                          color: "var(--bsky-text-primary)",
                                        }}
                                      >
                                        +{event.notifications.length - 12}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              // Regular aggregated layout
                              <div className="flex items-center gap-3">
                                {/* Actor avatars */}
                                <div className="flex flex-shrink-0 items-center -space-x-2">
                                  {event.notifications
                                    .slice(0, 5)
                                    .map((notif, i) => (
                                      <a
                                        key={`${notif.uri}-${i}`}
                                        href={getProfileUrl(
                                          notif.author?.handle || "unknown",
                                        )}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="transition-all duration-200 ease-out hover:z-10 hover:-translate-y-0.5 hover:scale-110"
                                      >
                                        <img
                                          src={proxifyBskyImage(
                                            notif.author.avatar,
                                          )}
                                          alt={
                                            notif.author?.handle || "unknown"
                                          }
                                          className="h-6 w-6 rounded-full border-2"
                                          style={{
                                            borderColor:
                                              "var(--bsky-bg-secondary)",
                                          }}
                                          title={
                                            notif.author?.displayName ||
                                            notif.author?.handle ||
                                            "Unknown"
                                          }
                                        />
                                      </a>
                                    ))}
                                  {event.notifications.length > 5 && (
                                    <div
                                      className="flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-medium"
                                      style={{
                                        backgroundColor:
                                          "var(--bsky-bg-tertiary)",
                                        borderColor: "var(--bsky-bg-secondary)",
                                        fontSize: "10px",
                                      }}
                                    >
                                      +{event.notifications.length - 5}
                                    </div>
                                  )}
                                </div>

                                {/* Compact summary */}
                                <div className="flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    {event.aggregationType === "follow" ? (
                                      <>
                                        <span className="text-sm font-medium">
                                          {event.actors.size} new{" "}
                                          {event.actors.size === 1
                                            ? "follower"
                                            : "followers"}
                                        </span>
                                        {getReasonIcon("follow")}
                                      </>
                                    ) : (
                                      <>
                                        <span className="text-sm font-medium">
                                          {event.actors.size}{" "}
                                          {event.actors.size === 1
                                            ? "person"
                                            : "people"}
                                        </span>
                                        <span
                                          className="text-sm"
                                          style={{
                                            color: "var(--bsky-text-secondary)",
                                          }}
                                        >
                                          •
                                        </span>
                                        {Array.from(event.types).map(
                                          (type, i) => (
                                            <span
                                              key={type}
                                              className="flex items-center gap-1 text-sm"
                                            >
                                              {getReasonIcon(type)}
                                              <span
                                                style={{
                                                  color:
                                                    "var(--bsky-text-secondary)",
                                                }}
                                              >
                                                {getActionCount(
                                                  event.notifications,
                                                  type,
                                                )}
                                              </span>
                                              {i < event.types.size - 1 && (
                                                <span
                                                  style={{
                                                    color:
                                                      "var(--bsky-text-secondary)",
                                                  }}
                                                >
                                                  •
                                                </span>
                                              )}
                                            </span>
                                          ),
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Post preview for aggregated post notifications */}
                            {(event.aggregationType === "post" ||
                              event.aggregationType === "post-burst") &&
                              isExpanded &&
                              (() => {
                                const notification = event.notifications[0];

                                // Try to get full post data
                                // For reposts and likes, use reasonSubject which contains the original post URI
                                const postUri =
                                  (notification.reason === "repost" ||
                                    notification.reason === "like") &&
                                  notification.reasonSubject
                                    ? notification.reasonSubject
                                    : notification.uri;
                                const post = postMap.get(postUri);

                                if (post) {
                                  // We have full post data
                                  const postUrl = getPostUrl(
                                    postUri,
                                    post.author?.handle,
                                  );
                                  return (
                                    <a
                                      href={postUrl || "#"}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="relative mt-3 block overflow-hidden rounded p-3 transition-all duration-200 ease-out before:absolute before:bottom-0 before:left-0 before:top-0 before:w-[3px] before:bg-bsky-primary before:opacity-50 before:content-[''] hover:-translate-y-0.5 hover:opacity-90 hover:shadow-md"
                                      style={{
                                        backgroundColor:
                                          "var(--bsky-bg-tertiary)",
                                        border:
                                          "1px solid var(--bsky-border-primary)",
                                        textDecoration: "none",
                                      }}
                                    >
                                      <p
                                        className="mb-1 flex items-center gap-1 text-xs font-medium"
                                        style={{
                                          color: "var(--bsky-text-tertiary)",
                                        }}
                                      >
                                        Your post:
                                        <ExternalLink size={10} />
                                      </p>
                                      <p
                                        className="line-clamp-3 text-sm"
                                        style={{
                                          color: "var(--bsky-text-primary)",
                                        }}
                                      >
                                        {post.record?.text ||
                                          "[Post with no text]"}
                                      </p>
                                      <div
                                        className="mt-2 flex items-center gap-2 text-xs"
                                        style={{
                                          color: "var(--bsky-text-tertiary)",
                                        }}
                                      >
                                        <span>
                                          {
                                            event.notifications.filter(
                                              (n) => n.reason === "like",
                                            ).length
                                          }{" "}
                                          likes
                                        </span>
                                        <span>•</span>
                                        <span>
                                          {
                                            event.notifications.filter(
                                              (n) => n.reason === "repost",
                                            ).length
                                          }{" "}
                                          reposts
                                        </span>
                                        {event.notifications.some(
                                          (n) => n.reason === "quote",
                                        ) && (
                                          <>
                                            <span>•</span>
                                            <span>
                                              {
                                                event.notifications.filter(
                                                  (n) => n.reason === "quote",
                                                ).length
                                              }{" "}
                                              quotes
                                            </span>
                                          </>
                                        )}
                                      </div>
                                    </a>
                                  );
                                }

                                // Fallback when post data isn't available
                                const postText =
                                  notification.record?.text ||
                                  (notification.record &&
                                  typeof notification.record === "object" &&
                                  "text" in notification.record
                                    ? (notification.record as { text?: string })
                                        .text
                                    : null);

                                if (!postText) return null;

                                return (
                                  <div
                                    className="relative mt-3 overflow-hidden rounded p-3 before:absolute before:bottom-0 before:left-0 before:top-0 before:w-[3px] before:bg-bsky-primary before:opacity-50 before:content-['']"
                                    style={{
                                      backgroundColor:
                                        "var(--bsky-bg-tertiary)",
                                      border:
                                        "1px solid var(--bsky-border-primary)",
                                    }}
                                  >
                                    <p
                                      className="mb-1 text-xs font-medium"
                                      style={{
                                        color: "var(--bsky-text-tertiary)",
                                      }}
                                    >
                                      Your post:
                                    </p>
                                    <p
                                      className="line-clamp-3 text-sm"
                                      style={{
                                        color: "var(--bsky-text-primary)",
                                      }}
                                    >
                                      {postText}
                                    </p>
                                    <div
                                      className="mt-2 flex items-center gap-2 text-xs"
                                      style={{
                                        color: "var(--bsky-text-tertiary)",
                                      }}
                                    >
                                      <span>
                                        {
                                          event.notifications.filter(
                                            (n) => n.reason === "like",
                                          ).length
                                        }{" "}
                                        likes
                                      </span>
                                      <span>•</span>
                                      <span>
                                        {
                                          event.notifications.filter(
                                            (n) => n.reason === "repost",
                                          ).length
                                        }{" "}
                                        reposts
                                      </span>
                                      {event.notifications.some(
                                        (n) => n.reason === "quote",
                                      ) && (
                                        <>
                                          <span>•</span>
                                          <span>
                                            {
                                              event.notifications.filter(
                                                (n) => n.reason === "quote",
                                              ).length
                                            }{" "}
                                            quotes
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                );
                              })()}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Visual gap indicator for large time gaps */}
                    {previousEvent &&
                      differenceInHours(previousEvent.time, event.time) >=
                        12 && (
                        <div
                          className="before:bg-bsky-border-color after:bg-bsky-border-color absolute relative -top-3 left-[5rem] whitespace-nowrap rounded-[10px] bg-bsky-bg-secondary px-1.5 py-0.5 text-xs before:absolute before:-top-3 before:left-1/2 before:h-2 before:w-px before:-translate-x-1/2 before:opacity-30 before:content-[''] after:absolute after:-bottom-3 after:left-1/2 after:h-2 after:w-px after:-translate-x-1/2 after:opacity-30 after:content-[''] sm:left-[7.5rem]"
                          style={{
                            color: "var(--bsky-text-tertiary)",
                            transform: "translateX(-50%)",
                            fontSize: "10px",
                          }}
                        >
                          {Math.floor(
                            differenceInHours(previousEvent.time, event.time),
                          )}
                          h
                        </div>
                      )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* End of timeline */}
          <div className="relative mt-8 flex items-center gap-3">
            <div className="w-24" />
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: "var(--bsky-border-color)" }}
            />
            <span
              className="text-sm"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              {notifications.length === 0
                ? "No notifications yet"
                : `${notifications.length} recent notifications`}
            </span>
          </div>
        </div>

        {/* Thread Modal */}
        {selectedPostUri && (
          <ThreadModal
            postUri={selectedPostUri}
            onClose={() => setSelectedPostUri(null)}
          />
        )}
      </div>{" "}
      {/* End scrollable wrapper */}
    </div>
  );
};

function getActionText(reason: string): string {
  switch (reason) {
    case "like":
      return "liked your post";
    case "repost":
      return "reposted your post";
    case "follow":
      return "followed you";
    case "mention":
      return "mentioned you";
    case "reply":
      return "replied to your post";
    case "quote":
      return "quoted your post";
    case "starterpack-joined":
      return "joined via your starterpack";
    case "verified":
      return "verified your account";
    case "unverified":
      return "unverified your account";
    case "like-via-repost":
      return "liked a repost of your post";
    case "repost-via-repost":
      return "reposted a repost of your post";
    default:
      return "interacted with your post";
  }
}

function getActionCount(notifications: any[], type: string): number {
  return notifications.filter((n) => n.reason === type).length;
}
