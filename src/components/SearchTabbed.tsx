import type { AppBskyFeedDefs } from "@atproto/api";
import { debug } from "@bsky/shared";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow, subDays, subMonths } from "date-fns";
import {
  ArrowLeft,
  Bookmark,
  BookmarkPlus,
  Calendar,
  Clock,
  ExternalLink,
  FileText,
  Filter,
  Flame,
  Globe,
  Hash,
  Image,
  Link,
  List,
  Search as SearchIcon,
  TrendingUp,
  User,
  Users,
  X,
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { useHiddenPosts } from "../contexts/HiddenPostsContext";
import { useModeration } from "../contexts/ModerationContext";
import { useDebounce } from "../hooks/useDebounce";
import { useFollowing } from "../hooks/useFollowing";
import { useMinDuration } from "../hooks/useTiming";
import { getFollowerCacheDB } from "../services/follower-cache-db";
import { getProfileCacheService } from "../services/profile-cache-service";
import { proxifyBskyImage } from "../utils/image-proxy";
import { constructAtUri, parseBskyUrl } from "../utils/url-helpers";
import { ImageGrid } from "./ImageGrid";
import { ThreadViewer } from "./ThreadViewer";
import { LoadingState } from "./ui/LoadingState";
import { ProfileHoverCard } from "./ui/ProfileHoverCard";

type SearchTab = "posts" | "users" | "feeds";

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

interface SavedSearch {
  id: string;
  query: string;
  createdAt: number;
}

// Use AppBskyFeedDefs.GeneratorView for feeds

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

export const SearchTabbed: React.FC = React.memo(() => {
  const { agent } = useAuth();
  const navigate = useNavigate();
  const { isPostHidden } = useHiddenPosts();
  const { isUserMuted, isUserBlocked, isThreadMuted } = useModeration();
  const [activeTab, setActiveTab] = useState<SearchTab>("posts");
  const [showAdvanced, setShowAdvanced] = useState(false);
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

  // Thread viewer state
  const [showThreadViewer, setShowThreadViewer] = useState(false);
  const [threadPosts, setThreadPosts] = useState<AppBskyFeedDefs.PostView[]>(
    [],
  );
  const [selectedPostUri, setSelectedPostUri] = useState<string | null>(null);
  const [highlightPostUri, setHighlightPostUri] = useState<string | null>(null);
  const [isLoadingThread, setIsLoadingThread] = useState(false);

  // Search history management
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("bsky-search-history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const addToSearchHistory = (query: string) => {
    if (!query.trim()) return;

    setSearchHistory((prev) => {
      const filtered = prev.filter((q) => q !== query);
      const updated = [query, ...filtered].slice(0, 10);
      try {
        localStorage.setItem("bsky-search-history", JSON.stringify(updated));
      } catch (error) {
        debug.error("Failed to save search history:", error);
      }
      return updated;
    });
  };

  const clearSearchHistory = () => {
    setSearchHistory([]);
    try {
      localStorage.removeItem("bsky-search-history");
    } catch (error) {
      debug.error("Failed to clear search history:", error);
    }
  };

  // Saved searches management
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>(() => {
    try {
      const saved = localStorage.getItem("bsky-saved-searches");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const saveSearch = useCallback((query: string) => {
    if (!query.trim()) return;

    setSavedSearches((prev) => {
      // Don't add duplicates
      if (prev.some((s) => s.query === query)) return prev;

      const newSearch: SavedSearch = {
        id: `saved-${Date.now()}`,
        query: query.trim(),
        createdAt: Date.now(),
      };
      const updated = [newSearch, ...prev].slice(0, 20);
      try {
        localStorage.setItem("bsky-saved-searches", JSON.stringify(updated));
      } catch (error) {
        debug.error("Failed to save search:", error);
      }
      return updated;
    });
  }, []);

  const removeSavedSearch = useCallback((id: string) => {
    setSavedSearches((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      try {
        localStorage.setItem("bsky-saved-searches", JSON.stringify(updated));
      } catch (error) {
        debug.error("Failed to remove saved search:", error);
      }
      return updated;
    });
  }, []);

  const isSearchSaved = useMemo(() => {
    return savedSearches.some((s) => s.query === filters.query.trim());
  }, [savedSearches, filters.query]);

  // Main search bar typeahead state
  const [showMainTypeahead, setShowMainTypeahead] = useState(false);
  const [mainSearchInputFocused, setMainSearchInputFocused] = useState(false);
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
          const profileService = getProfileCacheService(agent);

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
          await agent!.app.bsky.actor.searchActorsTypeahead({
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
    enabled: !!agent && !!debouncedUserSearch && debouncedUserSearch.length >= 2,
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

  // Trending topics query for empty state
  const { data: trendingTopics, isLoading: isLoadingTrending } = useQuery({
    queryKey: ["trendingTopics"],
    queryFn: async () => {
      try {
        const response =
          await agent!.app.bsky.unspecced.getTrendingTopics({
            limit: 10,
          });
        return response.data;
      } catch (error) {
        debug.error("Error fetching trending topics:", error);
        return null;
      }
    },
    enabled: !!agent,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000,
  });

  // Main search typeahead query for user suggestions
  const { data: mainTypeaheadUsers } = useQuery({
    queryKey: ["mainSearchTypeahead", debouncedMainSearch],
    queryFn: async () => {
      if (!debouncedMainSearch || debouncedMainSearch.length < 2) return [];

      try {
        const response =
          await agent!.app.bsky.actor.searchActorsTypeahead({
            q: debouncedMainSearch,
            limit: 5,
          });

        return response.data.actors.map((actor) => ({
          did: actor.did,
          handle: actor.handle,
          displayName: actor.displayName,
          avatar: actor.avatar,
        }));
      } catch (error) {
        debug.error("Error in main search typeahead:", error);
        return [];
      }
    },
    enabled:
      !!agent &&
      !!debouncedMainSearch &&
      debouncedMainSearch.length >= 2 &&
      mainSearchInputFocused,
  });

  // Handle click outside main typeahead
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        mainTypeaheadRef.current &&
        !mainTypeaheadRef.current.contains(event.target as Node) &&
        mainSearchInputRef.current &&
        !mainSearchInputRef.current.contains(event.target as Node)
      ) {
        setShowMainTypeahead(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Show typeahead when input is focused and has content or history
  useEffect(() => {
    if (
      mainSearchInputFocused &&
      (searchHistory.length > 0 ||
        savedSearches.length > 0 ||
        (mainTypeaheadUsers && mainTypeaheadUsers.length > 0))
    ) {
      setShowMainTypeahead(true);
    }
  }, [
    mainSearchInputFocused,
    searchHistory,
    savedSearches,
    mainTypeaheadUsers,
  ]);

  // Search posts query
  const {
    data: postsSearchResults,
    isLoading: isLoadingPosts,
    error: postsError,
  } = useQuery({
    queryKey: ["searchPosts", activeSearchQuery, filters.hasMedia, sortOrder],
    queryFn: async () => {
      if (!activeSearchQuery.trim()) return null;

      const response = await agent!.app.bsky.feed.searchPosts({
        q: activeSearchQuery,
        limit: 50,
        sort: sortOrder,
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
    enabled: !!agent && !!activeSearchQuery.trim() && activeTab === "posts",
  });

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
    enabled: !!agent && !!activeSearchQuery.trim() && activeTab === "users",
  });

  // Search feeds query
  const {
    data: feedsSearchResults,
    isLoading: isLoadingFeeds,
    error: feedsError,
  } = useQuery({
    queryKey: ["searchFeeds", activeSearchQuery],
    queryFn: async () => {
      if (!activeSearchQuery.trim()) return null;

      try {
        // Get popular feeds and user's feeds
        const [popularResponse, suggestedResponse] = await Promise.all([
          agent!.app.bsky.unspecced.getPopularFeedGenerators({
            limit: 50,
          }),
          agent!.app.bsky.feed.getSuggestedFeeds({
            limit: 50,
          }),
        ]);

        // Combine and deduplicate feeds
        const allFeeds = [
          ...popularResponse.data.feeds,
          ...suggestedResponse.data.feeds,
        ];
        const uniqueFeeds = Array.from(
          new Map(allFeeds.map((feed) => [feed.uri, feed])).values(),
        );

        // Filter feeds based on search query
        const searchLower = activeSearchQuery.toLowerCase();
        const filteredFeeds = uniqueFeeds.filter((feed: any) => {
          const displayName = feed.displayName?.toLowerCase() || "";
          const description = feed.description?.toLowerCase() || "";
          const creatorHandle = feed.creator?.handle?.toLowerCase() || "";
          const creatorName = feed.creator?.displayName?.toLowerCase() || "";

          return (
            displayName.includes(searchLower) ||
            description.includes(searchLower) ||
            creatorHandle.includes(searchLower) ||
            creatorName.includes(searchLower)
          );
        });

        return {
          feeds: filteredFeeds,
        };
      } catch (error) {
        debug.error("Error searching feeds:", error);
        // Fallback to just suggested feeds
        const response =
          await agent!.app.bsky.feed.getSuggestedFeeds({
            limit: 100,
          });

        const searchLower = activeSearchQuery.toLowerCase();
        const filteredFeeds = response.data.feeds.filter((feed: any) => {
          const displayName = feed.displayName?.toLowerCase() || "";
          const description = feed.description?.toLowerCase() || "";
          const creatorHandle = feed.creator?.handle?.toLowerCase() || "";
          const creatorName = feed.creator?.displayName?.toLowerCase() || "";

          return (
            displayName.includes(searchLower) ||
            description.includes(searchLower) ||
            creatorHandle.includes(searchLower) ||
            creatorName.includes(searchLower)
          );
        });

        return {
          feeds: filteredFeeds,
        };
      }
    },
    enabled: !!agent && !!activeSearchQuery.trim() && activeTab === "feeds",
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
      const singlePost = postsSearchResults?.posts.find((p) => p.uri === uri);
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
    if (!agent) return;
    const parsed = parseBskyUrl(url);
    if (!parsed || !parsed.postId) {
      return;
    }

    setIsLoadingThread(true);
    try {
      // If we have a handle, we need to resolve it to a DID first
      let uri: string;
      if (parsed.handle) {
        const profile = await agent.getProfile({
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

  // Get current search results and loading state based on active tab
  const currentSearchResults = () => {
    switch (activeTab) {
      case "posts":
        return {
          data: postsSearchResults,
          isLoading: isLoadingPosts,
          error: postsError,
        };
      case "users":
        return {
          data: usersSearchResults,
          isLoading: isLoadingUsers,
          error: usersError,
        };
      case "feeds":
        return {
          data: feedsSearchResults,
          isLoading: isLoadingFeeds,
          error: feedsError,
        };
    }
  };

  const {
    data: searchResults,
    isLoading: isLoadingRaw,
    error,
  } = currentSearchResults();

  // Apply minimum duration to prevent jarring flash of loading state
  const isLoading = useMinDuration(isLoadingRaw);

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
              className="bsky-scrollbar max-h-[70vh] overflow-y-auto"
            />
          )}
        </div>
      ) : (
        <>
          {/* Search Input Box */}
          <div className="bsky-glass relative mb-6 rounded-xl p-3 sm:p-4">
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              <div className="relative flex flex-1 items-center gap-2">
                <SearchIcon
                  size={20}
                  style={{ color: "var(--bsky-text-secondary)" }}
                  className="hidden sm:block"
                />
                <input
                  ref={mainSearchInputRef}
                  type="text"
                  placeholder={
                    activeTab === "posts"
                      ? "Search posts or paste a Bluesky URL..."
                      : activeTab === "users"
                        ? "Search for users..."
                        : "Search for feeds..."
                  }
                  value={filters.query}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, query: e.target.value }))
                  }
                  onFocus={() => {
                    setMainSearchInputFocused(true);
                    if (
                      searchHistory.length > 0 ||
                      savedSearches.length > 0 ||
                      filters.query.length >= 2
                    ) {
                      setShowMainTypeahead(true);
                    }
                  }}
                  onBlur={() => {
                    setMainSearchInputFocused(false);
                    // Delay hiding to allow clicks on typeahead
                    setTimeout(() => {
                      setShowMainTypeahead(false);
                    }, 200);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setShowMainTypeahead(false);
                      handleSearch();
                    } else if (e.key === "Escape") {
                      setShowMainTypeahead(false);
                    }
                  }}
                  className="flex-1 rounded-lg border px-3 py-2 text-sm transition-all focus-visible:outline-none focus-visible:ring-2"
                  style={{
                    backgroundColor: "var(--bsky-bg-secondary)",
                    borderColor: "var(--bsky-border-primary)",
                    color: "var(--bsky-text-primary)",
                    ["--tw-ring-color" as any]: "var(--bsky-primary)",
                  }}
                  aria-label="Search"
                  aria-autocomplete="list"
                  aria-expanded={showMainTypeahead}
                />

                {/* Typeahead Dropdown */}
                {showMainTypeahead &&
                  (searchHistory.length > 0 ||
                    savedSearches.length > 0 ||
                    (mainTypeaheadUsers && mainTypeaheadUsers.length > 0)) && (
                    <div
                      ref={mainTypeaheadRef}
                      className="bsky-scrollbar absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border shadow-lg sm:left-8"
                      style={{
                        backgroundColor: "var(--bsky-bg-secondary)",
                        borderColor: "var(--bsky-border-primary)",
                      }}
                      role="listbox"
                    >
                      {/* Saved Searches Section */}
                      {savedSearches.length > 0 && (
                        <div
                          className="border-b"
                          style={{ borderColor: "var(--bsky-border-primary)" }}
                        >
                          <div className="flex items-center justify-between px-3 py-2">
                            <span
                              className="flex items-center gap-1.5 text-xs font-medium"
                              style={{ color: "var(--bsky-text-secondary)" }}
                            >
                              <Bookmark size={12} />
                              Saved Searches
                            </span>
                          </div>
                          {savedSearches.slice(0, 5).map((saved) => (
                            <div
                              key={saved.id}
                              className="flex cursor-pointer items-center justify-between px-3 py-2 transition-colors hover:bg-white hover:bg-opacity-5"
                              role="option"
                            >
                              <button
                                className="flex flex-1 items-center gap-2 text-left"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setFilters((prev) => ({
                                    ...prev,
                                    query: saved.query,
                                  }));
                                  setActiveSearchQuery(saved.query);
                                  setShowMainTypeahead(false);
                                }}
                              >
                                <Bookmark
                                  size={14}
                                  style={{ color: "var(--bsky-primary)" }}
                                />
                                <span
                                  className="text-sm"
                                  style={{ color: "var(--bsky-text-primary)" }}
                                >
                                  {saved.query}
                                </span>
                              </button>
                              <button
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  removeSavedSearch(saved.id);
                                }}
                                className="rounded p-1 transition-opacity hover:opacity-70"
                                style={{ color: "var(--bsky-text-secondary)" }}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Recent Searches Section */}
                      {searchHistory.length > 0 && (
                        <div
                          className="border-b"
                          style={{ borderColor: "var(--bsky-border-primary)" }}
                        >
                          <div className="flex items-center justify-between px-3 py-2">
                            <span
                              className="flex items-center gap-1.5 text-xs font-medium"
                              style={{ color: "var(--bsky-text-secondary)" }}
                            >
                              <Clock size={12} />
                              Recent
                            </span>
                            <button
                              onMouseDown={(e) => {
                                e.preventDefault();
                                clearSearchHistory();
                              }}
                              className="text-xs transition-opacity hover:opacity-70"
                              style={{ color: "var(--bsky-text-secondary)" }}
                            >
                              Clear
                            </button>
                          </div>
                          {searchHistory.slice(0, 5).map((query, idx) => (
                            <button
                              key={idx}
                              className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white hover:bg-opacity-5"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setFilters((prev) => ({ ...prev, query }));
                                setActiveSearchQuery(query);
                                setShowMainTypeahead(false);
                              }}
                              role="option"
                            >
                              <Clock
                                size={14}
                                style={{ color: "var(--bsky-text-tertiary)" }}
                              />
                              <span
                                className="text-sm"
                                style={{ color: "var(--bsky-text-primary)" }}
                              >
                                {query}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* User Suggestions Section */}
                      {mainTypeaheadUsers && mainTypeaheadUsers.length > 0 && (
                        <div>
                          <div className="px-3 py-2">
                            <span
                              className="flex items-center gap-1.5 text-xs font-medium"
                              style={{ color: "var(--bsky-text-secondary)" }}
                            >
                              <User size={12} />
                              Users
                            </span>
                          </div>
                          {mainTypeaheadUsers.map((user) => (
                            <button
                              key={user.did}
                              className="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-white hover:bg-opacity-5"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                navigate(`/profile/${user.handle}`);
                                setShowMainTypeahead(false);
                              }}
                              role="option"
                            >
                              {user.avatar ? (
                                <img
                                  src={proxifyBskyImage(user.avatar)}
                                  alt=""
                                  className="h-8 w-8 rounded-full"
                                />
                              ) : (
                                <div
                                  className="flex h-8 w-8 items-center justify-center rounded-full"
                                  style={{
                                    backgroundColor: "var(--bsky-bg-tertiary)",
                                  }}
                                >
                                  <User
                                    size={16}
                                    style={{
                                      color: "var(--bsky-text-secondary)",
                                    }}
                                  />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div
                                  className="truncate text-sm font-medium"
                                  style={{ color: "var(--bsky-text-primary)" }}
                                >
                                  {user.displayName || user.handle}
                                </div>
                                <div
                                  className="truncate text-xs"
                                  style={{
                                    color: "var(--bsky-text-secondary)",
                                  }}
                                >
                                  @{user.handle}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
              </div>
              <div className="flex gap-2">
                {/* Save Search Button */}
                {filters.query.trim() && (
                  <button
                    onClick={() => {
                      if (isSearchSaved) {
                        const saved = savedSearches.find(
                          (s) => s.query === filters.query.trim(),
                        );
                        if (saved) removeSavedSearch(saved.id);
                      } else {
                        saveSearch(filters.query.trim());
                      }
                    }}
                    className="flex items-center justify-center rounded-lg px-2 py-2 transition-all hover:opacity-80"
                    style={{
                      backgroundColor: isSearchSaved
                        ? "var(--bsky-primary)"
                        : "var(--bsky-bg-secondary)",
                      color: isSearchSaved
                        ? "white"
                        : "var(--bsky-text-secondary)",
                      borderWidth: "1px",
                      borderColor: isSearchSaved
                        ? "var(--bsky-primary)"
                        : "var(--bsky-border-primary)",
                    }}
                    title={isSearchSaved ? "Remove from saved" : "Save search"}
                    aria-label={
                      isSearchSaved
                        ? "Remove from saved searches"
                        : "Save this search"
                    }
                  >
                    {isSearchSaved ? (
                      <Bookmark size={16} />
                    ) : (
                      <BookmarkPlus size={16} />
                    )}
                  </button>
                )}
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
                {activeTab === "posts" && (
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
                )}
              </div>
            </div>
          </div>

          {/* Search History */}
          {!activeSearchQuery && searchHistory.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <span
                  className="text-xs font-medium"
                  style={{ color: "var(--bsky-text-secondary)" }}
                >
                  Recent searches
                </span>
                <button
                  onClick={clearSearchHistory}
                  className="text-xs transition-opacity hover:opacity-70"
                  style={{ color: "var(--bsky-text-secondary)" }}
                >
                  Clear all
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {searchHistory.slice(0, 5).map((query, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setFilters((prev) => ({ ...prev, query }));
                      setActiveSearchQuery(query);
                    }}
                    className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-all hover:opacity-80"
                    style={{
                      backgroundColor: "var(--bsky-bg-secondary)",
                      color: "var(--bsky-text-secondary)",
                      borderWidth: "1px",
                      borderColor: "var(--bsky-border-primary)",
                    }}
                  >
                    <SearchIcon size={12} />
                    {query}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Trending Topics Section - Show when no active search */}
          {!activeSearchQuery && trendingTopics && (
            <div className="bsky-glass mb-6 rounded-xl p-4">
              <div className="mb-4 flex items-center gap-2">
                <TrendingUp
                  size={20}
                  style={{ color: "var(--bsky-primary)" }}
                />
                <h2
                  className="text-base font-semibold"
                  style={{ color: "var(--bsky-text-primary)" }}
                >
                  Trending on Bluesky
                </h2>
              </div>

              {isLoadingTrending ? (
                <div className="flex items-center justify-center py-4">
                  <div
                    className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
                    style={{ borderColor: "var(--bsky-primary)" }}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Main trending topics */}
                  {trendingTopics.topics &&
                    trendingTopics.topics.length > 0 && (
                      <div>
                        <div className="mb-2 flex items-center gap-1.5">
                          <Flame
                            size={14}
                            style={{ color: "var(--bsky-error)" }}
                          />
                          <span
                            className="text-xs font-medium"
                            style={{ color: "var(--bsky-text-secondary)" }}
                          >
                            Hot right now
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {trendingTopics.topics
                            .slice(0, 8)
                            .map((topic, idx) => (
                              <button
                                key={idx}
                                onClick={() => {
                                  const searchTerm =
                                    topic.displayName || topic.topic;
                                  setFilters((prev) => ({
                                    ...prev,
                                    query: searchTerm,
                                  }));
                                  setActiveSearchQuery(searchTerm);
                                  addToSearchHistory(searchTerm);
                                }}
                                className="group flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-all hover:shadow-md"
                                style={{
                                  backgroundColor: "var(--bsky-bg-secondary)",
                                  borderWidth: "1px",
                                  borderColor: "var(--bsky-border-primary)",
                                }}
                              >
                                <Hash
                                  size={14}
                                  className="transition-colors group-hover:text-[var(--bsky-primary)]"
                                  style={{ color: "var(--bsky-text-tertiary)" }}
                                />
                                <span
                                  className="font-medium transition-colors group-hover:text-[var(--bsky-primary)]"
                                  style={{ color: "var(--bsky-text-primary)" }}
                                >
                                  {topic.displayName || topic.topic}
                                </span>
                              </button>
                            ))}
                        </div>
                      </div>
                    )}

                  {/* Suggested topics */}
                  {trendingTopics.suggested &&
                    trendingTopics.suggested.length > 0 && (
                      <div className="mt-4">
                        <div className="mb-2 flex items-center gap-1.5">
                          <TrendingUp
                            size={14}
                            style={{ color: "var(--bsky-text-secondary)" }}
                          />
                          <span
                            className="text-xs font-medium"
                            style={{ color: "var(--bsky-text-secondary)" }}
                          >
                            Suggested for you
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {trendingTopics.suggested
                            .slice(0, 6)
                            .map((topic, idx) => (
                              <button
                                key={idx}
                                onClick={() => {
                                  const searchTerm =
                                    topic.displayName || topic.topic;
                                  setFilters((prev) => ({
                                    ...prev,
                                    query: searchTerm,
                                  }));
                                  setActiveSearchQuery(searchTerm);
                                  addToSearchHistory(searchTerm);
                                }}
                                className="group flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-all hover:opacity-80"
                                style={{
                                  backgroundColor: "transparent",
                                  borderWidth: "1px",
                                  borderColor: "var(--bsky-border-primary)",
                                }}
                              >
                                <Hash
                                  size={12}
                                  style={{ color: "var(--bsky-text-tertiary)" }}
                                />
                                <span
                                  style={{
                                    color: "var(--bsky-text-secondary)",
                                  }}
                                >
                                  {topic.displayName || topic.topic}
                                </span>
                              </button>
                            ))}
                        </div>
                      </div>
                    )}

                  {/* Empty state if no topics */}
                  {(!trendingTopics.topics ||
                    trendingTopics.topics.length === 0) &&
                    (!trendingTopics.suggested ||
                      trendingTopics.suggested.length === 0) && (
                      <div
                        className="py-4 text-center text-sm"
                        style={{ color: "var(--bsky-text-secondary)" }}
                      >
                        No trending topics available right now
                      </div>
                    )}
                </div>
              )}
            </div>
          )}

          {/* Search Tabs - Separate Layer */}
          <div className="mb-2 flex gap-2">
            <button
              onClick={() => setActiveTab("posts")}
              className={`relative flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                activeTab === "posts"
                  ? ""
                  : "hover:bg-white hover:bg-opacity-10"
              }`}
              style={{
                backgroundColor:
                  activeTab === "posts" ? "var(--bsky-primary)" : "transparent",
                color:
                  activeTab === "posts"
                    ? "white"
                    : "var(--bsky-text-secondary)",
              }}
            >
              <FileText size={16} />
              Posts
              {activeTab === "posts" &&
                postsSearchResults?.posts &&
                postsSearchResults.posts.length > 0 && (
                  <span
                    className="ml-1 rounded-full px-1.5 py-0.5 text-xs font-normal"
                    style={{
                      backgroundColor: "var(--bsky-primary)",
                      color: "white",
                      opacity: 0.9,
                    }}
                  >
                    {
                      postsSearchResults.posts.filter(
                        (post) =>
                          !isPostHidden(post.uri) &&
                          !isUserMuted(post.author.did) &&
                          !isUserBlocked(post.author.did) &&
                          !isThreadMuted(post.uri),
                      ).length
                    }
                  </span>
                )}
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`relative flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                activeTab === "users"
                  ? ""
                  : "hover:bg-white hover:bg-opacity-10"
              }`}
              style={{
                backgroundColor:
                  activeTab === "users" ? "var(--bsky-primary)" : "transparent",
                color:
                  activeTab === "users"
                    ? "white"
                    : "var(--bsky-text-secondary)",
              }}
            >
              <Users size={16} />
              Users
              {activeTab === "users" &&
                usersSearchResults?.actors &&
                usersSearchResults.actors.length > 0 && (
                  <span
                    className="ml-1 rounded-full px-1.5 py-0.5 text-xs font-normal"
                    style={{
                      backgroundColor: "var(--bsky-primary)",
                      color: "white",
                      opacity: 0.9,
                    }}
                  >
                    {
                      usersSearchResults.actors.filter(
                        (user) =>
                          !isUserMuted(user.did) && !isUserBlocked(user.did),
                      ).length
                    }
                  </span>
                )}
            </button>
            <button
              onClick={() => setActiveTab("feeds")}
              className={`relative flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                activeTab === "feeds"
                  ? ""
                  : "hover:bg-white hover:bg-opacity-10"
              }`}
              style={{
                backgroundColor:
                  activeTab === "feeds" ? "var(--bsky-primary)" : "transparent",
                color:
                  activeTab === "feeds"
                    ? "white"
                    : "var(--bsky-text-secondary)",
              }}
            >
              <List size={16} />
              Feeds
              {activeTab === "feeds" &&
                feedsSearchResults?.feeds &&
                feedsSearchResults.feeds.length > 0 && (
                  <span
                    className="ml-1 rounded-full px-1.5 py-0.5 text-xs font-normal"
                    style={{
                      backgroundColor: "var(--bsky-primary)",
                      color: "white",
                      opacity: 0.9,
                    }}
                  >
                    {feedsSearchResults.feeds.length}
                  </span>
                )}
            </button>
          </div>

          {/* Sort Options (for posts tab) */}
          {activeTab === "posts" && activeSearchQuery && (
            <div className="mb-3 flex items-center gap-2">
              <span
                className="text-xs font-medium"
                style={{ color: "var(--bsky-text-secondary)" }}
              >
                Sort by:
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setSortOrder("latest")}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                    sortOrder === "latest" ? "" : "opacity-60"
                  }`}
                  style={{
                    backgroundColor:
                      sortOrder === "latest"
                        ? "var(--bsky-primary)"
                        : "var(--bsky-bg-secondary)",
                    color:
                      sortOrder === "latest"
                        ? "white"
                        : "var(--bsky-text-secondary)",
                    borderWidth: "1px",
                    borderColor:
                      sortOrder === "latest"
                        ? "var(--bsky-primary)"
                        : "var(--bsky-border-primary)",
                  }}
                >
                  Latest
                </button>
                <button
                  onClick={() => setSortOrder("top")}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                    sortOrder === "top" ? "" : "opacity-60"
                  }`}
                  style={{
                    backgroundColor:
                      sortOrder === "top"
                        ? "var(--bsky-primary)"
                        : "var(--bsky-bg-secondary)",
                    color:
                      sortOrder === "top"
                        ? "white"
                        : "var(--bsky-text-secondary)",
                    borderWidth: "1px",
                    borderColor:
                      sortOrder === "top"
                        ? "var(--bsky-primary)"
                        : "var(--bsky-border-primary)",
                  }}
                >
                  Top
                </button>
              </div>
            </div>
          )}

          {/* Quick Filters (for posts tab) */}
          {activeTab === "posts" &&
            !showAdvanced &&
            filters.from.length === 0 &&
            !filters.sinceDate &&
            !filters.untilDate &&
            filters.phrases.length === 0 &&
            filters.hashtags.length === 0 &&
            filters.mentions.length === 0 &&
            filters.domains.length === 0 &&
            !filters.language && (
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      hasMedia: !prev.hasMedia,
                    }))
                  }
                  className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-sm transition-colors ${
                    filters.hasMedia ? "" : "opacity-60"
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
                  }}
                >
                  <Image size={14} />
                  Media only
                </button>
                <button
                  onClick={() => addToArrayFilter("from", "")}
                  className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm opacity-60 transition-all hover:opacity-100"
                  style={{
                    color: "var(--bsky-text-secondary)",
                    backgroundColor: "var(--bsky-bg-secondary)",
                    borderWidth: "1px",
                    borderColor: "var(--bsky-border-primary)",
                  }}
                >
                  <User size={14} />
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
                  className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm opacity-60 transition-all hover:opacity-100"
                  style={{
                    color: "var(--bsky-text-secondary)",
                    backgroundColor: "var(--bsky-bg-secondary)",
                    borderWidth: "1px",
                    borderColor: "var(--bsky-border-primary)",
                  }}
                >
                  <Calendar size={14} />
                  Past week
                </button>
              </div>
            )}

          {/* Advanced Filters Box (only show when there are filters or advanced mode) */}
          {activeTab === "posts" &&
            (filters.from.length > 0 ||
              filters.sinceDate ||
              filters.untilDate ||
              filters.phrases.length > 0 ||
              filters.hashtags.length > 0 ||
              filters.mentions.length > 0 ||
              filters.domains.length > 0 ||
              filters.language ||
              showAdvanced) && (
              <div className="bsky-glass mb-4 rounded-xl p-3 sm:p-4">
                {/* Filter Action Buttons - Compact when no filters (only for posts) */}
                {activeTab === "posts" &&
                filters.from.length === 0 &&
                !filters.sinceDate &&
                !filters.untilDate &&
                filters.phrases.length === 0 &&
                filters.hashtags.length === 0 &&
                filters.mentions.length === 0 &&
                filters.domains.length === 0 &&
                !filters.language &&
                !filters.hasMedia ? (
                  <div className="flex flex-wrap gap-1.5">
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
                ) : activeTab === "posts" ? (
                  /* Expanded Filters for posts */
                  <div className="mt-3 space-y-3">
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
                          {filters.hasMedia ? "✓ " : ""}Show only posts with
                          media
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
                                ref={(el) =>
                                  (inputRefs.current[`from-${i}`] = el)
                                }
                                type="text"
                                value={user}
                                onChange={(e) =>
                                  handleUserInputChange(
                                    "from",
                                    i,
                                    e.target.value,
                                  )
                                }
                                onKeyDown={(e) => handleKeyDown(e)}
                                onFocus={() => {
                                  setActiveUserInput({
                                    field: "from",
                                    index: i,
                                  });
                                  setUserSearchQuery(user);
                                  setShowingFollowers(false);
                                  if (user.length >= 2)
                                    setShowSuggestions(true);
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
                                className="flex-1 rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                                style={{
                                  backgroundColor: "var(--bsky-bg-secondary)",
                                  borderColor: "var(--bsky-border-primary)",
                                  color: "var(--bsky-text-primary)",
                                  ["--tw-ring-color" as any]:
                                    "var(--bsky-primary)",
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
                                          <ProfileHoverCard
                                            handle={suggestion.handle}
                                          >
                                            <img
                                              src={proxifyBskyImage(
                                                suggestion.avatar,
                                              )}
                                              alt=""
                                              className="h-8 w-8 rounded-full"
                                            />
                                          </ProfileHoverCard>
                                        )}
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-2">
                                            <ProfileHoverCard
                                              handle={suggestion.handle}
                                            >
                                              <span
                                                className="truncate font-medium"
                                                style={{
                                                  color:
                                                    "var(--bsky-text-primary)",
                                                }}
                                              >
                                                {suggestion.displayName ||
                                                  suggestion.handle}
                                              </span>
                                            </ProfileHoverCard>
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
                                              color:
                                                "var(--bsky-text-secondary)",
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
                        <label
                          htmlFor="search-date-from"
                          style={{ color: "var(--bsky-text-secondary)" }}
                        >
                          from
                        </label>
                        <div className="relative">
                          <input
                            id="search-date-from"
                            type="date"
                            value={filters.sinceDate}
                            max={filters.untilDate || undefined}
                            onChange={(e) =>
                              setFilters((prev) => ({
                                ...prev,
                                sinceDate: e.target.value,
                              }))
                            }
                            className="cursor-pointer rounded-md border px-2 py-1 pr-7 text-xs focus-visible:outline-none focus-visible:ring-2"
                            style={{
                              backgroundColor: "var(--bsky-bg-secondary)",
                              borderColor: "var(--bsky-border-primary)",
                              color: "var(--bsky-text-primary)",
                              ["--tw-ring-color" as any]: "var(--bsky-primary)",
                              colorScheme: "dark",
                              width: "140px",
                            }}
                            aria-describedby={
                              filters.sinceDate &&
                              filters.untilDate &&
                              new Date(filters.sinceDate) >
                                new Date(filters.untilDate)
                                ? "date-error"
                                : undefined
                            }
                          />
                          {filters.sinceDate && (
                            <button
                              onClick={() =>
                                setFilters((prev) => ({
                                  ...prev,
                                  sinceDate: "",
                                }))
                              }
                              className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 transition-opacity hover:opacity-70"
                              style={{ color: "var(--bsky-text-secondary)" }}
                              aria-label="Clear from date"
                            >
                              <X size={12} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                        <label
                          htmlFor="search-date-to"
                          style={{ color: "var(--bsky-text-secondary)" }}
                        >
                          to
                        </label>
                        <div className="relative">
                          <input
                            id="search-date-to"
                            type="date"
                            value={filters.untilDate}
                            min={filters.sinceDate || undefined}
                            onChange={(e) =>
                              setFilters((prev) => ({
                                ...prev,
                                untilDate: e.target.value,
                              }))
                            }
                            className="cursor-pointer rounded-md border px-2 py-1 pr-7 text-xs focus-visible:outline-none focus-visible:ring-2"
                            style={{
                              backgroundColor: "var(--bsky-bg-secondary)",
                              borderColor: "var(--bsky-border-primary)",
                              color: "var(--bsky-text-primary)",
                              ["--tw-ring-color" as any]: "var(--bsky-primary)",
                              colorScheme: "dark",
                              width: "140px",
                            }}
                            aria-describedby={
                              filters.sinceDate &&
                              filters.untilDate &&
                              new Date(filters.sinceDate) >
                                new Date(filters.untilDate)
                                ? "date-error"
                                : undefined
                            }
                          />
                          {filters.untilDate && (
                            <button
                              onClick={() =>
                                setFilters((prev) => ({
                                  ...prev,
                                  untilDate: "",
                                }))
                              }
                              className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 transition-opacity hover:opacity-70"
                              style={{ color: "var(--bsky-text-secondary)" }}
                              aria-label="Clear to date"
                            >
                              <X size={12} aria-hidden="true" />
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
                            id="date-error"
                            role="alert"
                            className="mt-2 text-xs"
                            style={{ color: "var(--bsky-error)" }}
                          >
                            "From" date must be before "To" date
                          </p>
                        )}
                    </div>
                  </div>
                ) : null}

                {/* Advanced Search Filters (only for posts) */}
                {showAdvanced && activeTab === "posts" && (
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
                              className="flex-1 rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                              style={{
                                backgroundColor: "var(--bsky-bg-secondary)",
                                borderColor: "var(--bsky-border-primary)",
                                color: "var(--bsky-text-primary)",
                                ["--tw-ring-color" as any]:
                                  "var(--bsky-primary)",
                              }}
                            />
                            <button
                              onClick={() =>
                                removeFromArrayFilter("phrases", i)
                              }
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
                              className="flex-1 rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                              style={{
                                backgroundColor: "var(--bsky-bg-secondary)",
                                borderColor: "var(--bsky-border-primary)",
                                color: "var(--bsky-text-primary)",
                                ["--tw-ring-color" as any]:
                                  "var(--bsky-primary)",
                              }}
                            />
                            <button
                              onClick={() =>
                                removeFromArrayFilter("hashtags", i)
                              }
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
                                  if (user.length >= 2)
                                    setShowSuggestions(true);
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
                                className="flex-1 rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                                style={{
                                  backgroundColor: "var(--bsky-bg-secondary)",
                                  borderColor: "var(--bsky-border-primary)",
                                  color: "var(--bsky-text-primary)",
                                  ["--tw-ring-color" as any]:
                                    "var(--bsky-primary)",
                                }}
                              />
                              <button
                                onClick={() =>
                                  removeFromArrayFilter("mentions", i)
                                }
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
                                          <ProfileHoverCard
                                            handle={suggestion.handle}
                                          >
                                            <img
                                              src={proxifyBskyImage(
                                                suggestion.avatar,
                                              )}
                                              alt=""
                                              className="h-8 w-8 rounded-full"
                                            />
                                          </ProfileHoverCard>
                                        )}
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-2">
                                            <ProfileHoverCard
                                              handle={suggestion.handle}
                                            >
                                              <span
                                                className="truncate font-medium"
                                                style={{
                                                  color:
                                                    "var(--bsky-text-primary)",
                                                }}
                                              >
                                                {suggestion.displayName ||
                                                  suggestion.handle}
                                              </span>
                                            </ProfileHoverCard>
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
                                              color:
                                                "var(--bsky-text-secondary)",
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
                              className="flex-1 rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                              style={{
                                backgroundColor: "var(--bsky-bg-secondary)",
                                borderColor: "var(--bsky-border-primary)",
                                color: "var(--bsky-text-primary)",
                                ["--tw-ring-color" as any]:
                                  "var(--bsky-primary)",
                              }}
                            />
                            <button
                              onClick={() =>
                                removeFromArrayFilter("domains", i)
                              }
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
                        className="w-full rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
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

                {/* Search Query Display (only for posts with filters) */}
                {activeTab === "posts" &&
                  searchQuery &&
                  searchQuery !== filters.query && (
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
            )}

          {/* Search Results */}
          <div className="space-y-3">
            {!activeSearchQuery && !isLoading && (
              <div
                className="rounded-xl border bg-white bg-opacity-5 p-8 text-center"
                style={{ borderColor: "var(--bsky-border-primary)" }}
              >
                <SearchIcon
                  size={48}
                  className="mx-auto mb-4 opacity-10"
                  style={{ color: "var(--bsky-text-secondary)" }}
                />
                <p
                  className="text-base font-medium"
                  style={{ color: "var(--bsky-text-primary)" }}
                >
                  Search for {activeTab}
                </p>
                <p
                  className="mt-1 text-sm"
                  style={{ color: "var(--bsky-text-secondary)" }}
                >
                  Enter a search query above and press Enter
                </p>
              </div>
            )}

            {isLoading && (
              <LoadingState
                variant="spinner"
                size="lg"
                message="Searching..."
                centered
                className="py-6"
              />
            )}

            {error && (
              <div
                className="rounded-xl border bg-red-500 bg-opacity-5 p-6 text-center"
                style={{ borderColor: "var(--bsky-error)" }}
              >
                <p className="text-sm" style={{ color: "var(--bsky-error)" }}>
                  Error searching. Please try again.
                </p>
              </div>
            )}

            {/* Posts Results */}
            {activeTab === "posts" &&
              searchResults &&
              postsSearchResults?.posts.length === 0 && (
                <div
                  className="rounded-xl border bg-white bg-opacity-5 p-6 text-center"
                  style={{ borderColor: "var(--bsky-border-primary)" }}
                >
                  <FileText
                    size={32}
                    className="mx-auto mb-3 opacity-10"
                    style={{ color: "var(--bsky-text-secondary)" }}
                  />
                  <p
                    className="mb-3 text-sm font-medium"
                    style={{ color: "var(--bsky-text-primary)" }}
                  >
                    No posts found matching your search
                  </p>
                  <p
                    className="mb-4 text-xs"
                    style={{ color: "var(--bsky-text-secondary)" }}
                  >
                    Try these suggestions:
                  </p>
                  <ul
                    className="space-y-2 text-left text-xs"
                    style={{ color: "var(--bsky-text-secondary)" }}
                  >
                    <li className="flex items-start gap-2">
                      <span>•</span>
                      <span>Check your spelling or try different keywords</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>•</span>
                      <span>
                        Try removing some filters or date restrictions
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>•</span>
                      <span>Search for broader terms or hashtags</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>•</span>
                      <span>Try switching to "Users" or "Feeds" tabs</span>
                    </li>
                  </ul>
                </div>
              )}

            {activeTab === "posts" &&
              searchResults &&
              postsSearchResults?.posts &&
              postsSearchResults.posts.length > 0 && (
                <>
                  <div className="mb-2 flex items-center justify-between">
                    <p
                      className="text-sm"
                      style={{ color: "var(--bsky-text-secondary)" }}
                    >
                      {
                        postsSearchResults.posts.filter(
                          (post) =>
                            !isPostHidden(post.uri) &&
                            !isUserMuted(post.author.did) &&
                            !isUserBlocked(post.author.did) &&
                            !isThreadMuted(post.uri),
                        ).length
                      }{" "}
                      results
                    </p>
                  </div>

                  {postsSearchResults.posts
                    .filter(
                      (post) =>
                        !isPostHidden(post.uri) &&
                        !isUserMuted(post.author.did) &&
                        !isUserBlocked(post.author.did) &&
                        !isThreadMuted(post.uri),
                    )
                    .map((post) => (
                      <div
                        key={post.uri}
                        className="bsky-glass cursor-pointer rounded-xl p-3 transition-all hover:shadow-lg sm:p-4"
                        onClick={() => handlePostClick(post)}
                      >
                        <div className="flex items-start gap-2.5">
                          <ProfileHoverCard handle={post.author.handle}>
                            <img
                              src={proxifyBskyImage(post.author.avatar)}
                              alt={post.author.displayName}
                              className="h-9 w-9 flex-shrink-0 cursor-pointer rounded-full transition-opacity hover:opacity-80"
                            />
                          </ProfileHoverCard>
                          <div className="min-w-0 flex-1">
                            <div className="mb-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                              <ProfileHoverCard handle={post.author.handle}>
                                <span
                                  className="cursor-pointer truncate text-sm font-medium hover:underline"
                                  style={{ color: "var(--bsky-text-primary)" }}
                                >
                                  {post.author.displayName}
                                </span>
                              </ProfileHoverCard>
                              <span
                                className="truncate text-xs"
                                style={{
                                  color: "var(--bsky-text-secondary)",
                                }}
                              >
                                @{post.author?.handle || "unknown"}
                              </span>
                              <span
                                className="whitespace-nowrap text-xs"
                                style={{ color: "var(--bsky-text-tertiary)" }}
                              >
                                ·{" "}
                                {formatDistanceToNow(new Date(post.indexedAt))}{" "}
                                ago
                              </span>
                            </div>
                            <div
                              className="break-words text-sm"
                              style={{ color: "var(--bsky-text-primary)" }}
                            >
                              {(post.record as any).text}
                            </div>

                            {/* Display quoted post if present */}
                            {(() => {
                              const embed = post.embed as any;

                              // Check for quoted post (record embed or recordWithMedia)
                              const quotedPost =
                                embed?.$type === "app.bsky.embed.record#view"
                                  ? embed.record
                                  : embed?.$type ===
                                      "app.bsky.embed.recordWithMedia#view"
                                    ? embed.record?.record
                                    : null;

                              if (
                                quotedPost &&
                                quotedPost.$type ===
                                  "app.bsky.embed.record#viewRecord"
                              ) {
                                return (
                                  <div className="mt-2 rounded-lg border border-bsky-border-primary bg-bsky-bg-secondary p-2.5">
                                    <div className="mb-1 flex items-center gap-1.5">
                                      {quotedPost.author?.avatar &&
                                        quotedPost.author?.handle && (
                                          <ProfileHoverCard
                                            handle={quotedPost.author.handle}
                                          >
                                            <img
                                              src={proxifyBskyImage(
                                                quotedPost.author.avatar,
                                              )}
                                              alt={quotedPost.author.handle}
                                              className="h-4 w-4 cursor-pointer rounded-full transition-opacity hover:opacity-80"
                                            />
                                          </ProfileHoverCard>
                                        )}
                                      {quotedPost.author?.handle ? (
                                        <ProfileHoverCard
                                          handle={quotedPost.author.handle}
                                        >
                                          <span className="cursor-pointer text-xs font-medium text-bsky-text-secondary hover:underline">
                                            {quotedPost.author?.displayName ||
                                              quotedPost.author?.handle}
                                          </span>
                                        </ProfileHoverCard>
                                      ) : (
                                        <span className="text-xs font-medium text-bsky-text-secondary">
                                          Unknown
                                        </span>
                                      )}
                                      <span className="text-xs text-bsky-text-tertiary">
                                        @
                                        {quotedPost.author?.handle || "unknown"}
                                      </span>
                                    </div>
                                    <p className="text-xs leading-relaxed text-bsky-text-primary">
                                      {quotedPost.value?.text || "[No text]"}
                                    </p>

                                    {/* Show images from quoted post if it has them */}
                                    {quotedPost.embeds &&
                                      quotedPost.embeds[0] &&
                                      quotedPost.embeds[0].$type ===
                                        "app.bsky.embed.images#view" &&
                                      quotedPost.embeds[0].images && (
                                        <ImageGrid
                                          images={quotedPost.embeds[0].images}
                                          className="mt-2"
                                        />
                                      )}
                                  </div>
                                );
                              }
                              return null;
                            })()}

                            {/* Display images using ImageGrid component */}
                            {(() => {
                              const images = getPostImages(post);
                              if (images.length === 0) return null;
                              return (
                                <ImageGrid images={images} className="mt-3" />
                              );
                            })()}

                            <div className="mt-2 flex items-center gap-3">
                              <span
                                className="text-xs"
                                style={{ color: "var(--bsky-text-tertiary)" }}
                              >
                                Click to view thread
                              </span>
                              <a
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(
                                    `https://bsky.app/profile/${post.author?.handle || "unknown"}/post/${post.uri.split("/").pop()}`,
                                    "_blank",
                                    "noopener,noreferrer",
                                  );
                                }}
                                className="inline-flex cursor-pointer items-center gap-1 text-xs hover:underline"
                                style={{ color: "var(--bsky-primary)" }}
                              >
                                <ExternalLink size={12} />
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </>
              )}

            {/* Users Results */}
            {activeTab === "users" &&
              searchResults &&
              usersSearchResults?.actors.length === 0 && (
                <div
                  className="rounded-xl border bg-white bg-opacity-5 p-6 text-center"
                  style={{ borderColor: "var(--bsky-border-primary)" }}
                >
                  <Users
                    size={32}
                    className="mx-auto mb-3 opacity-10"
                    style={{ color: "var(--bsky-text-secondary)" }}
                  />
                  <p
                    className="mb-3 text-sm font-medium"
                    style={{ color: "var(--bsky-text-primary)" }}
                  >
                    No users found matching your search
                  </p>
                  <p
                    className="mb-4 text-xs"
                    style={{ color: "var(--bsky-text-secondary)" }}
                  >
                    Try these suggestions:
                  </p>
                  <ul
                    className="space-y-2 text-left text-xs"
                    style={{ color: "var(--bsky-text-secondary)" }}
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
                      <span>
                        Try the "Posts" tab to find content from users
                      </span>
                    </li>
                  </ul>
                </div>
              )}

            {activeTab === "users" &&
              searchResults &&
              usersSearchResults?.actors &&
              usersSearchResults.actors.length > 0 && (
                <>
                  <div className="mb-2 flex items-center justify-between">
                    <p
                      className="text-sm"
                      style={{ color: "var(--bsky-text-secondary)" }}
                    >
                      {
                        usersSearchResults.actors.filter(
                          (user) =>
                            !isUserMuted(user.did) && !isUserBlocked(user.did),
                        ).length
                      }{" "}
                      results
                    </p>
                  </div>

                  {usersSearchResults.actors
                    .filter(
                      (user) =>
                        !isUserMuted(user.did) && !isUserBlocked(user.did),
                    )
                    .map((user) => (
                      <div
                        key={user.did}
                        className="bsky-glass cursor-pointer rounded-xl p-3 transition-all hover:shadow-lg sm:p-4"
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
                                style={{ color: "var(--bsky-text-primary)" }}
                              >
                                {user.displayName || user.handle}
                              </span>
                              <span
                                className="truncate text-sm"
                                style={{
                                  color: "var(--bsky-text-secondary)",
                                }}
                              >
                                @{user.handle}
                              </span>
                            </div>
                            {user.description && (
                              <p
                                className="mb-2 line-clamp-2 text-sm"
                                style={{ color: "var(--bsky-text-primary)" }}
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
                                style={{ color: "var(--bsky-text-tertiary)" }}
                              >
                                Click to view profile
                              </span>
                              <a
                                href={`https://bsky.app/profile/${user.handle}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-xs hover:underline"
                                style={{ color: "var(--bsky-primary)" }}
                              >
                                <ExternalLink size={12} />
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </>
              )}

            {/* Feeds Results */}
            {activeTab === "feeds" &&
              searchResults &&
              feedsSearchResults?.feeds.length === 0 && (
                <div
                  className="rounded-xl border bg-white bg-opacity-5 p-6 text-center"
                  style={{ borderColor: "var(--bsky-border-primary)" }}
                >
                  <List
                    size={32}
                    className="mx-auto mb-3 opacity-10"
                    style={{ color: "var(--bsky-text-secondary)" }}
                  />
                  <p
                    className="mb-3 text-sm font-medium"
                    style={{ color: "var(--bsky-text-primary)" }}
                  >
                    No feeds found matching your search
                  </p>
                  <p
                    className="mb-4 text-xs"
                    style={{ color: "var(--bsky-text-secondary)" }}
                  >
                    Try these suggestions:
                  </p>
                  <ul
                    className="space-y-2 text-left text-xs"
                    style={{ color: "var(--bsky-text-secondary)" }}
                  >
                    <li className="flex items-start gap-2">
                      <span>•</span>
                      <span>Check the feed name spelling</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>•</span>
                      <span>Try searching for feed topics or categories</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>•</span>
                      <span>Browse popular feeds to discover new ones</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>•</span>
                      <span>Try the "Posts" tab to search for content</span>
                    </li>
                  </ul>
                </div>
              )}

            {activeTab === "feeds" &&
              searchResults &&
              feedsSearchResults?.feeds &&
              feedsSearchResults.feeds.length > 0 && (
                <>
                  <div className="mb-2 flex items-center justify-between">
                    <p
                      className="text-sm"
                      style={{ color: "var(--bsky-text-secondary)" }}
                    >
                      {feedsSearchResults.feeds.length} results
                    </p>
                  </div>

                  {feedsSearchResults.feeds.map((feed) => (
                    <div
                      key={feed.uri}
                      className="bsky-glass cursor-pointer rounded-xl p-3 transition-all hover:shadow-lg sm:p-4"
                      onClick={() => {
                        // Navigate to home and set the selected feed
                        // For now, just open the feed URL externally until we have proper feed navigation
                        window.open(
                          `https://bsky.app/profile/${feed.creator.handle}/feed/${feed.uri.split("/").pop()}`,
                          "_blank",
                          "noopener,noreferrer",
                        );
                      }}
                    >
                      <div className="flex items-start gap-3">
                        {feed.avatar && (
                          <img
                            src={proxifyBskyImage(feed.avatar)}
                            alt={feed.displayName}
                            className="h-12 w-12 flex-shrink-0 rounded-lg"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="mb-1">
                            <h3
                              className="font-medium"
                              style={{ color: "var(--bsky-text-primary)" }}
                            >
                              {feed.displayName}
                            </h3>
                          </div>
                          {feed.description && (
                            <p
                              className="mb-2 line-clamp-2 text-sm"
                              style={{ color: "var(--bsky-text-primary)" }}
                            >
                              {feed.description}
                            </p>
                          )}
                          <div className="mb-2 flex items-center gap-4 text-xs">
                            <span
                              style={{ color: "var(--bsky-text-secondary)" }}
                            >
                              by @{feed.creator.handle}
                            </span>
                            {feed.likeCount !== undefined && (
                              <span
                                style={{
                                  color: "var(--bsky-text-secondary)",
                                }}
                              >
                                <strong>
                                  {feed.likeCount.toLocaleString()}
                                </strong>{" "}
                                likes
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span
                              className="text-xs"
                              style={{ color: "var(--bsky-text-tertiary)" }}
                            >
                              Click to view feed
                            </span>
                            <a
                              href={`https://bsky.app/profile/${feed.creator.handle}/feed/${feed.uri.split("/").pop()}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-xs hover:underline"
                              style={{ color: "var(--bsky-primary)" }}
                            >
                              <ExternalLink size={12} />
                            </a>
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
});

SearchTabbed.displayName = "SearchTabbed";
