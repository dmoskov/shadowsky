import { ArrowUp } from "lucide-react";
import React from "react";

/**
 * Floating "New posts" pill shown when fresh feed content is available
 * (see useFeedFreshness). Zero-height sticky wrapper so appearing/disappearing
 * never shifts the feed layout; sticks near the top of the scroll context in
 * both single-column (window scroll) and deck-column (overflow scroll) modes.
 */
export const NewPostsPill: React.FC<{ onClick: () => void }> = ({
  onClick,
}) => (
  <div className="pointer-events-none sticky top-2 z-10 h-0">
    <div className="flex justify-center">
      <button
        onClick={onClick}
        aria-label="Load new posts"
        className="pointer-events-auto flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium text-white shadow-asph-lg transition-opacity hover:opacity-90"
        style={{ backgroundColor: "var(--asph-primary)" }}
      >
        <ArrowUp size={14} />
        New posts
      </button>
    </div>
  </div>
);
