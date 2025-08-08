import type { AppBskyFeedDefs } from "@atproto/api";
import { debug } from "@bsky/shared";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow, subDays, subMonths } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  ExternalLink,
  Filter,
  Globe,
  Hash,
  Image,
  Link,
  Search as SearchIcon,
  User,
  X,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useDebounce } from "../hooks/useDebounce";
import { useFollowing } from "../hooks/useFollowing";
import { atProtoClient } from "../services/atproto";
import { getFollowerCacheDB } from "../services/follower-cache-db";
import { getProfileCacheService } from "../services/profile-cache-service";
import { proxifyBskyImage } from "../utils/image-proxy";
import { constructAtUri, parseBskyUrl } from "../utils/url-helpers";
import { ThreadViewer } from "./ThreadViewer";

interface SearchFilters {
  query: string;
  phrases: string[];
  hashtags: string[];
  from: string[];
  mentions: string[];
  domains: string[];
  language: string;
  sinceDate: string;
  untilDate: string;
  hasMedia: boolean;
}

interface UserSuggestion {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  interactionScore?: number;
}

// Check if a post has media attachments
const postHasMedia = (post: AppBskyFeedDefs.PostView): boolean => {
  if (!post.embed) return false;

  const embed = post.embed as any;

  // Direct image embed
  if (embed.$type === "app.bsky.embed.images#view") {
    return true;
  }

  // Record with media (quote post with images)
  if (
    embed.$type === "app.bsky.embed.recordWithMedia#view" &&
    embed.media?.$type === "app.bsky.embed.images#view"
  ) {
    return true;
  }

  // Video embed
  if (embed.$type === "app.bsky.embed.video#view") {
    return true;
  }

  return false;
};

// Extract images from a post
const getPostImages = (
  post: AppBskyFeedDefs.PostView,
): Array<{ thumb: string; fullsize: string; alt?: string }> => {
  if (!post.embed) return [];

  const embed = post.embed as any;
  let images: Array<{ thumb: string; fullsize: string; alt?: string }> = [];

  // Extract images from different embed types
  if (embed.$type === "app.bsky.embed.images#view" && embed.images) {
    images = embed.images;
  } else if (
    embed.$type === "app.bsky.embed.recordWithMedia#view" &&
    embed.media?.$type === "app.bsky.embed.images#view" &&
    embed.media.images
  ) {
    images = embed.media.images;
  }

  return images;
};

// Build search query from filters
const buildSearchQuery = (searchFilters: SearchFilters) => {
  const parts: string[] = [];

  // Basic query
  if (searchFilters.query) {
    parts.push(searchFilters.query);
  }

  // Exact phrases
  searchFilters.phrases.forEach((phrase) => {
    if (phrase.trim()) {
      parts.push(`"${phrase.trim()}"`);
    }
  });

  // Hashtags
  searchFilters.hashtags.forEach((tag) => {
    if (tag.trim()) {
      parts.push(`#${tag.trim().replace(/^#/, "")}`);
    }
  });

  // From users
  searchFilters.from.forEach((user) => {
    if (user.trim()) {
      parts.push(`from:${user.trim().replace(/^@/, "")}`);
    }
  });

  // Mentions
  searchFilters.mentions.forEach((user) => {
    if (user.trim()) {
      const cleanUser = user.trim().replace(/^@/, "");
      if (cleanUser === "me") {
        parts.push("mentions:me");
      } else {
        parts.push(`@${cleanUser}`);
      }
    }
  });

  // Domains
  searchFilters.domains.forEach((domain) => {
    if (domain.trim()) {
      parts.push(`domain:${domain.trim()}`);
    }
  });

  // Language
  if (searchFilters.language) {
    parts.push(`lang:${searchFilters.language}`);
  }

  // Date range
  if (searchFilters.sinceDate) {
    parts.push(`since:${searchFilters.sinceDate}`);
  }

  if (searchFilters.untilDate) {
    parts.push(`until:${searchFilters.untilDate}`);
  }

  return parts.join(" ");
};

export const Search: React.FC = () => {
  const {} = useAuth();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
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

  // Thread viewer state
  const [showThreadViewer, setShowThreadViewer] = useState(false);
  const [threadPosts, setThreadPosts] = useState<AppBskyFeedDefs.PostView[]>(
    [],
  );
  const [selectedPostUri, setSelectedPostUri] = useState<string | null>(null);
  const [highlightPostUri, setHighlightPostUri] = useState<string | null>(null);
  const [isLoadingThread, setIsLoadingThread] = useState(false);

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
    if (followingSet && followingSet.size > 0) {
      const loadFollowersData = async () => {
        try {
          const db = await getFollowerCacheDB();
          const profileService = getProfileCacheService(atProtoClient.agent);

          // Get DIDs from following set
          const dids = Array.from(followingSet);

          // Get cached profiles first
          const cachedProfiles = await db.getProfiles(dids);
          const interactionStats =
            await db.getInteractionStatsForMultiple(dids);

          // Build initial list from cache
          const followers: UserSuggestion[] = [];
          for (const [did, profile] of cachedProfiles) {
            followers.push({
              did: profile.did,
              handle: profile.handle,
              displayName: profile.displayName,
              avatar: profile.avatar,
              interactionScore:
                interactionStats.get(did)?.totalInteractions || 0,
            });
          }

          // Sort by interaction score
          followers.sort(
            (a, b) => (b.interactionScore || 0) - (a.interactionScore || 0),
          );

          // Update state with cached data first
          setFollowersWithData(followers);

          // Then fetch any missing profiles in background
          const missingDids = dids.filter((did) => !cachedProfiles.has(did));
          if (missingDids.length > 0) {
            debug.log(
              `Fetching ${missingDids.length} missing follower profiles`,
            );
            const freshProfiles =
              await profileService.getProfilesByDidsWithCache(missingDids);

            // Update with fresh data
            const updatedFollowers = [...followers];
            for (const [did, profile] of freshProfiles) {
              if (!cachedProfiles.has(did)) {
                updatedFollowers.push({
                  did: profile.did,
                  handle: profile.handle,
                  displayName: profile.displayName,
                  avatar: profile.avatar,
                  interactionScore:
                    interactionStats.get(did)?.totalInteractions || 0,
                });
              }
            }

            // Re-sort with all data
            updatedFollowers.sort(
              (a, b) => (b.interactionScore || 0) - (a.interactionScore || 0),
            );
            setFollowersWithData(updatedFollowers);
          }
        } catch (error) {
          debug.error("Error loading followers data:", error);
        }
      };

      loadFollowersData();
    }
  }, [followingSet]);

  // Typeahead query - now includes followers
  const { data: searchSuggestions } = useQuery({
    queryKey: ["userTypeahead", debouncedUserSearch],
    queryFn: async () => {
      if (!debouncedUserSearch || debouncedUserSearch.length < 2) return [];

      try {
        const response =
          await atProtoClient.agent.app.bsky.actor.searchActorsTypeahead({
            q: debouncedUserSearch,
            limit: 8,
          });

        return response.data.actors.map((actor) => ({
          did: actor.did,
          handle: actor.handle,
          displayName: actor.displayName,
          avatar: actor.avatar,
        }));
      } catch (error) {
        console.error("Error searching users:", error);
        return [];
      }
    },
    enabled: !!debouncedUserSearch && debouncedUserSearch.length >= 2,
  });

  // Combine followers and search results
  const userSuggestions = React.useMemo(() => {
    if (showingFollowers && (!userSearchQuery || userSearchQuery.length < 2)) {
      // Show all followers when arrow down pressed
      return followersWithData.slice(0, 20); // Limit to top 20
    }

    if (!debouncedUserSearch || debouncedUserSearch.length < 2) {
      return [];
    }

    // Filter followers that match the search
    const searchLower = debouncedUserSearch.toLowerCase();
    const matchingFollowers = followersWithData.filter(
      (f) =>
        f?.handle?.toLowerCase().includes(searchLower) ||
        f?.displayName?.toLowerCase().includes(searchLower),
    );

    // Get search results that aren't followers
    const followerDids = new Set(followersWithData.map((f) => f.did));
    const nonFollowerResults = (searchSuggestions || []).filter(
      (s) => !followerDids.has(s.did),
    );

    // Combine: followers first, then other results
    return [...matchingFollowers, ...nonFollowerResults].slice(0, 10);
  }, [
    debouncedUserSearch,
    searchSuggestions,
    followersWithData,
    showingFollowers,
    userSearchQuery,
  ]);

  // Handle clicks outside suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        // Don't close if we're clicking on an input
        const target = event.target as HTMLElement;
        if (!target.closest("input")) {
          setShowSuggestions(false);
          setActiveUserInput(null);
          setUserSearchQuery("");
          setSelectedSuggestionIndex(-1);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Ensure selected item is visible when navigating with keyboard
  useEffect(() => {
    if (selectedSuggestionIndex >= 0 && suggestionsRef.current) {
      const selectedButton =
        suggestionsRef.current.querySelectorAll("button")[
          selectedSuggestionIndex
        ];
      if (selectedButton) {
        selectedButton.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedSuggestionIndex]);

  // No longer auto-trigger search - user must click search button or press Enter
  useEffect(() => {
    // Clear active search if the query is cleared
    if (!searchQuery.trim()) {
      setActiveSearchQuery("");
    }
  }, [searchQuery]);

  // Search posts query
  const {
    data: searchResults,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["search", activeSearchQuery, filters.hasMedia],
    queryFn: async () => {
      if (!activeSearchQuery.trim()) return null;

      const response = await atProtoClient.agent.app.bsky.feed.searchPosts({
        q: activeSearchQuery,
        limit: 50,
      });

      // Filter by media if needed
      if (filters.hasMedia) {
        const filteredPosts = response.data.posts.filter((post) =>
          postHasMedia(post),
        );
        return {
          ...response.data,
          posts: filteredPosts,
        };
      }

      return response.data;
    },
    enabled: !!activeSearchQuery.trim(),
  });

  // Fetch thread for a post
  const fetchThread = async (uri: string, findRoot: boolean = true) => {
    setIsLoadingThread(true);
    try {
      // Get the thread
      const response = await atProtoClient.agent.getPostThread({
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
            const rootResponse = await atProtoClient.agent.getPostThread({
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
          const parentPosts = collectParents(thread.parent);
          posts.push(...parentPosts);
        }

        // Add the current post
        if (thread.post) {
          posts.push(thread.post);
        }
      }

      // Then collect all replies
      const extractReplies = (thread: any) => {
        if (thread.replies) {
          thread.replies.forEach((reply: any) => {
            if (reply.post) {
              posts.push(reply.post);
            }
            extractReplies(reply);
          });
        }
      };

      extractReplies(response.data.thread);

      setThreadPosts(posts);
      setSelectedPostUri(posts[0]?.uri || uri); // Set to root if available
      setHighlightPostUri(null); // No highlight needed when showing from root
      setShowThreadViewer(true);
    } catch (error) {
      debug.error("Error fetching thread:", error);
      // Still show the single post if thread fetch fails
      const singlePost = searchResults?.posts.find((p) => p.uri === uri);
      if (singlePost) {
        setThreadPosts([singlePost]);
        setSelectedPostUri(uri);
        setHighlightPostUri(null);
        setShowThreadViewer(true);
      }
    } finally {
      setIsLoadingThread(false);
    }
  };

  // Handle search result click
  const handlePostClick = async (post: AppBskyFeedDefs.PostView) => {
    await fetchThread(post.uri, false); // Don't find root for search results, just show the thread from that point
  };

  // Handle Bluesky URL input
  const handleBskyUrlSubmit = async (url: string) => {
    const parsed = parseBskyUrl(url);
    if (!parsed || !parsed.postId) {
      return;
    }

    setIsLoadingThread(true);
    try {
      // If we have a handle, we need to resolve it to a DID first
      let uri: string;
      if (parsed.handle) {
        const profile = await atProtoClient.agent.getProfile({
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
        <div className="bsky-glass mb-4 rounded-xl p-4">
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={() => {
                setShowThreadViewer(false);
                setThreadPosts([]);
                setSelectedPostUri(null);
                setHighlightPostUri(null);
              }}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all hover:bg-white hover:bg-opacity-10"
              style={{ color: "var(--bsky-primary)" }}
            >
              <ArrowLeft size={16} />
              Back to search
            </button>
            {selectedPostUri && (
              <a
                href={`https://bsky.app/profile/${threadPosts[0]?.author?.handle || "unknown"}/post/${selectedPostUri.split("/").pop()}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm transition-all"
                style={{
                  backgroundColor: "var(--bsky-primary)",
                  color: "white",
                }}
              >
                View on Bluesky
                <ExternalLink size={14} />
              </a>
            )}
          </div>
          {isLoadingThread ? (
            <div className="py-8 text-center">
              <div
                className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2"
                style={{ borderColor: "var(--bsky-primary)" }}
              ></div>
              <p
                className="mt-3 text-sm"
                style={{ color: "var(--bsky-text-secondary)" }}
              >
                Loading thread...
              </p>
            </div>
          ) : (
            <ThreadViewer
              posts={threadPosts}
              rootUri={selectedPostUri || undefined}
              highlightUri={highlightPostUri || undefined}
              className="max-h-[70vh] overflow-y-auto"
            />
          )}
        </div>
      ) : (
        <>
          {/* Search Bar */}
          <div className="bsky-glass mb-4 rounded-xl p-3 sm:p-4">
            <div className="mb-3 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center gap-2">
                <SearchIcon
                  size={20}
                  style={{ color: "var(--bsky-text-secondary)" }}
                  className="hidden sm:block"
                />
                <input
                  type="text"
                  placeholder="Search posts or paste a Bluesky URL..."
                  value={filters.query}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, query: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSearch();
                    }
                  }}
                  className="flex-1 rounded-lg border px-3 py-2 text-sm transition-all focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: "var(--bsky-bg-secondary)",
                    borderColor: "var(--bsky-border-primary)",
                    color: "var(--bsky-text-primary)",
                    ["--tw-ring-color" as any]: "var(--bsky-primary)",
                  }}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSearch}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all sm:flex-none sm:px-4"
                  style={{
                    backgroundColor: "var(--bsky-primary)",
                    color: "white",
                  }}
                >
                  <SearchIcon size={16} />
                  <span className="hidden sm:inline">Search</span>
                </button>
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-all ${
                    showAdvanced ? "text-white" : ""
                  }`}
                  style={{
                    backgroundColor: showAdvanced
                      ? "var(--bsky-primary)"
                      : "var(--bsky-bg-secondary)",
                    color: showAdvanced
                      ? "white"
                      : "var(--bsky-text-secondary)",
                    borderWidth: "1px",
                    borderColor: "var(--bsky-border-primary)",
                  }}
                >
                  <Filter size={16} />
                  <span className="hidden sm:inline">Filters</span>
                </button>
              </div>
            </div>

            {/* Filter Action Buttons - Compact when no filters */}
            {filters.from.length === 0 &&
            !filters.sinceDate &&
            !filters.untilDate &&
            filters.phrases.length === 0 &&
            filters.hashtags.length === 0 &&
            filters.mentions.length === 0 &&
            filters.domains.length === 0 &&
            !filters.language &&
            !filters.hasMedia ? (
              <div
                className="mt-3 flex flex-wrap gap-1.5 border-t pt-3"
                style={{ borderColor: "var(--bsky-border-primary)" }}
              >
                <button
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      hasMedia: !prev.hasMedia,
                    }))
                  }
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors hover:bg-opacity-80 ${
                    filters.hasMedia ? "ring-2" : ""
                  }`}
                  style={{
                    color: filters.hasMedia
                      ? "white"
                      : "var(--bsky-text-secondary)",
                    backgroundColor: filters.hasMedia
                      ? "var(--bsky-primary)"
                      : "var(--bsky-bg-secondary)",
                    borderWidth: "1px",
                    borderColor: filters.hasMedia
                      ? "var(--bsky-primary)"
                      : "var(--bsky-border-primary)",
                    ["--tw-ring-color" as any]: "var(--bsky-primary)",
                  }}
                >
                  <Image size={12} />
                  Media attached
                </button>
                <button
                  onClick={() => addToArrayFilter("from", "")}
                  className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors hover:bg-opacity-80"
                  style={{
                    color: "var(--bsky-text-secondary)",
                    backgroundColor: "var(--bsky-bg-secondary)",
                    borderWidth: "1px",
                    borderColor: "var(--bsky-border-primary)",
                  }}
                >
                  <User size={12} />
                  From user
                </button>
                <button
                  onClick={() => {
                    const today = new Date();
                    const sevenDaysAgo = subDays(today, 7);
                    setFilters((prev) => ({
                      ...prev,
                      sinceDate: format(sevenDaysAgo, "yyyy-MM-dd"),
                      untilDate: format(today, "yyyy-MM-dd"),
                    }));
                  }}
                  className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors hover:bg-opacity-80"
                  style={{
                    color: "var(--bsky-text-secondary)",
                    backgroundColor: "var(--bsky-bg-secondary)",
                    borderWidth: "1px",
                    borderColor: "var(--bsky-border-primary)",
                  }}
                >
                  <Calendar size={12} />
                  Date range
                </button>
                {showAdvanced && (
                  <>
                    <button
                      key="phrases"
                      onClick={() => addToArrayFilter("phrases", "")}
                      className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors hover:bg-opacity-80"
                      style={{
                        color: "var(--bsky-text-secondary)",
                        backgroundColor: "var(--bsky-bg-secondary)",
                        borderWidth: "1px",
                        borderColor: "var(--bsky-border-primary)",
                      }}
                    >
                      <SearchIcon size={12} />
                      Phrase
                    </button>
                    <button
                      key="hashtags"
                      onClick={() => addToArrayFilter("hashtags", "")}
                      className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors hover:bg-opacity-80"
                      style={{
                        color: "var(--bsky-text-secondary)",
                        backgroundColor: "var(--bsky-bg-secondary)",
                        borderWidth: "1px",
                        borderColor: "var(--bsky-border-primary)",
                      }}
                    >
                      <Hash size={12} />
                      Tag
                    </button>
                    <button
                      key="mentions"
                      onClick={() => addToArrayFilter("mentions", "")}
                      className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors hover:bg-opacity-80"
                      style={{
                        color: "var(--bsky-text-secondary)",
                        backgroundColor: "var(--bsky-bg-secondary)",
                        borderWidth: "1px",
                        borderColor: "var(--bsky-border-primary)",
                      }}
                    >
                      <User size={12} />
                      Mentions
                    </button>
                    <button
                      key="domains"
                      onClick={() => addToArrayFilter("domains", "")}
                      className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors hover:bg-opacity-80"
                      style={{
                        color: "var(--bsky-text-secondary)",
                        backgroundColor: "var(--bsky-bg-secondary)",
                        borderWidth: "1px",
                        borderColor: "var(--bsky-border-primary)",
                      }}
                    >
                      <Link size={12} />
                      Links
                    </button>
                    <button
                      key="language"
                      onClick={() =>
                        setFilters((prev) => ({ ...prev, language: "en" }))
                      }
                      className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors hover:bg-opacity-80"
                      style={{
                        color: "var(--bsky-text-secondary)",
                        backgroundColor: "var(--bsky-bg-secondary)",
                        borderWidth: "1px",
                        borderColor: "var(--bsky-border-primary)",
                      }}
                    >
                      <Globe size={12} />
                      Lang
                    </button>
                  </>
                )}
              </div>
            ) : (
              /* Expanded Filters */
              <div
                className="mt-3 space-y-3 border-t pt-3"
                style={{ borderColor: "var(--bsky-border-primary)" }}
              >
                {/* Media Filter */}
                <div>
                  <label
                    className="mb-2 flex items-center gap-2 text-sm font-medium"
                    style={{ color: "var(--bsky-text-secondary)" }}
                  >
                    <Image size={16} />
                    Media Filter
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setFilters((prev) => ({
                          ...prev,
                          hasMedia: !prev.hasMedia,
                        }))
                      }
                      className={`rounded-lg border px-3 py-2 text-sm transition-all ${
                        filters.hasMedia ? "ring-2" : ""
                      }`}
                      style={{
                        backgroundColor: filters.hasMedia
                          ? "var(--bsky-primary)"
                          : "var(--bsky-bg-secondary)",
                        borderColor: filters.hasMedia
                          ? "var(--bsky-primary)"
                          : "var(--bsky-border-primary)",
                        color: filters.hasMedia
                          ? "white"
                          : "var(--bsky-text-primary)",
                        ["--tw-ring-color" as any]: "var(--bsky-primary)",
                      }}
                    >
                      {filters.hasMedia ? "✓ " : ""}Show only posts with media
                    </button>
                  </div>
                </div>

                {/* From Users */}
                <div>
                  <label
                    className="mb-2 flex items-center gap-2 text-sm font-medium"
                    style={{ color: "var(--bsky-text-secondary)" }}
                  >
                    <User size={16} />
                    From Users
                  </label>
                  <div className="space-y-2">
                    {filters.from.map((user, i) => (
                      <div key={i} className="relative">
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
                            onBlur={() => {
                              // Use setTimeout to allow click events on suggestions to fire first
                              setTimeout(() => {
                                if (
                                  activeUserInput?.field === "from" &&
                                  activeUserInput?.index === i
                                ) {
                                  setShowSuggestions(false);
                                  setShowingFollowers(false);
                                  setSelectedSuggestionIndex(-1);
                                }
                              }, 200);
                            }}
                            placeholder="e.g., jay.bsky.team or me"
                            className="flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                            style={{
                              backgroundColor: "var(--bsky-bg-secondary)",
                              borderColor: "var(--bsky-border-primary)",
                              color: "var(--bsky-text-primary)",
                              ["--tw-ring-color" as any]: "var(--bsky-primary)",
                            }}
                          />
                          <button
                            onClick={() => removeFromArrayFilter("from", i)}
                            className="rounded-lg p-2 transition-opacity hover:opacity-70"
                            style={{ color: "var(--bsky-text-secondary)" }}
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
                              className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border shadow-lg"
                              style={{
                                backgroundColor: "var(--bsky-bg-secondary)",
                                borderColor: "var(--bsky-border-primary)",
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
                                      e.preventDefault(); // Prevent focus loss
                                      handleUserSelect(suggestion);
                                    }}
                                    onMouseEnter={() =>
                                      setSelectedSuggestionIndex(idx)
                                    }
                                    className={`flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left transition-colors ${
                                      idx === selectedSuggestionIndex
                                        ? "bg-opacity-20"
                                        : "hover:bg-opacity-10"
                                    } hover:bg-white`}
                                    style={{
                                      backgroundColor:
                                        idx === selectedSuggestionIndex
                                          ? "rgba(0, 133, 255, 0.1)"
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
                                      <div className="flex items-center gap-2">
                                        <span
                                          className="truncate font-medium"
                                          style={{
                                            color: "var(--bsky-text-primary)",
                                          }}
                                        >
                                          {suggestion.displayName ||
                                            suggestion.handle}
                                        </span>
                                        {isFollower && (
                                          <span
                                            className="rounded px-1.5 py-0.5 text-xs"
                                            style={{
                                              backgroundColor:
                                                "var(--bsky-primary)",
                                              color: "white",
                                              opacity: 0.8,
                                            }}
                                          >
                                            Following
                                          </span>
                                        )}
                                      </div>
                                      <div
                                        className="truncate text-sm"
                                        style={{
                                          color: "var(--bsky-text-secondary)",
                                        }}
                                      >
                                        @{suggestion.handle}
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
                      className="rounded-lg px-3 py-1.5 text-sm transition-colors"
                      style={{
                        color: "var(--bsky-primary)",
                        backgroundColor: "var(--bsky-bg-secondary)",
                        borderWidth: "1px",
                        borderColor: "var(--bsky-border-primary)",
                      }}
                    >
                      + Add user
                    </button>
                  </div>
                </div>

                {/* Date Range */}
                <div>
                  <label
                    className="mb-2 flex items-center gap-2 text-sm font-medium"
                    style={{ color: "var(--bsky-text-secondary)" }}
                  >
                    <Calendar size={16} />
                    Date Range
                  </label>

                  {/* Date Presets */}
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    <button
                      onClick={() => {
                        const today = new Date();
                        const sevenDaysAgo = subDays(today, 7);
                        setFilters((prev) => ({
                          ...prev,
                          sinceDate: format(sevenDaysAgo, "yyyy-MM-dd"),
                          untilDate: format(today, "yyyy-MM-dd"),
                        }));
                      }}
                      className="rounded-md px-2 py-0.5 text-xs transition-colors hover:opacity-80"
                      style={{
                        backgroundColor: "var(--bsky-bg-secondary)",
                        color: "var(--bsky-primary)",
                        borderWidth: "1px",
                        borderColor: "var(--bsky-border-primary)",
                      }}
                    >
                      7d
                    </button>
                    <button
                      onClick={() => {
                        const today = new Date();
                        const thirtyDaysAgo = subDays(today, 30);
                        setFilters((prev) => ({
                          ...prev,
                          sinceDate: format(thirtyDaysAgo, "yyyy-MM-dd"),
                          untilDate: format(today, "yyyy-MM-dd"),
                        }));
                      }}
                      className="rounded-md px-2 py-0.5 text-xs transition-colors hover:opacity-80"
                      style={{
                        backgroundColor: "var(--bsky-bg-secondary)",
                        color: "var(--bsky-primary)",
                        borderWidth: "1px",
                        borderColor: "var(--bsky-border-primary)",
                      }}
                    >
                      30d
                    </button>
                    <button
                      onClick={() => {
                        const today = new Date();
                        const threeMonthsAgo = subMonths(today, 3);
                        setFilters((prev) => ({
                          ...prev,
                          sinceDate: format(threeMonthsAgo, "yyyy-MM-dd"),
                          untilDate: format(today, "yyyy-MM-dd"),
                        }));
                      }}
                      className="rounded-md px-2 py-0.5 text-xs transition-colors hover:opacity-80"
                      style={{
                        backgroundColor: "var(--bsky-bg-secondary)",
                        color: "var(--bsky-primary)",
                        borderWidth: "1px",
                        borderColor: "var(--bsky-border-primary)",
                      }}
                    >
                      3m
                    </button>
                    <button
                      onClick={() => {
                        const today = new Date();
                        const oneYearAgo = subMonths(today, 12);
                        setFilters((prev) => ({
                          ...prev,
                          sinceDate: format(oneYearAgo, "yyyy-MM-dd"),
                          untilDate: format(today, "yyyy-MM-dd"),
                        }));
                      }}
                      className="rounded-md px-2 py-0.5 text-xs transition-colors hover:opacity-80"
                      style={{
                        backgroundColor: "var(--bsky-bg-secondary)",
                        color: "var(--bsky-primary)",
                        borderWidth: "1px",
                        borderColor: "var(--bsky-border-primary)",
                      }}
                    >
                      1y
                    </button>
                    {(filters.sinceDate || filters.untilDate) && (
                      <button
                        onClick={() =>
                          setFilters((prev) => ({
                            ...prev,
                            sinceDate: "",
                            untilDate: "",
                          }))
                        }
                        className="rounded-md px-2 py-0.5 text-xs transition-colors hover:opacity-80"
                        style={{
                          backgroundColor: "var(--bsky-border-primary)",
                          color: "var(--bsky-text-secondary)",
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Date Inputs */}
                  <div className="flex items-center gap-2 text-xs">
                    <span style={{ color: "var(--bsky-text-secondary)" }}>
                      from
                    </span>
                    <div className="relative">
                      <input
                        type="date"
                        value={filters.sinceDate}
                        max={filters.untilDate || undefined}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            sinceDate: e.target.value,
                          }))
                        }
                        className="cursor-pointer rounded-md border px-2 py-1 pr-7 text-xs focus:outline-none focus:ring-2"
                        style={{
                          backgroundColor: "var(--bsky-bg-secondary)",
                          borderColor: "var(--bsky-border-primary)",
                          color: "var(--bsky-text-primary)",
                          ["--tw-ring-color" as any]: "var(--bsky-primary)",
                          colorScheme: "dark",
                          width: "140px",
                        }}
                      />
                      {filters.sinceDate && (
                        <button
                          onClick={() =>
                            setFilters((prev) => ({ ...prev, sinceDate: "" }))
                          }
                          className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 transition-opacity hover:opacity-70"
                          style={{ color: "var(--bsky-text-secondary)" }}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                    <span style={{ color: "var(--bsky-text-secondary)" }}>
                      to
                    </span>
                    <div className="relative">
                      <input
                        type="date"
                        value={filters.untilDate}
                        min={filters.sinceDate || undefined}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            untilDate: e.target.value,
                          }))
                        }
                        className="cursor-pointer rounded-md border px-2 py-1 pr-7 text-xs focus:outline-none focus:ring-2"
                        style={{
                          backgroundColor: "var(--bsky-bg-secondary)",
                          borderColor: "var(--bsky-border-primary)",
                          color: "var(--bsky-text-primary)",
                          ["--tw-ring-color" as any]: "var(--bsky-primary)",
                          colorScheme: "dark",
                          width: "140px",
                        }}
                      />
                      {filters.untilDate && (
                        <button
                          onClick={() =>
                            setFilters((prev) => ({ ...prev, untilDate: "" }))
                          }
                          className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 transition-opacity hover:opacity-70"
                          style={{ color: "var(--bsky-text-secondary)" }}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Date validation message */}
                  {filters.sinceDate &&
                    filters.untilDate &&
                    new Date(filters.sinceDate) >
                      new Date(filters.untilDate) && (
                      <p
                        className="mt-2 text-xs"
                        style={{ color: "var(--bsky-error)" }}
                      >
                        "From" date must be before "To" date
                      </p>
                    )}
                </div>
              </div>
            )}

            {/* Advanced Search Filters */}
            {showAdvanced && (
              <div
                className="mt-6 space-y-4 border-t pt-6"
                style={{ borderColor: "var(--bsky-border-primary)" }}
              >
                {/* Exact Phrases */}
                <div>
                  <label
                    className="mb-2 flex items-center gap-2 text-sm font-medium"
                    style={{ color: "var(--bsky-text-secondary)" }}
                  >
                    <SearchIcon size={16} />
                    Exact Phrases
                  </label>
                  <div className="space-y-2">
                    {filters.phrases.map((phrase, i) => (
                      <div key={i} className="flex items-center gap-2">
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
                          placeholder='e.g., "hello world"'
                          className="flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                          style={{
                            backgroundColor: "var(--bsky-bg-secondary)",
                            borderColor: "var(--bsky-border-primary)",
                            color: "var(--bsky-text-primary)",
                            ["--tw-ring-color" as any]: "var(--bsky-primary)",
                          }}
                        />
                        <button
                          onClick={() => removeFromArrayFilter("phrases", i)}
                          className="rounded-lg p-2 transition-opacity hover:opacity-70"
                          style={{ color: "var(--bsky-text-secondary)" }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addToArrayFilter("phrases", "")}
                      className="rounded-lg px-3 py-1.5 text-sm transition-colors"
                      style={{
                        color: "var(--bsky-primary)",
                        backgroundColor: "var(--bsky-bg-secondary)",
                        borderWidth: "1px",
                        borderColor: "var(--bsky-border-primary)",
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
                    style={{ color: "var(--bsky-text-secondary)" }}
                  >
                    <Hash size={16} />
                    Hashtags
                  </label>
                  <div className="space-y-2">
                    {filters.hashtags.map((tag, i) => (
                      <div key={i} className="flex items-center gap-2">
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
                          className="flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                          style={{
                            backgroundColor: "var(--bsky-bg-secondary)",
                            borderColor: "var(--bsky-border-primary)",
                            color: "var(--bsky-text-primary)",
                            ["--tw-ring-color" as any]: "var(--bsky-primary)",
                          }}
                        />
                        <button
                          onClick={() => removeFromArrayFilter("hashtags", i)}
                          className="rounded-lg p-2 transition-opacity hover:opacity-70"
                          style={{ color: "var(--bsky-text-secondary)" }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addToArrayFilter("hashtags", "")}
                      className="rounded-lg px-3 py-1.5 text-sm transition-colors"
                      style={{
                        color: "var(--bsky-primary)",
                        backgroundColor: "var(--bsky-bg-secondary)",
                        borderWidth: "1px",
                        borderColor: "var(--bsky-border-primary)",
                      }}
                    >
                      + Add hashtag
                    </button>
                  </div>
                </div>

                {/* Mentions */}
                <div>
                  <label
                    className="mb-2 flex items-center gap-2 text-sm font-medium"
                    style={{ color: "var(--bsky-text-secondary)" }}
                  >
                    <User size={16} />
                    Mentions
                  </label>
                  <div className="space-y-2">
                    {filters.mentions.map((user, i) => (
                      <div key={i} className="relative">
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
                            onBlur={() => {
                              // Use setTimeout to allow click events on suggestions to fire first
                              setTimeout(() => {
                                if (
                                  activeUserInput?.field === "mentions" &&
                                  activeUserInput?.index === i
                                ) {
                                  setShowSuggestions(false);
                                  setShowingFollowers(false);
                                  setSelectedSuggestionIndex(-1);
                                }
                              }, 200);
                            }}
                            placeholder="e.g., alice.bsky.social or me"
                            className="flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                            style={{
                              backgroundColor: "var(--bsky-bg-secondary)",
                              borderColor: "var(--bsky-border-primary)",
                              color: "var(--bsky-text-primary)",
                              ["--tw-ring-color" as any]: "var(--bsky-primary)",
                            }}
                          />
                          <button
                            onClick={() => removeFromArrayFilter("mentions", i)}
                            className="rounded-lg p-2 transition-opacity hover:opacity-70"
                            style={{ color: "var(--bsky-text-secondary)" }}
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
                              className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border shadow-lg"
                              style={{
                                backgroundColor: "var(--bsky-bg-secondary)",
                                borderColor: "var(--bsky-border-primary)",
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
                                      e.preventDefault(); // Prevent focus loss
                                      handleUserSelect(suggestion);
                                    }}
                                    onMouseEnter={() =>
                                      setSelectedSuggestionIndex(idx)
                                    }
                                    className={`flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left transition-colors ${
                                      idx === selectedSuggestionIndex
                                        ? "bg-opacity-20"
                                        : "hover:bg-opacity-10"
                                    } hover:bg-white`}
                                    style={{
                                      backgroundColor:
                                        idx === selectedSuggestionIndex
                                          ? "rgba(0, 133, 255, 0.1)"
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
                                      <div className="flex items-center gap-2">
                                        <span
                                          className="truncate font-medium"
                                          style={{
                                            color: "var(--bsky-text-primary)",
                                          }}
                                        >
                                          {suggestion.displayName ||
                                            suggestion.handle}
                                        </span>
                                        {isFollower && (
                                          <span
                                            className="rounded px-1.5 py-0.5 text-xs"
                                            style={{
                                              backgroundColor:
                                                "var(--bsky-primary)",
                                              color: "white",
                                              opacity: 0.8,
                                            }}
                                          >
                                            Following
                                          </span>
                                        )}
                                      </div>
                                      <div
                                        className="truncate text-sm"
                                        style={{
                                          color: "var(--bsky-text-secondary)",
                                        }}
                                      >
                                        @{suggestion.handle}
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
                      className="rounded-lg px-3 py-1.5 text-sm transition-colors"
                      style={{
                        color: "var(--bsky-primary)",
                        backgroundColor: "var(--bsky-bg-secondary)",
                        borderWidth: "1px",
                        borderColor: "var(--bsky-border-primary)",
                      }}
                    >
                      + Add mention
                    </button>
                  </div>
                </div>

                {/* Domain Filter */}
                <div>
                  <label
                    className="mb-2 flex items-center gap-2 text-sm font-medium"
                    style={{ color: "var(--bsky-text-secondary)" }}
                  >
                    <Link size={16} />
                    Domains
                  </label>
                  <div className="space-y-2">
                    {filters.domains.map((domain, i) => (
                      <div key={i} className="flex items-center gap-2">
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
                          placeholder="e.g., npr.org"
                          className="flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                          style={{
                            backgroundColor: "var(--bsky-bg-secondary)",
                            borderColor: "var(--bsky-border-primary)",
                            color: "var(--bsky-text-primary)",
                            ["--tw-ring-color" as any]: "var(--bsky-primary)",
                          }}
                        />
                        <button
                          onClick={() => removeFromArrayFilter("domains", i)}
                          className="rounded-lg p-2 transition-opacity hover:opacity-70"
                          style={{ color: "var(--bsky-text-secondary)" }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addToArrayFilter("domains", "")}
                      className="rounded-lg px-3 py-1.5 text-sm transition-colors"
                      style={{
                        color: "var(--bsky-primary)",
                        backgroundColor: "var(--bsky-bg-secondary)",
                        borderWidth: "1px",
                        borderColor: "var(--bsky-border-primary)",
                      }}
                    >
                      + Add domain
                    </button>
                  </div>
                </div>

                {/* Language */}
                <div>
                  <label
                    className="mb-2 flex items-center gap-2 text-sm font-medium"
                    style={{ color: "var(--bsky-text-secondary)" }}
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
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    style={{
                      backgroundColor: "var(--bsky-bg-secondary)",
                      borderColor: "var(--bsky-border-primary)",
                      color: "var(--bsky-text-primary)",
                      ["--tw-ring-color" as any]: "var(--bsky-primary)",
                    }}
                  >
                    <option value="">Any language</option>
                    <option value="en">English</option>
                    <option value="ja">Japanese</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="pt">Portuguese</option>
                    <option value="it">Italian</option>
                    <option value="nl">Dutch</option>
                    <option value="ko">Korean</option>
                    <option value="zh">Chinese</option>
                  </select>
                </div>
              </div>
            )}

            {/* Search Query Display */}
            {searchQuery && (
              <div
                className="mt-3 rounded-md p-2 text-xs"
                style={{ backgroundColor: "var(--bsky-bg-secondary)" }}
              >
                <code
                  className="break-all"
                  style={{ color: "var(--bsky-text-primary)" }}
                >
                  {searchQuery}
                </code>
              </div>
            )}
          </div>

          {/* Search Results */}
          <div className="space-y-3">
            {!activeSearchQuery && !isLoading && (
              <div className="bsky-glass rounded-xl p-6 text-center">
                <SearchIcon
                  size={32}
                  className="mx-auto mb-3 opacity-20"
                  style={{ color: "var(--bsky-text-secondary)" }}
                />
                <p
                  className="text-sm"
                  style={{ color: "var(--bsky-text-secondary)" }}
                >
                  Enter a search query and press Enter or click Search
                </p>
              </div>
            )}

            {isLoading && (
              <div className="py-6 text-center">
                <div
                  className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2"
                  style={{ borderColor: "var(--bsky-primary)" }}
                ></div>
                <p
                  className="mt-3 text-sm"
                  style={{ color: "var(--bsky-text-secondary)" }}
                >
                  Searching...
                </p>
              </div>
            )}

            {error && (
              <div className="bsky-glass rounded-xl p-4 text-center">
                <p
                  className="text-sm"
                  style={{ color: "var(--bsky-text-secondary)" }}
                >
                  Error searching posts. Please try again.
                </p>
              </div>
            )}

            {searchResults && searchResults.posts.length === 0 && (
              <div className="bsky-glass rounded-xl p-4 text-center">
                <p
                  className="text-sm"
                  style={{ color: "var(--bsky-text-secondary)" }}
                >
                  No posts found matching your search criteria.
                </p>
              </div>
            )}

            {searchResults && searchResults.posts.length > 0 && (
              <>
                <div className="mb-2 flex items-center justify-between">
                  <p
                    className="text-sm"
                    style={{ color: "var(--bsky-text-secondary)" }}
                  >
                    {searchResults.posts.length} results
                  </p>
                </div>

                {searchResults.posts.map((post) => (
                  <div
                    key={post.uri}
                    className="bsky-glass cursor-pointer rounded-xl p-3 transition-all hover:shadow-lg sm:p-4"
                    onClick={() => handlePostClick(post)}
                  >
                    <div className="flex items-start gap-2.5">
                      <img
                        src={proxifyBskyImage(post.author.avatar)}
                        alt={post.author.displayName}
                        className="h-9 w-9 flex-shrink-0 rounded-full"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span
                            className="truncate text-sm font-medium"
                            style={{ color: "var(--bsky-text-primary)" }}
                          >
                            {post.author.displayName}
                          </span>
                          <span
                            className="truncate text-xs"
                            style={{ color: "var(--bsky-text-secondary)" }}
                          >
                            @{post.author?.handle || "unknown"}
                          </span>
                          <span
                            className="whitespace-nowrap text-xs"
                            style={{ color: "var(--bsky-text-tertiary)" }}
                          >
                            · {formatDistanceToNow(new Date(post.indexedAt))}{" "}
                            ago
                          </span>
                        </div>
                        <div
                          className="break-words text-sm"
                          style={{ color: "var(--bsky-text-primary)" }}
                        >
                          {(post.record as any).text}
                        </div>

                        {/* Display images if present */}
                        {(() => {
                          const images = getPostImages(post);
                          if (images.length === 0) return null;

                          return (
                            <div className="mt-3">
                              <div
                                className={`grid gap-2 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
                              >
                                {images.slice(0, 4).map((img, idx) => (
                                  <img
                                    key={idx}
                                    src={proxifyBskyImage(img.thumb)}
                                    alt={img.alt || ""}
                                    className="w-full cursor-pointer rounded-lg border object-cover transition-opacity hover:opacity-90"
                                    style={{
                                      borderColor: "var(--bsky-border-primary)",
                                      height:
                                        images.length === 1 ? "200px" : "120px",
                                      maxHeight: "300px",
                                    }}
                                    loading="lazy"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(
                                        img.fullsize,
                                        "_blank",
                                        "noopener,noreferrer",
                                      );
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                        <div className="mt-2 flex items-center gap-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(
                                `https://bsky.app/profile/${post.author?.handle || "unknown"}/post/${post.uri.split("/").pop()}`,
                                "_blank",
                                "noopener,noreferrer",
                              );
                            }}
                            className="flex items-center gap-1 text-xs hover:underline"
                            style={{ color: "var(--bsky-primary)" }}
                          >
                            View on Bluesky
                            <ExternalLink size={12} />
                          </button>
                          <span
                            className="text-xs"
                            style={{ color: "var(--bsky-text-tertiary)" }}
                          >
                            Click to view thread
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};
