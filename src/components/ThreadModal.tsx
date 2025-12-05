import { RichText, type AppBskyFeedDefs } from "@atproto/api";
import { debug } from "@bsky/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, X } from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactDOM from "react-dom";
import { useAuth } from "../contexts/AuthContext";
import { useModal } from "../contexts/ModalContext";
import { useModalSwipeBack } from "../hooks/useModalSwipeBack";
import { useThreadKeyboardShortcuts } from "../hooks/useThreadKeyboardShortcuts";
import { useMinDuration } from "../hooks/useTiming";
import { useVideoUploadManager } from "../hooks/useVideoUploadManager";
import type { ThreadSummaryResult } from "../services/anthropic";
import { uploadBlobWithRetry } from "../utils/blob-upload";
import { EnhancedComposer } from "./EnhancedComposer";
import { ProgressiveThreadSummary } from "./ProgressiveThreadSummary";
import { getComplexityTier, getTierConfig } from "./ProgressiveThreadView";
import { ThreadContextBar } from "./ThreadContextBar";
import { ThreadEngagementAnalytics } from "./ThreadEngagementAnalytics";
import { ThreadMinimap } from "./ThreadMinimap";
import { ThreadShortcutsHelp } from "./ThreadShortcutsHelp";
import { ThreadViewer } from "./ThreadViewer";
import { ThreadSkeleton } from "./ui/SkeletonLoader";

interface ThreadModalProps {
  postUri: string;
  onClose: () => void;
  openToReply?: boolean; // When true, opens with the post ready to reply
  openToQuote?: boolean; // When true, opens with the post ready to quote
}

interface ReplyState {
  isReplying: boolean;
  replyToPost: AppBskyFeedDefs.PostView | null;
}

interface QuoteState {
  isQuoting: boolean;
  quotedPost: AppBskyFeedDefs.PostView | null;
}

type PostView = AppBskyFeedDefs.PostView;

export function ThreadModal({
  postUri,
  onClose,
  openToReply = false,
  openToQuote = false,
}: ThreadModalProps) {
  const { agent, session } = useAuth();
  const swipeHandlers = useModalSwipeBack({ onClose });
  const videoUploadManager = useVideoUploadManager(agent);
  const queryClient = useQueryClient();
  const { showConfirm } = useModal();
  const [replyState, setReplyState] = useState<ReplyState>({
    isReplying: openToReply,
    replyToPost: null,
  });
  const [quoteState, setQuoteState] = useState<QuoteState>({
    isQuoting: openToQuote,
    quotedPost: null,
  });
  const [continueThreadPost, setContinueThreadPost] =
    useState<AppBskyFeedDefs.PostView | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [focusedPostIndex, setFocusedPostIndex] = useState(0);
  const [highlightedPostUri, setHighlightedPostUri] = useState(postUri);

  // Reset highlighted post when postUri changes
  useEffect(() => {
    setHighlightedPostUri(postUri);
  }, [postUri]);

  // Ref for ThreadContextBar sentinel element (placed after thread stats)
  const contextBarSentinelRef = useRef<HTMLDivElement>(null);
  // Ref for scrollable thread container (for minimap viewport tracking)
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleEsc);
    // Store original overflow value
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("thread-modal-open");

    return () => {
      window.removeEventListener("keydown", handleEsc);
      // Restore original overflow value
      document.body.style.overflow = originalOverflow;
      document.body.classList.remove("thread-modal-open");
    };
  }, [onClose]);

  const {
    data: threadData,
    isLoading: isLoadingRaw,
    error,
    refetch,
  } = useQuery({
    queryKey: ["thread", postUri],
    queryFn: async () => {
      if (!agent) throw new Error("Not authenticated");

      try {
        const response = await agent.getPostThread({ uri: postUri, depth: 10 });
        debug.log("Thread response:", response);

        // Check the response type to provide better error messages
        const thread = response.data.thread;

        if (!thread) {
          throw new Error("Thread data is empty");
        }

        // Log the thread type for debugging
        debug.log("Thread type:", thread.$type);

        // Check for different thread view types based on official AT Protocol lexicons
        if (thread.$type === "app.bsky.feed.defs#notFoundPost") {
          throw new Error("POST_NOT_FOUND");
        }

        if (thread.$type === "app.bsky.feed.defs#blockedPost") {
          throw new Error("POST_BLOCKED");
        }

        if (thread.$type !== "app.bsky.feed.defs#threadViewPost") {
          // Log the full thread object to understand what we're getting
          debug.error("Unexpected thread type encountered:", {
            type: thread.$type,
            threadObject: thread,
            hasPost: !!(thread as any).post,
            postUri: postUri,
          });

          // Check if it might be a partial thread or have a post anyway
          if ((thread as any).post) {
            debug.log(
              "Thread has post despite unexpected type, attempting to use it",
            );
            return thread;
          }

          throw new Error(
            `INVALID_THREAD_TYPE: ${thread.$type || "undefined"}`,
          );
        }

        return thread;
      } catch (err: any) {
        debug.error("Failed to load thread:", err);

        // Re-throw with more context
        if (err.message) {
          throw err;
        }

        // Handle API errors
        if (err?.status === 400) {
          throw new Error("POST_NOT_FOUND");
        }

        throw new Error("NETWORK_ERROR");
      }
    },
    enabled: !!agent && !!postUri,
  });

  // Apply minimum duration to prevent loading flash
  const isLoading = useMinDuration(isLoadingRaw, 300);

  // Extract all posts from the thread structure
  const posts = React.useMemo(() => {
    if (!threadData) return [];

    const allPosts: PostView[] = [];
    const processThread = (thread: any) => {
      if (!thread) return;

      // Handle both typed and untyped thread objects
      const isThreadViewPost =
        thread.$type === "app.bsky.feed.defs#threadViewPost" ||
        (!thread.$type && thread.post); // Some responses might not have $type

      if (isThreadViewPost && thread.post) {
        allPosts.push(thread.post);

        // Process parent if exists
        if (thread.parent) {
          processThread(thread.parent);
        }

        // Process replies
        if (thread.replies && Array.isArray(thread.replies)) {
          thread.replies.forEach(processThread);
        }
      }
    };

    processThread(threadData);
    return allPosts;
  }, [threadData]);

  // Find the root post
  const rootPost = React.useMemo(() => {
    if (!threadData) return undefined;

    let current = threadData;
    while (current?.$type === "app.bsky.feed.defs#threadViewPost") {
      const threadViewPost = current as AppBskyFeedDefs.ThreadViewPost;
      if (
        threadViewPost.parent?.$type === "app.bsky.feed.defs#threadViewPost"
      ) {
        current = threadViewPost.parent;
      } else {
        break;
      }
    }

    if (current?.$type === "app.bsky.feed.defs#threadViewPost") {
      const threadViewPost = current as AppBskyFeedDefs.ThreadViewPost;
      return threadViewPost.post?.uri || postUri;
    }
    return postUri;
  }, [threadData, postUri]);

  // Get the actual root post object
  const rootPostObject = useMemo(() => {
    return posts.find((p) => p.uri === rootPost);
  }, [posts, rootPost]);

  // Calculate thread statistics for ThreadContextBar
  const threadStats = useMemo(() => {
    if (posts.length === 0) return { uniqueParticipants: 0, maxDepth: 0 };

    // Calculate unique participants
    const uniqueAuthors = new Set(posts.map((p) => p.author.did));

    // Calculate max depth
    let maxDepth = 0;
    const depthMap = new Map<string, number>();

    // Find root and set its depth to 0
    if (rootPost) {
      depthMap.set(rootPost, 0);
    }

    // Build depth map by traversing reply chain
    posts.forEach((post) => {
      const record = post.record as { reply?: { parent?: { uri: string } } };
      const parentUri = record?.reply?.parent?.uri;

      if (!parentUri) {
        // This is the root
        depthMap.set(post.uri, 0);
      } else if (depthMap.has(parentUri)) {
        const parentDepth = depthMap.get(parentUri) || 0;
        const newDepth = parentDepth + 1;
        depthMap.set(post.uri, newDepth);
        maxDepth = Math.max(maxDepth, newDepth);
      }
    });

    // Make a second pass for any posts that weren't resolved
    posts.forEach((post) => {
      if (!depthMap.has(post.uri)) {
        const record = post.record as { reply?: { parent?: { uri: string } } };
        const parentUri = record?.reply?.parent?.uri;
        if (parentUri && depthMap.has(parentUri)) {
          const parentDepth = depthMap.get(parentUri) || 0;
          const newDepth = parentDepth + 1;
          depthMap.set(post.uri, newDepth);
          maxDepth = Math.max(maxDepth, newDepth);
        }
      }
    });

    return {
      uniqueParticipants: uniqueAuthors.size,
      maxDepth,
    };
  }, [posts, rootPost]);

  // Calculate complexity tier for progressive UI
  const tierConfig = useMemo(() => {
    const replyCount = Math.max(0, posts.length - 1);
    const tier = getComplexityTier(replyCount);
    return getTierConfig(tier);
  }, [posts.length]);

  // Build parent URI map for progressive summary
  const parentUris = useMemo(() => {
    const map = new Map<string, string>();
    posts.forEach((p) => {
      const record = p.record as { reply?: { parent?: { uri: string } } };
      if (record?.reply?.parent?.uri) {
        map.set(p.uri, record.reply.parent.uri);
      }
    });
    return map;
  }, [posts]);

  // Get cached haiku summary for ThreadContextBar
  const cachedHaikuSummary = useMemo(() => {
    const queryKey = ["thread-summary", rootPost || postUri];
    const cachedData = queryClient.getQueryData<ThreadSummaryResult>(queryKey);
    return cachedData?.summary || null;
  }, [queryClient, rootPost, postUri]);

  // Get current focused post and its navigation context
  const navigationContext = useMemo(() => {
    if (posts.length === 0) return null;

    const currentPost = posts[focusedPostIndex] || posts[0];
    if (!currentPost) return null;

    // Find parent post
    const postRecord = currentPost.record as {
      reply?: { parent?: { uri: string } };
    };
    const parentUri = postRecord?.reply?.parent?.uri;
    const parentPost = parentUri
      ? posts.find((p) => p.uri === parentUri)
      : undefined;

    // Find siblings (posts with same parent)
    let siblingPosts:
      | { prev?: PostView; next?: PostView; current: number; total: number }
      | undefined;
    if (parentPost) {
      const siblings = posts.filter((p) => {
        const record = p.record as { reply?: { parent?: { uri: string } } };
        return record?.reply?.parent?.uri === parentUri;
      });
      if (siblings.length > 1) {
        const currentIdx = siblings.findIndex((p) => p.uri === currentPost.uri);
        siblingPosts = {
          prev: currentIdx > 0 ? siblings[currentIdx - 1] : undefined,
          next:
            currentIdx < siblings.length - 1
              ? siblings[currentIdx + 1]
              : undefined,
          current: currentIdx,
          total: siblings.length,
        };
      }
    }

    return {
      currentPost,
      parentPost,
      siblingPosts,
    };
  }, [posts, focusedPostIndex]);

  // Navigation handlers
  const handleJumpToRoot = useCallback(() => {
    setFocusedPostIndex(0);
  }, []);

  const handleJumpToParent = useCallback(() => {
    if (navigationContext?.parentPost) {
      const parentIdx = posts.findIndex(
        (p) => p.uri === navigationContext.parentPost?.uri,
      );
      if (parentIdx >= 0) {
        setFocusedPostIndex(parentIdx);
      }
    }
  }, [navigationContext, posts]);

  const handleJumpToPrevSibling = useCallback(() => {
    if (navigationContext?.siblingPosts?.prev) {
      const idx = posts.findIndex(
        (p) => p.uri === navigationContext.siblingPosts?.prev?.uri,
      );
      if (idx >= 0) {
        setFocusedPostIndex(idx);
      }
    }
  }, [navigationContext, posts]);

  const handleJumpToNextSibling = useCallback(() => {
    if (navigationContext?.siblingPosts?.next) {
      const idx = posts.findIndex(
        (p) => p.uri === navigationContext.siblingPosts?.next?.uri,
      );
      if (idx >= 0) {
        setFocusedPostIndex(idx);
      }
    }
  }, [navigationContext, posts]);

  // Handler for breadcrumb navigation
  const handleBreadcrumbNavigate = useCallback(
    (index: number) => {
      if (index >= 0 && index < posts.length) {
        setFocusedPostIndex(index);
      }
    },
    [posts.length],
  );

  // Handler for jumping to end of thread
  const handleJumpToEnd = useCallback(() => {
    if (posts.length > 0) {
      setFocusedPostIndex(posts.length - 1);
    }
  }, [posts.length]);

  // Handler for jumping to specific index (used by ThreadContextBar)
  const handleJumpToIndex = useCallback(
    (index: number) => {
      if (index >= 0 && index < posts.length) {
        setFocusedPostIndex(index);
      }
    },
    [posts.length],
  );

  // Ref for composer focus
  const composerRef = useRef<HTMLDivElement>(null);

  // State for author-only filter mode
  const [showAuthorOnly, setShowAuthorOnly] = useState(false);

  // Get the thread author (root post author) for filtering
  const threadAuthorDid = rootPostObject?.author?.did;

  // Find next branch point (a post with multiple children)
  const handleJumpToNextBranch = useCallback(() => {
    // Find the first post after current that has multiple replies
    for (let i = focusedPostIndex + 1; i < posts.length; i++) {
      const post = posts[i];
      // Check if this post has multiple direct replies
      const childCount = posts.filter((p) => {
        const record = p.record as { reply?: { parent?: { uri: string } } };
        return record?.reply?.parent?.uri === post.uri;
      }).length;
      if (childCount > 1) {
        setFocusedPostIndex(i);
        return;
      }
    }
    // Wrap around to find from beginning
    for (let i = 0; i < focusedPostIndex; i++) {
      const post = posts[i];
      const childCount = posts.filter((p) => {
        const record = p.record as { reply?: { parent?: { uri: string } } };
        return record?.reply?.parent?.uri === post.uri;
      }).length;
      if (childCount > 1) {
        setFocusedPostIndex(i);
        return;
      }
    }
  }, [posts, focusedPostIndex]);

  // Handle toggle author-only view
  const handleToggleAuthorOnly = useCallback(() => {
    setShowAuthorOnly((prev) => !prev);
  }, []);

  // Focus reply composer
  const handleFocusReply = useCallback(() => {
    // Open reply to currently focused post
    if (posts.length > 0) {
      const currentPost = posts[focusedPostIndex] || posts[0];
      if (currentPost) {
        setReplyState({
          isReplying: true,
          replyToPost: currentPost,
        });
        // Focus composer after state update
        setTimeout(() => {
          composerRef.current?.querySelector("textarea")?.focus();
        }, 100);
      }
    }
  }, [posts, focusedPostIndex]);

  // Navigate down in thread
  const handleNavigateDown = useCallback(() => {
    if (focusedPostIndex < posts.length - 1) {
      setFocusedPostIndex(focusedPostIndex + 1);
    }
  }, [focusedPostIndex, posts.length]);

  // Navigate up in thread
  const handleNavigateUp = useCallback(() => {
    if (focusedPostIndex > 0) {
      setFocusedPostIndex(focusedPostIndex - 1);
    }
  }, [focusedPostIndex]);

  // Thread keyboard shortcuts
  const { shortcuts, showHelpPanel, setShowHelpPanel } =
    useThreadKeyboardShortcuts({
      enabled: posts.length > 0,
      authorDid: threadAuthorDid,
      actions: {
        jumpToSummary: handleJumpToRoot,
        jumpToNextBranch: handleJumpToNextBranch,
        jumpToOriginalPost: handleJumpToRoot,
        toggleAuthorOnlyView: handleToggleAuthorOnly,
        jumpToParent: handleJumpToParent,
        jumpToPrevSibling: handleJumpToPrevSibling,
        jumpToNextSibling: handleJumpToNextSibling,
        navigateUp: handleNavigateUp,
        navigateDown: handleNavigateDown,
        focusReply: handleFocusReply,
      },
    });

  // Filter posts for author-only view
  const displayPosts = useMemo(() => {
    if (!showAuthorOnly || !threadAuthorDid) {
      return posts;
    }
    return posts.filter((p) => p.author.did === threadAuthorDid);
  }, [posts, showAuthorOnly, threadAuthorDid]);

  // Find the last post in the user's own thread continuation (deepest post by user in direct reply chain)
  const findLastUserPost = useCallback(
    (postsArr: PostView[], currentUserDid?: string): PostView | null => {
      if (!currentUserDid || postsArr.length === 0) return null;

      // Get user's posts
      const userPosts = postsArr.filter((p) => p.author.did === currentUserDid);
      if (userPosts.length === 0) return null;

      // Find the deepest post in the thread that belongs to the user
      // Sort by timestamp to find the latest
      userPosts.sort(
        (a, b) =>
          new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime(),
      );

      return userPosts[0];
    },
    [],
  );

  // Handle deleting a post
  const handleDeletePost = useCallback(
    async (post: PostView) => {
      if (!agent) return;

      await showConfirm(
        "Delete this post? This action cannot be undone. Note: Deleting a post in the middle of a thread may affect thread continuity.",
        async () => {
          try {
            await agent.deletePost(post.uri);
            // Invalidate and refetch the thread
            queryClient.invalidateQueries({ queryKey: ["thread", postUri] });
            refetch();
          } catch (error) {
            debug.error("Failed to delete post:", error);
            throw error;
          }
        },
        {
          variant: "warning",
          title: "Delete Post",
          confirmText: "Delete",
          cancelText: "Cancel",
        },
      );
    },
    [agent, showConfirm, queryClient, postUri, refetch],
  );

  // Handle continuing a thread from the last post
  const handleContinueThread = useCallback((lastPost: PostView) => {
    setContinueThreadPost(lastPost);
    setReplyState({
      isReplying: true,
      replyToPost: lastPost,
    });
    setQuoteState({
      isQuoting: false,
      quotedPost: null,
    });
  }, []);

  // Set initial reply/quote state when we get the main post
  useEffect(() => {
    if (posts.length > 0) {
      const targetPost = posts.find((p) => p.uri === postUri) || posts[0];

      if (openToReply && targetPost) {
        setReplyState({
          isReplying: true,
          replyToPost: targetPost,
        });
      }

      if (openToQuote && targetPost) {
        setQuoteState({
          isQuoting: true,
          quotedPost: targetPost,
        });
      }
    }
  }, [openToReply, openToQuote, posts, postUri]);

  const handleQuotePost = async (
    text: string,
    media: any[] | undefined,
    quotedPost: AppBskyFeedDefs.PostView,
  ) => {
    if (!agent) throw new Error("Not authenticated");

    // Upload media if present
    let embed = undefined;
    if (media && media.length > 0) {
      const hasVideo = media.some((m) => m.type === "video");

      if (hasVideo) {
        // Handle video upload with proper state management
        const videoFile = media.find((m) => m.type === "video");
        if (videoFile) {
          // Convert File to Uint8Array
          const arrayBuffer = await videoFile.file.arrayBuffer();
          const videoData = new Uint8Array(arrayBuffer);

          const videoBlob = await videoUploadManager.startUpload(
            videoData,
            videoFile.file.type || "video/mp4",
            videoFile.file.name || "video.mp4",
          );

          // Check if upload was cancelled or failed
          if (!videoBlob) {
            const error = videoUploadManager.uploadState.error;
            if (error) {
              throw new Error(error.message);
            }
            throw new Error("Video upload was cancelled");
          }

          embed = {
            $type: "app.bsky.embed.video",
            video: videoBlob.blob,
            aspectRatio: videoBlob.aspectRatio,
          };
        }
      } else {
        // Handle image uploads
        const images = await Promise.all(
          media
            .filter((m) => m.type === "image")
            .map(async (img) => {
              const response = await uploadBlobWithRetry(agent, img.file, {
                encoding: "image/jpeg",
              });
              return {
                alt: img.alt || "",
                image: response.data.blob,
                aspectRatio: undefined, // Let Bluesky determine this
              };
            }),
        );

        if (images.length > 0) {
          embed = {
            $type: "app.bsky.embed.images",
            images,
          };
        }
      }
    }

    // Create quote post embed
    const quoteEmbed = embed
      ? {
          $type: "app.bsky.embed.recordWithMedia",
          record: {
            $type: "app.bsky.embed.record",
            record: {
              uri: quotedPost.uri,
              cid: quotedPost.cid,
            },
          },
          media: embed,
        }
      : {
          $type: "app.bsky.embed.record",
          record: {
            uri: quotedPost.uri,
            cid: quotedPost.cid,
          },
        };

    // Detect facets (mentions, links, hashtags) in the text
    const rt = new RichText({ text: text.trim() });
    await rt.detectFacets(agent);

    const record = {
      text: rt.text,
      facets: rt.facets,
      embed: quoteEmbed,
      createdAt: new Date().toISOString(),
    };

    await agent.post(record);

    // Close composer after successful post
    setQuoteState({
      isQuoting: false,
      quotedPost: null,
    });

    // Close the modal
    onClose();
  };

  const handleReply = async (text: string, media?: any[]) => {
    if (!agent) throw new Error("Not authenticated");

    // Handle quote post
    if (quoteState.isQuoting && quoteState.quotedPost) {
      return handleQuotePost(text, media, quoteState.quotedPost);
    }

    // Handle regular reply
    if (!replyState.replyToPost || !rootPost)
      throw new Error("Missing required context");

    const replyPost = replyState.replyToPost;
    const rootCid = posts.find((p) => p.uri === rootPost)?.cid || replyPost.cid;

    // Upload media if present
    let embed = undefined;
    if (media && media.length > 0) {
      const hasVideo = media.some((m) => m.type === "video");

      if (hasVideo) {
        // Handle video upload with proper state management
        const videoFile = media.find((m) => m.type === "video");
        if (videoFile) {
          // Convert File to Uint8Array
          const arrayBuffer = await videoFile.file.arrayBuffer();
          const videoData = new Uint8Array(arrayBuffer);

          const videoBlob = await videoUploadManager.startUpload(
            videoData,
            videoFile.file.type || "video/mp4",
            videoFile.file.name || "video.mp4",
          );

          // Check if upload was cancelled or failed
          if (!videoBlob) {
            const error = videoUploadManager.uploadState.error;
            if (error) {
              throw new Error(error.message);
            }
            throw new Error("Video upload was cancelled");
          }

          embed = {
            $type: "app.bsky.embed.video",
            video: videoBlob.blob,
            aspectRatio: videoBlob.aspectRatio,
          };
        }
      } else {
        // Handle image uploads
        const images = await Promise.all(
          media
            .filter((m) => m.type === "image")
            .map(async (img) => {
              const response = await uploadBlobWithRetry(agent, img.file, {
                encoding: "image/jpeg",
              });
              return {
                alt: img.alt || "",
                image: response.data.blob,
                aspectRatio: undefined, // Let Bluesky determine this
              };
            }),
        );

        if (images.length > 0) {
          embed = {
            $type: "app.bsky.embed.images",
            images,
          };
        }
      }
    }

    // Detect facets (mentions, links, hashtags) in the text
    const rt = new RichText({ text: text.trim() });
    await rt.detectFacets(agent);

    const record = {
      text: rt.text,
      facets: rt.facets,
      reply: {
        root: { uri: rootPost, cid: rootCid },
        parent: { uri: replyPost.uri, cid: replyPost.cid },
      },
      embed,
      createdAt: new Date().toISOString(),
    };

    await agent.post(record);
    refetch(); // Refresh the thread to show the new reply

    // Close reply composer after successful post
    setReplyState({
      isReplying: false,
      replyToPost: null,
    });
  };

  return ReactDOM.createPortal(
    <>
      <div className="fixed inset-0 z-[100] bg-black/70" onClick={onClose} />

      {/* Sticky ThreadContextBar - appears when scrolled past thread stats */}
      {posts.length > 0 && (
        <ThreadContextBar
          posts={posts}
          threadUri={rootPost || postUri}
          haikuSummary={cachedHaikuSummary}
          currentIndex={focusedPostIndex}
          totalPosts={posts.length}
          uniqueParticipants={threadStats.uniqueParticipants}
          maxDepth={threadStats.maxDepth}
          onJumpToStart={handleJumpToRoot}
          onJumpToEnd={handleJumpToEnd}
          onJumpToParent={handleJumpToParent}
          onJumpToIndex={handleJumpToIndex}
          sentinelRef={contextBarSentinelRef}
        />
      )}

      <div
        {...swipeHandlers}
        className="modal-backdrop thread-modal-container z-[101] p-0 sm:p-4 md:p-8"
      >
        <div className="modal-container modal-5xl flex flex-col bg-bsky-bg-primary sm:max-h-[90vh] sm:rounded-2xl sm:shadow-2xl">
          {/* Header with close button */}
          <div
            className="flex flex-shrink-0 items-center justify-between border-b px-4 py-3 md:px-6 md:py-4"
            style={{
              backgroundColor: "var(--bsky-bg-primary)",
              borderColor: "var(--bsky-border-primary)",
            }}
          >
            <div className="flex items-center gap-3">
              <h2
                className="text-lg font-semibold md:text-xl"
                style={{ color: "var(--bsky-text-primary)" }}
              >
                Thread
              </h2>
              {posts.length > 0 && (
                <span
                  className="rounded-full px-2 py-0.5 text-xs"
                  style={{
                    backgroundColor: "var(--bsky-bg-tertiary)",
                    color: "var(--bsky-text-secondary)",
                  }}
                >
                  {posts.length} posts
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Analytics toggle - only show for complex+ threads */}
              {posts.length > 0 && tierConfig.showAnalyticsBadge && (
                <button
                  onClick={() => setShowAnalytics(!showAnalytics)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    showAnalytics
                      ? "bg-blue-500 text-white"
                      : "hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                  style={
                    !showAnalytics
                      ? { color: "var(--bsky-text-secondary)" }
                      : {}
                  }
                  title="Toggle thread analytics"
                >
                  <BarChart3 size={16} />
                  <span className="hidden sm:inline">Analytics</span>
                </button>
              )}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onClose();
                }}
                className="rounded-full p-2 transition-all hover:scale-110 hover:bg-gray-100 dark:hover:bg-gray-800"
                style={{ color: "var(--bsky-text-secondary)" }}
                aria-label="Close"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Scrollable content */}
          <div
            ref={scrollContainerRef}
            className="bsky-scrollbar flex-1 overflow-y-auto"
            style={{ minHeight: 0 }}
          >
            <div className="mx-auto max-w-3xl p-4 md:p-8">
              {isLoading && (
                <ThreadSkeleton replyCount={3} aria-label="Loading thread" />
              )}

              {error && (
                <div className="py-8 text-center">
                  <div className="mx-auto max-w-md space-y-4">
                    <div
                      className="rounded-lg p-6"
                      style={{ backgroundColor: "var(--bsky-bg-secondary)" }}
                    >
                      <p
                        className="mb-2 text-lg font-medium"
                        style={{ color: "var(--bsky-text-primary)" }}
                      >
                        {error.message === "POST_NOT_FOUND"
                          ? "Post Not Found"
                          : error.message === "POST_BLOCKED"
                            ? "Content Blocked"
                            : error.message.startsWith("INVALID_THREAD_TYPE")
                              ? "Unable to Display Thread"
                              : error.message === "NETWORK_ERROR"
                                ? "Connection Error"
                                : "Failed to Load Thread"}
                      </p>
                      <p
                        className="text-sm"
                        style={{ color: "var(--bsky-text-secondary)" }}
                      >
                        {error.message === "POST_NOT_FOUND"
                          ? "This post may have been deleted or is no longer available."
                          : error.message === "POST_BLOCKED"
                            ? "This content has been blocked and cannot be displayed."
                            : error.message.startsWith("INVALID_THREAD_TYPE")
                              ? "The thread format is not supported or may be corrupted."
                              : error.message === "NETWORK_ERROR"
                                ? "Please check your connection and try again."
                                : "An unexpected error occurred while loading the thread."}
                      </p>

                      {/* Debug info when debug mode is enabled */}
                      {localStorage.getItem("debug") === "true" && (
                        <details className="mt-4">
                          <summary
                            className="cursor-pointer text-xs"
                            style={{ color: "var(--bsky-text-tertiary)" }}
                          >
                            Debug Info
                          </summary>
                          <pre className="mt-2 overflow-x-auto rounded bg-black/10 p-2 text-xs">
                            {JSON.stringify(
                              {
                                error: error.message,
                                errorType: error.message.startsWith(
                                  "INVALID_THREAD_TYPE",
                                )
                                  ? error.message.split(": ")[1]
                                  : undefined,
                                postUri,
                                timestamp: new Date().toISOString(),
                              },
                              null,
                              2,
                            )}
                          </pre>
                        </details>
                      )}

                      {/* Retry button for network errors */}
                      {(error.message === "NETWORK_ERROR" ||
                        error.message === "Thread data is empty") && (
                        <button
                          onClick={() => refetch()}
                          className="mt-4 rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:opacity-80"
                          style={{
                            backgroundColor: "var(--bsky-primary)",
                            color: "white",
                          }}
                        >
                          Try Again
                        </button>
                      )}
                    </div>

                    <button
                      onClick={onClose}
                      className="text-sm underline"
                      style={{ color: "var(--bsky-text-tertiary)" }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}

              {posts.length > 0 && (
                <>
                  {/* Thread Analytics (collapsible) - only when toggled */}
                  {showAnalytics && (
                    <ThreadEngagementAnalytics
                      posts={posts}
                      className="mb-4"
                      collapsed={false}
                      onPostClick={(post) => {
                        setHighlightedPostUri(post.uri);
                        // Scroll to the post
                        const postElement = document.querySelector(
                          `[data-post-uri="${post.uri}"]`,
                        );
                        if (postElement) {
                          postElement.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                          });
                        }
                      }}
                    />
                  )}

                  {/* Thread Viewer - uses displayPosts for author-only filter */}
                  <ThreadViewer
                    rootPostObject={rootPostObject}
                    threadSummary={
                      tierConfig.showSummary ? (
                        <ProgressiveThreadSummary
                          posts={posts}
                          threadUri={rootPost || postUri}
                          parentUris={parentUris}
                          summaryDepth={tierConfig.summaryDepth}
                        />
                      ) : null
                    }
                    posts={displayPosts}
                    rootUri={rootPost}
                    highlightUri={highlightedPostUri}
                    showUnreadIndicators={false}
                    className="w-full"
                    currentUserDid={session?.did}
                    contextBarSentinelRef={contextBarSentinelRef}
                    focusedIndex={focusedPostIndex}
                    onFocusedIndexChange={setFocusedPostIndex}
                    onPostClick={(clickedPost, action) => {
                      const post =
                        posts.find((p) => p.uri === clickedPost.uri) || null;

                      // Update focused index when clicking a post
                      const clickedIdx = posts.findIndex(
                        (p) => p.uri === clickedPost.uri,
                      );
                      if (clickedIdx >= 0) {
                        setFocusedPostIndex(clickedIdx);
                      }

                      if (action === "reply") {
                        // When user clicks reply on a post in the thread
                        setReplyState({
                          isReplying: true,
                          replyToPost: post,
                        });
                        setQuoteState({
                          isQuoting: false,
                          quotedPost: null,
                        });
                      } else if (action === "quote") {
                        // When user clicks quote on a post in the thread
                        setQuoteState({
                          isQuoting: true,
                          quotedPost: post,
                        });
                        setReplyState({
                          isReplying: false,
                          replyToPost: null,
                        });
                      }
                    }}
                    onDeletePost={handleDeletePost}
                    onContinueThread={() => {
                      const lastUserPost = findLastUserPost(
                        posts,
                        session?.did,
                      );
                      if (lastUserPost) {
                        handleContinueThread(lastUserPost);
                      } else {
                        // If no user posts, use the last post in the thread
                        const lastPost = posts[posts.length - 1];
                        if (lastPost) {
                          handleContinueThread(lastPost);
                        }
                      }
                    }}
                  />
                </>
              )}
            </div>
          </div>

          {/* Enhanced composer at the bottom - visible when replying or quoting */}
          {posts.length > 0 &&
            ((replyState.isReplying && replyState.replyToPost) ||
              (quoteState.isQuoting && quoteState.quotedPost)) && (
              <div
                ref={composerRef}
                className="flex-shrink-0 border-t"
                style={{
                  backgroundColor: "var(--bsky-bg-secondary)",
                  borderColor: "var(--bsky-border-primary)",
                }}
              >
                <div className="mx-auto max-w-3xl p-4 md:p-6">
                  <EnhancedComposer
                    onSubmit={handleReply}
                    placeholder={
                      quoteState.isQuoting
                        ? "Add your thoughts..."
                        : continueThreadPost
                          ? "Continue your thread..."
                          : "Add your reply..."
                    }
                    autoFocus={true}
                    replyTo={
                      replyState.isReplying && replyState.replyToPost
                        ? {
                            uri: replyState.replyToPost.uri,
                            cid: replyState.replyToPost.cid,
                            author: {
                              handle: replyState.replyToPost.author.handle,
                              displayName:
                                replyState.replyToPost.author.displayName,
                            },
                            text: (replyState.replyToPost.record as any)?.text,
                          }
                        : undefined
                    }
                    parentPost={
                      replyState.isReplying && replyState.replyToPost
                        ? replyState.replyToPost
                        : undefined
                    }
                    quotedPost={
                      quoteState.isQuoting && quoteState.quotedPost
                        ? quoteState.quotedPost
                        : undefined
                    }
                    features={{
                      media: true,
                      emoji: true,
                      giphy: true,
                      altTextGeneration: true,
                      shortcuts: true,
                      hashtags: true,
                      threadOptimization: false,
                    }}
                    showReplyContext={
                      replyState.isReplying && !continueThreadPost
                    }
                    submitLabel={
                      quoteState.isQuoting
                        ? "Quote"
                        : continueThreadPost
                          ? "Continue"
                          : "Reply"
                    }
                    onCancel={() => {
                      setReplyState({
                        isReplying: false,
                        replyToPost: null,
                      });
                      setQuoteState({
                        isQuoting: false,
                        quotedPost: null,
                      });
                      setContinueThreadPost(null);
                    }}
                  />
                </div>
              </div>
            )}
        </div>

        {/* Thread Minimap - floating visual navigation for complex threads */}
        {/* Only show for complex+ threads based on tier config */}
        {posts.length > 0 && tierConfig.showMinimap && (
          <ThreadMinimap
            posts={posts}
            currentIndex={focusedPostIndex}
            currentUserDid={session?.did}
            onNavigate={handleBreadcrumbNavigate}
            rootUri={rootPost}
            scrollContainerRef={scrollContainerRef}
          />
        )}
      </div>

      {/* Keyboard shortcuts help panel */}
      <ThreadShortcutsHelp
        shortcuts={shortcuts}
        isOpen={showHelpPanel}
        onClose={() => setShowHelpPanel(false)}
      />
    </>,
    document.body,
  );
}
