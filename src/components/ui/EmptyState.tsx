/**
 * EmptyState - Reusable component for empty, error, and first-time-user states
 *
 * Provides consistent UI for:
 * - Empty search results
 * - First-time user experiences
 * - Error states with recovery actions
 * - Offline states
 */

import {
  BookmarkIcon,
  CloudOff,
  Inbox,
  MessageSquare,
  Search,
  Users,
  type LucideIcon,
} from "lucide-react";
import React from "react";
import { ErrorIllustration, type ErrorIllustrationType } from "./ErrorIllustration";

export type EmptyStateVariant =
  | "empty"
  | "search"
  | "bookmarks"
  | "messages"
  | "followers"
  | "following"
  | "notifications"
  | "offline"
  | "error"
  | "first-time";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
  icon?: LucideIcon;
}

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title?: string;
  message?: string;
  illustration?: ErrorIllustrationType;
  icon?: LucideIcon;
  actions?: EmptyStateAction[];
  className?: string;
  compact?: boolean;
}

interface VariantConfig {
  title: string;
  message: string;
  illustration: ErrorIllustrationType;
  icon: LucideIcon;
}

const variantConfigs: Record<EmptyStateVariant, VariantConfig> = {
  empty: {
    title: "Nothing here yet",
    message: "This area is empty. Check back later for new content.",
    illustration: "empty",
    icon: Inbox,
  },
  search: {
    title: "No results found",
    message: "Try adjusting your search terms or check for typos.",
    illustration: "not-found",
    icon: Search,
  },
  bookmarks: {
    title: "No bookmarks yet",
    message: "Save posts you want to read later by clicking the bookmark icon.",
    illustration: "empty",
    icon: BookmarkIcon,
  },
  messages: {
    title: "No messages",
    message: "Start a conversation with someone you follow.",
    illustration: "empty",
    icon: MessageSquare,
  },
  followers: {
    title: "No followers yet",
    message: "When people follow this account, they'll appear here.",
    illustration: "empty",
    icon: Users,
  },
  following: {
    title: "Not following anyone",
    message: "Follow accounts to see their posts in your feed.",
    illustration: "empty",
    icon: Users,
  },
  notifications: {
    title: "No notifications",
    message: "You're all caught up! New activity will appear here.",
    illustration: "empty",
    icon: Inbox,
  },
  offline: {
    title: "You're offline",
    message: "Check your internet connection and try again.",
    illustration: "offline",
    icon: CloudOff,
  },
  error: {
    title: "Something went wrong",
    message: "We couldn't load this content. Please try again.",
    illustration: "error",
    icon: Inbox,
  },
  "first-time": {
    title: "Welcome!",
    message: "Get started by exploring the features available to you.",
    illustration: "empty",
    icon: Inbox,
  },
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  variant = "empty",
  title: customTitle,
  message: customMessage,
  illustration: customIllustration,
  icon: CustomIcon,
  actions,
  className = "",
  compact = false,
}) => {
  const config = variantConfigs[variant];
  const title = customTitle || config.title;
  const message = customMessage || config.message;
  const illustration = customIllustration || config.illustration;
  const Icon = CustomIcon || config.icon;

  if (compact) {
    return (
      <div
        className={`flex flex-col items-center justify-center py-6 text-center ${className}`}
      >
        <Icon
          className="mb-2 h-8 w-8"
          style={{ color: "var(--bsky-text-tertiary)" }}
        />
        <p
          className="text-sm font-medium"
          style={{ color: "var(--bsky-text-secondary)" }}
        >
          {title}
        </p>
        <p
          className="mt-1 text-xs"
          style={{ color: "var(--bsky-text-tertiary)" }}
        >
          {message}
        </p>
        {actions && actions.length > 0 && (
          <div className="mt-3 flex gap-2">
            {actions.map((action, index) => {
              const ActionIcon = action.icon;
              return (
                <button
                  key={index}
                  onClick={action.onClick}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    action.variant === "secondary"
                      ? "border hover:opacity-80"
                      : "text-white"
                  }`}
                  style={
                    action.variant === "secondary"
                      ? {
                          backgroundColor: "var(--bsky-bg-secondary)",
                          borderColor: "var(--bsky-border)",
                          color: "var(--bsky-text-primary)",
                        }
                      : {
                          backgroundColor: "var(--bsky-primary)",
                        }
                  }
                >
                  {ActionIcon && <ActionIcon className="h-3.5 w-3.5" />}
                  {action.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center py-12 text-center ${className}`}
    >
      <ErrorIllustration type={illustration} size="md" className="mb-4" />

      <h3
        className="mb-2 text-lg font-semibold"
        style={{ color: "var(--bsky-text-primary)" }}
      >
        {title}
      </h3>

      <p
        className="mb-6 max-w-sm text-sm"
        style={{ color: "var(--bsky-text-secondary)" }}
      >
        {message}
      </p>

      {actions && actions.length > 0 && (
        <div className="flex flex-wrap justify-center gap-3">
          {actions.map((action, index) => {
            const ActionIcon = action.icon;
            return (
              <button
                key={index}
                onClick={action.onClick}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  action.variant === "secondary"
                    ? "border hover:opacity-80"
                    : "text-white"
                }`}
                style={
                  action.variant === "secondary"
                    ? {
                        backgroundColor: "var(--bsky-bg-secondary)",
                        borderColor: "var(--bsky-border)",
                        color: "var(--bsky-text-primary)",
                      }
                    : {
                        backgroundColor: "var(--bsky-primary)",
                      }
                }
              >
                {ActionIcon && <ActionIcon className="h-4 w-4" />}
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/**
 * Convenience component for search empty states
 */
export const SearchEmptyState: React.FC<{
  query?: string;
  onClearSearch?: () => void;
  className?: string;
}> = ({ query, onClearSearch, className }) => (
  <EmptyState
    variant="search"
    title="No results found"
    message={
      query
        ? `We couldn't find anything matching "${query}". Try different keywords.`
        : "Enter a search term to find posts, people, or topics."
    }
    actions={
      onClearSearch
        ? [{ label: "Clear search", onClick: onClearSearch, variant: "secondary" }]
        : undefined
    }
    className={className}
  />
);

/**
 * Convenience component for offline states
 */
export const OfflineEmptyState: React.FC<{
  onRetry?: () => void;
  className?: string;
}> = ({ onRetry, className }) => (
  <EmptyState
    variant="offline"
    actions={
      onRetry
        ? [{ label: "Try again", onClick: onRetry, variant: "primary" }]
        : undefined
    }
    className={className}
  />
);

/**
 * Convenience component for error states with retry
 */
export const ErrorEmptyState: React.FC<{
  message?: string;
  onRetry?: () => void;
  className?: string;
}> = ({ message, onRetry, className }) => (
  <EmptyState
    variant="error"
    message={message}
    actions={
      onRetry
        ? [{ label: "Try again", onClick: onRetry, variant: "primary" }]
        : undefined
    }
    className={className}
  />
);

export default EmptyState;
