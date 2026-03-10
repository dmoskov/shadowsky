import { useQuery } from "@tanstack/react-query";
import { List, Search, Users } from "lucide-react";
import React, { useContext, useState } from "react";
import { AuthContext } from "../../contexts/AuthContext";
import { useViewTransitionNavigate } from "../../hooks/useViewTransitionNavigate";
import { proxifyBskyImage } from "../../utils/image-proxy";

interface DiscoveredList {
  uri: string;
  cid: string;
  name: string;
  purpose: string;
  description?: string;
  avatar?: string;
  listItemCount?: number;
  creator: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  indexedAt: string;
}

export const DiscoverLists: React.FC = () => {
  const authContext = useContext(AuthContext);
  const agent = authContext?.agent ?? null;
  const navigate = useViewTransitionNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSubTab, setActiveSubTab] = useState<"curated" | "search">(
    "curated",
  );

  // Search for users and fetch their lists
  const { data: searchResults, isLoading: isSearchLoading } = useQuery({
    queryKey: ["discoverListsSearch", searchQuery],
    queryFn: async () => {
      if (!agent || !searchQuery.trim()) return [];

      // Search for actors
      const searchResponse = await agent.app.bsky.actor.searchActors({
        q: searchQuery,
        limit: 10,
      });

      if (!searchResponse.data.actors?.length) return [];

      // For each actor, fetch their public lists
      const listsPromises = searchResponse.data.actors
        .slice(0, 5)
        .map(async (actor) => {
          try {
            const listsResponse = await agent.app.bsky.graph.getLists({
              actor: actor.did,
              limit: 10,
            });
            return listsResponse.data.lists.map((list) => ({
              ...list,
              listItemCount: list.listItemCount,
            }));
          } catch {
            return [];
          }
        });

      const allLists = await Promise.all(listsPromises);
      return allLists.flat() as DiscoveredList[];
    },
    enabled: !!agent && !!searchQuery.trim() && activeSubTab === "search",
  });

  // Curated lists — fetch lists from well-known Bluesky team/community accounts
  const { data: curatedLists, isLoading: isCuratedLoading } = useQuery({
    queryKey: ["discoverListsCurated"],
    queryFn: async () => {
      if (!agent) return [];

      // Get suggested follows and fetch their lists to surface interesting lists
      const suggestedResponse = await agent.app.bsky.actor.getSuggestions({
        limit: 20,
      });

      if (!suggestedResponse.data.actors?.length) return [];

      // Fetch lists from a subset of suggested accounts
      const listsPromises = suggestedResponse.data.actors
        .slice(0, 8)
        .map(async (actor) => {
          try {
            const listsResponse = await agent.app.bsky.graph.getLists({
              actor: actor.did,
              limit: 5,
            });
            return listsResponse.data.lists;
          } catch {
            return [];
          }
        });

      const allLists = await Promise.all(listsPromises);
      // Deduplicate and sort by member count
      const uniqueLists = Array.from(
        new Map(allLists.flat().map((l) => [l.uri, l])).values(),
      );
      return uniqueLists.sort(
        (a, b) => (b.listItemCount || 0) - (a.listItemCount || 0),
      ) as DiscoveredList[];
    },
    enabled: !!agent && activeSubTab === "curated",
    staleTime: 5 * 60 * 1000,
  });

  const isLoading =
    activeSubTab === "curated" ? isCuratedLoading : isSearchLoading;
  const lists = activeSubTab === "curated" ? curatedLists : searchResults;

  const handleListClick = (listUri: string) => {
    navigate(`/lists/${encodeURIComponent(listUri)}`);
  };

  const getPurposeLabel = (purpose: string) => {
    if (purpose === "app.bsky.graph.defs#curatelist") return "Curation";
    if (purpose === "app.bsky.graph.defs#modlist") return "Moderation";
    if (purpose === "app.bsky.graph.defs#referencelist") return "Reference";
    return "List";
  };

  const getPurposeColor = (purpose: string) => {
    if (purpose === "app.bsky.graph.defs#curatelist")
      return "var(--asph-primary)";
    if (purpose === "app.bsky.graph.defs#modlist") return "var(--asph-error)";
    return "var(--asph-text-tertiary)";
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <button
          onClick={() => setActiveSubTab("curated")}
          className="touch-target rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
          style={{
            backgroundColor:
              activeSubTab === "curated"
                ? "var(--asph-primary)"
                : "var(--asph-bg-secondary)",
            color:
              activeSubTab === "curated"
                ? "white"
                : "var(--asph-text-secondary)",
          }}
        >
          Suggested
        </button>
        <button
          onClick={() => setActiveSubTab("search")}
          className="touch-target rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
          style={{
            backgroundColor:
              activeSubTab === "search"
                ? "var(--asph-primary)"
                : "var(--asph-bg-secondary)",
            color:
              activeSubTab === "search"
                ? "white"
                : "var(--asph-text-secondary)",
          }}
        >
          Search
        </button>
      </div>

      {activeSubTab === "search" && (
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 transform"
            style={{ color: "var(--asph-text-secondary)" }}
          />
          <input
            type="text"
            placeholder="Search by user to find their lists..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border py-2.5 pl-10 pr-4 focus-visible:outline-none focus-visible:ring-2"
            style={{
              backgroundColor: "var(--asph-bg-secondary)",
              borderColor: "var(--asph-border-primary)",
              color: "var(--asph-text-primary)",
            }}
          />
        </div>
      )}

      {isLoading ? (
        <div
          className="py-8 text-center"
          style={{ color: "var(--asph-text-secondary)" }}
        >
          Loading lists...
        </div>
      ) : lists && lists.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {lists.map((list) => (
            <div
              key={list.uri}
              onClick={() => handleListClick(list.uri)}
              className="cursor-pointer rounded-xl border p-4 transition-all duration-200 hover:shadow-md"
              style={{
                borderColor: "var(--asph-border-primary)",
                backgroundColor: "var(--asph-bg-secondary)",
              }}
            >
              <div className="mb-2 flex items-start gap-3">
                {list.avatar ? (
                  <img
                    src={proxifyBskyImage(list.avatar)}
                    alt={list.name}
                    className="h-10 w-10 rounded-lg object-cover"
                  />
                ) : (
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ backgroundColor: "var(--asph-bg-primary)" }}
                  >
                    <List
                      size={18}
                      style={{ color: "var(--asph-text-secondary)" }}
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3
                    className="truncate font-semibold"
                    style={{ color: "var(--asph-text-primary)" }}
                  >
                    {list.name}
                  </h3>
                  <p
                    className="truncate text-xs"
                    style={{ color: "var(--asph-text-secondary)" }}
                  >
                    by @{list.creator.handle}
                  </p>
                </div>
                <span
                  className="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    color: getPurposeColor(list.purpose),
                    backgroundColor: "var(--asph-bg-primary)",
                  }}
                >
                  {getPurposeLabel(list.purpose)}
                </span>
              </div>

              {list.description && (
                <p
                  className="mb-2 line-clamp-2 text-xs"
                  style={{ color: "var(--asph-text-tertiary)" }}
                >
                  {list.description}
                </p>
              )}

              <div className="flex items-center gap-1">
                <Users
                  size={12}
                  style={{ color: "var(--asph-text-tertiary)" }}
                />
                <span
                  className="text-xs"
                  style={{ color: "var(--asph-text-tertiary)" }}
                >
                  {(list.listItemCount || 0).toLocaleString()} members
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="py-8 text-center"
          style={{ color: "var(--asph-text-secondary)" }}
        >
          {activeSubTab === "search" && !searchQuery.trim()
            ? "Search for a user to discover their lists"
            : "No lists found"}
        </div>
      )}
    </div>
  );
};
