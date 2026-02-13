import { useQuery } from "@tanstack/react-query";
import { differenceInHours, formatDistanceToNow } from "date-fns";
import {
  ExternalLink,
  Heart,
  MessageCircle,
  Quote,
  RefreshCw,
  Repeat2,
} from "lucide-react";
import React from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { useScrollContainerGPU } from "../hooks/useGPUAcceleration";
import { useNotificationPosts } from "../hooks/useNotificationPosts";
import { proxifyBskyImage } from "../utils/image-proxy";
import { throttle, TIMING } from "../utils/timing";
import { ThreadModal } from "./ThreadModal";
import {
  AggregatedEvent,
  aggregateNotifications,
  DayGroupHeader,
  getActionCount,
  getActionText,
  getProfileUrl,
  getReasonIcon,
  getSpacingClass,
  getTimeLabel,
  getTimeOfDay,
  getTimeOfDayColor,
  groupEventsByDay,
  isDayTime,
  VisualTimelineProps,
} from "./timeline";

export const VisualTimeline: React.FC<VisualTimelineProps> = React.memo(
  ({ hideTimeLabels = false, isInSkyDeck = false, isFocused = true }) => {
    const { agent } = useAuth();
    const navigate = useNavigate();
    const containerRef = React.useRef<HTMLDivElement>(null);
    const scrollableRef = React.useRef<HTMLDivElement>(null);
    const gpuScrollRef = useScrollContainerGPU();
    const timelineItemsRef = React.useRef<Map<string, HTMLDivElement>>(
      new Map(),
    );
    const [selectedItemIndex, setSelectedItemIndex] =
      React.useState<number>(-1);
    const [selectedPostUri, setSelectedPostUri] = React.useState<string | null>(
      null,
    );
    const [dayGroupColors, setDayGroupColors] = React.useState<
      Map<string, { color: string; position: number }>
    >(new Map());
    // Removed expandedItems state - cards are always expanded
    const [cursor, setCursor] = React.useState<string | undefined>(undefined);
    const [allNotifications, setAllNotifications] = React.useState<any[]>([]);
    const [hasMore, setHasMore] = React.useState(true);
    const [isLoadingMore, setIsLoadingMore] = React.useState(false);
    const [hasNewNotifications, setHasNewNotifications] = React.useState(false);
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    // Helper function to handle internal navigation
    const handleInternalNavigation = (e: React.MouseEvent, url: string) => {
      e.preventDefault();
      e.stopPropagation();
      navigate(url);
    };

    // Initial load query
    const { data, isLoading } = useQuery({
      queryKey: ["notifications-visual-timeline", "initial"],
      queryFn: async () => {
        if (!agent) throw new Error("Not authenticated");
        const response = await agent.listNotifications({ limit: 50 });
        return response.data;
      },
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnMount: false, // Don't refetch on mount - use stale time instead
      refetchInterval: 60 * 1000, // Poll every 60 seconds after initial load
      enabled: !!agent, // Only run when agent is available
    });

    // Update state when initial data loads
    React.useEffect(() => {
      if (data) {
        setAllNotifications(data.notifications || []);
        setCursor(data.cursor);
        setHasMore(!!data.cursor);
      }
    }, [data]);

    // Periodically check for new notifications
    React.useEffect(() => {
      if (!agent || allNotifications.length === 0) return;

      const checkForNew = async () => {
        try {
          const response = await agent.listNotifications({ limit: 1 });
          if (response.data.notifications?.[0]) {
            const latestNotification = response.data.notifications[0];
            const currentLatest = allNotifications[0];

            if (latestNotification.uri !== currentLatest.uri) {
              setHasNewNotifications(true);
            }
          }
        } catch (_error) {
          // Silently fail - this is just a background check
        }
      };

      // Check every 30 seconds
      const interval = setInterval(checkForNew, 30000);
      return () => clearInterval(interval);
    }, [agent, allNotifications]);

    // Load more function
    const loadMore = React.useCallback(async () => {
      if (!agent || !cursor || isLoadingMore || !hasMore) {
        return;
      }

      setIsLoadingMore(true);
      try {
        const response = await agent.listNotifications({
          limit: 50,
          cursor: cursor,
        });

        if (
          response.data.notifications &&
          response.data.notifications.length > 0
        ) {
          const newNotifications = response.data.notifications;

          setAllNotifications((prev) => {
            const updated = [...prev, ...newNotifications];
            return updated;
          });
          setCursor(response.data.cursor);
          setHasMore(!!response.data.cursor);
        } else {
          setHasMore(false);
        }
      } catch (error) {
        console.error("Error loading more notifications:", error);
        setHasMore(false);
      } finally {
        setIsLoadingMore(false);
      }
    }, [agent, cursor, isLoadingMore, hasMore, allNotifications.length]);

    // Refresh function to load new notifications
    const refreshNotifications = React.useCallback(async () => {
      if (!agent || isRefreshing) return;

      setIsRefreshing(true);
      setHasNewNotifications(false);

      try {
        const response = await agent.listNotifications({
          limit: 50,
        });

        if (response.data.notifications) {
          // Check for new notifications by comparing the first notification
          const latestNotification = response.data.notifications[0];
          const currentLatest = allNotifications[0];

          if (
            latestNotification &&
            currentLatest &&
            latestNotification.uri !== currentLatest.uri
          ) {
            // Find where the new notifications end
            const existingIndex = response.data.notifications.findIndex((n) =>
              allNotifications.some((existing) => existing.uri === n.uri),
            );

            if (existingIndex > 0) {
              // Add only the new notifications at the beginning
              const newNotifications = response.data.notifications.slice(
                0,
                existingIndex,
              );
              setAllNotifications((prev) => [...newNotifications, ...prev]);

              // Scroll to top to show new notifications
              if (scrollableRef.current) {
                scrollableRef.current.scrollTop = 0;
              } else {
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            } else if (existingIndex === -1) {
              // All notifications are new (rare case)
              setAllNotifications(response.data.notifications);
              setCursor(response.data.cursor);
              setHasMore(!!response.data.cursor);
            }
          }
        }
      } catch (error) {
        console.error("Error refreshing notifications:", error);
      } finally {
        setIsRefreshing(false);
      }
    }, [agent, allNotifications, isRefreshing]);

    // Intersection observer for infinite scrolling
    React.useEffect(() => {
      // For non-SkyDeck mode, use document's main element as root
      // For SkyDeck mode, use the scrollable container
      const scrollRoot = isInSkyDeck
        ? scrollableRef.current
        : document.querySelector("main") || null;

      const options = {
        root: scrollRoot,
        rootMargin: "200px",
        threshold: 0.1,
      };

      const observer = new IntersectionObserver((entries) => {
        const target = entries[0];
        if (target.isIntersecting && hasMore && !isLoadingMore) {
          loadMore();
        }
      }, options);

      // Create sentinel element
      const sentinel = document.getElementById("timeline-scroll-sentinel");
      if (sentinel) {
        observer.observe(sentinel);
      }

      return () => {
        if (sentinel) {
          observer.unobserve(sentinel);
        }
      };
    }, [loadMore, hasMore, isLoadingMore, isInSkyDeck]);

    // Get notifications from the state
    const notifications = allNotifications;

    // Fetch posts for notifications to show richer content
    const { data: posts } = useNotificationPosts(notifications);

    // Create a map for quick post lookup
    const postMap = React.useMemo(() => {
      if (!posts) return new Map();
      return new Map(posts.map((post) => [post.uri, post]));
    }, [posts]);

    // Smart aggregation based on notification type and context
    const aggregatedEvents = React.useMemo(
      () => aggregateNotifications(allNotifications, postMap),
      [allNotifications, postMap],
    );

    // Group events by day - must be before conditional returns
    const eventsByDay = React.useMemo(
      () => groupEventsByDay(aggregatedEvents, getTimeLabel),
      [aggregatedEvents],
    );

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
                    closestEvent = {
                      element: event,
                      distance,
                      time: eventTime,
                    };
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

      // Throttle scroll handler for 60fps (16ms)
      const handleScroll = throttle(updateDayColors, TIMING.SCROLL_THROTTLE);

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
              <div key={`timeline-skeleton-${i}`} className="flex gap-4">
                <div
                  className="h-6 w-24 rounded"
                  style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
                ></div>
                <div
                  className="h-20 flex-1 rounded"
                  style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
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
        <div
          className={
            isInSkyDeck ? "gpu-scroll-container flex-1 overflow-y-auto" : ""
          }
          ref={(el) => {
            // Combine refs: scrollableRef for local state, gpuScrollRef for GPU acceleration
            (
              scrollableRef as React.MutableRefObject<HTMLDivElement | null>
            ).current = el;
            if (isInSkyDeck) {
              gpuScrollRef(el);
            }
          }}
        >
          <div className="relative">
            {/* New notifications banner */}
            {hasNewNotifications && !isRefreshing && (
              <div
                className="sticky top-0 z-40 mb-2 px-4 py-2 backdrop-blur-md sm:px-6"
                style={{
                  backgroundColor: "var(--asph-bg-primary)",
                  borderBottom: "1px solid var(--asph-primary)",
                }}
              >
                <button
                  onClick={refreshNotifications}
                  className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all hover:opacity-90"
                  style={{
                    backgroundColor: "var(--asph-primary)",
                    color: "white",
                  }}
                >
                  <RefreshCw
                    size={16}
                    className={isRefreshing ? "animate-spin" : ""}
                  />
                  New notifications available
                </button>
              </div>
            )}

            {eventsByDay.map((dayGroup, dayIndex) => (
              <div key={dayGroup.label} data-day-group={dayGroup.label}>
                <DayGroupHeader
                  dayGroup={dayGroup}
                  isInSkyDeck={isInSkyDeck}
                  dayGroupColors={dayGroupColors}
                />

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
                              ? "bg-asph-bg-secondary"
                              : ""
                          } ${
                            event.aggregationType === "follow"
                              ? "border-l-[3px] border-l-asph-follow pl-3"
                              : event.aggregationType === "post" ||
                                  event.aggregationType === "post-burst"
                                ? "border-l-[3px] border-l-asph-primary pl-3"
                                : event.aggregationType === "user-activity"
                                  ? "relative overflow-hidden bg-asph-bg-secondary"
                                  : ""
                          } ${isSelected ? "relative translate-x-1 transform before:absolute before:-left-1 before:bottom-0 before:top-0 before:w-[3px] before:rounded-r-[3px] before:bg-asph-primary before:opacity-80 before:content-['']" : ""} hover:translate-x-0.5 hover:transform hover:shadow-lg`}
                          style={{
                            backgroundColor: getTimeOfDayColor(event.time)
                              .backgroundColor,
                            border: `1px solid ${isSelected ? "var(--asph-primary)" : getTimeOfDayColor(event.time).borderColor}`,
                            borderRadius: "8px",
                            boxShadow: isSelected
                              ? `0 0 0 2px var(--asph-primary), 0 1px 3px ${getTimeOfDayColor(event.time).shadowColor}`
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
                                <div
                                  onClick={(e) =>
                                    handleInternalNavigation(
                                      e,
                                      getProfileUrl(
                                        event.notifications[0].author?.handle ||
                                          "unknown",
                                      ),
                                    )
                                  }
                                  className="flex-shrink-0 cursor-pointer transition-all duration-200 ease-out hover:opacity-80"
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
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    {getReasonIcon(
                                      event.notifications[0].reason,
                                    )}
                                    <span
                                      onClick={(e) =>
                                        handleInternalNavigation(
                                          e,
                                          getProfileUrl(
                                            event.notifications[0].author
                                              ?.handle || "unknown",
                                          ),
                                        )
                                      }
                                      className="cursor-pointer text-sm font-medium hover:underline"
                                      style={{ color: "var(--asph-primary)" }}
                                    >
                                      {event.notifications[0].author
                                        ?.displayName ||
                                        event.notifications[0].author?.handle ||
                                        "Unknown"}
                                    </span>
                                  </div>
                                  <div
                                    className="mt-0.5 text-xs sm:text-sm"
                                    style={{
                                      color: "var(--asph-text-secondary)",
                                    }}
                                  >
                                    {getActionText(
                                      event.notifications[0].reason,
                                    )}
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
                                    return (
                                      <div
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedPostUri(postUri);
                                        }}
                                        className="relative ml-11 mt-2 block cursor-pointer overflow-hidden rounded p-3 transition-all duration-200 ease-out before:absolute before:bottom-0 before:left-0 before:top-0 before:w-[3px] before:bg-asph-primary before:opacity-50 before:content-[''] hover:-translate-y-0.5 hover:opacity-90 hover:shadow-md"
                                        style={{
                                          backgroundColor:
                                            "var(--asph-bg-tertiary)",
                                          border:
                                            "1px solid var(--asph-border-primary)",
                                          textDecoration: "none",
                                        }}
                                      >
                                        <p
                                          className="mb-1 flex items-center gap-1 text-xs font-medium"
                                          style={{
                                            color: "var(--asph-text-tertiary)",
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
                                            color: "var(--asph-text-primary)",
                                          }}
                                        >
                                          {post.record?.text ||
                                            (post.embed?.$type ===
                                              "app.bsky.embed.images#view" ||
                                            (post.embed?.$type ===
                                              "app.bsky.embed.recordWithMedia#view" &&
                                              post.embed?.media?.$type ===
                                                "app.bsky.embed.images#view")
                                              ? "📷 Image"
                                              : post.embed?.$type ===
                                                    "app.bsky.embed.video#view" ||
                                                  (post.embed?.$type ===
                                                    "app.bsky.embed.recordWithMedia#view" &&
                                                    post.embed?.media?.$type ===
                                                      "app.bsky.embed.video#view")
                                                ? "🎬 Video"
                                                : post.embed?.$type ===
                                                      "app.bsky.embed.external#view" ||
                                                    (post.embed?.$type ===
                                                      "app.bsky.embed.recordWithMedia#view" &&
                                                      post.embed?.media
                                                        ?.$type ===
                                                        "app.bsky.embed.external#view")
                                                  ? "🔗 Link"
                                                  : "[Post with no text]")}
                                        </p>
                                      </div>
                                    );
                                  }

                                  // Fallback for mentions or when post data isn't available
                                  const postText =
                                    notification.record?.text ||
                                    (notification.record &&
                                    typeof notification.record === "object" &&
                                    "text" in notification.record
                                      ? (
                                          notification.record as {
                                            text?: string;
                                          }
                                        ).text
                                      : null);

                                  if (!postText) return null;

                                  return (
                                    <div
                                      className="relative ml-11 mt-2 overflow-hidden rounded p-3 before:absolute before:bottom-0 before:left-0 before:top-0 before:w-[3px] before:bg-asph-primary before:opacity-50 before:content-['']"
                                      style={{
                                        backgroundColor:
                                          "var(--asph-bg-tertiary)",
                                        border:
                                          "1px solid var(--asph-border-primary)",
                                      }}
                                    >
                                      <p
                                        className="mb-1 text-xs font-medium"
                                        style={{
                                          color: "var(--asph-text-tertiary)",
                                        }}
                                      >
                                        {notification.reason === "mention"
                                          ? "Mentioned you in:"
                                          : "Post:"}
                                      </p>
                                      <p
                                        className="line-clamp-2 text-xs"
                                        style={{
                                          color: "var(--asph-text-primary)",
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
                                    <div
                                      onClick={(e) =>
                                        handleInternalNavigation(
                                          e,
                                          getProfileUrl(
                                            event.primaryActor!.handle,
                                          ),
                                        )
                                      }
                                      className="flex-shrink-0 cursor-pointer transition-all duration-200 ease-out hover:opacity-80"
                                    >
                                      <img
                                        src={proxifyBskyImage(
                                          event.primaryActor!.avatar,
                                        )}
                                        alt={event.primaryActor!.handle}
                                        className="h-10 w-10 rounded-full"
                                        style={{
                                          border:
                                            "1px solid var(--asph-border-primary)",
                                        }}
                                      />
                                    </div>
                                    <div className="flex-1">
                                      <div className="mb-1 flex items-center gap-2">
                                        <span
                                          onClick={(e) =>
                                            handleInternalNavigation(
                                              e,
                                              getProfileUrl(
                                                event.primaryActor!.handle,
                                              ),
                                            )
                                          }
                                          className="cursor-pointer text-base font-bold hover:underline"
                                          style={{
                                            color: "var(--asph-primary)",
                                          }}
                                        >
                                          {event.primaryActor!.displayName ||
                                            event.primaryActor!.handle}
                                        </span>
                                        <span
                                          className="text-xs"
                                          style={{
                                            color: "var(--asph-text-tertiary)",
                                          }}
                                        >
                                          • active
                                        </span>
                                      </div>
                                      <p
                                        className="text-sm"
                                        style={{
                                          color: "var(--asph-text-secondary)",
                                        }}
                                      >
                                        {event.notifications.length}{" "}
                                        interactions over{" "}
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
                                      color: "var(--asph-text-secondary)",
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
                                            color: "var(--asph-text-tertiary)",
                                          }}
                                        >
                                          Posts they interacted with:
                                        </p>
                                        <div className="space-y-1.5">
                                          {event.affectedPosts
                                            .slice(0, 3)
                                            .map((post, i) => {
                                              return (
                                                <div
                                                  key={`${post.uri}-${i}`}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedPostUri(
                                                      post.uri,
                                                    );
                                                  }}
                                                  className="line-clamp-2 block cursor-pointer rounded p-2 text-xs transition-all duration-200 ease-out hover:opacity-90"
                                                  style={{
                                                    backgroundColor:
                                                      "var(--asph-bg-tertiary)",
                                                    border:
                                                      "1px solid var(--asph-border-primary)",
                                                    textDecoration: "none",
                                                    color:
                                                      "var(--asph-text-primary)",
                                                  }}
                                                >
                                                  {post.text ||
                                                    (post.hasImages
                                                      ? "📷 Image"
                                                      : post.hasVideo
                                                        ? "🎬 Video"
                                                        : post.hasExternal
                                                          ? "🔗 Link"
                                                          : "[Post with no text]")}
                                                </div>
                                              );
                                            })}
                                          {event.affectedPosts.length > 3 && (
                                            <p
                                              className="text-xs"
                                              style={{
                                                color:
                                                  "var(--asph-text-tertiary)",
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
                                            "var(--asph-bg-tertiary)",
                                          border:
                                            "1px solid var(--asph-border-primary)",
                                        }}
                                      >
                                        <MessageCircle
                                          size={20}
                                          style={{
                                            color: "var(--asph-text-secondary)",
                                          }}
                                        />
                                      </div>
                                    </div>
                                    <div className="flex-1">
                                      <div className="mb-1 flex items-center gap-2">
                                        <span
                                          className="text-sm font-medium"
                                          style={{
                                            color: "var(--asph-text-primary)",
                                          }}
                                        >
                                          Popular Post
                                        </span>
                                        {event.notifications.length >= 10 && (
                                          <span
                                            className="rounded-full px-2 py-0.5 text-xs font-medium"
                                            style={{
                                              backgroundColor:
                                                "var(--asph-bg-tertiary)",
                                              color:
                                                "var(--asph-text-secondary)",
                                              border:
                                                "1px solid var(--asph-border-primary)",
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
                                          color: "var(--asph-text-secondary)",
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
                                            color: "var(--asph-text-secondary)",
                                          }}
                                        />
                                        <span
                                          style={{
                                            color: "var(--asph-text-secondary)",
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
                                            color: "var(--asph-text-secondary)",
                                          }}
                                        />
                                        <span
                                          style={{
                                            color: "var(--asph-text-secondary)",
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
                                            color: "var(--asph-text-secondary)",
                                          }}
                                        />
                                        <span
                                          style={{
                                            color: "var(--asph-text-secondary)",
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
                                            color: "var(--asph-text-secondary)",
                                          }}
                                        />
                                        <span
                                          style={{
                                            color: "var(--asph-text-secondary)",
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
                                          <div
                                            key={`${notif.uri}-${i}`}
                                            onClick={(e) =>
                                              handleInternalNavigation(
                                                e,
                                                getProfileUrl(
                                                  notif.author?.handle ||
                                                    "unknown",
                                                ),
                                              )
                                            }
                                            className="cursor-pointer transition-all duration-200 ease-out hover:opacity-80"
                                          >
                                            <img
                                              src={proxifyBskyImage(
                                                notif.author.avatar,
                                              )}
                                              alt={
                                                notif.author?.handle ||
                                                "unknown"
                                              }
                                              className="h-8 w-8 rounded-full"
                                              title={
                                                notif.author?.displayName ||
                                                notif.author?.handle ||
                                                "Unknown"
                                              }
                                            />
                                          </div>
                                        ))}
                                      {event.notifications.length > 12 && (
                                        <div
                                          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
                                          style={{
                                            backgroundColor:
                                              "var(--asph-bg-tertiary)",
                                            color: "var(--asph-text-primary)",
                                          }}
                                        >
                                          +{event.notifications.length - 12}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ) : event.aggregationType ===
                                "recent-comments" ? (
                                // Recent comments aggregation
                                <div>
                                  <div className="mb-4 flex items-center gap-3">
                                    <div
                                      className="flex h-10 w-10 items-center justify-center rounded-full"
                                      style={{
                                        backgroundColor:
                                          "var(--asph-bg-tertiary)",
                                        border:
                                          "1px solid var(--asph-border-primary)",
                                      }}
                                    >
                                      <MessageCircle
                                        size={20}
                                        style={{ color: "var(--asph-primary)" }}
                                      />
                                    </div>
                                    <div>
                                      <h3
                                        className="text-base font-bold"
                                        style={{
                                          color: "var(--asph-text-primary)",
                                        }}
                                      >
                                        Recent Comments
                                      </h3>
                                      <p
                                        className="text-sm"
                                        style={{
                                          color: "var(--asph-text-tertiary)",
                                        }}
                                      >
                                        {event.notifications.length} comments
                                        from{" "}
                                        {
                                          new Set(
                                            event.notifications.map(
                                              (n) => n.author?.handle,
                                            ),
                                          ).size
                                        }{" "}
                                        people
                                        {event.earliestTime &&
                                          event.latestTime && (
                                            <span>
                                              {" "}
                                              over{" "}
                                              {formatDistanceToNow(
                                                event.earliestTime,
                                                {
                                                  addSuffix: false,
                                                },
                                              )}
                                            </span>
                                          )}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Comment list in table format */}
                                  <div
                                    className="rounded-lg border"
                                    style={{
                                      backgroundColor:
                                        "var(--asph-bg-tertiary)",
                                      borderColor: "var(--asph-border-primary)",
                                    }}
                                  >
                                    {event.notifications
                                      .slice(0, 5)
                                      .map((notification, idx) => (
                                        <div
                                          key={notification.uri}
                                          className={`flex gap-3 p-3 ${
                                            idx !== 0 ? "border-t" : ""
                                          }`}
                                          style={{
                                            borderColor:
                                              "var(--asph-border-primary)",
                                          }}
                                        >
                                          {/* Author avatar */}
                                          <div className="flex-shrink-0">
                                            <div
                                              onClick={(e) =>
                                                handleInternalNavigation(
                                                  e,
                                                  getProfileUrl(
                                                    notification.author.handle,
                                                  ),
                                                )
                                              }
                                              className="cursor-pointer"
                                            >
                                              <img
                                                src={proxifyBskyImage(
                                                  notification.author.avatar,
                                                )}
                                                alt={notification.author.handle}
                                                className="h-8 w-8 rounded-full transition-opacity hover:opacity-80"
                                                style={{
                                                  border:
                                                    "1px solid var(--asph-border-primary)",
                                                }}
                                              />
                                            </div>
                                          </div>

                                          {/* Content */}
                                          <div className="min-w-0 flex-1">
                                            <div className="mb-1 flex items-baseline justify-between gap-2">
                                              <span
                                                onClick={(e) =>
                                                  handleInternalNavigation(
                                                    e,
                                                    getProfileUrl(
                                                      notification.author
                                                        .handle,
                                                    ),
                                                  )
                                                }
                                                className="cursor-pointer truncate font-medium hover:underline"
                                                style={{
                                                  color:
                                                    "var(--asph-text-primary)",
                                                }}
                                              >
                                                {notification.author
                                                  .displayName ||
                                                  notification.author.handle}
                                              </span>
                                              <span
                                                className="flex-shrink-0 text-xs"
                                                style={{
                                                  color:
                                                    "var(--asph-text-tertiary)",
                                                }}
                                              >
                                                {formatDistanceToNow(
                                                  new Date(
                                                    notification.indexedAt,
                                                  ),
                                                  { addSuffix: true },
                                                )}
                                              </span>
                                            </div>
                                            <p
                                              onClick={() => {
                                                if (
                                                  notification.reasonSubject
                                                ) {
                                                  setSelectedPostUri(
                                                    notification.reasonSubject,
                                                  );
                                                }
                                              }}
                                              className="line-clamp-2 cursor-pointer text-sm hover:opacity-80"
                                              style={{
                                                color:
                                                  "var(--asph-text-primary)",
                                              }}
                                            >
                                              {(notification.record as any)
                                                ?.text || "[No text]"}
                                            </p>
                                          </div>
                                        </div>
                                      ))}

                                    {event.notifications.length > 5 && (
                                      <div
                                        className="border-t px-3 py-2 text-center text-sm"
                                        style={{
                                          borderColor:
                                            "var(--asph-border-primary)",
                                          color: "var(--asph-text-tertiary)",
                                        }}
                                      >
                                        +{event.notifications.length - 5} more
                                        comments
                                      </div>
                                    )}
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
                                        <div
                                          key={`${notif.uri}-${i}`}
                                          onClick={(e) =>
                                            handleInternalNavigation(
                                              e,
                                              getProfileUrl(
                                                notif.author?.handle ||
                                                  "unknown",
                                              ),
                                            )
                                          }
                                          className="cursor-pointer transition-all duration-200 ease-out hover:z-10 hover:-translate-y-0.5 hover:scale-110"
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
                                                "var(--asph-bg-secondary)",
                                            }}
                                            title={
                                              notif.author?.displayName ||
                                              notif.author?.handle ||
                                              "Unknown"
                                            }
                                          />
                                        </div>
                                      ))}
                                    {event.notifications.length > 5 && (
                                      <div
                                        className="flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-medium"
                                        style={{
                                          backgroundColor:
                                            "var(--asph-bg-tertiary)",
                                          borderColor:
                                            "var(--asph-bg-secondary)",
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
                                              color:
                                                "var(--asph-text-secondary)",
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
                                                      "var(--asph-text-secondary)",
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
                                                        "var(--asph-text-secondary)",
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
                                    return (
                                      <div
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedPostUri(postUri);
                                        }}
                                        className="relative mt-3 block cursor-pointer overflow-hidden rounded p-3 transition-all duration-200 ease-out before:absolute before:bottom-0 before:left-0 before:top-0 before:w-[3px] before:bg-asph-primary before:opacity-50 before:content-[''] hover:-translate-y-0.5 hover:opacity-90 hover:shadow-md"
                                        style={{
                                          backgroundColor:
                                            "var(--asph-bg-tertiary)",
                                          border:
                                            "1px solid var(--asph-border-primary)",
                                          textDecoration: "none",
                                        }}
                                      >
                                        <p
                                          className="mb-1 flex items-center gap-1 text-xs font-medium"
                                          style={{
                                            color: "var(--asph-text-tertiary)",
                                          }}
                                        >
                                          Your post:
                                          <ExternalLink size={10} />
                                        </p>
                                        <p
                                          className="line-clamp-3 text-sm"
                                          style={{
                                            color: "var(--asph-text-primary)",
                                          }}
                                        >
                                          {post.record?.text ||
                                            (post.embed?.$type ===
                                              "app.bsky.embed.images#view" ||
                                            (post.embed?.$type ===
                                              "app.bsky.embed.recordWithMedia#view" &&
                                              post.embed?.media?.$type ===
                                                "app.bsky.embed.images#view")
                                              ? "📷 Image"
                                              : post.embed?.$type ===
                                                    "app.bsky.embed.video#view" ||
                                                  (post.embed?.$type ===
                                                    "app.bsky.embed.recordWithMedia#view" &&
                                                    post.embed?.media?.$type ===
                                                      "app.bsky.embed.video#view")
                                                ? "🎬 Video"
                                                : post.embed?.$type ===
                                                      "app.bsky.embed.external#view" ||
                                                    (post.embed?.$type ===
                                                      "app.bsky.embed.recordWithMedia#view" &&
                                                      post.embed?.media
                                                        ?.$type ===
                                                        "app.bsky.embed.external#view")
                                                  ? "🔗 Link"
                                                  : "[Post with no text]")}
                                        </p>
                                        <div
                                          className="mt-2 flex items-center gap-2 text-xs"
                                          style={{
                                            color: "var(--asph-text-tertiary)",
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
                                  }

                                  // Fallback when post data isn't available
                                  const postText =
                                    notification.record?.text ||
                                    (notification.record &&
                                    typeof notification.record === "object" &&
                                    "text" in notification.record
                                      ? (
                                          notification.record as {
                                            text?: string;
                                          }
                                        ).text
                                      : null);

                                  if (!postText) return null;

                                  return (
                                    <div
                                      className="relative mt-3 overflow-hidden rounded p-3 before:absolute before:bottom-0 before:left-0 before:top-0 before:w-[3px] before:bg-asph-primary before:opacity-50 before:content-['']"
                                      style={{
                                        backgroundColor:
                                          "var(--asph-bg-tertiary)",
                                        border:
                                          "1px solid var(--asph-border-primary)",
                                      }}
                                    >
                                      <p
                                        className="mb-1 text-xs font-medium"
                                        style={{
                                          color: "var(--asph-text-tertiary)",
                                        }}
                                      >
                                        Your post:
                                      </p>
                                      <p
                                        className="line-clamp-3 text-sm"
                                        style={{
                                          color: "var(--asph-text-primary)",
                                        }}
                                      >
                                        {postText}
                                      </p>
                                      <div
                                        className="mt-2 flex items-center gap-2 text-xs"
                                        style={{
                                          color: "var(--asph-text-tertiary)",
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
                            className="absolute -top-3 left-[5rem] whitespace-nowrap rounded-[10px] bg-asph-bg-secondary px-1.5 py-0.5 text-xs sm:left-[7.5rem]"
                            style={{
                              color: "var(--asph-text-tertiary)",
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

            {/* Load more indicator / End of timeline */}
            <div id="timeline-scroll-sentinel" className="relative mb-4 mt-8">
              <div className="flex items-center gap-3">
                <div className="w-24" />
                <div
                  className={`h-3 w-3 rounded-full ${isLoadingMore ? "animate-pulse" : ""}`}
                  style={{
                    backgroundColor: isLoadingMore
                      ? "var(--asph-primary)"
                      : "var(--asph-border-primary)",
                  }}
                />
                <span
                  className="text-sm"
                  style={{ color: "var(--asph-text-secondary)" }}
                >
                  {isLoadingMore
                    ? "Loading more notifications..."
                    : notifications.length === 0
                      ? "No notifications yet"
                      : hasMore
                        ? `${notifications.length} notifications loaded`
                        : `All ${notifications.length} notifications loaded`}
                </span>
              </div>

              {/* Manual load more button */}
              {hasMore && !isLoadingMore && notifications.length > 0 && (
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={loadMore}
                    className="rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:opacity-90"
                    style={{
                      backgroundColor: "var(--asph-bg-secondary)",
                      color: "var(--asph-text-primary)",
                      border: "1px solid var(--asph-border-primary)",
                    }}
                  >
                    Load More Notifications
                  </button>
                </div>
              )}
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
  },
);

VisualTimeline.displayName = "VisualTimeline";
