/**
 * NewPostsIndicator Component
 *
 * Displays a floating indicator at the top of the timeline when new posts
 * are available from followed accounts. Clicking the indicator scrolls to
 * the top and refreshes the timeline.
 *
 * Features:
 * - Animated entrance/exit
 * - Shows count of new posts available
 * - Auto-hides after refresh
 * - Accessible with keyboard support
 */

import React from "react";

interface NewPostsIndicatorProps {
  /** Number of new posts available */
  count: number;
  /** Callback when user clicks to refresh */
  onRefresh: () => void;
  /** Optional CSS class name */
  className?: string;
}

export const NewPostsIndicator: React.FC<NewPostsIndicatorProps> = ({
  count,
  onRefresh,
  className = "",
}) => {
  if (count === 0) {
    return null;
  }

  const handleClick = () => {
    // Scroll to top of page
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Trigger refresh
    onRefresh();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      className={`animate-slide-down fixed left-1/2 top-20 z-50 -translate-x-1/2 ${className}`}
    >
      <button
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className="flex transform items-center gap-2 rounded-full bg-blue-500 px-6 py-3 text-white shadow-lg transition-all duration-200 hover:scale-105 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
        aria-live="polite"
        aria-label={`${count} new ${count === 1 ? "post" : "posts"} available. Click to refresh.`}
      >
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 10l7-7m0 0l7 7m-7-7v18"
          />
        </svg>
        <span className="font-medium">
          {count} new {count === 1 ? "post" : "posts"}
        </span>
      </button>
    </div>
  );
};

export default NewPostsIndicator;
