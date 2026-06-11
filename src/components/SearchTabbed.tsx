import { type AppBskyFeedDefs } from "@atproto/api";
import { debug } from "@bsky/shared";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, subMonths } from "date-fns";
import {
  ArrowLeft,
  Bookmark,
  BookmarkPlus,
  Calendar,
  Clock,
  FileText,
  Filter,
  Flame,
  Globe,
  Hash,
  Image,
  List,
  Search as SearchIcon,
  TrendingUp,
  User,
  Users,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { useHiddenPosts } from "../contexts/HiddenPostsContext";
import { useModeration } from "../contexts/ModerationContext";
import { useDebounce } from "../hooks/useDebounce";
import { useFollowing } from "../hooks/useFollowing";
import {
  defaultFilters as defaultFacetedFilters,
  type SearchFilters as FacetedSearchFilters,
} from "../hooks/useSearch";
import { useViewTransitionNavigate } from "../hooks/useViewTransitionNavigate";
import { getFollowerCacheDB } from "../services/follower-cache-db";
import { getProfileCacheService } from "../services/profile-cache-service";
import { proxifyBskyImage } from "../utils/image-proxy";
import { constructAtUri, parseBskyUrl } from "../utils/url-helpers";
import { SearchFilterPanel } from "./SearchFilterPanel";
import { ThreadViewer } from "./ThreadViewer";
import { SearchTabFeeds } from "./search/SearchTabFeeds";
import { SearchTabPosts } from "./search/SearchTabPosts";
import { SearchTabUsers } from "./search/SearchTabUsers";
import {
  buildSearchQuery,
  parseFacetedFiltersFromParams,
  serializeFacetedFiltersToParams,
  type SearchFilters,
  type SearchTab,
  type UserSuggestion,
} from "./search/search-utils";
import { useSavedSearches } from "./search/useSavedSearches";
import { useSearchHistory } from "./search/useSearchHistory";

export const SearchTabbed: React.FC = React.memo(() => {
  const { agent } = useAuth();
  const navigate = useViewTransitionNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isPostHidden } = useHiddenPosts();
  const { isUserMuted, isUserBlocked, isThreadMuted } = useModeration();
  const [activeTab, setActiveTab] = useState<SearchTab>("posts");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showFacetedFilters, setShowFacetedFilters] = useState(false);
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"top" | "latest">("latest");
  const [filters, setFilters] = useState<SearchFilters>({
    query: "",
    phrases: [],
    hashtags: [],
    from: [],
    mentions: [],
    domains: [],
    language: "",
    sinceDate: "",
    untilDate: "",
    hasMedia: false,
  });

  // Faceted search filters (media type, engagement thresholds)
  const [facetedFilters, setFacetedFilters] = useState<FacetedSearchFilters>(
    () => {
      const fromParams = parseFacetedFiltersFromParams(searchParams);
      return {
        ...defaultFacetedFilters,
        ...fromParams,
        engagement: {
          ...defaultFacetedFilters.engagement,
          ...(fromParams.engagement || {}),
        },
      };
    },
  );

  // Run searches arriving via URL (?q=...), e.g. weather banner click-through
  const urlQuery = searchParams.get("q") ?? "";
  useEffect(() => {
    if (urlQuery && urlQuery !== filters.query) {
      setFilters((prev) => ({ ...prev, query: urlQuery }));
      setActiveSearchQuery(urlQuery);
      setActiveTab("posts");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlQuery]);

  // Sync faceted filters to URL params
  useEffect(() => {
    const params = serializeFacetedFiltersToParams(facetedFilters);
    const currentQuery = searchParams.get("q");

    // Build new search params, preserving query
    const newParams = new URLSearchParams();
    if (currentQuery) newParams.set("q", currentQuery);

    Object.entries(params).forEach(([key, value]) => {
      newParams.set(key, value);
    });

    // Only update if params have changed
    const currentStr = searchParams.toString();
    const newStr = newParams.toString();
    if (currentStr !== newStr) {
      setSearchParams(newParams, { replace: true });
    }
  }, [facetedFilters, searchParams, setSearchParams]);

  // Check if any faceted filters are active
  const hasFacetedFiltersActive = useMemo(() => {
    return (
      facetedFilters.mediaType !== "all" ||
      facetedFilters.engagement.minLikes > 0 ||
      facetedFilters.engagement.minReposts > 0 ||
      facetedFilters.engagement.minReplies > 0 ||
      facetedFilters.fromUsers.length > 0 ||
      facetedFilters.sinceDate !== "" ||
      facetedFilters.untilDate !== "" ||
      facetedFilters.language !== ""
    );
  }, [facetedFilters]);

  // Thread viewer state
  const [showThreadViewer, setShowThreadViewer] = useState(false);
  const [threadPosts, setThreadPosts] = useState<AppBskyFeedDefs.PostView[]>(
    [],
  );
  const [selectedPostUri, setSelectedPostUri] = useState<string | null>(null);
  const [highlightPostUri, setHighlightPostUri] = useState<string | null>(null);
  const [isLoadingThread, setIsLoadingThread] = useState(false);

  // Search history management (localStorage-backed)
  const { searchHistory, addToSearchHistory, clearSearchHistory } =
    useSearchHistory();

  // Saved searches management (localStorage-backed)
  const { savedSearches, saveSearch, removeSavedSearch, isSearchSaved } =
    useSavedSearches(filters.query);

  // Main search bar typeahead state
  const [showMainTypeahead, setShowMainTypeahead] = useState(false);
  const mainSearchInputRef = useRef<HTMLInputElement>(null);
  const mainTypeaheadRef = useRef<HTMLDivElement>(null);
  const debouncedMainSearch = useDebounce(filters.query, 300);

  // Build search query and debounce it for automatic search
  const searchQuery = buildSearchQuery(filters);

  // Typeahead state
  const [activeUserInput, setActiveUserInput] = useState<{
    field: "from" | "mentions";
    index: number;
  } | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const debouncedUserSearch = useDebounce(userSearchQuery, 300);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [showingFollowers, setShowingFollowers] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // Fetch user's following list
  const { data: followingSet } = useFollowing();

  // State for followers with enriched data
  const [followersWithData, setFollowersWithData] = useState<UserSuggestion[]>(
    [],
  );

  // Fetch and enrich followers data
  useEffect(() => {
    if (agent && followingSet && followingSet.size > 0) {
      const loadFollowersData = async () => {
        try {
          const db = await getFollowerCacheDB();
          const profileCache = getProfileCacheService(agent);

          // Get all DIDs from following set
          const dids = Array.from(followingSet);

          // First try to get from cache (using getProfilesByDidsWithCache)
          const cachedMap = await profileCache.getProfilesByDidsWithCache(dids);

          // Convert map to array and add interaction stats
          const profiles: UserSuggestion[] = [];
          for (const [did, cached] of cachedMap) {
            const stats = await db.getInteractionStats(did);
            profiles.push({
              did,
              handle: cached.handle,
              displayName: cached.displayName,
              avatar: cached.avatar,
              interactionScore: stats?.totalInteractions || 0,
            });
          }

          // Sort by interaction score
          profiles.sort(
            (a, b) => (b.interactionScore || 0) - (a.interactionScore || 0),
          );

          setFollowersWithData(profiles);
        } catch (error) {
          debug.error("Error loading followers data:", error);
        }
      };

      loadFollowersData();
    }
  }, [agent, followingSet]);

  // Typeahead suggestions query for user search
  const { data: userSuggestions } = useQuery({
    queryKey: ["userSuggestions", debouncedUserSearch, showingFollowers],
    queryFn: async () => {
      if (showingFollowers) {
        // Return top followers
        return followersWithData.slice(0, 10);
      }

      if (!debouncedUserSearch || debouncedUserSearch.length < 2) {
        return [];
      }

      const response = await agent!.app.bsky.actor.searchActorsTypeahead({
        q: debouncedUserSearch,
        limit: 10,
      });

      return response.data.actors.map((actor) => ({
        did: actor.did,
        handle: actor.handle,
        displayName: actor.displayName,
        avatar: actor.avatar,
      }));
    },
    enabled:
      !!agent &&
      (showingFollowers ||
        (!!debouncedUserSearch && debouncedUserSearch.length >= 2)),
  });

  // Typeahead for main search input
  const { data: mainTypeaheadSuggestions } = useQuery({
    queryKey: ["mainSearchTypeahead", debouncedMainSearch],
    queryFn: async () => {
      if (!debouncedMainSearch || debouncedMainSearch.length < 2) {
        return [];
      }

      const response = await agent!.app.bsky.actor.searchActorsTypeahead({
        q: debouncedMainSearch,
        limit: 5,
      });

      return response.data.actors.map((actor) => ({
        did: actor.did,
        handle: actor.handle,
        displayName: actor.displayName,
        avatar: actor.avatar,
      }));
    },
    enabled:
      !!agent && !!debouncedMainSearch && debouncedMainSearch.length >= 2,
  });

  // Fetch trending topics
  const { data: trendingTopics } = useQuery({
    queryKey: ["trendingTopics"],
    queryFn: async () => {
      try {
        const response = await agent!.app.bsky.unspecced.getTrendingTopics({
          limit: 10,
        });
        return response.data;
      } catch (error) {
        debug.error("Error fetching trending topics:", error);
        return { topics: [], suggested: [] };
      }
    },
    enabled: !!agent,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch thread for a post
  const fetchThread = async (uri: string, findRoot: boolean = true) => {
    if (!agent) return;
    setIsLoadingThread(true);
    try {
      // Get the thread
      const response = await agent.getPostThread({
        uri,
        depth: 10,
      });

      // If this is a reply and we want the full thread, fetch from the root
      if (
        findRoot &&
        response.data.thread.$type === "app.bsky.feed.defs#threadViewPost"
      ) {
        const thread = response.data.thread as AppBskyFeedDefs.ThreadViewPost;
        if (thread.parent) {
          // Find the root post by traversing up the parent chain
          let rootThread = thread;
          while (
            rootThread.parent &&
            rootThread.parent.$type === "app.bsky.feed.defs#threadViewPost"
          ) {
            rootThread = rootThread.parent as AppBskyFeedDefs.ThreadViewPost;
          }

          // Now fetch the full thread from the root
          if (rootThread.post?.uri && rootThread.post.uri !== uri) {
            const rootResponse = await agent.getPostThread({
              uri: rootThread.post.uri,
              depth: 10,
            });

            // Extract all posts from the root thread
            const posts: AppBskyFeedDefs.PostView[] = [];

            const extractPosts = (thread: any) => {
              if (thread.post) {
                posts.push(thread.post);
              }
              if (thread.replies) {
                thread.replies.forEach((reply: any) => {
                  extractPosts(reply);
                });
              }
            };

            extractPosts(rootResponse.data.thread);

            setThreadPosts(posts);
            setSelectedPostUri(rootThread.post.uri); // Set to root URI
            setHighlightPostUri(uri); // Highlight the originally requested post
            setShowThreadViewer(true);
            return;
          }
        }
      }

      // Extract all posts from the thread (if not fetching from root)
      const posts: AppBskyFeedDefs.PostView[] = [];

      // First, collect any parent posts
      const collectParents = (thread: any): AppBskyFeedDefs.PostView[] => {
        const parentPosts: AppBskyFeedDefs.PostView[] = [];
        if (thread.parent) {
          parentPosts.push(...collectParents(thread.parent));
        }
        if (thread.post) {
          parentPosts.push(thread.post);
        }
        return parentPosts;
      };

      // Collect parent posts (excluding the current post)
      if (response.data.thread.$type === "app.bsky.feed.defs#threadViewPost") {
        const thread = response.data.thread as AppBskyFeedDefs.ThreadViewPost;
        if (thread.parent) {
          posts.push(...collectParents(thread.parent));
        }
      }

      // Add the main post
      if (response.data.thread.$type === "app.bsky.feed.defs#threadViewPost") {
        const thread = response.data.thread as AppBskyFeedDefs.ThreadViewPost;
        posts.push(thread.post);

        // Add replies
        if (thread.replies) {
          const extractReplies = (replies: any[]) => {
            replies.forEach((reply) => {
              if (reply.$type === "app.bsky.feed.defs#threadViewPost") {
                posts.push(reply.post);
                if (reply.replies) {
                  extractReplies(reply.replies);
                }
              }
            });
          };
          extractReplies(thread.replies);
        }
      }

      setThreadPosts(posts);
      setSelectedPostUri(uri);
      setHighlightPostUri(null);
      setShowThreadViewer(true);
    } catch (error) {
      debug.error("Error fetching thread:", error);
    } finally {
      setIsLoadingThread(false);
    }
  };

  // Handle post click (open thread viewer)
  const handlePostClick = async (post: AppBskyFeedDefs.PostView) => {
    await fetchThread(post.uri);
  };

  // Handle Bluesky URL submission
  const handleBskyUrlSubmit = async (url: string) => {
    setIsLoadingThread(true);
    const parsed = parseBskyUrl(url);
    if (!parsed || !parsed.postId) {
      setIsLoadingThread(false);
      return;
    }

    try {
      // If we have a handle, we need to resolve it to a DID first
      let uri: string;
      if (parsed.handle) {
        const profile = await agent!.getProfile({
          actor: parsed.handle,
        });
        uri = constructAtUri(profile.data.did, parsed.postId);
      } else if (parsed.did) {
        uri = constructAtUri(parsed.did, parsed.postId);
      } else {
        return;
      }

      await fetchThread(uri);
      // Clear the search query after successful load
      setFilters((prev) => ({ ...prev, query: "" }));
    } catch (error) {
      debug.error("Error loading post from URL:", error);
    } finally {
      setIsLoadingThread(false);
    }
  };

  // Handle search button click
  const handleSearch = () => {
    // Check if the query is a Bluesky URL
    const trimmedQuery = filters.query.trim();
    if (
      trimmedQuery.includes("bsky.app/profile/") &&
      trimmedQuery.includes("/post/")
    ) {
      handleBskyUrlSubmit(trimmedQuery);
    } else {
      setActiveSearchQuery(searchQuery);
      if (trimmedQuery) {
        addToSearchHistory(trimmedQuery);
      }
    }
  };

  // Add or remove items from array filters
  const addToArrayFilter = (field: keyof SearchFilters, value: string) => {
    if (Array.isArray(filters[field])) {
      setFilters((prev) => ({
        ...prev,
        [field]: [...(prev[field] as string[]), value],
      }));
    }
  };

  const removeFromArrayFilter = (field: keyof SearchFilters, index: number) => {
    setFilters((prev) => ({
      ...prev,
      [field]: (prev[field] as string[]).filter((_, i) => i !== index),
    }));
  };

  // Handle user input changes with typeahead
  const handleUserInputChange = (
    field: "from" | "mentions",
    index: number,
    value: string,
  ) => {
    const newArray = [...filters[field]];
    newArray[index] = value;
    setFilters((prev) => ({ ...prev, [field]: newArray }));

    // Update typeahead state
    setActiveUserInput({ field, index });
    setUserSearchQuery(value);
    setShowSuggestions(true);
    setShowingFollowers(false); // Reset followers display when typing
    setSelectedSuggestionIndex(-1); // Reset selection when input changes
  };

  // Handle user selection from suggestions
  const handleUserSelect = (suggestion: UserSuggestion) => {
    if (activeUserInput) {
      const { field, index } = activeUserInput;
      const newArray = [...filters[field]];
      newArray[index] = suggestion.handle;
      setFilters((prev) => ({ ...prev, [field]: newArray }));

      // Clear typeahead state
      setShowSuggestions(false);
      setShowingFollowers(false);
      setActiveUserInput(null);
      setUserSearchQuery("");
      setSelectedSuggestionIndex(-1);

      // Focus the input again
      const inputKey = `${field}-${index}`;
      inputRefs.current[inputKey]?.focus();
    }
  };

  // Handle keyboard navigation for typeahead
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        // Only allow arrow navigation if user has typed at least 2 characters
        if (userSearchQuery && userSearchQuery.length >= 2) {
          e.preventDefault();
          if (
            showSuggestions &&
            userSuggestions &&
            userSuggestions.length > 0
          ) {
            setSelectedSuggestionIndex((prev) =>
              prev < userSuggestions.length - 1 ? prev + 1 : prev,
            );
          }
        }
        break;

      case "ArrowUp":
        // Only allow arrow navigation if user has typed at least 2 characters
        if (userSearchQuery && userSearchQuery.length >= 2) {
          e.preventDefault();
          if (
            showSuggestions &&
            userSuggestions &&
            userSuggestions.length > 0
          ) {
            setSelectedSuggestionIndex((prev) => (prev > -1 ? prev - 1 : -1));
          }
        }
        break;

      case "Enter":
        if (
          selectedSuggestionIndex >= 0 &&
          userSuggestions &&
          selectedSuggestionIndex < userSuggestions.length
        ) {
          e.preventDefault();
          handleUserSelect(userSuggestions[selectedSuggestionIndex]);
        }
        break;

      case "Escape":
        e.preventDefault();
        setShowSuggestions(false);
        setShowingFollowers(false);
        setSelectedSuggestionIndex(-1);
        break;
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-4xl p-4">
      {/* Thread Viewer */}
      {showThreadViewer ? (
        <div
          className="asph-glass mb-4 rounded-xl p-4"
          style={{ border: "1px solid var(--asph-border-primary)" }}
        >
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={() => {
                setShowThreadViewer(false);
                setThreadPosts([]);
                setSelectedPostUri(null);
                setHighlightPostUri(null);
              }}
              className="touch-target-sm flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-asph-bg-hover"
              style={{ color: "var(--asph-text-primary)" }}
            >
              <ArrowLeft size={16} />
              Back to Search
            </button>
          </div>

          {isLoadingThread ? (
            <div className="flex items-center justify-center py-8">
              <div
                className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
                style={{ borderColor: "var(--asph-primary)" }}
              />
            </div>
          ) : (
            <ThreadViewer
              posts={threadPosts}
              rootUri={selectedPostUri || undefined}
              highlightUri={highlightPostUri || undefined}
              onPostClick={handlePostClick}
            />
          )}
        </div>
      ) : (
        <>
          {/* Main Search Box */}
          <div
            className="asph-glass mb-4 rounded-xl p-4"
            style={{ border: "1px solid var(--asph-border-primary)" }}
          >
            <div className="relative mb-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <SearchIcon
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    size={18}
                    style={{ color: "var(--asph-text-secondary)" }}
                  />
                  <input
                    ref={mainSearchInputRef}
                    type="text"
                    value={filters.query}
                    onChange={(e) => {
                      setFilters((prev) => ({
                        ...prev,
                        query: e.target.value,
                      }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSearch();
                        setShowMainTypeahead(false);
                      } else if (e.key === "Escape") {
                        setShowMainTypeahead(false);
                      }
                    }}
                    onFocus={() => {
                      if (
                        filters.query.length >= 2 ||
                        searchHistory.length > 0 ||
                        savedSearches.length > 0
                      ) {
                        setShowMainTypeahead(true);
                      }
                    }}
                    onBlur={(e) => {
                      // Check if focus is moving to an element inside the typeahead dropdown
                      const related = e.relatedTarget as HTMLElement | null;
                      if (
                        related &&
                        mainTypeaheadRef.current?.contains(related)
                      ) {
                        return; // Don't close if clicking inside typeahead
                      }
                      setTimeout(() => setShowMainTypeahead(false), 150);
                    }}
                    placeholder="Search posts, users, or paste a Bluesky post URL..."
                    className="w-full rounded-xl border py-3 pl-10 pr-4 focus-visible:outline-none focus-visible:ring-2"
                    style={{
                      backgroundColor: "var(--asph-bg-secondary)",
                      borderColor: "var(--asph-border-primary)",
                      color: "var(--asph-text-primary)",
                      ["--tw-ring-color" as any]: "var(--asph-primary)",
                    }}
                  />
                  {filters.query && (
                    <button
                      onClick={() => {
                        setFilters((prev) => ({ ...prev, query: "" }));
                        setActiveSearchQuery("");
                        mainSearchInputRef.current?.focus();
                      }}
                      className="touch-target-icon absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 transition-opacity hover:opacity-70"
                      style={{ color: "var(--asph-text-secondary)" }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                <button
                  onClick={handleSearch}
                  disabled={!filters.query.trim()}
                  className="touch-target-sm flex items-center gap-2 rounded-xl px-4 py-3 font-medium transition-all disabled:opacity-50"
                  style={{
                    backgroundColor: "var(--asph-primary)",
                    color: "white",
                  }}
                >
                  <SearchIcon size={16} />
                  Search
                </button>

                {filters.query.trim() && (
                  <button
                    onClick={() => {
                      if (isSearchSaved) {
                        const search = savedSearches.find(
                          (s) => s.query === filters.query.trim(),
                        );
                        if (search) removeSavedSearch(search.id);
                      } else {
                        saveSearch(filters.query.trim());
                      }
                    }}
                    className="touch-target rounded-xl p-3 transition-all hover:bg-asph-bg-hover"
                    style={{ color: "var(--asph-text-secondary)" }}
                    title={isSearchSaved ? "Remove from saved" : "Save search"}
                  >
                    {isSearchSaved ? (
                      <Bookmark size={18} fill="currentColor" />
                    ) : (
                      <BookmarkPlus size={18} />
                    )}
                  </button>
                )}
              </div>

              {/* Main search typeahead */}
              {showMainTypeahead &&
                ((mainTypeaheadSuggestions &&
                  mainTypeaheadSuggestions.length > 0) ||
                  searchHistory.length > 0 ||
                  savedSearches.length > 0 ||
                  (trendingTopics &&
                    (trendingTopics.topics?.length > 0 ||
                      trendingTopics.suggested?.length > 0))) && (
                  <div
                    ref={mainTypeaheadRef}
                    className="absolute z-50 mt-2 max-h-[60vh] w-full overflow-y-auto rounded-xl border shadow-lg"
                    style={{
                      backgroundColor: "var(--asph-bg-secondary)",
                      borderColor: "var(--asph-border-primary)",
                    }}
                  >
                    {/* User suggestions */}
                    {mainTypeaheadSuggestions &&
                      mainTypeaheadSuggestions.length > 0 && (
                        <div
                          className="border-b"
                          style={{ borderColor: "var(--asph-border-primary)" }}
                        >
                          <div
                            className="px-3 py-2 text-xs font-medium"
                            style={{ color: "var(--asph-text-secondary)" }}
                          >
                            Users
                          </div>
                          {mainTypeaheadSuggestions.map((user) => (
                            <button
                              key={user.did}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                navigate(`/profile/${user.handle}`);
                              }}
                            >
                              {user.avatar && (
                                <img
                                  src={proxifyBskyImage(user.avatar)}
                                  alt=""
                                  className="touch-target-list-item flex h-8 w-8 w-full cursor-pointer items-center gap-3 rounded-full px-3 py-2 text-left transition-colors hover:bg-asph-bg-hover"
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <div
                                  className="truncate text-sm font-medium"
                                  style={{ color: "var(--asph-text-primary)" }}
                                >
                                  {user.displayName || user.handle}
                                </div>
                                <div
                                  className="truncate text-xs"
                                  style={{
                                    color: "var(--asph-text-secondary)",
                                  }}
                                >
                                  @{user.handle}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                    {/* Saved searches */}
                    {savedSearches.length > 0 && (
                      <div
                        className="border-b"
                        style={{ borderColor: "var(--asph-border-primary)" }}
                      >
                        <div className="flex items-center justify-between px-3 py-2">
                          <span
                            className="text-xs font-medium"
                            style={{ color: "var(--asph-text-secondary)" }}
                          >
                            Saved Searches
                          </span>
                        </div>
                        {savedSearches.map((search) => (
                          <div
                            key={search.id}
                            className="group flex items-center gap-2 px-3 py-2 transition-colors hover:bg-asph-bg-hover"
                          >
                            <button
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setFilters((prev) => ({
                                  ...prev,
                                  query: search.query,
                                }));
                                setShowMainTypeahead(false);
                                setTimeout(() => handleSearch(), 100);
                              }}
                              className="touch-target flex min-w-0 flex-1 items-center gap-2 text-left"
                            >
                              <Bookmark
                                size={14}
                                style={{ color: "var(--asph-primary)" }}
                              />
                              <span
                                className="truncate text-sm"
                                style={{ color: "var(--asph-text-primary)" }}
                              >
                                {search.query}
                              </span>
                            </button>
                            <button
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                removeSavedSearch(search.id);
                              }}
                              className="touch-target-icon rounded p-1 opacity-0 transition-opacity hover:bg-asph-bg-hover group-hover:opacity-100"
                              style={{ color: "var(--asph-text-secondary)" }}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Recent searches */}
                    {searchHistory.length > 0 && (
                      <div
                        className="border-b"
                        style={{ borderColor: "var(--asph-border-primary)" }}
                      >
                        <div className="flex items-center justify-between px-3 py-2">
                          <span
                            className="text-xs font-medium"
                            style={{ color: "var(--asph-text-secondary)" }}
                          >
                            Recent Searches
                          </span>
                          <button
                            onMouseDown={(e) => {
                              e.preventDefault();
                              clearSearchHistory();
                            }}
                            className="touch-target-sm text-xs hover:underline"
                            style={{ color: "var(--asph-primary)" }}
                          >
                            Clear
                          </button>
                        </div>
                        {searchHistory.map((query, i) => (
                          <button
                            key={`${query}-${i}`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setFilters((prev) => ({ ...prev, query }));
                              setShowMainTypeahead(false);
                              setTimeout(() => handleSearch(), 100);
                            }}
                            className="touch-target-list-item flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-asph-bg-hover"
                          >
                            <Clock
                              size={14}
                              style={{ color: "var(--asph-text-secondary)" }}
                            />
                            <span
                              className="truncate text-sm"
                              style={{ color: "var(--asph-text-primary)" }}
                            >
                              {query}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Trending topics */}
                    {trendingTopics &&
                      (trendingTopics.topics?.length > 0 ||
                        trendingTopics.suggested?.length > 0) && (
                        <div>
                          <div
                            className="px-3 py-2 text-xs font-medium"
                            style={{ color: "var(--asph-text-secondary)" }}
                          >
                            <div className="flex items-center gap-2">
                              <Flame size={14} />
                              Trending Topics
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 px-3 pb-3">
                            {[
                              ...(trendingTopics.topics || []),
                              ...(trendingTopics.suggested || []),
                            ]
                              .slice(0, 10)
                              .map((topic: any) => (
                                <button
                                  key={topic.topic || topic}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    const topicText =
                                      topic.displayName || topic.topic || topic;
                                    setFilters((prev) => ({
                                      ...prev,
                                      query: topicText,
                                    }));
                                    setShowMainTypeahead(false);
                                    setTimeout(() => handleSearch(), 100);
                                  }}
                                  className="touch-target rounded-full px-3 py-1 text-xs transition-all hover:bg-white hover:bg-opacity-20"
                                  style={{
                                    backgroundColor: "var(--asph-bg-tertiary)",
                                    color: "var(--asph-text-secondary)",
                                  }}
                                >
                                  {topic.displayName || topic.topic || topic}
                                </button>
                              ))}
                          </div>
                        </div>
                      )}
                  </div>
                )}
            </div>

            {/* Advanced Search & Faceted Filters Buttons */}
            <div className="flex items-center gap-2">
              {activeTab === "posts" && (
                <button
                  onClick={() => setShowFacetedFilters(!showFacetedFilters)}
                  className={`touch-target flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                    showFacetedFilters ? "" : "hover:bg-asph-bg-hover"
                  }`}
                  style={{
                    backgroundColor: showFacetedFilters
                      ? "var(--asph-primary)"
                      : hasFacetedFiltersActive
                        ? "rgba(255, 107, 157, 0.2)"
                        : "transparent",
                    color: showFacetedFilters
                      ? "white"
                      : "var(--asph-text-secondary)",
                  }}
                >
                  <Filter size={16} />
                  Filters
                  {hasFacetedFiltersActive && !showFacetedFilters && (
                    <span
                      className="flex h-2 w-2 rounded-full"
                      style={{ backgroundColor: "var(--asph-primary)" }}
                    />
                  )}
                </button>
              )}

              {activeTab === "posts" && (
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className={`touch-target flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                    showAdvanced ? "" : "hover:bg-asph-bg-hover"
                  }`}
                  style={{
                    backgroundColor: showAdvanced
                      ? "var(--asph-primary)"
                      : "transparent",
                    color: showAdvanced
                      ? "white"
                      : "var(--asph-text-secondary)",
                  }}
                >
                  <TrendingUp size={16} />
                  Advanced
                </button>
              )}
            </div>
          </div>

          {/* Search Tabs */}
          <div className="mb-2 flex gap-2">
            <button
              onClick={() => setActiveTab("posts")}
              className={`touch-target relative flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                activeTab === "posts" ? "" : "hover:bg-asph-bg-hover"
              }`}
              style={{
                backgroundColor:
                  activeTab === "posts" ? "var(--asph-primary)" : "transparent",
                color:
                  activeTab === "posts"
                    ? "white"
                    : "var(--asph-text-secondary)",
              }}
            >
              <FileText size={16} />
              Posts
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`touch-target relative flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                activeTab === "users" ? "" : "hover:bg-asph-bg-hover"
              }`}
              style={{
                backgroundColor:
                  activeTab === "users" ? "var(--asph-primary)" : "transparent",
                color:
                  activeTab === "users"
                    ? "white"
                    : "var(--asph-text-secondary)",
              }}
            >
              <Users size={16} />
              Users
            </button>
            <button
              onClick={() => setActiveTab("feeds")}
              className={`touch-target relative flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                activeTab === "feeds" ? "" : "hover:bg-asph-bg-hover"
              }`}
              style={{
                backgroundColor:
                  activeTab === "feeds" ? "var(--asph-primary)" : "transparent",
                color:
                  activeTab === "feeds"
                    ? "white"
                    : "var(--asph-text-secondary)",
              }}
            >
              <List size={16} />
              Feeds
            </button>
          </div>

          {/* Sort Options (for posts tab) */}
          {activeTab === "posts" && activeSearchQuery && (
            <div className="mb-3 flex items-center gap-2">
              <span
                className="text-xs font-medium"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                Sort by:
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setSortOrder("latest")}
                  className={`touch-target rounded-md px-3 py-1 text-xs font-medium transition-all ${
                    sortOrder === "latest" ? "" : "opacity-60"
                  }`}
                  style={{
                    backgroundColor:
                      sortOrder === "latest"
                        ? "var(--asph-primary)"
                        : "var(--asph-bg-secondary)",
                    color:
                      sortOrder === "latest"
                        ? "white"
                        : "var(--asph-text-secondary)",
                  }}
                >
                  Latest
                </button>
                <button
                  onClick={() => setSortOrder("top")}
                  className={`touch-target rounded-md px-3 py-1 text-xs font-medium transition-all ${
                    sortOrder === "top" ? "" : "opacity-60"
                  }`}
                  style={{
                    backgroundColor:
                      sortOrder === "top"
                        ? "var(--asph-primary)"
                        : "var(--asph-bg-secondary)",
                    color:
                      sortOrder === "top"
                        ? "white"
                        : "var(--asph-text-secondary)",
                  }}
                >
                  Top
                </button>
              </div>
            </div>
          )}

          {/* Faceted Filters Panel (for posts tab) */}
          {activeTab === "posts" && showFacetedFilters && (
            <div className="mb-4">
              <SearchFilterPanel
                filters={facetedFilters}
                setFilters={setFacetedFilters}
              />
            </div>
          )}

          {/* Advanced Search (for posts tab) */}
          {showAdvanced && activeTab === "posts" && (
            <div
              className="asph-glass mb-4 rounded-xl p-4"
              style={{ border: "1px solid var(--asph-border-primary)" }}
            >
              <h3
                className="mb-4 text-lg font-semibold"
                style={{ color: "var(--asph-text-primary)" }}
              >
                Advanced Search
              </h3>

              <div className="space-y-4">
                {/* Exact Phrases */}
                <div>
                  <label
                    className="mb-2 flex items-center gap-2 text-sm font-medium"
                    style={{ color: "var(--asph-text-secondary)" }}
                  >
                    <FileText size={16} />
                    Exact Phrases
                  </label>
                  <div className="space-y-2">
                    {filters.phrases.map((phrase, i) => (
                      <div
                        key={`phrase-${phrase}-${i}`}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="text"
                          value={phrase}
                          onChange={(e) => {
                            const newPhrases = [...filters.phrases];
                            newPhrases[i] = e.target.value;
                            setFilters((prev) => ({
                              ...prev,
                              phrases: newPhrases,
                            }));
                          }}
                          placeholder="e.g., artificial intelligence"
                          className="flex-1 rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                          style={{
                            backgroundColor: "var(--asph-bg-secondary)",
                            borderColor: "var(--asph-border-primary)",
                            color: "var(--asph-text-primary)",
                            ["--tw-ring-color" as any]: "var(--asph-primary)",
                          }}
                        />
                        <button
                          onClick={() => removeFromArrayFilter("phrases", i)}
                          className="touch-target-icon rounded-lg p-2 transition-opacity hover:opacity-70"
                          style={{ color: "var(--asph-text-secondary)" }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addToArrayFilter("phrases", "")}
                      className="touch-target-sm rounded-lg px-3 py-1.5 text-sm transition-colors"
                      style={{
                        color: "var(--asph-primary)",
                        backgroundColor: "var(--asph-bg-secondary)",
                        borderWidth: "1px",
                        borderColor: "var(--asph-border-primary)",
                      }}
                    >
                      + Add phrase
                    </button>
                  </div>
                </div>

                {/* Hashtags */}
                <div>
                  <label
                    className="mb-2 flex items-center gap-2 text-sm font-medium"
                    style={{ color: "var(--asph-text-secondary)" }}
                  >
                    <Hash size={16} />
                    Hashtags
                  </label>
                  <div className="space-y-2">
                    {filters.hashtags.map((tag, i) => (
                      <div
                        key={`hashtag-${i}`}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="text"
                          value={tag}
                          onChange={(e) => {
                            const newTags = [...filters.hashtags];
                            newTags[i] = e.target.value;
                            setFilters((prev) => ({
                              ...prev,
                              hashtags: newTags,
                            }));
                          }}
                          placeholder="e.g., bluesky"
                          className="flex-1 rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                          style={{
                            backgroundColor: "var(--asph-bg-secondary)",
                            borderColor: "var(--asph-border-primary)",
                            color: "var(--asph-text-primary)",
                            ["--tw-ring-color" as any]: "var(--asph-primary)",
                          }}
                        />
                        <button
                          onClick={() => removeFromArrayFilter("hashtags", i)}
                          className="touch-target-icon rounded-lg p-2 transition-opacity hover:opacity-70"
                          style={{ color: "var(--asph-text-secondary)" }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addToArrayFilter("hashtags", "")}
                      className="touch-target-sm rounded-lg px-3 py-1.5 text-sm transition-colors"
                      style={{
                        color: "var(--asph-primary)",
                        backgroundColor: "var(--asph-bg-secondary)",
                        borderWidth: "1px",
                        borderColor: "var(--asph-border-primary)",
                      }}
                    >
                      + Add hashtag
                    </button>
                  </div>
                </div>

                {/* From Users */}
                <div>
                  <label
                    className="mb-2 flex items-center gap-2 text-sm font-medium"
                    style={{ color: "var(--asph-text-secondary)" }}
                  >
                    <User size={16} />
                    From Users
                  </label>
                  <div className="space-y-2">
                    {filters.from.map((user, i) => (
                      <div key={`from-${i}`} className="relative">
                        <div className="flex items-center gap-2">
                          <input
                            ref={(el) => (inputRefs.current[`from-${i}`] = el)}
                            type="text"
                            value={user}
                            onChange={(e) =>
                              handleUserInputChange("from", i, e.target.value)
                            }
                            onKeyDown={(e) => handleKeyDown(e)}
                            onFocus={() => {
                              setActiveUserInput({ field: "from", index: i });
                              setUserSearchQuery(user);
                              setShowingFollowers(false);
                              if (user.length >= 2) setShowSuggestions(true);
                            }}
                            onBlur={(e) => {
                              const related =
                                e.relatedTarget as HTMLElement | null;
                              if (
                                related &&
                                suggestionsRef.current?.contains(related)
                              ) {
                                return; // Don't close if clicking inside suggestions
                              }
                              setTimeout(() => {
                                if (
                                  activeUserInput?.field === "from" &&
                                  activeUserInput?.index === i
                                ) {
                                  setShowSuggestions(false);
                                  setShowingFollowers(false);
                                  setSelectedSuggestionIndex(-1);
                                }
                              }, 150);
                            }}
                            placeholder="e.g., alice.bsky.social"
                            className="flex-1 rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                            style={{
                              backgroundColor: "var(--asph-bg-secondary)",
                              borderColor: "var(--asph-border-primary)",
                              color: "var(--asph-text-primary)",
                              ["--tw-ring-color" as any]: "var(--asph-primary)",
                            }}
                          />
                          <button
                            onClick={() => {
                              setActiveUserInput({ field: "from", index: i });
                              setShowingFollowers(true);
                              setShowSuggestions(true);
                              setUserSearchQuery("");
                            }}
                            className="touch-target-icon rounded-lg p-2 transition-opacity hover:opacity-70"
                            style={{ color: "var(--asph-text-secondary)" }}
                            title="Show following"
                          >
                            <Users size={16} />
                          </button>
                          <button
                            onClick={() => removeFromArrayFilter("from", i)}
                            className="touch-target-icon rounded-lg p-2 transition-opacity hover:opacity-70"
                            style={{ color: "var(--asph-text-secondary)" }}
                          >
                            <X size={16} />
                          </button>
                        </div>

                        {/* Typeahead suggestions */}
                        {showSuggestions &&
                          activeUserInput?.field === "from" &&
                          activeUserInput?.index === i &&
                          userSuggestions &&
                          userSuggestions.length > 0 && (
                            <div
                              ref={suggestionsRef}
                              className="absolute z-50 mt-1 max-h-[40vh] w-full overflow-y-auto rounded-lg border shadow-lg"
                              style={{
                                backgroundColor: "var(--asph-bg-secondary)",
                                borderColor: "var(--asph-border-primary)",
                              }}
                            >
                              {userSuggestions.map((suggestion, idx) => {
                                const isFollower = followingSet?.has(
                                  suggestion.did,
                                );
                                return (
                                  <button
                                    key={suggestion.did}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      handleUserSelect(suggestion);
                                    }}
                                    onMouseEnter={() =>
                                      setSelectedSuggestionIndex(idx)
                                    }
                                    className={`touch-target flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left transition-colors ${
                                      idx === selectedSuggestionIndex
                                        ? "bg-opacity-20"
                                        : "hover:bg-opacity-10"
                                    } hover:bg-white`}
                                    style={{
                                      backgroundColor:
                                        idx === selectedSuggestionIndex
                                          ? "rgba(255, 107, 157, 0.1)"
                                          : "transparent",
                                    }}
                                  >
                                    {suggestion.avatar && (
                                      <img
                                        src={proxifyBskyImage(
                                          suggestion.avatar,
                                        )}
                                        alt=""
                                        className="h-8 w-8 rounded-full"
                                      />
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <div
                                        className="truncate text-sm font-medium"
                                        style={{
                                          color: "var(--asph-text-primary)",
                                        }}
                                      >
                                        {suggestion.displayName ||
                                          suggestion.handle}
                                      </div>
                                      <div
                                        className="truncate text-xs"
                                        style={{
                                          color: "var(--asph-text-secondary)",
                                        }}
                                      >
                                        @{suggestion.handle}
                                        {isFollower && " · Following"}
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                      </div>
                    ))}
                    <button
                      onClick={() => addToArrayFilter("from", "")}
                      className="touch-target-sm rounded-lg px-3 py-1.5 text-sm transition-colors"
                      style={{
                        color: "var(--asph-primary)",
                        backgroundColor: "var(--asph-bg-secondary)",
                        borderWidth: "1px",
                        borderColor: "var(--asph-border-primary)",
                      }}
                    >
                      + Add user
                    </button>
                  </div>
                </div>

                {/* Mentions */}
                <div>
                  <label
                    className="mb-2 flex items-center gap-2 text-sm font-medium"
                    style={{ color: "var(--asph-text-secondary)" }}
                  >
                    <User size={16} />
                    Mentions
                  </label>
                  <div className="space-y-2">
                    {filters.mentions.map((user, i) => (
                      <div key={`mention-${i}`} className="relative">
                        <div className="flex items-center gap-2">
                          <input
                            ref={(el) =>
                              (inputRefs.current[`mentions-${i}`] = el)
                            }
                            type="text"
                            value={user}
                            onChange={(e) =>
                              handleUserInputChange(
                                "mentions",
                                i,
                                e.target.value,
                              )
                            }
                            onKeyDown={(e) => handleKeyDown(e)}
                            onFocus={() => {
                              setActiveUserInput({
                                field: "mentions",
                                index: i,
                              });
                              setUserSearchQuery(user);
                              setShowingFollowers(false);
                              if (user.length >= 2) setShowSuggestions(true);
                            }}
                            onBlur={(e) => {
                              const related =
                                e.relatedTarget as HTMLElement | null;
                              if (
                                related &&
                                suggestionsRef.current?.contains(related)
                              ) {
                                return; // Don't close if clicking inside suggestions
                              }
                              setTimeout(() => {
                                if (
                                  activeUserInput?.field === "mentions" &&
                                  activeUserInput?.index === i
                                ) {
                                  setShowSuggestions(false);
                                  setShowingFollowers(false);
                                  setSelectedSuggestionIndex(-1);
                                }
                              }, 150);
                            }}
                            placeholder="e.g., alice.bsky.social or me"
                            className="flex-1 rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                            style={{
                              backgroundColor: "var(--asph-bg-secondary)",
                              borderColor: "var(--asph-border-primary)",
                              color: "var(--asph-text-primary)",
                              ["--tw-ring-color" as any]: "var(--asph-primary)",
                            }}
                          />
                          <button
                            onClick={() => {
                              setActiveUserInput({
                                field: "mentions",
                                index: i,
                              });
                              setShowingFollowers(true);
                              setShowSuggestions(true);
                              setUserSearchQuery("");
                            }}
                            className="touch-target rounded-lg p-2 transition-opacity hover:opacity-70"
                            style={{ color: "var(--asph-text-secondary)" }}
                            title="Show following"
                          >
                            <Users size={16} />
                          </button>
                          <button
                            onClick={() => removeFromArrayFilter("mentions", i)}
                            className="touch-target-icon rounded-lg p-2 transition-opacity hover:opacity-70"
                            style={{ color: "var(--asph-text-secondary)" }}
                          >
                            <X size={16} />
                          </button>
                        </div>

                        {/* Typeahead suggestions */}
                        {showSuggestions &&
                          activeUserInput?.field === "mentions" &&
                          activeUserInput?.index === i &&
                          userSuggestions &&
                          userSuggestions.length > 0 && (
                            <div
                              ref={suggestionsRef}
                              className="absolute z-50 mt-1 max-h-[40vh] w-full overflow-y-auto rounded-lg border shadow-lg"
                              style={{
                                backgroundColor: "var(--asph-bg-secondary)",
                                borderColor: "var(--asph-border-primary)",
                              }}
                            >
                              {userSuggestions.map((suggestion, idx) => {
                                const isFollower = followingSet?.has(
                                  suggestion.did,
                                );
                                return (
                                  <button
                                    key={suggestion.did}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      handleUserSelect(suggestion);
                                    }}
                                    onMouseEnter={() =>
                                      setSelectedSuggestionIndex(idx)
                                    }
                                    className={`touch-target flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left transition-colors ${
                                      idx === selectedSuggestionIndex
                                        ? "bg-opacity-20"
                                        : "hover:bg-opacity-10"
                                    } hover:bg-white`}
                                    style={{
                                      backgroundColor:
                                        idx === selectedSuggestionIndex
                                          ? "rgba(255, 107, 157, 0.1)"
                                          : "transparent",
                                    }}
                                  >
                                    {suggestion.avatar && (
                                      <img
                                        src={proxifyBskyImage(
                                          suggestion.avatar,
                                        )}
                                        alt=""
                                        className="h-8 w-8 rounded-full"
                                      />
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <div
                                        className="truncate text-sm font-medium"
                                        style={{
                                          color: "var(--asph-text-primary)",
                                        }}
                                      >
                                        {suggestion.displayName ||
                                          suggestion.handle}
                                      </div>
                                      <div
                                        className="truncate text-xs"
                                        style={{
                                          color: "var(--asph-text-secondary)",
                                        }}
                                      >
                                        @{suggestion.handle}
                                        {isFollower && " · Following"}
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                      </div>
                    ))}
                    <button
                      onClick={() => addToArrayFilter("mentions", "")}
                      className="touch-target-sm rounded-lg px-3 py-1.5 text-sm transition-colors"
                      style={{
                        color: "var(--asph-primary)",
                        backgroundColor: "var(--asph-bg-secondary)",
                        borderWidth: "1px",
                        borderColor: "var(--asph-border-primary)",
                      }}
                    >
                      + Add mention
                    </button>
                  </div>
                </div>

                {/* Domains */}
                <div>
                  <label
                    className="mb-2 flex items-center gap-2 text-sm font-medium"
                    style={{ color: "var(--asph-text-secondary)" }}
                  >
                    <Globe size={16} />
                    Domains (links)
                  </label>
                  <div className="space-y-2">
                    {filters.domains.map((domain, i) => (
                      <div
                        key={`domain-${domain}-${i}`}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="text"
                          value={domain}
                          onChange={(e) => {
                            const newDomains = [...filters.domains];
                            newDomains[i] = e.target.value;
                            setFilters((prev) => ({
                              ...prev,
                              domains: newDomains,
                            }));
                          }}
                          placeholder="e.g., github.com"
                          className="flex-1 rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                          style={{
                            backgroundColor: "var(--asph-bg-secondary)",
                            borderColor: "var(--asph-border-primary)",
                            color: "var(--asph-text-primary)",
                            ["--tw-ring-color" as any]: "var(--asph-primary)",
                          }}
                        />
                        <button
                          onClick={() => removeFromArrayFilter("domains", i)}
                          className="touch-target-icon rounded-lg p-2 transition-opacity hover:opacity-70"
                          style={{ color: "var(--asph-text-secondary)" }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addToArrayFilter("domains", "")}
                      className="touch-target-sm rounded-lg px-3 py-1.5 text-sm transition-colors"
                      style={{
                        color: "var(--asph-primary)",
                        backgroundColor: "var(--asph-bg-secondary)",
                        borderWidth: "1px",
                        borderColor: "var(--asph-border-primary)",
                      }}
                    >
                      + Add domain
                    </button>
                  </div>
                </div>

                {/* Language Filter */}
                <div>
                  <label
                    className="mb-2 flex items-center gap-2 text-sm font-medium"
                    style={{ color: "var(--asph-text-secondary)" }}
                  >
                    <Globe size={16} />
                    Language
                  </label>
                  <select
                    value={filters.language}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        language: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                    style={{
                      backgroundColor: "var(--asph-bg-secondary)",
                      borderColor: "var(--asph-border-primary)",
                      color: "var(--asph-text-primary)",
                      ["--tw-ring-color" as any]: "var(--asph-primary)",
                    }}
                  >
                    <option value="">Any language</option>
                    <option value="en">English</option>
                    <option value="ja">Japanese</option>
                    <option value="pt">Portuguese</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="it">Italian</option>
                    <option value="ko">Korean</option>
                    <option value="zh">Chinese</option>
                  </select>
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      className="mb-2 flex items-center gap-2 text-sm font-medium"
                      style={{ color: "var(--asph-text-secondary)" }}
                    >
                      <Calendar size={16} />
                      Since
                    </label>
                    <input
                      type="date"
                      value={filters.sinceDate}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          sinceDate: e.target.value,
                        }))
                      }
                      max={
                        filters.untilDate || format(new Date(), "yyyy-MM-dd")
                      }
                      className="w-full rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                      style={{
                        backgroundColor: "var(--asph-bg-secondary)",
                        borderColor: "var(--asph-border-primary)",
                        color: "var(--asph-text-primary)",
                        ["--tw-ring-color" as any]: "var(--asph-primary)",
                      }}
                    />
                  </div>
                  <div>
                    <label
                      className="mb-2 flex items-center gap-2 text-sm font-medium"
                      style={{ color: "var(--asph-text-secondary)" }}
                    >
                      <Calendar size={16} />
                      Until
                    </label>
                    <input
                      type="date"
                      value={filters.untilDate}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          untilDate: e.target.value,
                        }))
                      }
                      min={filters.sinceDate}
                      max={format(new Date(), "yyyy-MM-dd")}
                      className="w-full rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                      style={{
                        backgroundColor: "var(--asph-bg-secondary)",
                        borderColor: "var(--asph-border-primary)",
                        color: "var(--asph-text-primary)",
                        ["--tw-ring-color" as any]: "var(--asph-primary)",
                      }}
                    />
                  </div>
                </div>

                {/* Quick date filters */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      setFilters((prev) => ({
                        ...prev,
                        sinceDate: format(subDays(new Date(), 1), "yyyy-MM-dd"),
                        untilDate: format(new Date(), "yyyy-MM-dd"),
                      }))
                    }
                    className="touch-target-sm rounded-lg px-3 py-1.5 text-xs transition-colors"
                    style={{
                      color: "var(--asph-primary)",
                      backgroundColor: "var(--asph-bg-secondary)",
                      borderWidth: "1px",
                      borderColor: "var(--asph-border-primary)",
                    }}
                  >
                    Last 24h
                  </button>
                  <button
                    onClick={() =>
                      setFilters((prev) => ({
                        ...prev,
                        sinceDate: format(subDays(new Date(), 7), "yyyy-MM-dd"),
                        untilDate: format(new Date(), "yyyy-MM-dd"),
                      }))
                    }
                    className="touch-target-sm rounded-lg px-3 py-1.5 text-xs transition-colors"
                    style={{
                      color: "var(--asph-primary)",
                      backgroundColor: "var(--asph-bg-secondary)",
                      borderWidth: "1px",
                      borderColor: "var(--asph-border-primary)",
                    }}
                  >
                    Last 7 days
                  </button>
                  <button
                    onClick={() =>
                      setFilters((prev) => ({
                        ...prev,
                        sinceDate: format(
                          subMonths(new Date(), 1),
                          "yyyy-MM-dd",
                        ),
                        untilDate: format(new Date(), "yyyy-MM-dd"),
                      }))
                    }
                    className="touch-target rounded-lg px-3 py-1.5 text-xs transition-colors"
                    style={{
                      color: "var(--asph-primary)",
                      backgroundColor: "var(--asph-bg-secondary)",
                      borderWidth: "1px",
                      borderColor: "var(--asph-border-primary)",
                    }}
                  >
                    Last 30 days
                  </button>
                  <button
                    onClick={() =>
                      setFilters((prev) => ({
                        ...prev,
                        sinceDate: "",
                        untilDate: "",
                      }))
                    }
                    className="touch-target-sm rounded-lg px-3 py-1.5 text-xs transition-colors"
                    style={{
                      color: "var(--asph-text-secondary)",
                      backgroundColor: "var(--asph-bg-secondary)",
                      borderWidth: "1px",
                      borderColor: "var(--asph-border-primary)",
                    }}
                  >
                    Clear dates
                  </button>
                </div>

                {/* Media Filter */}
                <div>
                  <label
                    className="mb-2 flex items-center gap-2 text-sm font-medium"
                    style={{ color: "var(--asph-text-secondary)" }}
                  >
                    <Image size={16} />
                    Has Media
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={filters.hasMedia}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          hasMedia: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded"
                      style={{
                        accentColor: "var(--asph-primary)",
                      }}
                    />
                    <span
                      className="text-sm"
                      style={{ color: "var(--asph-text-primary)" }}
                    >
                      Only show posts with media attachments
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Tab Content */}
          <div className="space-y-4">
            {activeTab === "posts" && (
              <SearchTabPosts
                activeSearchQuery={activeSearchQuery}
                agent={agent}
                sortOrder={sortOrder}
                facetedFilters={facetedFilters}
                hasMediaFilter={filters.hasMedia}
                isPostHidden={isPostHidden}
                isUserMuted={isUserMuted}
                isUserBlocked={isUserBlocked}
                isThreadMuted={isThreadMuted}
                handlePostClick={handlePostClick}
              />
            )}

            {activeTab === "users" && (
              <SearchTabUsers
                activeSearchQuery={activeSearchQuery}
                agent={agent}
                isUserMuted={isUserMuted}
                isUserBlocked={isUserBlocked}
                navigate={navigate}
              />
            )}

            {activeTab === "feeds" && (
              <SearchTabFeeds
                activeSearchQuery={activeSearchQuery}
                agent={agent}
                navigate={navigate}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
});
