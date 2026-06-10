/**
 * ThreadContextBar - Sticky header for deep thread navigation
 *
 * Provides persistent context when scrolling through complex threads:
 * - Shows haiku summary snippet
 * - Quick stats (posts, participants, depth)
 * - Jump to dropdown for navigation
 * - Quick-jump buttons (start/end/parent)
 *
 * Uses Intersection Observer for performance-optimized scroll detection
 */

import type { AppBskyFeedDefs } from "@atproto/api";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  GitBranch,
  Home,
  Sparkles,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Post = AppBskyFeedDefs.PostView;

interface ThreadContextBarProps {
  posts: Post[];
  threadUri: string;
  haikuSummary?: string | null;
  currentIndex: number;
  totalPosts: number;
  uniqueParticipants: number;
  maxDepth: number;
  onJumpToStart: () => void;
  onJumpToEnd: () => void;
  onJumpToParent: () => void;
  onJumpToIndex: (index: number) => void;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
}

interface JumpTarget {
  label: string;
  index: number;
  description?: string;
}

export function ThreadContextBar({
  posts,
  haikuSummary,
  currentIndex,
  totalPosts,
  uniqueParticipants,
  maxDepth,
  onJumpToStart,
  onJumpToEnd,
  onJumpToParent,
  onJumpToIndex,
  sentinelRef,
  className = "",
}: ThreadContextBarProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [jumpMenuOpen, setJumpMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Set up Intersection Observer
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show context bar when sentinel is NOT visible (scrolled past)
        setIsVisible(!entry.isIntersecting);
      },
      {
        root: null, // Use viewport
        threshold: 0,
        rootMargin: "-64px 0px 0px 0px", // Account for header height
      },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [sentinelRef]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setJumpMenuOpen(false);
      }
    };

    if (jumpMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [jumpMenuOpen]);

  // Build jump targets from posts
  const jumpTargets: JumpTarget[] = useMemo(() => {
    const targets: JumpTarget[] = [];

    // Add root post
    targets.push({
      label: "Start of thread",
      index: 0,
      description: "Go to the original post",
    });

    // Find branch points (posts with multiple direct replies)
    const replyCountMap = new Map<string, number>();
    posts.forEach((post) => {
      const record = post.record as { reply?: { parent?: { uri: string } } };
      const parentUri = record?.reply?.parent?.uri;
      if (parentUri) {
        replyCountMap.set(parentUri, (replyCountMap.get(parentUri) || 0) + 1);
      }
    });

    // Add branch points
    posts.forEach((post, idx) => {
      const replyCount = replyCountMap.get(post.uri) || 0;
      if (replyCount > 1 && idx !== 0) {
        targets.push({
          label: `Branch point (${replyCount} replies)`,
          index: idx,
          description: `@${post.author.handle}`,
        });
      }
    });

    // Add end of thread
    if (totalPosts > 1) {
      targets.push({
        label: "End of thread",
        index: totalPosts - 1,
        description: "Go to the latest post",
      });
    }

    return targets;
  }, [posts, totalPosts]);

  // Truncate haiku for compact display
  const truncatedHaiku = useMemo(() => {
    if (!haikuSummary) return null;
    // Take first line of haiku
    const firstLine = haikuSummary.split("\n")[0];
    if (firstLine.length > 40) {
      return firstLine.substring(0, 37) + "...";
    }
    return firstLine;
  }, [haikuSummary]);

  // Handle jump selection
  const handleJumpSelect = useCallback(
    (target: JumpTarget) => {
      onJumpToIndex(target.index);
      setJumpMenuOpen(false);
    },
    [onJumpToIndex],
  );

  // Handle keyboard navigation in menu
  const handleMenuKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setJumpMenuOpen(false);
    }
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={`fixed left-0 right-0 top-0 z-[102] transition-all duration-300 ${
        isVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
      } ${className}`}
      style={{
        backgroundColor: "var(--asph-bg-primary)",
        borderBottom: "1px solid var(--asph-border-primary)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2">
        {/* Left section: Haiku snippet */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {truncatedHaiku && (
            <div className="flex min-w-0 items-center gap-1.5">
              <Sparkles
                size={14}
                className="flex-shrink-0 text-violet-500 dark:text-violet-400"
              />
              <span
                className="truncate text-xs italic"
                style={{ color: "var(--asph-text-secondary)" }}
                title={haikuSummary || undefined}
              >
                {truncatedHaiku}
              </span>
            </div>
          )}
        </div>

        {/* Center section: Quick stats */}
        <div className="flex flex-shrink-0 items-center gap-3">
          <div
            className="flex items-center gap-1 text-xs"
            style={{ color: "var(--asph-text-tertiary)" }}
            title={`${totalPosts} posts in thread`}
          >
            <span
              className="font-medium"
              style={{ color: "var(--asph-text-secondary)" }}
            >
              {totalPosts}
            </span>
            <span className="hidden sm:inline">posts</span>
          </div>

          <div
            className="flex items-center gap-1 text-xs"
            style={{ color: "var(--asph-text-tertiary)" }}
            title={`${uniqueParticipants} participants`}
          >
            <Users size={12} className="flex-shrink-0" />
            <span
              className="font-medium"
              style={{ color: "var(--asph-text-secondary)" }}
            >
              {uniqueParticipants}
            </span>
          </div>

          {maxDepth > 2 && (
            <div
              className="flex items-center gap-1 text-xs"
              style={{ color: "var(--asph-text-tertiary)" }}
              title={`Max depth: ${maxDepth} levels`}
            >
              <GitBranch size={12} className="flex-shrink-0" />
              <span
                className="font-medium"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                {maxDepth}
              </span>
            </div>
          )}

          {/* Current position indicator */}
          <div
            className="rounded-full px-2 py-0.5 text-xs"
            style={{
              backgroundColor: "var(--asph-bg-tertiary)",
              color: "var(--asph-text-secondary)",
            }}
          >
            {currentIndex + 1}/{totalPosts}
          </div>
        </div>

        {/* Right section: Navigation buttons */}
        <div className="flex flex-shrink-0 items-center gap-1">
          {/* Jump to dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setJumpMenuOpen(!jumpMenuOpen)}
              onKeyDown={handleMenuKeyDown}
              className="touch-target-sm flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors hover:bg-asph-bg-hover"
              style={{ color: "var(--asph-text-secondary)" }}
              title="Jump to..."
              aria-expanded={jumpMenuOpen}
              aria-haspopup="true"
            >
              <span className="hidden sm:inline">Jump</span>
              {jumpMenuOpen ? (
                <ChevronUp size={14} />
              ) : (
                <ChevronDown size={14} />
              )}
            </button>

            {/* Dropdown menu */}
            {jumpMenuOpen && (
              <div
                className="absolute right-0 top-full z-10 mt-1 min-w-[200px] rounded-lg border py-1 shadow-lg"
                style={{
                  backgroundColor: "var(--asph-bg-primary)",
                  borderColor: "var(--asph-border-primary)",
                }}
              >
                {jumpTargets.map((target) => (
                  <button
                    key={`${target.label}-${target.index}`}
                    onClick={() => handleJumpSelect(target)}
                    style={{ color: "var(--asph-text-primary)" }}
                  >
                    <span>{target.label}</span>
                    {target.description && (
                      <span
                        className="touch-target-list-item ml-2 flex w-full items-center justify-between px-3 py-2 text-left text-sm text-xs transition-colors hover:bg-asph-bg-hover"
                        style={{ color: "var(--asph-text-tertiary)" }}
                      >
                        {target.description}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick navigation buttons */}
          <button
            onClick={onJumpToStart}
            className="touch-target-icon rounded-lg p-1.5 transition-colors hover:bg-asph-bg-hover"
            style={{ color: "var(--asph-text-secondary)" }}
            title="Jump to start (Home)"
            disabled={currentIndex === 0}
          >
            <Home size={16} />
          </button>

          <button
            onClick={onJumpToParent}
            className="touch-target-icon rounded-lg p-1.5 transition-colors hover:bg-asph-bg-hover"
            style={{ color: "var(--asph-text-secondary)" }}
            title="Jump to parent post"
          >
            <ArrowUp size={16} />
          </button>

          <button
            onClick={onJumpToEnd}
            className="touch-target-icon rounded-lg p-1.5 transition-colors hover:bg-asph-bg-hover"
            style={{ color: "var(--asph-text-secondary)" }}
            title="Jump to end (End)"
            disabled={currentIndex === totalPosts - 1}
          >
            <ArrowDown size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default ThreadContextBar;
