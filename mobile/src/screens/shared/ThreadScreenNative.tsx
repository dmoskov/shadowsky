import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  StyleSheet,
  Alert,
  ActionSheetIOS,
  Platform,
} from "react-native";
import { AppBskyFeedDefs } from "@atproto/api";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { usePostThread } from "../../hooks/api/useFeed";
import { useLikePost, useUnlikePost, useRepost, useDeleteRepost } from "../../hooks/api/usePosts";
import { useAppNavigation } from "../../hooks/useNavigation";
import { ThreadSkeleton } from "../../components/ThreadSkeleton";
import { ErrorState } from "../../components/ErrorState";
import { getAtProtoClient } from "../../services/atproto/client";
import { useTheme } from "../../contexts/ThemeContext";
import { sharePost } from "../../utils/share";
import { triggerHaptic } from "../../utils/haptics";
import { createLogger } from '../../utils/logger';
import { NativeThreadView } from '../../../modules/native-thread-view';
import {
  generateThreadSummary,
  type ThreadSummaryPost,
  type ThreadSummaryFormat,
  type ThreadSummaryResult,
} from "../../services/ai-service";
import { getCachedSummary, cacheSummary } from "../../services/thread-summary-cache";

const logger = createLogger('ThreadScreenNative');

const SUMMARY_STALE_TIME_MS = 10 * 60 * 1000; // 10 minutes
const MIN_POSTS_FOR_SUMMARY = 5;

interface ThreadScreenProps {
  handle: string;
  postId: string;
}

/**
 * Build AT Protocol URI from handle and post ID
 * Format: at://did/app.bsky.feed.post/postId
 */
async function buildPostUri(handle: string, postId: string): Promise<string> {
  const client = getAtProtoClient();
  const agent = client.getAgent();

  // Resolve handle to DID
  const profile = await agent.getProfile({ actor: handle });
  const did = profile.data.did;

  return `at://${did}/app.bsky.feed.post/${postId}`;
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

export function ThreadScreenNative({ handle, postId }: ThreadScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [postUri, setPostUri] = useState<string | null>(null);
  const [isResolvingUri, setIsResolvingUri] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [summaryMode, setSummaryMode] = useState<"quick" | "full">("quick");

  const { navigateToProfile, navigateToThread, navigateToCompose } = useAppNavigation();
  const likePost = useLikePost();
  const unlikePost = useUnlikePost();
  const repost = useRepost();
  const deleteRepost = useDeleteRepost();

  // Resolve handle to URI on mount
  useEffect(() => {
    async function resolveUri() {
      setIsResolvingUri(true);
      setResolveError(null);
      try {
        const uri = await buildPostUri(handle, postId);
        setPostUri(uri);
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
  }, [handle, postId]);

  // Fetch thread data
  const { data: thread, isLoading, error, refetch } = usePostThread(postUri || "");

  // Extract posts and parent URIs for summary generation
  const threadPostData = useMemo(() => {
    if (!thread || !AppBskyFeedDefs.isThreadViewPost(thread)) {
      return { posts: [] as AppBskyFeedDefs.PostView[], parentUris: new Map<string, string>() };
    }
    const posts = collectAllPosts(thread);
    const parentUris = buildParentUriMap(thread);
    return { posts, parentUris };
  }, [thread]);

  // Determine if we should show a summary (5+ posts, matching JS behavior)
  const shouldFetchSummary = threadPostData.posts.length >= MIN_POSTS_FOR_SUMMARY;

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
  const { data: summaryResult, isLoading: isSummaryLoading } = useQuery<ThreadSummaryResult>({
    queryKey: ["thread-summary-native", postUri, activeFormat, summaryMode],
    queryFn: async () => {
      const cacheKeyUri = `${postUri}:${activeFormat}`;
      const cached = await getCachedSummary(cacheKeyUri);
      if (cached) return cached;

      const result = await generateThreadSummary(summaryPosts, activeFormat);
      await cacheSummary(cacheKeyUri, result);
      return result;
    },
    enabled: shouldFetchSummary && !!postUri,
    staleTime: SUMMARY_STALE_TIME_MS,
    gcTime: SUMMARY_STALE_TIME_MS * 2,
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
    navigateToThreadFromUri(uri, navigateToThread);
  };

  const handleProfilePress = (event: { nativeEvent: { handle: string } }) => {
    navigateToProfile(event.nativeEvent.handle);
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

    // If already reposted, just unrepost
    if (repostUri) {
      triggerHaptic("medium");
      deleteRepost.mutate({ repostUri, postUri: uri });
      return;
    }

    // Get post data from thread for author info
    const postNode = findPostInThread(uri);
    const postAuthor = postNode?.post.author;
    const postRecord = postNode?.post.record as any;

    // Show menu: Repost, Quote, or Share
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Repost', 'Quote', 'Share'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            // Repost
            triggerHaptic("medium");
            repost.mutate({ uri, cid });
          } else if (buttonIndex === 2) {
            // Quote - navigate to compose
            navigateToCompose({
              quoteTo: {
                uri,
                cid,
                author: {
                  handle: postAuthor?.handle || '',
                  displayName: postAuthor?.displayName || '',
                  avatar: postAuthor?.avatar || '',
                },
                text: postRecord?.text?.substring(0, 150) || '',
              },
            });
          } else if (buttonIndex === 3) {
            // Share
            handleShare(event);
          }
        }
      );
    } else {
      // Android - use Alert
      Alert.alert(
        'Repost',
        'Choose an option',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Repost',
            onPress: () => {
              triggerHaptic("medium");
              repost.mutate({ uri, cid });
            },
          },
          {
            text: 'Quote',
            onPress: () => {
              navigateToCompose({
                quoteTo: {
                  uri,
                  cid,
                  author: {
                    handle: postAuthor?.handle || '',
                    displayName: postAuthor?.displayName || '',
                    avatar: postAuthor?.avatar || '',
                  },
                  text: postRecord?.text?.substring(0, 150) || '',
                },
              });
            },
          },
          {
            text: 'Share',
            onPress: () => handleShare(event),
          },
        ],
        { cancelable: true }
      );
    }
  };

  const handleReply = (event: { nativeEvent: { uri: string; cid: string; handle: string } }) => {
    const { uri, cid, handle: eventHandle } = event.nativeEvent;

    // Get post data from thread for author info and text preview
    const postNode = findPostInThread(uri);
    const postAuthor = postNode?.post.author;
    const postRecord = postNode?.post.record as any;

    navigateToCompose({
      replyTo: {
        uri,
        cid,
        author: {
          handle: postAuthor?.handle || eventHandle,
          displayName: postAuthor?.displayName || '',
          avatar: postAuthor?.avatar || '',
        },
        text: postRecord?.text?.substring(0, 100) || '',
      },
    });
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
    navigateToProfile(event.nativeEvent.handle);
  };

  const handleHashtagPress = (event: { nativeEvent: { tag: string } }) => {
    router.push({ pathname: '/(tabs)/(search)', params: { q: '#' + event.nativeEvent.tag } } as any);
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

  if (isResolvingUri || !postUri) {
    return <ThreadSkeleton />;
  }

  if (resolveError) {
    return <ErrorState message={resolveError} onRetry={refetch} />;
  }

  if (isLoading) {
    return <ThreadSkeleton />;
  }

  if (error) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "Failed to load thread"}
        onRetry={refetch}
      />
    );
  }

  if (!thread) {
    return <ErrorState message="Thread not found" />;
  }

  return (
    <View style={styles.container}>
      <NativeThreadView
        style={styles.threadView}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        error={error ? (typeof error === 'object' && error !== null && 'message' in error ? (error as Error).message : "Failed to load thread") : undefined}
        threadUri={postUri}
        summaryJson={summaryJson}
        isSummaryLoading={shouldFetchSummary && isSummaryLoading}
        summaryMode={summaryMode}
        onRefresh={handleRefresh}
        onPostPress={handlePostPress}
        onProfilePress={handleProfilePress}
        onLike={handleLike}
        onRepost={handleRepost}
        onReply={handleReply}
        onBookmark={() => {}}
        onMentionPress={handleMentionPress}
        onHashtagPress={handleHashtagPress}
        onShare={handleShare}
        onNavigateToParent={(event) => navigateToThreadFromUri(event.nativeEvent.uri, navigateToThread)}
        onNavigateToRoot={(event) => navigateToThreadFromUri(event.nativeEvent.uri, navigateToThread)}
        onPressLikeCount={handlePressLikeCount}
        onPressRepostCount={handlePressRepostCount}
        onPressQuoteCount={handlePressQuoteCount}
        onSummaryModeChange={handleSummaryModeChange}
      />
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
