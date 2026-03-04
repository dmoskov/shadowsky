/**
 * NewContentIndicator - Floating indicator for new content above viewport
 *
 * Shows a pill-shaped button when new content (posts/notifications) has been
 * inserted above the user's current scroll position. Clicking scrolls to top
 * to reveal the new content.
 *
 * Features:
 * - Smooth entrance/exit animations
 * - Bounce animation on icon for attention
 * - Respects prefers-reduced-motion
 * - Accessible with keyboard navigation
 */

import React, { memo, useCallback, useEffect, useState } from "react";

export interface NewContentIndicatorProps {
  /** Number of new items above the viewport */
  count: number;
  /** Whether to show the indicator */
  show: boolean;
  /** Called when indicator is clicked */
  onClick: () => void;
  /** Label for the content type (default: "new posts") */
  label?: string;
  /** Singular label (default: "new post") */
  singularLabel?: string;
  /** Additional CSS class */
  className?: string;
  /** Position from top (default: 16px) */
  topOffset?: number;
  /** Z-index (default: 100) */
  zIndex?: number;
}

export const NewContentIndicator = memo(function NewContentIndicator({
  count,
  show,
  onClick,
  label = "new posts",
  singularLabel = "new post",
  className = "",
  topOffset = 16,
  zIndex = 100,
}: NewContentIndicatorProps) {
  const [isExiting, setIsExiting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Handle show/hide with exit animation
  useEffect(() => {
    if (show && count > 0) {
      setIsExiting(false);
      setIsVisible(true);
    } else if (isVisible && !show) {
      // Start exit animation
      setIsExiting(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setIsExiting(false);
      }, 200); // Match exit animation duration
      return () => clearTimeout(timer);
    }
  }, [show, count, isVisible]);

  const handleClick = useCallback(() => {
    setIsExiting(true);
    // Small delay before calling onClick to allow exit animation to start
    setTimeout(() => {
      onClick();
    }, 50);
  }, [onClick]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleClick();
      }
    },
    [handleClick],
  );

  if (!isVisible) {
    return null;
  }

  const displayText = count === 1 ? `1 ${singularLabel}` : `${count} ${label}`;

  return (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`touch-target new-content-indicator ${isExiting ? "exiting" : ""} ${className}`}
      style={{
        top: topOffset,
        zIndex,
      }}
      aria-label={`View ${displayText}. Click to scroll to top.`}
      aria-live="polite"
    >
      {/* Up arrow icon */}
      <svg
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 10l7-7m0 0l7 7m-7-7v18"
        />
      </svg>
      <span>{displayText}</span>
    </button>
  );
});

NewContentIndicator.displayName = "NewContentIndicator";

/**
 * NewNotificationsIndicator - Specialized indicator for notifications
 */
export interface NewNotificationsIndicatorProps {
  count: number;
  show: boolean;
  onClick: () => void;
  className?: string;
}

export const NewNotificationsIndicator = memo(
  function NewNotificationsIndicator({
    count,
    show,
    onClick,
    className = "",
  }: NewNotificationsIndicatorProps) {
    return (
      <NewContentIndicator
        count={count}
        show={show}
        onClick={onClick}
        label="new notifications"
        singularLabel="new notification"
        className={className}
      />
    );
  },
);

NewNotificationsIndicator.displayName = "NewNotificationsIndicator";

/**
 * NewPostsIndicator - Specialized indicator for feed posts
 */
export interface NewPostsIndicatorProps {
  count: number;
  show: boolean;
  onClick: () => void;
  className?: string;
}

export const NewPostsIndicator = memo(function NewPostsIndicator({
  count,
  show,
  onClick,
  className = "",
}: NewPostsIndicatorProps) {
  return (
    <NewContentIndicator
      count={count}
      show={show}
      onClick={onClick}
      label="new posts"
      singularLabel="new post"
      className={className}
    />
  );
});

NewPostsIndicator.displayName = "NewPostsIndicator";
