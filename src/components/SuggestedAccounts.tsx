/**
 * SuggestedAccounts component - displays suggested accounts from trending participation
 */

import { Users } from "lucide-react";
import React from "react";
import type { TrendActor } from "../services/trending-service";
import { proxifyBskyImage } from "../utils/image-proxy";

interface SuggestedAccountsProps {
  actors: TrendActor[];
  onAccountClick: (handle: string) => void;
  isLoading?: boolean;
  title?: string;
}

export const SuggestedAccounts: React.FC<SuggestedAccountsProps> = ({
  actors,
  onAccountClick,
  isLoading = false,
  title = "Active in Trending",
}) => {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Users size={16} style={{ color: "var(--bsky-primary)" }} />
          <span
            className="text-sm font-medium"
            style={{ color: "var(--bsky-text-secondary)" }}
          >
            {title}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="flex animate-pulse items-center gap-2 rounded-lg p-2"
              style={{ backgroundColor: "var(--bsky-bg-secondary)" }}
            >
              <div
                className="h-8 w-8 rounded-full"
                style={{ backgroundColor: "var(--bsky-border-primary)" }}
              />
              <div className="flex-1 space-y-1">
                <div
                  className="h-3 w-16 rounded"
                  style={{ backgroundColor: "var(--bsky-border-primary)" }}
                />
                <div
                  className="h-2 w-12 rounded"
                  style={{ backgroundColor: "var(--bsky-border-primary)" }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Deduplicate actors by DID and limit to top 6
  const uniqueActors = actors
    .reduce((acc, actor) => {
      if (!acc.some((a) => a.did === actor.did)) {
        acc.push(actor);
      }
      return acc;
    }, [] as TrendActor[])
    .slice(0, 6);

  if (uniqueActors.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Users size={16} style={{ color: "var(--bsky-primary)" }} />
        <span
          className="text-sm font-medium"
          style={{ color: "var(--bsky-text-secondary)" }}
        >
          {title}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {uniqueActors.map((actor) => (
          <button
            key={actor.did}
            onClick={() => onAccountClick(actor.handle)}
            className="flex items-center gap-2 rounded-lg border p-2 text-left transition-all hover:border-blue-400 hover:shadow-sm"
            style={{
              backgroundColor: "var(--bsky-bg-secondary)",
              borderColor: "var(--bsky-border-primary)",
            }}
          >
            {actor.avatar ? (
              <img
                src={proxifyBskyImage(actor.avatar)}
                alt=""
                className="h-8 w-8 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: "var(--bsky-primary)" }}
              >
                <span className="text-xs font-medium text-white">
                  {(actor.displayName || actor.handle).charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div
                className="truncate text-sm font-medium"
                style={{ color: "var(--bsky-text-primary)" }}
              >
                {actor.displayName || actor.handle}
              </div>
              <div
                className="truncate text-xs"
                style={{ color: "var(--bsky-text-tertiary)" }}
              >
                @{actor.handle}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
