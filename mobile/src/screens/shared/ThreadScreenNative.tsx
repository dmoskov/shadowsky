import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
} from "react-native";
import { AppBskyFeedDefs, AppBskyFeedPost } from "@atproto/api";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { usePostThread } from "../../hooks/api/useFeed";
import { useLikePost, useUnlikePost, useRepost, useDeleteRepost, useCreatePost } from "../../hooks/api/usePosts";
import { useAppNavigation } from "../../hooks/useNavigation";
import { ThreadSkeleton } from "../../components/ThreadSkeleton";
import { ErrorState } from "../../components/ErrorState";
import { getAtProtoClient } from "../../services/atproto/client";
import { useTheme } from "../../contexts/ThemeContext";
import { usePreferences } from "../../contexts/PreferencesContext";
import { sharePost } from "../../utils/share";
import { useBookmarks } from "../../hooks/api/useBookmarks";
import { useToast } from "../../contexts/ToastContext";
import { triggerHaptic } from "../../utils/haptics";
import { InlineErrorBoundary } from '../../components/ui/InlineErrorBoundary';
import { createLogger } from '../../utils/logger';
import { NativeThreadView, setTranslationResult, setTranslationError, setMentionSearchResults, setReplySent, setThreadData, clearThreadData } from '../../../modules/native-thread-view';
import { translatePost } from '../../services/translation-service';
import { searchActors } from '../../services/atproto/profiles';
import {
  generateThreadSummary,
  type ThreadSummaryPost,
  type ThreadSummaryFormat,
  type ThreadSummaryResult,
} from "../../services/ai-service";
import { getCachedSummary, cacheSummary } from "../../services/thread-summary-cache";

const logger = createLogger('ThreadScreenNative');

/**
 * Serialize a ThreadViewPost into the JSON format expected by native ThreadView.
 * The native parseThreadNode expects: {post, parent, replies[]}
 * where post = {uri, cid, author, record, embed, indexedAt, likeCount, ...}
 */
function serializeThreadNode(node: any): any {
  if (!node || !AppBskyFeedDefs.isThreadViewPost(node)) return null;

  const post = node.post;
  const record = post.record as AppBskyFeedPost.Record;

  const serialized: Record<string, unknown> = {
    post: {
      uri: post.uri,
      cid: post.cid,
      author: {
        did: post.author.did,
        handle: post.author.handle,
        displayName: post.author.displayName,
        avatar: post.author.avatar,
        isVerified: post.author.verification?.verifiedStatus === 'valid' || undefined,
      },
      record: {
        text: record?.text || '',
        facets: record?.facets,
        createdAt: record?.createdAt || post.indexedAt,
        langs: record?.langs,
      },
      embed: post.embed,
      indexedAt: post.indexedAt,
      likeCount: post.likeCount ?? 0,
      repostCount: post.repostCount ?? 0,
      replyCount: post.replyCount ?? 0,
      quoteCount: post.quoteCount ?? 0,
      viewer: post.viewer ? {
        like: post.viewer.like,
        repost: post.viewer.repost,
      } : undefined,
    },
    replies: (node.replies || [])
      .filter((r: any) => AppBskyFeedDefs.isThreadViewPost(r))
      .map(serializeThreadNode)
      .filter(Boolean),
  };

  // Add parent reference if this is a reply
  if (node.parent && AppBskyFeedDefs.isThreadViewPost(node.parent)) {
    serialized.parent = {
      uri: node.parent.post.uri,
      cid: node.parent.post.cid,
    };
  }

  return serialized;
}


/**
 * Walk the parent chain from the queried post up to the root,
 * then serialize starting from the root. Returns the root serialization
 * and the URI of the originally-queried post (so we can scroll to it).
 */
function serializeFromRoot(thread: any): { serialized: any; focusUri: string | null } {
  if (!thread || !AppBskyFeedDefs.isThreadViewPost(thread)) {
    return { serialized: null, focusUri: null };
  }

  // Walk up the parent chain to find the actual root
  let root = thread;
  const originalUri = thread.post.uri;
  while (root.parent && AppBskyFeedDefs.isThreadViewPost(root.parent)) {
    root = root.parent;
  }

  // If we're already at root (no parent chain), just serialize normally
  if (root === thread) {
    return { serialized: serializeThreadNode(root), focusUri: null };
  }

  // Serialize from root — this includes the full parent chain + all replies
  return {
    serialized: serializeThreadNode(root),
    focusUri: originalUri,
  };
}

const SUMMARY_STALE_TIME_MS = Infinity; // Cache permanently; invalidated via replyCount in queryKey
const MIN_POSTS_FOR_SUMMARY = 5;

interface ThreadScreenProps {
  handle: string;
  postId: string;
  did?: string;
  focusedReplyUri?: string;
  onNavigateToPost?: (uri: string) => void;
  onNavigateToProfile?: (handle: string) => void;
  onNavigateToHashtag?: (tag: string) => void;
}

/**
 * Resolve a handle to a DID using the lightweight resolveHandle API
 */
async function resolveHandleToDid(handle: string): Promise<string> {
  const client = getAtProtoClient();
  const agent = client.getAgent();
  const res = await agent.resolveHandle({ handle });
  return res.data.did;
}

/**
 * Parse AT Protocol URI to extract DID and post ID
 * Format: at://did/app.bsky.feed.post/postId
 * Returns null if invalid
 */
function parsePostUri(uri: string): { did: string; postId: string } | null {
  const match = uri.match(/^at:\/\/([^/]+)\/app\.bsky\.feed\.post\/(.+)$/);
  if (!match) return null;
  return { did: match[1], postId: match[2] };
}

/**
 * Navigate to thread from URI
 * Resolves DID to handle if needed
 */
async function navigateToThreadFromUri(uri: string, navigateToThread: (handle: string, postId: string) => void) {
  const parsed = parsePostUri(uri);
  if (!parsed) {
    logger.error('Invalid post URI:', uri);
    return;
  }

  try {
    const client = getAtProtoClient();
    const agent = client.getAgent();
    const profile = await agent.getProfile({ actor: parsed.did });
    navigateToThread(profile.data.handle, parsed.postId);
  } catch (error) {
    logger.error('Failed to resolve DID to handle:', error);
  }
}

/**
 * Recursively collect all PostView objects from a thread tree
 */
function collectAllPosts(node: AppBskyFeedDefs.ThreadViewPost): AppBskyFeedDefs.PostView[] {
  const posts: AppBskyFeedDefs.PostView[] = [node.post];
  if (node.replies) {
    for (const reply of node.replies) {
      if (AppBskyFeedDefs.isThreadViewPost(reply)) {
        posts.push(...collectAllPosts(reply));
      }
    }
  }
  return posts;
}

/**
 * Build a map of post URI -> parent URI from the thread tree
 */
function buildParentUriMap(node: AppBskyFeedDefs.ThreadViewPost): Map<string, string> {
  const map = new Map<string, string>();
  const traverse = (currentNode: AppBskyFeedDefs.ThreadViewPost) => {
    if (!currentNode.replies || !Array.isArray(currentNode.replies)) return;
    for (const replyNode of currentNode.replies) {
      if (AppBskyFeedDefs.isThreadViewPost(replyNode)) {
        map.set(replyNode.post.uri, currentNode.post.uri);
        traverse(replyNode);
      }
    }
  };
  traverse(node);
  return map;
}

/**
 * Calculate depth of a post in the parent chain
 */
function getDepth(postUri: string, parentUris: Map<string, string>): number {
  let depth = 0;
  let currentUri = postUri;
  while (parentUris.has(currentUri)) {
    depth++;
    currentUri = parentUris.get(currentUri)!;
    if (depth > 100) break;
  }
  return depth;
}

/**
 * Choose summary format based on thread size and engagement
 */
function getSummaryFormat(postCount: number, totalEngagement: number): ThreadSummaryFormat {
  if (postCount >= 75) return "comprehensive";
  if (postCount >= 30) return "detailed";
  if (postCount >= 10) return "moderate";
  if (totalEngagement > 100 || postCount > 20) return "moderate";
  return "brief";
}

export function ThreadScreenNative({ handle, postId, did, focusedReplyUri, onNavigateToPost, onNavigateToProfile, onNavigateToHashtag }: ThreadScreenProps) {
  const { colors } = useTheme();
  const { preferences } = usePreferences();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  // Perf tracking
  const perfRef = useRef({
    mountedAt: performance.now(),
    resolveStart: 0,
    fetchStart: 0,
    logged: false,
  });

  // If DID is available, construct URI immediately — no API call needed
  const [postUri, setPostUri] = useState<string | null>(
    did ? `at://${did}/app.bsky.feed.post/${postId}` : null
  );
  const [isResolvingUri, setIsResolvingUri] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoFocusUri, setAutoFocusUri] = useState<string | null>(null);
  const [summaryMode, setSummaryMode] = useState<"quick" | "full">("quick");

  const { navigateToProfile, navigateToThread, navigateToCompose } = useAppNavigation();
  const likePost = useLikePost();
  const unlikePost = useUnlikePost();
  const repost = useRepost();
  const deleteRepost = useDeleteRepost();
  const createPost = useCreatePost();
  const { toggleBookmark, bookmarks } = useBookmarks();
  const { showToast } = useToast();

  // Compute bookmarked post URIs for quick lookup
  const bookmarkedPostUris = useMemo(() => {
    return new Set(bookmarks.map(b => b.postUri));
  }, [bookmarks]);

  // Only resolve handle→DID if DID wasn't provided (e.g. deep links)
  useEffect(() => {
    if (postUri) return; // Already have URI from DID prop

    async function resolveUri() {
      setIsResolvingUri(true);
      setResolveError(null);
      perfRef.current.resolveStart = performance.now();
      try {
        const resolvedDid = await resolveHandleToDid(handle);
        logger.log(`[perf] handle→DID resolve: ${(performance.now() - perfRef.current.resolveStart).toFixed(0)}ms`);
        setPostUri(`at://${resolvedDid}/app.bsky.feed.post/${postId}`);
      } catch (error) {
        logger.error('Failed to resolve post URI:', error);
        setResolveError(error instanceof Error ? error.message : "Failed to load post");
      } finally {
        setIsResolvingUri(false);
      }
    }

    if (handle && postId) {
      resolveUri();
    }
  }, [handle, postId, postUri]);

  // Track when fetch starts
  useEffect(() => {
    if (postUri) {
      perfRef.current.fetchStart = performance.now();
      logger.log(`[perf] fetch start (${(perfRef.current.fetchStart - perfRef.current.mountedAt).toFixed(0)}ms after mount)`);
    }
  }, [postUri]);

  // Fetch thread data
  const { data: thread, isLoading, error, refetch } = usePostThread(postUri || "");

  // Bridge thread data to native SwiftUI ThreadView
  useEffect(() => {
    if (thread && AppBskyFeedDefs.isThreadViewPost(thread)) {
      const fetchElapsed = perfRef.current.fetchStart > 0
        ? (performance.now() - perfRef.current.fetchStart).toFixed(0)
        : '?';
      logger.log(`[perf] thread data received: ${fetchElapsed}ms (fetch)`);

      try {
        const serializeStart = performance.now();
        const { serialized, focusUri: rootFocusUri } = serializeFromRoot(thread);
        if (serialized) {
          const json = JSON.stringify(serialized);
          const serializeMs = (performance.now() - serializeStart).toFixed(0);

          const bridgeStart = performance.now();
          setThreadData(json);
          if (rootFocusUri) {
            setAutoFocusUri(rootFocusUri);
          }
          const bridgeMs = (performance.now() - bridgeStart).toFixed(0);

          const totalMs = (performance.now() - perfRef.current.mountedAt).toFixed(0);
          logger.log(`[perf] serialize: ${serializeMs}ms, bridge: ${bridgeMs}ms, json: ${(json.length / 1024).toFixed(1)}KB`);
          logger.log(`[perf] total mount→bridged: ${totalMs}ms`);
        }
      } catch (e) {
        logger.error('Failed to serialize thread data:', e);
      }
    }
    return () => {
      clearThreadData();
    };
  }, [thread]);

  // Extract posts and parent URIs for summary generation
  const threadPostData = useMemo(() => {
    if (!thread || !AppBskyFeedDefs.isThreadViewPost(thread)) {
      return { posts: [] as AppBskyFeedDefs.PostView[], parentUris: new Map<string, string>() };
    }
    const posts = collectAllPosts(thread);
    const parentUris = buildParentUriMap(thread);
    return { posts, parentUris };
  }, [thread]);

  // Determine if we should show a summary (5+ posts, matching JS behavior, and setting enabled)
  const aiSummariesEnabled = preferences?.enableAISummaries !== false;
  const shouldFetchSummary = aiSummariesEnabled && threadPostData.posts.length >= MIN_POSTS_FOR_SUMMARY;

  // Track reply count for cache invalidation — summary only needs regeneration when new replies arrive
  const threadReplyCount = useMemo(() => {
    if (!thread || !AppBskyFeedDefs.isThreadViewPost(thread)) return 0;
    return thread.post.replyCount || 0;
  }, [thread]);

  // Calculate the active format
  const activeFormat: ThreadSummaryFormat = useMemo(() => {
    if (summaryMode === "quick") return "tldr";
    const totalEngagement = threadPostData.posts.reduce(
      (sum, p) => sum + (p.likeCount || 0) + (p.replyCount || 0) + (p.repostCount || 0),
      0,
    );
    return getSummaryFormat(threadPostData.posts.length, totalEngagement);
  }, [summaryMode, threadPostData.posts]);

  // Build summary posts for the API call
  const summaryPosts: ThreadSummaryPost[] = useMemo(() => {
    return threadPostData.posts.map((post) => ({
      text: (post.record as { text?: string })?.text || "",
      author: post.author.displayName || post.author.handle,
      authorHandle: post.author.handle,
      likes: post.likeCount || 0,
      replies: post.replyCount || 0,
      reposts: post.repostCount || 0,
      uri: post.uri,
      parentUri: threadPostData.parentUris.get(post.uri),
      depth: getDepth(post.uri, threadPostData.parentUris),
    }));
  }, [threadPostData]);

  // Generate summary using the same API as the JS ThreadSummary component
  // queryKey includes threadReplyCount so React Query auto-invalidates when new replies arrive
  const { data: summaryResult, isLoading: isSummaryLoading } = useQuery<ThreadSummaryResult>({
    queryKey: ["thread-summary-native", postUri, activeFormat, summaryMode, threadReplyCount],
    queryFn: async () => {
      // Persistent cache key includes replyCount — auto-invalidates when replies change
      const cacheKeyUri = `${postUri}:${activeFormat}:${threadReplyCount}`;
      const cached = await getCachedSummary(cacheKeyUri);
      if (cached) {
        return cached;
      }

      const result = await generateThreadSummary(summaryPosts, activeFormat);
      await cacheSummary(cacheKeyUri, result);
      return result;
    },
    enabled: shouldFetchSummary && !!postUri,
    staleTime: SUMMARY_STALE_TIME_MS,
    gcTime: SUMMARY_STALE_TIME_MS,
    retry: false,
    refetchOnWindowFocus: false,
    meta: { suppressErrors: true },
  });

  // Serialize summary result as JSON for the native bridge
  const summaryJson = useMemo(() => {
    if (!summaryResult) return undefined;
    try {
      return JSON.stringify(summaryResult);
    } catch {
      return undefined;
    }
  }, [summaryResult]);

  const handleSummaryModeChange = useCallback((event: { nativeEvent: { mode: string } }) => {
    const mode = event.nativeEvent.mode;
    if (mode === "quick" || mode === "full") {
      setSummaryMode(mode);
    }
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const handlePostPress = (event: { nativeEvent: { uri: string; handle: string } }) => {
    const { uri } = event.nativeEvent;
    if (onNavigateToPost) {
      onNavigateToPost(uri);
    } else {
      navigateToThreadFromUri(uri, navigateToThread);
    }
  };

  const handleProfilePress = (event: { nativeEvent: { handle: string } }) => {
    if (onNavigateToProfile) {
      onNavigateToProfile(event.nativeEvent.handle);
    } else {
      navigateToProfile(event.nativeEvent.handle);
    }
  };

  const handleLike = (event: { nativeEvent: { uri: string; cid: string; likeUri?: string } }) => {
    const { uri, cid, likeUri } = event.nativeEvent;

    if (likeUri) {
      triggerHaptic("light");
      unlikePost.mutate({ likeUri, postUri: uri });
    } else {
      triggerHaptic("light");
      likePost.mutate({ uri, cid });
    }
  };

  // Helper to find a post's data within the thread tree
  const findPostInThread = (uri: string): AppBskyFeedDefs.ThreadViewPost | null => {
    if (!thread || !AppBskyFeedDefs.isThreadViewPost(thread)) return null;

    const search = (node: AppBskyFeedDefs.ThreadViewPost): AppBskyFeedDefs.ThreadViewPost | null => {
      if (node.post.uri === uri) return node;
      if (node.replies) {
        for (const reply of node.replies) {
          if (AppBskyFeedDefs.isThreadViewPost(reply)) {
            const found = search(reply);
            if (found) return found;
          }
        }
      }
      return null;
    };

    return search(thread);
  };

  const handleRepost = (event: { nativeEvent: { uri: string; cid: string; repostUri?: string } }) => {
    const { uri, cid, repostUri } = event.nativeEvent;

    if (repostUri) {
      // Unrepost — native UI already selected this via the repost button
      triggerHaptic("medium");
      deleteRepost.mutate({ repostUri, postUri: uri });
    } else {
      // Repost — native UI already confirmed via the Repost/Quote menu
      triggerHaptic("medium");
      repost.mutate({ uri, cid });
    }
  };

  const handleQuotePost = (event: { nativeEvent: { uri: string; cid: string; authorHandle: string; authorDisplayName?: string; authorAvatar?: string; text: string } }) => {
    const { uri, cid, authorHandle, authorDisplayName, authorAvatar, text } = event.nativeEvent;
    navigateToCompose({
      quoteTo: {
        uri,
        cid,
        author: {
          handle: authorHandle,
          displayName: authorDisplayName,
          avatar: authorAvatar,
        },
        text: text?.substring(0, 150) || '',
      },
    });
  };

  const handleReply = useCallback((_event: { nativeEvent: { uri: string; cid: string; handle: string } }) => {
    // Reply target is now updated natively in the inline composer.
    // The native SwiftUI composer handles updating the "Replying to @handle" context.
    // No need to navigate to the JS compose screen.
  }, []);

  const handleBookmark = (event: { nativeEvent: { uri: string } }) => {
    const { uri } = event.nativeEvent;
    const postNode = findPostInThread(uri);
    if (postNode) {
      const isCurrentlyBookmarked = bookmarkedPostUris.has(uri);
      triggerHaptic("light");
      toggleBookmark(postNode.post);
      if (isCurrentlyBookmarked) {
        showToast("Post removed from saved", { type: "info" });
      } else {
        showToast("Post saved", { type: "success" });
      }
    }
  };

  const handleShare = (event: { nativeEvent: { uri: string } }) => {
    // Create a minimal FeedViewPost for sharing
    const feedViewPost: AppBskyFeedDefs.FeedViewPost = {
      post: {
        uri: event.nativeEvent.uri,
        cid: '',
        author: {
          did: '',
          handle: '',
        },
        record: {},
        indexedAt: '',
      },
    };
    sharePost(feedViewPost);
  };

  const handleMentionPress = (event: { nativeEvent: { handle: string; did: string } }) => {
    if (onNavigateToProfile) {
      onNavigateToProfile(event.nativeEvent.handle);
    } else {
      navigateToProfile(event.nativeEvent.handle);
    }
  };

  const handleHashtagPress = (event: { nativeEvent: { tag: string } }) => {
    if (onNavigateToHashtag) {
      onNavigateToHashtag(event.nativeEvent.tag);
    } else {
      router.push({ pathname: '/(app)/(tabs)/(search)', params: { q: '#' + event.nativeEvent.tag } } as any);
    }
  };

  const handlePressLikeCount = (event: { nativeEvent: { uri: string } }) => {
    const encodedUri = encodeURIComponent(event.nativeEvent.uri);
    router.push(`/(app)/post/${encodedUri}/likes` as any);
  };

  const handlePressRepostCount = (event: { nativeEvent: { uri: string } }) => {
    const encodedUri = encodeURIComponent(event.nativeEvent.uri);
    router.push(`/(app)/post/${encodedUri}/reposts` as any);
  };

  const handlePressQuoteCount = (event: { nativeEvent: { uri: string } }) => {
    const encodedUri = encodeURIComponent(event.nativeEvent.uri);
    router.push(`/(app)/post/${encodedUri}/quotes` as any);
  };

  const handleTranslate = useCallback(async (event: { nativeEvent: { uri: string; text: string; sourceLang: string } }) => {
    const { uri, text, sourceLang } = event.nativeEvent;
    try {
      const result = await translatePost(text, sourceLang, uri);
      setTranslationResult(uri, result.translatedText, result.detectedSourceLang);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Translation failed";
      setTranslationError(uri, message);
    }
  }, []);

  // --- Inline reply composer handlers ---

  const handleSendReply = useCallback(async (event: { nativeEvent: { text: string; replyToUri?: string; replyToCid?: string } }) => {
    const { text, replyToUri, replyToCid } = event.nativeEvent;

    // Determine the root for the reply (always the thread root post)
    const rootUri = thread && AppBskyFeedDefs.isThreadViewPost(thread) ? thread.post.uri : replyToUri;
    const rootCid = thread && AppBskyFeedDefs.isThreadViewPost(thread) ? thread.post.cid : replyToCid;

    if (!replyToUri || !replyToCid || !rootUri || !rootCid) {
      setReplySent(false, "Missing reply context");
      return;
    }

    try {
      await createPost.mutateAsync({
        text,
        reply: {
          root: { uri: rootUri, cid: rootCid },
          parent: { uri: replyToUri, cid: replyToCid },
        },
      });
      triggerHaptic("success");
      setReplySent(true);
      // Refresh thread to show the new reply
      refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send reply";
      setReplySent(false, message);
    }
  }, [thread, createPost, refetch]);

  const handleOpenImagePicker = useCallback(() => {
    // Delegate to JS compose screen for rich media features
    navigateToCompose({});
  }, [navigateToCompose]);

  const handleOpenGifPicker = useCallback(() => {
    navigateToCompose({});
  }, [navigateToCompose]);

  const handleOpenEmojiPicker = useCallback(() => {
    navigateToCompose({});
  }, [navigateToCompose]);

  const handleMentionSearchQuery = useCallback(async (event: { nativeEvent: { query: string } }) => {
    const { query } = event.nativeEvent;
    try {
      const results = await searchActors(query, 5);
      const serialized = results.map((actor: { did: string; handle: string; displayName?: string; avatar?: string }) => ({
        did: actor.did,
        handle: actor.handle,
        displayName: actor.displayName || null,
        avatar: actor.avatar || null,
      }));
      setMentionSearchResults(JSON.stringify(serialized));
    } catch {
      setMentionSearchResults('[]');
    }
  }, []);

  // Get default reply target (root post author)
  const rootPostAuthor = useMemo(() => {
    if (!thread || !AppBskyFeedDefs.isThreadViewPost(thread)) return undefined;
    return thread.post.author;
  }, [thread]);

  // Only use skeleton before we have a postUri (handle resolution pending)
  if (isResolvingUri || !postUri) {
    return <ThreadSkeleton />;
  }

  if (resolveError) {
    return <ErrorState message={resolveError} onRetry={refetch} />;
  }

  if (error) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "Failed to load thread"}
        onRetry={refetch}
      />
    );
  }

  const isValidThread = thread && AppBskyFeedDefs.isThreadViewPost(thread);

  // If query completed but thread is not a valid ThreadViewPost (deleted/blocked)
  if (!isLoading && thread && !isValidThread) {
    return <ErrorState message="This post may have been deleted" onRetry={refetch} />;
  }

  // Always render NativeThreadView so its observers are registered before
  // the useEffect posts thread data via NotificationCenter. Communicate
  // loading state via the isLoading prop instead of swapping views.
  return (
    <View style={styles.container}>
      <InlineErrorBoundary context="NativeThreadView">
      <NativeThreadView
        style={styles.threadView}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        error={undefined}
        threadUri={postUri}
        focusedReplyUri={autoFocusUri || focusedReplyUri}
        summaryJson={summaryJson}
        isSummaryLoading={shouldFetchSummary && isSummaryLoading}
        summaryMode={summaryMode}
        onRefresh={handleRefresh}
        onPostPress={handlePostPress}
        onProfilePress={handleProfilePress}
        onLike={handleLike}
        onRepost={handleRepost}
        onReply={handleReply}
        onBookmark={handleBookmark}
        onMentionPress={handleMentionPress}
        onHashtagPress={handleHashtagPress}
        onShare={handleShare}
        onNavigateToParent={(event) => {
          if (onNavigateToPost) {
            onNavigateToPost(event.nativeEvent.uri);
          } else {
            navigateToThreadFromUri(event.nativeEvent.uri, navigateToThread);
          }
        }}
        onNavigateToRoot={(event) => {
          if (onNavigateToPost) {
            onNavigateToPost(event.nativeEvent.uri);
          } else {
            navigateToThreadFromUri(event.nativeEvent.uri, navigateToThread);
          }
        }}
        onPressLikeCount={handlePressLikeCount}
        onPressRepostCount={handlePressRepostCount}
        onPressQuoteCount={handlePressQuoteCount}
        onSummaryModeChange={handleSummaryModeChange}
        onTranslate={handleTranslate}
        onQuotePost={handleQuotePost}
        replyToHandle={rootPostAuthor?.handle}
        replyToUri={postUri}
        replyToCid={thread && AppBskyFeedDefs.isThreadViewPost(thread) ? thread.post.cid : undefined}
        onSendReply={handleSendReply}
        onOpenImagePicker={handleOpenImagePicker}
        onOpenGifPicker={handleOpenGifPicker}
        onOpenEmojiPicker={handleOpenEmojiPicker}
        onMentionSearchQuery={handleMentionSearchQuery}
      />
      </InlineErrorBoundary>
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    threadView: {
      flex: 1,
    },
  });
}
