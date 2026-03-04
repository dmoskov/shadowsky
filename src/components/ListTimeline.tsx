import { AppBskyFeedDefs } from "@atproto/api";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import { List, ListImperativeAPI, useDynamicRowHeight } from "react-window";
import { useAuth } from "../contexts/AuthContext";
import { useViewTransitionNavigate } from "../hooks/useViewTransitionNavigate";
import { blueskyListService } from "../services/bluesky-list-service";
import { PostCard } from "./PostCard";
import { ThreadModal } from "./ThreadModal";
import { EmptyState } from "./ui/EmptyState";

// Store scroll positions for each list
const scrollPositions = new Map<string, number>();

export const ListTimeline: React.FC = () => {
  const { listId } = useParams<{ listId: string }>();
  const listUri = listId ? decodeURIComponent(listId) : undefined;
  const { agent } = useAuth();
  const navigate = useViewTransitionNavigate();
  const [posts, setPosts] = useState<AppBskyFeedDefs.FeedViewPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | undefined>();
  const [selectedPost, setSelectedPost] =
    useState<AppBskyFeedDefs.PostView | null>(null);
  const [showThread, setShowThread] = useState(false);
  const listRef = useRef<ListImperativeAPI>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(600);
  const [shouldRestoreScroll, setShouldRestoreScroll] = useState(false);

  // Use dynamic row height hook
  const dynamicRowHeight = useDynamicRowHeight({
    defaultRowHeight: 200,
    key: listUri,
  });

  const { data: list, isLoading: listLoading } = useQuery({
    queryKey: ["list", listUri],
    queryFn: async () => {
      if (!agent || !listUri) {
        throw new Error("Not authenticated or no list URI");
      }
      await blueskyListService.initialize(agent);
      return blueskyListService.getList(listUri);
    },
    enabled: !!agent && !!listUri,
  });

  const { data: members } = useQuery({
    queryKey: ["listMembers", listUri],
    queryFn: async () => {
      if (!agent || !listUri) {
        throw new Error("Not authenticated or no list URI");
      }
      await blueskyListService.initialize(agent);
      return blueskyListService.getListMembers(listUri);
    },
    enabled: !!agent && !!listUri,
  });

  const loadPosts = async (reset = false) => {
    if (!agent || !members || loading || (!hasMore && !reset)) return;

    setLoading(true);
    try {
      const authorDids = members.map((m) => m.subject.did);
      if (authorDids.length === 0) {
        setPosts([]);
        setHasMore(false);
        return;
      }

      const allPosts: AppBskyFeedDefs.FeedViewPost[] = [];
      const fetchCursor: string | undefined = reset ? undefined : cursor;

      for (const did of authorDids) {
        try {
          const response = await agent.getAuthorFeed({
            actor: did,
            limit: 30,
            cursor: fetchCursor,
          });

          allPosts.push(...response.data.feed);
        } catch (error) {
          console.error(`Failed to fetch posts for ${did}:`, error);
        }
      }

      allPosts.sort((a, b) => {
        const aTime = new Date(a.post.indexedAt).getTime();
        const bTime = new Date(b.post.indexedAt).getTime();
        return bTime - aTime;
      });

      if (reset) {
        setPosts(allPosts);
      } else {
        setPosts((prev) => [...prev, ...allPosts]);
      }

      setHasMore(allPosts.length > 0);
      setCursor(fetchCursor);
    } catch (error) {
      console.error("Failed to load posts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (members && agent) {
      loadPosts(true);
    }
  }, [members, agent]);

  // Measure container height for virtual list
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Restore scroll position when posts are loaded
  useEffect(() => {
    if (
      shouldRestoreScroll &&
      listUri &&
      posts.length > 0 &&
      scrollPositions.has(listUri) &&
      listRef.current
    ) {
      const savedPosition = scrollPositions.get(listUri)!;
      // Use setTimeout to ensure DOM is ready
      setTimeout(() => {
        if (listRef.current) {
          listRef.current.scrollToRow({
            index: 0,
            behavior: "auto",
          });
          // Access element property safely
          const element = listRef.current.element;
          if (element) {
            element.scrollTop = savedPosition;
          }
        }
      }, 0);
      setShouldRestoreScroll(false);
    }
  }, [listUri, posts.length, shouldRestoreScroll]);

  // Mark that we should restore scroll on mount
  useEffect(() => {
    if (listUri && scrollPositions.has(listUri)) {
      setShouldRestoreScroll(true);
    }
  }, [listUri]);

  // Save scroll position when navigating away
  useEffect(() => {
    return () => {
      if (listUri && listRef.current) {
        const element = listRef.current.element;
        if (element) {
          scrollPositions.set(listUri, element.scrollTop);
        }
      }
    };
  }, [listUri]);

  const handleRefresh = () => {
    setPosts([]);
    setCursor(undefined);
    setHasMore(true);
    loadPosts(true);
  };

  const openPostThread = (post: AppBskyFeedDefs.PostView) => {
    setSelectedPost(post);
    setShowThread(true);
  };

  // Handle scroll for infinite loading
  const handleRowsRendered = useCallback(
    (
      visibleRows: { startIndex: number; stopIndex: number },
      _allRows: { startIndex: number; stopIndex: number },
    ) => {
      if (!hasMore || loading || posts.length === 0) return;

      // Trigger load at 80% scroll position
      const scrollPercentage = visibleRows.stopIndex / posts.length;
      if (scrollPercentage >= 0.8) {
        loadPosts();
      }
    },
    [hasMore, loading, posts.length],
  );

  if (listLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="border-t-asph-accent-primary h-8 w-8 animate-spin rounded-full border-2 border-asph-border-primary" />
      </div>
    );
  }

  if (!list) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <p className="text-asph-text-primary">List not found</p>
        <button
          onClick={() => navigate("/lists")}
          className="mt-4 cursor-pointer rounded-lg bg-asph-primary px-4 py-2 text-white transition-all duration-200 hover:opacity-90"
        >
          Back to Lists
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-asph-bg-primary">
      <div className="sticky top-0 z-10 border-b border-asph-border-primary bg-asph-bg-primary p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/lists")}
            className="cursor-pointer rounded-full p-2 transition-all duration-200 hover:bg-asph-bg-secondary"
          >
            <ArrowLeft className="h-5 w-5 text-asph-text-primary" />
          </button>
          <div className="flex-1">
            <h2 className="m-0 text-xl font-semibold text-asph-text-primary">
              {list.name}
            </h2>
            {list.description && (
              <p className="mt-1 text-sm text-asph-text-secondary">
                {list.description}
              </p>
            )}
            <p className="mt-1 text-xs text-asph-text-tertiary">
              {list.listItemCount || 0}{" "}
              {list.listItemCount === 1 ? "member" : "members"}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="cursor-pointer rounded-full p-2 text-asph-text-secondary transition-all duration-200 hover:bg-asph-bg-secondary disabled:opacity-50"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 overflow-hidden">
        {!members || members.length === 0 ? (
          <EmptyState variant="list-members" compact />
        ) : posts.length === 0 && !loading ? (
          <EmptyState variant="list" compact />
        ) : posts.length > 0 ? (
          <List
            listRef={listRef}
            rowCount={posts.length}
            rowHeight={dynamicRowHeight}
            defaultHeight={containerHeight}
            onRowsRendered={handleRowsRendered}
            overscanCount={5}
            rowComponent={({ index, style }) => {
              const feedItem = posts[index];
              return (
                <div
                  style={style}
                  onClick={() => openPostThread(feedItem.post)}
                >
                  <PostCard
                    post={feedItem.post}
                    reason={feedItem.reason}
                    replyParent={
                      feedItem.reply?.parent as
                        | AppBskyFeedDefs.PostView
                        | undefined
                    }
                    onLike={() => {}}
                    onRepost={() => {}}
                    onReply={() => {}}
                    onBookmark={() => {}}
                  />
                </div>
              );
            }}
            rowProps={{}}
          />
        ) : loading ? (
          <div className="flex justify-center p-4">
            <div className="border-t-asph-accent-primary h-6 w-6 animate-spin rounded-full border-2 border-asph-border-primary" />
          </div>
        ) : null}
        {posts.length > 0 && loading && (
          <div className="flex justify-center p-4">
            <div className="border-t-asph-accent-primary h-6 w-6 animate-spin rounded-full border-2 border-asph-border-primary" />
          </div>
        )}
      </div>

      {showThread && selectedPost && (
        <ThreadModal
          postUri={selectedPost.uri}
          onClose={() => {
            setShowThread(false);
            setSelectedPost(null);
          }}
        />
      )}
    </div>
  );
};
