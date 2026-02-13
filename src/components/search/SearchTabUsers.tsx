import type { BskyAgent } from "@atproto/api";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Users } from "lucide-react";
import React from "react";
import { proxifyBskyImage } from "../../utils/image-proxy";
import { LoadingState } from "../ui/LoadingState";

interface SearchTabUsersProps {
  activeSearchQuery: string;
  agent: BskyAgent | null;
  isUserMuted: (did: string) => boolean;
  isUserBlocked: (did: string) => boolean;
  navigate: (path: string) => void;
}

export const SearchTabUsers: React.FC<SearchTabUsersProps> = React.memo(
  ({ activeSearchQuery, agent, isUserMuted, isUserBlocked, navigate }) => {
    // Search users query
    const {
      data: usersSearchResults,
      isLoading: isLoadingUsers,
      error: usersError,
    } = useQuery({
      queryKey: ["searchUsers", activeSearchQuery],
      queryFn: async () => {
        if (!activeSearchQuery.trim()) return null;

        const response = await agent!.app.bsky.actor.searchActors({
          q: activeSearchQuery,
          limit: 50,
        });

        return response.data;
      },
      enabled: !!agent && !!activeSearchQuery.trim(),
    });

    // Show loading state
    if (isLoadingUsers) {
      return (
        <LoadingState
          variant="spinner"
          size="lg"
          message="Searching..."
          centered
          className="py-6"
        />
      );
    }

    // Show error state
    if (usersError) {
      return (
        <div
          className="rounded-xl border bg-red-500 bg-opacity-5 p-6 text-center"
          style={{ borderColor: "var(--asph-error)" }}
        >
          <p className="text-sm" style={{ color: "var(--asph-error)" }}>
            Error searching. Please try again.
          </p>
        </div>
      );
    }

    // Show empty state when no results
    if (usersSearchResults && usersSearchResults.actors.length === 0) {
      return (
        <div
          className="rounded-xl border bg-white bg-opacity-5 p-6 text-center"
          style={{ borderColor: "var(--asph-border-primary)" }}
        >
          <Users
            size={32}
            className="mx-auto mb-3 opacity-10"
            style={{ color: "var(--asph-text-secondary)" }}
          />
          <p
            className="mb-3 text-sm font-medium"
            style={{ color: "var(--asph-text-primary)" }}
          >
            No users found matching your search
          </p>
          <p
            className="mb-4 text-xs"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            Try these suggestions:
          </p>
          <ul
            className="space-y-2 text-left text-xs"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            <li className="flex items-start gap-2">
              <span>•</span>
              <span>Check the username spelling</span>
            </li>
            <li className="flex items-start gap-2">
              <span>•</span>
              <span>Try searching by display name instead</span>
            </li>
            <li className="flex items-start gap-2">
              <span>•</span>
              <span>Search for related terms or interests</span>
            </li>
            <li className="flex items-start gap-2">
              <span>•</span>
              <span>Try the "Posts" tab to find content from users</span>
            </li>
          </ul>
        </div>
      );
    }

    // Show results
    if (
      usersSearchResults &&
      usersSearchResults.actors &&
      usersSearchResults.actors.length > 0
    ) {
      const visibleUsers = usersSearchResults.actors.filter(
        (user) => !isUserMuted(user.did) && !isUserBlocked(user.did),
      );

      return (
        <>
          <div className="mb-2 flex items-center justify-between">
            <p
              className="text-sm"
              style={{ color: "var(--asph-text-secondary)" }}
            >
              {visibleUsers.length} results
            </p>
          </div>

          {visibleUsers.map((user) => (
            <div
              key={user.did}
              className="asph-glass cursor-pointer rounded-xl p-3 transition-all hover:shadow-lg sm:p-4"
              style={{
                border: "1px solid var(--asph-border-primary)",
              }}
              onClick={() => navigate(`/profile/${user.handle}`)}
            >
              <div className="flex items-start gap-3">
                {user.avatar && (
                  <img
                    src={proxifyBskyImage(user.avatar)}
                    alt={user.displayName}
                    className="h-12 w-12 flex-shrink-0 rounded-full"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-baseline gap-2">
                    <span
                      className="truncate font-medium"
                      style={{ color: "var(--asph-text-primary)" }}
                    >
                      {user.displayName || user.handle}
                    </span>
                    <span
                      className="truncate text-sm"
                      style={{
                        color: "var(--asph-text-secondary)",
                      }}
                    >
                      @{user.handle}
                    </span>
                  </div>
                  {user.description && (
                    <p
                      className="mb-2 line-clamp-2 text-sm"
                      style={{ color: "var(--asph-text-primary)" }}
                    >
                      {user.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-xs">
                    {/* Profile counts not available in basic ProfileView */}
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <span
                      className="text-xs"
                      style={{ color: "var(--asph-text-tertiary)" }}
                    >
                      Click to view profile
                    </span>
                    <a
                      href={`https://bsky.app/profile/${user.handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-xs hover:underline"
                      style={{ color: "var(--asph-primary)" }}
                    >
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </>
      );
    }

    // No results yet (initial state)
    return null;
  },
);

SearchTabUsers.displayName = "SearchTabUsers";
