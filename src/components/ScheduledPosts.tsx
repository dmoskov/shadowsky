/**
 * ScheduledPosts Component
 *
 * Calendar and queue management UI for scheduled posts.
 * Features day/week/month views, drag-and-drop reordering,
 * and comprehensive post management actions.
 */

import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import {
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit2,
  List,
  MoreVertical,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useModal } from "../contexts/ModalContext";
import {
  getStatusColor,
  getStatusLabel,
  useCancelScheduledPost,
  useDeleteScheduledPost,
  usePendingScheduledPosts,
  useReschedulePost,
  useScheduledPostsGroupedByDate,
  useScheduledPostStats,
  useSchedulerInit,
} from "../hooks/useScheduledPosts";
import {
  formatScheduledTime,
  getSuggestedPostingTimes,
  ScheduledPost,
} from "../services/scheduled-posts";

type ViewMode = "day" | "week" | "month";
type DisplayMode = "calendar" | "queue";

export const ScheduledPosts: React.FC = () => {
  // Initialize scheduler service
  useSchedulerInit();

  const [displayMode, setDisplayMode] = useState<DisplayMode>("calendar");
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showPostMenu, setShowPostMenu] = useState<string | null>(null);

  // Get date range based on view mode
  const { startDate, endDate } = useMemo(() => {
    switch (viewMode) {
      case "day":
        return {
          startDate: new Date(currentDate.setHours(0, 0, 0, 0)),
          endDate: new Date(currentDate.setHours(23, 59, 59, 999)),
        };
      case "week":
        return {
          startDate: startOfWeek(currentDate, { weekStartsOn: 0 }),
          endDate: endOfWeek(currentDate, { weekStartsOn: 0 }),
        };
      case "month":
        return {
          startDate: startOfMonth(currentDate),
          endDate: endOfMonth(currentDate),
        };
    }
  }, [viewMode, currentDate]);

  // Fetch scheduled posts
  const { groupedByDate, isLoading } = useScheduledPostsGroupedByDate(
    startDate,
    endDate,
  );
  const { data: stats } = useScheduledPostStats();
  const { data: pendingPosts } = usePendingScheduledPosts();

  // Mutations
  const deleteMutation = useDeleteScheduledPost();
  const cancelMutation = useCancelScheduledPost();
  const rescheduleMutation = useReschedulePost();

  const { showConfirm } = useModal();

  // Navigation handlers
  const navigatePrevious = useCallback(() => {
    switch (viewMode) {
      case "day":
        setCurrentDate((d) => addDays(d, -1));
        break;
      case "week":
        setCurrentDate((d) => subWeeks(d, 1));
        break;
      case "month":
        setCurrentDate((d) => subMonths(d, 1));
        break;
    }
  }, [viewMode]);

  const navigateNext = useCallback(() => {
    switch (viewMode) {
      case "day":
        setCurrentDate((d) => addDays(d, 1));
        break;
      case "week":
        setCurrentDate((d) => addWeeks(d, 1));
        break;
      case "month":
        setCurrentDate((d) => addMonths(d, 1));
        break;
    }
  }, [viewMode]);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  // Post action handlers
  const handleDelete = useCallback(
    async (post: ScheduledPost) => {
      await showConfirm(
        "Delete scheduled post? This action cannot be undone.",
        async () => {
          await deleteMutation.mutateAsync(post.id);
        },
      );
    },
    [deleteMutation, showConfirm],
  );

  const handleCancel = useCallback(
    async (post: ScheduledPost) => {
      await showConfirm(
        "Cancel scheduled post? The post will be cancelled but not deleted.",
        async () => {
          await cancelMutation.mutateAsync(post.id);
        },
      );
    },
    [cancelMutation, showConfirm],
  );

  const openReschedule = useCallback((post: ScheduledPost) => {
    setSelectedPost(post);
    setShowRescheduleModal(true);
    setShowPostMenu(null);
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowPostMenu(null);
    if (showPostMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showPostMenu]);

  // Get title for current view
  const viewTitle = useMemo(() => {
    switch (viewMode) {
      case "day":
        return format(currentDate, "EEEE, MMMM d, yyyy");
      case "week":
        return `${format(startDate, "MMM d")} - ${format(endDate, "MMM d, yyyy")}`;
      case "month":
        return format(currentDate, "MMMM yyyy");
    }
  }, [viewMode, currentDate, startDate, endDate]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Stats Banner */}
      <div
        className="mb-6 rounded-xl p-4"
        style={{ backgroundColor: "var(--bsky-bg-secondary)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Clock size={24} style={{ color: "var(--bsky-primary)" }} />
            <div>
              <h2
                className="text-lg font-semibold"
                style={{ color: "var(--bsky-text-primary)" }}
              >
                Scheduled Posts
              </h2>
              <p
                className="text-sm"
                style={{ color: "var(--bsky-text-secondary)" }}
              >
                {stats?.pending || 0} pending
                {stats?.nextScheduledAt && (
                  <> · Next: {formatScheduledTime(stats.nextScheduledAt)}</>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatBadge
              label="Pending"
              count={stats?.pending || 0}
              color="var(--bsky-primary)"
            />
            <StatBadge
              label="Failed"
              count={stats?.failed || 0}
              color="var(--bsky-error, #ef4444)"
            />
            <StatBadge
              label="Completed"
              count={stats?.completed || 0}
              color="var(--bsky-success, #22c55e)"
            />
          </div>
        </div>
      </div>

      {/* View Controls */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {/* Display Mode Toggle */}
        <div
          className="flex rounded-lg p-1"
          style={{ backgroundColor: "var(--bsky-bg-secondary)" }}
        >
          <button
            onClick={() => setDisplayMode("calendar")}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              displayMode === "calendar" ? "shadow-sm" : ""
            }`}
            style={{
              backgroundColor:
                displayMode === "calendar"
                  ? "var(--bsky-bg-primary)"
                  : "transparent",
              color:
                displayMode === "calendar"
                  ? "var(--bsky-primary)"
                  : "var(--bsky-text-secondary)",
            }}
          >
            <Calendar size={16} />
            Calendar
          </button>
          <button
            onClick={() => setDisplayMode("queue")}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              displayMode === "queue" ? "shadow-sm" : ""
            }`}
            style={{
              backgroundColor:
                displayMode === "queue"
                  ? "var(--bsky-bg-primary)"
                  : "transparent",
              color:
                displayMode === "queue"
                  ? "var(--bsky-primary)"
                  : "var(--bsky-text-secondary)",
            }}
          >
            <List size={16} />
            Queue
          </button>
        </div>

        {/* Calendar Controls (only show in calendar mode) */}
        {displayMode === "calendar" && (
          <div className="flex items-center gap-2">
            {/* View Mode Selector */}
            <div
              className="flex rounded-lg p-1"
              style={{ backgroundColor: "var(--bsky-bg-secondary)" }}
            >
              {(["day", "week", "month"] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`rounded-md px-3 py-1 text-sm font-medium capitalize transition-colors ${
                    viewMode === mode ? "shadow-sm" : ""
                  }`}
                  style={{
                    backgroundColor:
                      viewMode === mode
                        ? "var(--bsky-bg-primary)"
                        : "transparent",
                    color:
                      viewMode === mode
                        ? "var(--bsky-primary)"
                        : "var(--bsky-text-secondary)",
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-1">
              <button
                onClick={navigatePrevious}
                className="rounded-lg p-2 transition-colors hover:bg-opacity-80"
                style={{ color: "var(--bsky-text-secondary)" }}
                aria-label="Previous"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={goToToday}
                className="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: "var(--bsky-bg-secondary)",
                  color: "var(--bsky-text-primary)",
                }}
              >
                Today
              </button>
              <button
                onClick={navigateNext}
                className="rounded-lg p-2 transition-colors hover:bg-opacity-80"
                style={{ color: "var(--bsky-text-secondary)" }}
                aria-label="Next"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* View Title */}
      {displayMode === "calendar" && (
        <h3
          className="mb-4 text-xl font-semibold"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          {viewTitle}
        </h3>
      )}

      {/* Main Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw
            size={24}
            className="animate-spin"
            style={{ color: "var(--bsky-text-secondary)" }}
          />
        </div>
      ) : displayMode === "calendar" ? (
        <CalendarView
          viewMode={viewMode}
          currentDate={currentDate}
          startDate={startDate}
          endDate={endDate}
          groupedByDate={groupedByDate}
          onPostClick={openReschedule}
          onShowMenu={(id) => setShowPostMenu(id)}
          showPostMenu={showPostMenu}
          onDelete={handleDelete}
          onCancel={handleCancel}
          onReschedule={openReschedule}
        />
      ) : (
        <QueueView
          posts={pendingPosts || []}
          onPostClick={openReschedule}
          onShowMenu={(id) => setShowPostMenu(id)}
          showPostMenu={showPostMenu}
          onDelete={handleDelete}
          onCancel={handleCancel}
          onReschedule={openReschedule}
        />
      )}

      {/* Reschedule Modal */}
      {showRescheduleModal && selectedPost && (
        <RescheduleModal
          post={selectedPost}
          onClose={() => {
            setShowRescheduleModal(false);
            setSelectedPost(null);
          }}
          onReschedule={async (newTime) => {
            await rescheduleMutation.mutateAsync({
              id: selectedPost.id,
              newTime,
            });
            setShowRescheduleModal(false);
            setSelectedPost(null);
          }}
          isLoading={rescheduleMutation.isPending}
        />
      )}
    </div>
  );
};

// Stat Badge Component
const StatBadge: React.FC<{
  label: string;
  count: number;
  color: string;
}> = ({ label, count, color }) => (
  <div
    className="flex items-center gap-1.5 rounded-full px-3 py-1"
    style={{ backgroundColor: `${color}15` }}
  >
    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
    <span className="text-xs font-medium" style={{ color }}>
      {count} {label}
    </span>
  </div>
);

// Calendar View Component
const CalendarView: React.FC<{
  viewMode: ViewMode;
  currentDate: Date;
  startDate: Date;
  endDate: Date;
  groupedByDate: Map<string, ScheduledPost[]>;
  onPostClick: (post: ScheduledPost) => void;
  onShowMenu: (id: string | null) => void;
  showPostMenu: string | null;
  onDelete: (post: ScheduledPost) => void;
  onCancel: (post: ScheduledPost) => void;
  onReschedule: (post: ScheduledPost) => void;
}> = ({
  viewMode,
  currentDate,
  startDate,
  endDate,
  groupedByDate,
  onPostClick,
  onShowMenu,
  showPostMenu,
  onDelete,
  onCancel,
  onReschedule,
}) => {
  // Generate days array for the view
  const days = useMemo(() => {
    const result: Date[] = [];
    let current = new Date(startDate);

    if (viewMode === "month") {
      // Start from the beginning of the week that contains the first of the month
      current = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
      const monthEnd = endOfMonth(currentDate);
      const viewEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

      while (current <= viewEnd) {
        result.push(new Date(current));
        current = addDays(current, 1);
      }
    } else {
      while (current <= endDate) {
        result.push(new Date(current));
        current = addDays(current, 1);
      }
    }

    return result;
  }, [viewMode, currentDate, startDate, endDate]);

  if (viewMode === "day") {
    const dayPosts = groupedByDate.get(currentDate.toDateString()) || [];

    return (
      <DayView
        date={currentDate}
        posts={dayPosts}
        onPostClick={onPostClick}
        onShowMenu={onShowMenu}
        showPostMenu={showPostMenu}
        onDelete={onDelete}
        onCancel={onCancel}
        onReschedule={onReschedule}
      />
    );
  }

  return (
    <div
      className="rounded-xl border"
      style={{ borderColor: "var(--bsky-border-primary)" }}
    >
      {/* Day Headers */}
      <div
        className="grid grid-cols-7 border-b"
        style={{ borderColor: "var(--bsky-border-primary)" }}
      >
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className="px-2 py-2 text-center text-xs font-semibold"
            style={{ color: "var(--bsky-text-secondary)" }}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className={`grid grid-cols-7 ${viewMode === "month" ? "" : ""}`}>
        {days.map((day, index) => {
          const dayPosts = groupedByDate.get(day.toDateString()) || [];
          const isCurrentMonth =
            viewMode !== "month" || isSameMonth(day, currentDate);

          return (
            <div
              key={index}
              className={`min-h-[100px] border-b border-r p-2 ${
                !isCurrentMonth ? "opacity-40" : ""
              }`}
              style={{
                borderColor: "var(--bsky-border-primary)",
                backgroundColor: isToday(day)
                  ? "var(--bsky-primary-light, rgba(59, 130, 246, 0.05))"
                  : "transparent",
              }}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-sm ${
                    isToday(day) ? "font-bold" : ""
                  }`}
                  style={{
                    backgroundColor: isToday(day)
                      ? "var(--bsky-primary)"
                      : "transparent",
                    color: isToday(day) ? "white" : "var(--bsky-text-primary)",
                  }}
                >
                  {format(day, "d")}
                </span>
                {dayPosts.length > 0 && (
                  <span
                    className="text-xs font-medium"
                    style={{ color: "var(--bsky-primary)" }}
                  >
                    {dayPosts.length}
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {dayPosts.slice(0, 3).map((post) => (
                  <CalendarPostChip
                    key={post.id}
                    post={post}
                    onClick={() => onPostClick(post)}
                    onShowMenu={onShowMenu}
                    showMenu={showPostMenu === post.id}
                    onDelete={onDelete}
                    onCancel={onCancel}
                    onReschedule={onReschedule}
                  />
                ))}
                {dayPosts.length > 3 && (
                  <span
                    className="block text-xs"
                    style={{ color: "var(--bsky-text-secondary)" }}
                  >
                    +{dayPosts.length - 3} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Day View Component
const DayView: React.FC<{
  date: Date;
  posts: ScheduledPost[];
  onPostClick: (post: ScheduledPost) => void;
  onShowMenu: (id: string | null) => void;
  showPostMenu: string | null;
  onDelete: (post: ScheduledPost) => void;
  onCancel: (post: ScheduledPost) => void;
  onReschedule: (post: ScheduledPost) => void;
}> = ({
  posts,
  onPostClick,
  onShowMenu,
  showPostMenu,
  onDelete,
  onCancel,
  onReschedule,
}) => {
  // Create hour slots
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Group posts by hour
  const postsByHour = useMemo(() => {
    const grouped = new Map<number, ScheduledPost[]>();
    posts.forEach((post) => {
      const hour = new Date(post.scheduledFor).getHours();
      const existing = grouped.get(hour) || [];
      grouped.set(hour, [...existing, post]);
    });
    return grouped;
  }, [posts]);

  return (
    <div
      className="rounded-xl border"
      style={{ borderColor: "var(--bsky-border-primary)" }}
    >
      {hours.map((hour) => {
        const hourPosts = postsByHour.get(hour) || [];
        const timeLabel = format(new Date().setHours(hour, 0, 0, 0), "h a");

        return (
          <div
            key={hour}
            className="flex border-b last:border-b-0"
            style={{ borderColor: "var(--bsky-border-primary)" }}
          >
            <div
              className="w-16 shrink-0 px-2 py-3 text-right text-sm"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              {timeLabel}
            </div>
            <div
              className="min-h-[48px] flex-1 border-l p-2"
              style={{ borderColor: "var(--bsky-border-primary)" }}
            >
              {hourPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onClick={() => onPostClick(post)}
                  onShowMenu={onShowMenu}
                  showMenu={showPostMenu === post.id}
                  onDelete={onDelete}
                  onCancel={onCancel}
                  onReschedule={onReschedule}
                  compact
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Calendar Post Chip Component
const CalendarPostChip: React.FC<{
  post: ScheduledPost;
  onClick: () => void;
  onShowMenu: (id: string | null) => void;
  showMenu: boolean;
  onDelete: (post: ScheduledPost) => void;
  onCancel: (post: ScheduledPost) => void;
  onReschedule: (post: ScheduledPost) => void;
}> = ({
  post,
  onClick,
  onShowMenu,
  showMenu,
  onDelete,
  onCancel,
  onReschedule,
}) => {
  const statusColor = getStatusColor(post.status);
  const time = format(new Date(post.scheduledFor), "h:mm a");

  return (
    <div className="relative">
      <button
        onClick={onClick}
        className="group flex w-full items-center gap-1 rounded px-1.5 py-1 text-left text-xs transition-colors hover:bg-opacity-20"
        style={{
          backgroundColor: `${statusColor}15`,
        }}
      >
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: statusColor }}
        />
        <span
          className="truncate"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          {time}
        </span>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onShowMenu(showMenu ? null : post.id);
        }}
        className="absolute right-0 top-0 p-1 opacity-0 group-hover:opacity-100"
        style={{ color: "var(--bsky-text-secondary)" }}
      >
        <MoreVertical size={12} />
      </button>
      {showMenu && (
        <PostMenu
          post={post}
          onClose={() => onShowMenu(null)}
          onDelete={onDelete}
          onCancel={onCancel}
          onReschedule={onReschedule}
        />
      )}
    </div>
  );
};

// Queue View Component
const QueueView: React.FC<{
  posts: ScheduledPost[];
  onPostClick: (post: ScheduledPost) => void;
  onShowMenu: (id: string | null) => void;
  showPostMenu: string | null;
  onDelete: (post: ScheduledPost) => void;
  onCancel: (post: ScheduledPost) => void;
  onReschedule: (post: ScheduledPost) => void;
}> = ({
  posts,
  onPostClick,
  onShowMenu,
  showPostMenu,
  onDelete,
  onCancel,
  onReschedule,
}) => {
  // Sort posts by scheduled time
  const sortedPosts = useMemo(
    () =>
      [...posts].sort(
        (a, b) =>
          new Date(a.scheduledFor).getTime() -
          new Date(b.scheduledFor).getTime(),
      ),
    [posts],
  );

  if (sortedPosts.length === 0) {
    return (
      <div className="py-12 text-center">
        <Clock
          size={48}
          className="mx-auto mb-4 opacity-50"
          style={{ color: "var(--bsky-text-secondary)" }}
        />
        <h3
          className="mb-2 text-lg font-semibold"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          No scheduled posts
        </h3>
        <p className="text-sm" style={{ color: "var(--bsky-text-secondary)" }}>
          Schedule a post to see it here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortedPosts.map((post, index) => (
        <PostCard
          key={post.id}
          post={post}
          onClick={() => onPostClick(post)}
          onShowMenu={onShowMenu}
          showMenu={showPostMenu === post.id}
          onDelete={onDelete}
          onCancel={onCancel}
          onReschedule={onReschedule}
          queuePosition={index + 1}
        />
      ))}
    </div>
  );
};

// Post Card Component
const PostCard: React.FC<{
  post: ScheduledPost;
  onClick: () => void;
  onShowMenu: (id: string | null) => void;
  showMenu: boolean;
  onDelete: (post: ScheduledPost) => void;
  onCancel: (post: ScheduledPost) => void;
  onReschedule: (post: ScheduledPost) => void;
  compact?: boolean;
  queuePosition?: number;
}> = ({
  post,
  onClick,
  onShowMenu,
  showMenu,
  onDelete,
  onCancel,
  onReschedule,
  compact = false,
  queuePosition,
}) => {
  const statusColor = getStatusColor(post.status);
  const statusLabel = getStatusLabel(post.status);
  const content = post.text || post.threadPosts?.[0]?.text || "Scheduled post";
  const isThread = post.threadPosts && post.threadPosts.length > 1;
  const mediaCount =
    (post.media?.length || 0) +
    (post.threadPosts?.reduce((acc, p) => acc + (p.media?.length || 0), 0) ||
      0);

  return (
    <div
      className={`group relative cursor-pointer rounded-xl border transition-all hover:shadow-md ${
        compact ? "p-2" : "p-4"
      }`}
      style={{
        borderColor: "var(--bsky-border-primary)",
        backgroundColor: "var(--bsky-bg-primary)",
      }}
      onClick={onClick}
    >
      {/* Queue Position Badge */}
      {queuePosition && (
        <div
          className="absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: "var(--bsky-primary)" }}
        >
          {queuePosition}
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Status Indicator */}
        <div
          className="mt-1 h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: statusColor }}
          title={statusLabel}
        />

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Time and Status */}
          <div className="mb-1 flex items-center gap-2">
            <span
              className="text-sm font-medium"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              {formatScheduledTime(post.scheduledFor)}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: `${statusColor}15`,
                color: statusColor,
              }}
            >
              {statusLabel}
            </span>
            {isThread && (
              <span
                className="text-xs"
                style={{ color: "var(--bsky-text-secondary)" }}
              >
                {post.threadPosts!.length} posts
              </span>
            )}
          </div>

          {/* Post Content Preview */}
          <p
            className={`${compact ? "line-clamp-1" : "line-clamp-2"}`}
            style={{ color: "var(--bsky-text-primary)" }}
          >
            {content}
          </p>

          {/* Media Indicator */}
          {mediaCount > 0 && (
            <span
              className="mt-1 inline-flex items-center gap-1 text-xs"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              📎 {mediaCount} media
            </span>
          )}

          {/* Failed Error Message */}
          {post.status === "failed" && post.lastError && (
            <div
              className="mt-2 flex items-start gap-2 rounded-lg p-2"
              style={{ backgroundColor: "var(--bsky-error-bg, #fef2f2)" }}
            >
              <AlertCircle
                size={16}
                style={{ color: "var(--bsky-error, #ef4444)" }}
              />
              <span
                className="text-xs"
                style={{ color: "var(--bsky-error, #ef4444)" }}
              >
                {post.lastError}
              </span>
            </div>
          )}
        </div>

        {/* Actions Menu */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShowMenu(showMenu ? null : post.id);
            }}
            className="rounded-lg p-1.5 transition-colors hover:bg-opacity-80"
            style={{ color: "var(--bsky-text-secondary)" }}
            aria-label="Post options"
          >
            <MoreVertical size={18} />
          </button>
          {showMenu && (
            <PostMenu
              post={post}
              onClose={() => onShowMenu(null)}
              onDelete={onDelete}
              onCancel={onCancel}
              onReschedule={onReschedule}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// Post Menu Component
const PostMenu: React.FC<{
  post: ScheduledPost;
  onClose: () => void;
  onDelete: (post: ScheduledPost) => void;
  onCancel: (post: ScheduledPost) => void;
  onReschedule: (post: ScheduledPost) => void;
}> = ({ post, onClose, onDelete, onCancel, onReschedule }) => {
  const canReschedule = post.status === "pending" || post.status === "failed";
  const canCancel = post.status === "pending";

  return (
    <div
      className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-lg border py-1 shadow-lg"
      style={{
        backgroundColor: "var(--bsky-bg-primary)",
        borderColor: "var(--bsky-border-primary)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {canReschedule && (
        <button
          onClick={() => onReschedule(post)}
          className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-opacity-80"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          <Clock size={16} />
          Reschedule
        </button>
      )}
      <button
        onClick={() => {
          // TODO: Open edit modal
          onClose();
        }}
        className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-opacity-80"
        style={{ color: "var(--bsky-text-primary)" }}
      >
        <Edit2 size={16} />
        Edit
      </button>
      {canCancel && (
        <button
          onClick={() => onCancel(post)}
          className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-opacity-80"
          style={{ color: "var(--bsky-warning, #f59e0b)" }}
        >
          <X size={16} />
          Cancel
        </button>
      )}
      <button
        onClick={() => onDelete(post)}
        className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-opacity-80"
        style={{ color: "var(--bsky-error, #ef4444)" }}
      >
        <Trash2 size={16} />
        Delete
      </button>
    </div>
  );
};

// Reschedule Modal Component
const RescheduleModal: React.FC<{
  post: ScheduledPost;
  onClose: () => void;
  onReschedule: (newTime: Date) => Promise<void>;
  isLoading: boolean;
}> = ({ post, onClose, onReschedule, isLoading }) => {
  const [selectedDate, setSelectedDate] = useState(
    format(new Date(post.scheduledFor), "yyyy-MM-dd"),
  );
  const [selectedTime, setSelectedTime] = useState(
    format(new Date(post.scheduledFor), "HH:mm"),
  );
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestedTimes = useMemo(() => getSuggestedPostingTimes(), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newTime = new Date(`${selectedDate}T${selectedTime}`);
    await onReschedule(newTime);
  };

  const selectSuggestedTime = (date: Date) => {
    setSelectedDate(format(date, "yyyy-MM-dd"));
    setSelectedTime(format(date, "HH:mm"));
    setShowSuggestions(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl p-6"
        style={{ backgroundColor: "var(--bsky-bg-primary)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3
            className="text-lg font-semibold"
            style={{ color: "var(--bsky-text-primary)" }}
          >
            Reschedule Post
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 transition-colors hover:bg-opacity-80"
            style={{ color: "var(--bsky-text-secondary)" }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Post Preview */}
        <div
          className="mb-4 rounded-lg p-3"
          style={{ backgroundColor: "var(--bsky-bg-secondary)" }}
        >
          <p
            className="line-clamp-2 text-sm"
            style={{ color: "var(--bsky-text-primary)" }}
          >
            {post.text || post.threadPosts?.[0]?.text || "Scheduled post"}
          </p>
          <p
            className="mt-1 text-xs"
            style={{ color: "var(--bsky-text-secondary)" }}
          >
            Currently: {formatScheduledTime(post.scheduledFor)}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Date/Time Inputs */}
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label
                className="mb-1 block text-sm font-medium"
                style={{ color: "var(--bsky-text-secondary)" }}
              >
                Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={format(new Date(), "yyyy-MM-dd")}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{
                  borderColor: "var(--bsky-border-primary)",
                  backgroundColor: "var(--bsky-bg-secondary)",
                  color: "var(--bsky-text-primary)",
                }}
              />
            </div>
            <div>
              <label
                className="mb-1 block text-sm font-medium"
                style={{ color: "var(--bsky-text-secondary)" }}
              >
                Time
              </label>
              <input
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{
                  borderColor: "var(--bsky-border-primary)",
                  backgroundColor: "var(--bsky-bg-secondary)",
                  color: "var(--bsky-text-primary)",
                }}
              />
            </div>
          </div>

          {/* Suggested Times Toggle */}
          <button
            type="button"
            onClick={() => setShowSuggestions(!showSuggestions)}
            className="mb-3 flex items-center gap-2 text-sm font-medium transition-colors"
            style={{ color: "var(--bsky-primary)" }}
          >
            <Sparkles size={16} />
            {showSuggestions ? "Hide" : "Show"} optimal times
          </button>

          {/* Suggested Times */}
          {showSuggestions && (
            <div className="mb-4 grid grid-cols-2 gap-2">
              {suggestedTimes.slice(0, 6).map((time, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => selectSuggestedTime(time)}
                  className="rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:border-blue-500"
                  style={{
                    borderColor: "var(--bsky-border-primary)",
                    backgroundColor: "var(--bsky-bg-secondary)",
                    color: "var(--bsky-text-primary)",
                  }}
                >
                  {formatScheduledTime(time)}
                </button>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              style={{
                backgroundColor: "var(--bsky-bg-secondary)",
                color: "var(--bsky-text-primary)",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: "var(--bsky-primary)" }}
            >
              {isLoading && <RefreshCw size={16} className="animate-spin" />}
              Reschedule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ScheduledPosts;
