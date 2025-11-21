import { AppBskyFeedDefs } from "@atproto/api";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { blueskyListService } from "../services/bluesky-list-service";
import { PostCard } from "./PostCard";
import { ThreadModal } from "./ThreadModal";

export const ListTimeline: React.FC = () => {
  const { listId } = useParams<{ listId: string }>();
  const listUri = listId ? decodeURIComponent(listId) : undefined;
  const { agent } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<AppBskyFeedDefs.FeedViewPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | undefined>();
  const [selectedPost, setSelectedPost] =
    useState<AppBskyFeedDefs.PostView | null>(null);
  const [showThread, setShowThread] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadPosts();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [hasMore, loading, cursor]);

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

  if (listLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="border-t-bsky-accent-primary h-8 w-8 animate-spin rounded-full border-2 border-bsky-border-primary" />
      </div>
    );
  }

  if (!list) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <p className="text-bsky-text-primary">List not found</p>
        <button
          onClick={() => navigate("/lists")}
          className="mt-4 cursor-pointer rounded-lg bg-bsky-primary px-4 py-2 text-white transition-all duration-200 hover:opacity-90"
        >
          Back to Lists
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-bsky-bg-primary">
      <div className="sticky top-0 z-10 border-b border-bsky-border-primary bg-bsky-bg-primary p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/lists")}
            className="cursor-pointer rounded-full p-2 transition-all duration-200 hover:bg-bsky-bg-secondary"
          >
            <ArrowLeft className="h-5 w-5 text-bsky-text-primary" />
          </button>
          <div className="flex-1">
            <h2 className="m-0 text-xl font-semibold text-bsky-text-primary">
              {list.name}
            </h2>
            {list.description && (
              <p className="mt-1 text-sm text-bsky-text-secondary">
                {list.description}
              </p>
            )}
            <p className="mt-1 text-xs text-bsky-text-tertiary">
              {list.listItemCount || 0}{" "}
              {list.listItemCount === 1 ? "member" : "members"}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="cursor-pointer rounded-full p-2 text-bsky-text-secondary transition-all duration-200 hover:bg-bsky-bg-secondary disabled:opacity-50"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!members || members.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <p className="text-bsky-text-secondary">
              No members in this list yet. Add members from their profile pages.
            </p>
          </div>
        ) : posts.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <p className="text-bsky-text-secondary">
              No posts from list members yet
            </p>
          </div>
        ) : (
          <>
            {posts.map((feedItem) => (
              <div
                key={feedItem.post.uri}
                onClick={() => openPostThread(feedItem.post)}
              >
                <PostCard
                  post={feedItem.post}
                  reason={feedItem.reason}
                  onLike={() => {}}
                  onRepost={() => {}}
                  onReply={() => {}}
                  onBookmark={() => {}}
                />
              </div>
            ))}
            {hasMore && (
              <div ref={loadMoreRef} className="flex justify-center p-4">
                <div className="border-t-bsky-accent-primary h-6 w-6 animate-spin rounded-full border-2 border-bsky-border-primary" />
              </div>
            )}
          </>
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
