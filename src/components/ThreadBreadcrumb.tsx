import type { AppBskyFeedDefs } from "@atproto/api";
import { ChevronRight, Home, MoreHorizontal } from "lucide-react";
import React, { useMemo } from "react";

type Post = AppBskyFeedDefs.PostView;

interface BreadcrumbItem {
  post: Post;
  index: number;
}

interface ThreadBreadcrumbProps {
  posts: Post[];
  currentIndex: number;
  onNavigate: (index: number) => void;
  className?: string;
}

export const ThreadBreadcrumb: React.FC<ThreadBreadcrumbProps> = ({
  posts,
  currentIndex,
  onNavigate,
  className = "",
}) => {
  // Build the path from root to current focused post
  const breadcrumbPath = useMemo((): BreadcrumbItem[] => {
    if (
      posts.length === 0 ||
      currentIndex < 0 ||
      currentIndex >= posts.length
    ) {
      return [];
    }

    const currentPost = posts[currentIndex];
    if (!currentPost) return [];

    const path: BreadcrumbItem[] = [];
    const visited = new Set<string>();

    // Walk backward from current post to root following parent chain
    let current: Post | undefined = currentPost;
    let currentIdx = currentIndex;

    while (current && !visited.has(current.uri)) {
      visited.add(current.uri);
      path.unshift({ post: current, index: currentIdx });

      // Find parent
      const record = current.record as { reply?: { parent?: { uri: string } } };
      const parentUri = record?.reply?.parent?.uri;

      if (parentUri) {
        const parentIdx = posts.findIndex((p) => p.uri === parentUri);
        if (parentIdx >= 0) {
          current = posts[parentIdx];
          currentIdx = parentIdx;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    return path;
  }, [posts, currentIndex]);

  // Compute depth (0-indexed from root)
  const depth = breadcrumbPath.length - 1;

  // Responsive: collapse middle items on mobile if path is long
  const displayPath = useMemo(() => {
    if (breadcrumbPath.length <= 3) {
      return { items: breadcrumbPath, collapsed: false };
    }

    // Show root, "...", and last two items
    return {
      items: [
        breadcrumbPath[0],
        null, // placeholder for ellipsis
        ...breadcrumbPath.slice(-2),
      ] as (BreadcrumbItem | null)[],
      collapsed: true,
      hiddenCount: breadcrumbPath.length - 3,
    };
  }, [breadcrumbPath]);

  if (breadcrumbPath.length === 0) {
    return null;
  }

  return (
    <div
      className={`flex items-center gap-1 overflow-x-auto ${className}`}
      style={{
        backgroundColor: "var(--asph-bg-tertiary)",
        borderRadius: "8px",
        padding: "8px 12px",
      }}
    >
      {/* Depth badge */}
      {depth > 0 && (
        <span
          className="mr-2 flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: "var(--asph-primary)",
            color: "white",
          }}
          title={`Depth: ${depth} ${depth === 1 ? "level" : "levels"} deep`}
        >
          D{depth}
        </span>
      )}

      {/* Breadcrumb items */}
      <div className="flex min-w-0 flex-1 items-center gap-1">
        {displayPath.items.map((item, idx) => {
          // Render ellipsis
          if (item === null) {
            return (
              <React.Fragment key="ellipsis">
                <ChevronRight
                  size={14}
                  className="flex-shrink-0"
                  style={{ color: "var(--asph-text-tertiary)" }}
                />
                <span
                  className="hidden flex-shrink-0 rounded px-1 py-0.5 text-xs sm:inline-flex"
                  style={{ color: "var(--asph-text-tertiary)" }}
                  title={`${displayPath.hiddenCount} posts hidden`}
                >
                  <MoreHorizontal size={14} />
                </span>
              </React.Fragment>
            );
          }

          const isRoot = idx === 0 && !displayPath.collapsed;
          const isCurrent =
            idx === displayPath.items.length - 1 ||
            (displayPath.collapsed && idx === displayPath.items.length - 1);
          const actualItem = item as BreadcrumbItem;

          return (
            <React.Fragment key={actualItem.post.uri}>
              {idx > 0 && item !== null && (
                <ChevronRight
                  size={14}
                  className="flex-shrink-0"
                  style={{ color: "var(--asph-text-tertiary)" }}
                />
              )}
              <button
                onClick={() => onNavigate(actualItem.index)}
                disabled={isCurrent}
                className={`flex min-w-0 max-w-[120px] items-center gap-1 rounded px-2 py-1 text-xs transition-colors sm:max-w-[150px] ${
                  isCurrent
                    ? "cursor-default font-medium"
                    : "hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
                style={{
                  color: isCurrent
                    ? "var(--asph-text-primary)"
                    : "var(--asph-text-secondary)",
                }}
                title={`@${actualItem.post.author.handle}${
                  actualItem.post.author.displayName
                    ? ` (${actualItem.post.author.displayName})`
                    : ""
                }`}
              >
                {isRoot && <Home size={12} className="flex-shrink-0" />}
                <span className="truncate">
                  @{actualItem.post.author.handle.split(".")[0]}
                </span>
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
