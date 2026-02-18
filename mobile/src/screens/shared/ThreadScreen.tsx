import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ActionSheetIOS,
  Platform,
  RefreshControl,
  ListRenderItem,
} from "react-native";
import { AppBskyFeedDefs } from "@atproto/api";
import { useRouter } from "expo-router";
import { usePostThread } from "../../hooks/api/useFeed";
import { useLikePost, useUnlikePost, useRepost, useDeleteRepost, useCreatePost } from "../../hooks/api/usePosts";
import { useBookmarks } from "../../hooks/api/useBookmarks";
import { useAppNavigation } from "../../hooks/useNavigation";
import { PostCard } from "../../components/PostCard";
import { ErrorState } from "../../components/ErrorState";
import { ThreadSkeleton } from "../../components/ThreadSkeleton";
import { ThreadSummary } from "../../components/ThreadSummary";
import { ThreadNavigator } from "../../components/ThreadNavigator";
import { getAtProtoClient } from "../../services/atproto/client";
import { useTheme } from "../../contexts/ThemeContext";
import { sharePost } from "../../utils/share";
import { triggerHaptic } from "../../utils/haptics";
import { useSpotlightPost } from "../../hooks/useSpotlightIndex";
import { useSharedTransition } from "../../contexts/SharedTransitionContext";

import { createLogger } from '../../utils/logger';

const logger = createLogger('ThreadScreen');

interface ThreadScreenProps {
  handle: string;
  postId: string;
  did?: string;
}

const MAX_REPLY_LENGTH = 300;

// --- Thread tree types and helpers ---

interface ThreadNode {
  post: AppBskyFeedDefs.FeedViewPost;
  children: ThreadNode[];
  depth: number;
  uri: string;
  parentUri?: string;
}

type ThreadListItem =
  | { type: "root-post"; post: AppBskyFeedDefs.FeedViewPost; key: string }
  | { type: "summary"; posts: AppBskyFeedDefs.PostView[]; threadUri: string; parentUris: Map<string, string>; key: string }
  | { type: "divider"; key: string }
  | { type: "reply-node"; node: ThreadNode; hasChildren: boolean; isCollapsed: boolean; descendantCount: number; key: string }
  | { type: "collapsed-indicator"; uri: string; depth: number; descendantCount: number; key: string }
  | { type: "no-replies"; key: string };

/**
 * Build AT Protocol URI from handle and post ID
 */
async function buildPostUri(handle: string, postId: string): Promise<string> {
  const client = getAtProtoClient();
  const agent = client.getAgent();
  const profile = await agent.getProfile({ actor: handle });
  const did = profile.data.did;
  return `at://${did}/app.bsky.feed.post/${postId}`;
}

/**
 * Extract FeedViewPost from thread node
 */
function threadNodeToFeedViewPost(node: any): AppBskyFeedDefs.FeedViewPost | null {
  if (!node || !node.post) return null;
  return {
    post: node.post,
    reply: node.reply,
    reason: undefined,
    feedContext: undefined,
  } as AppBskyFeedDefs.FeedViewPost;
}

/**
 * Recursively extract all reply posts from thread (flat list)
 */
function extractReplies(node: any): AppBskyFeedDefs.FeedViewPost[] {
  if (!node || !node.replies || !Array.isArray(node.replies)) {
    return [];
  }
  const replies: AppBskyFeedDefs.FeedViewPost[] = [];
  for (const replyNode of node.replies) {
    const feedViewPost = threadNodeToFeedViewPost(replyNode);
    if (feedViewPost) {
      replies.push(feedViewPost);
      const nestedReplies = extractReplies(replyNode);
      replies.push(...nestedReplies);
    }
  }
  return replies;
}

/**
 * Build tree structure from flat replies
 */
function buildThreadTree(
  rootPost: AppBskyFeedDefs.FeedViewPost,
  replies: AppBskyFeedDefs.FeedViewPost[]
): ThreadNode {
  const nodeMap: Map<string, ThreadNode> = new Map();

  const rootNode: ThreadNode = {
    post: rootPost,
    children: [],
    depth: 0,
    uri: rootPost.post.uri,
  };
  nodeMap.set(rootPost.post.uri, rootNode);

  replies.forEach((reply) => {
    const node: ThreadNode = {
      post: reply,
      children: [],
      depth: 0,
      uri: reply.post.uri,
    };
    nodeMap.set(reply.post.uri, node);
  });

  replies.forEach((reply) => {
    const record = reply.post.record as any;
    const parentUri = record?.reply?.parent?.uri;
    if (parentUri) {
      const parentNode = nodeMap.get(parentUri);
      const childNode = nodeMap.get(reply.post.uri);
      if (parentNode && childNode) {
        parentNode.children.push(childNode);
        childNode.depth = parentNode.depth + 1;
        childNode.parentUri = parentUri;
      }
    }
  });

  return rootNode;
}

/**
 * Count descendants in a branch
 */
function countDescendants(node: ThreadNode): number {
  let count = node.children.length;
  node.children.forEach((child) => {
    count += countDescendants(child);
  });
  return count;
}

/**
 * Get depth-based color for visual hierarchy
 */
function getDepthColor(depth: number, colors: any): string {
  const depthColors = [
    colors.info,
    colors.mention,
    colors.accent,
    colors.warning,
    colors.success,
    colors.quote,
  ];
  return depthColors[depth % depthColors.length];
}

/**
 * Flatten the thread tree into a list of items for FlatList,
 * respecting collapsed branches.
 */
function flattenThreadTree(
  node: ThreadNode,
  collapsedBranches: Set<string>,
  items: ThreadListItem[]
): void {
  // Skip root node (depth 0) — it's rendered as a separate list item type
  if (node.depth > 0) {
    const hasChildren = node.children.length > 0;
    const isCollapsed = collapsedBranches.has(node.uri);
    const descendantCount = countDescendants(node);

    items.push({
      type: "reply-node",
      node,
      hasChildren,
      isCollapsed,
      descendantCount,
      key: `reply-${node.uri}`,
    });

    if (isCollapsed && hasChildren) {
      items.push({
        type: "collapsed-indicator",
        uri: node.uri,
        depth: node.depth,
        descendantCount,
        key: `collapsed-${node.uri}`,
      });
      return; // Don't recurse into collapsed children
    }
  }

  for (const child of node.children) {
    flattenThreadTree(child, collapsedBranches, items);
  }
}

// --- Main Component ---

export function ThreadScreen({ handle, postId, did }: ThreadScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [postUri, setPostUri] = useState<string | null>(null);
  const [isResolvingUri, setIsResolvingUri] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolveRetry, setResolveRetry] = useState(0);
  const [replyText, setReplyText] = useState("");
  const [isReplyVisible, setIsReplyVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [collapsedBranches, setCollapsedBranches] = useState<Set<string>>(new Set());
  const flatListRef = useRef<FlatList<ThreadListItem>>(null);

  const { navigateToProfile, navigateToCompose } = useAppNavigation();
  const likePost = useLikePost();
  const unlikePost = useUnlikePost();
  const repostMutation = useRepost();
  const deleteRepost = useDeleteRepost();
  const createPost = useCreatePost();
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const { activateTransition, cancelTransition } = useSharedTransition();

  // Activate shared element transition overlay on mount
  useEffect(() => {
    activateTransition();
    return () => {
      // Cancel any in-progress transition on unmount (e.g. swipe back)
      cancelTransition();
    };
  }, [activateTransition, cancelTransition]);

  // Resolve handle to URI on mount — skip network call if DID is provided
  React.useEffect(() => {
    if (!handle && !did) return;
    if (!postId) return;

    if (did) {
      // Fast path: construct URI directly from DID (no network call)
      setPostUri(`at://${did}/app.bsky.feed.post/${postId}`);
      return;
    }

    // Slow path: resolve handle to DID via network
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

    resolveUri();
  }, [handle, postId, did, resolveRetry]);

  // Fetch thread data
  const { data: thread, isLoading, error, refetch } = usePostThread(postUri || "");

  // Index root post in Spotlight when thread is viewed
  const spotlightPostData = useMemo(() => {
    if (!thread || !("post" in thread)) return null;
    const post = (thread as any).post;
    if (!post) return null;
    const record = post.record as any;
    return {
      uri: post.uri as string,
      text: (record?.text as string) || "",
      authorHandle: post.author?.handle as string,
      authorName: post.author?.displayName as string | undefined,
      authorAvatar: post.author?.avatar as string | undefined,
    };
  }, [thread]);
  useSpotlightPost(spotlightPostData);

  // Extract root post and replies
  const rootPost = useMemo(() => {
    if (!thread) return null;
    return threadNodeToFeedViewPost(thread);
  }, [thread]);

  const replies = useMemo(() => {
    if (!thread) return [];
    return extractReplies(thread);
  }, [thread]);

  // Build parent URIs map for AI summary
  const parentUris = useMemo(() => {
    if (!thread) return new Map<string, string>();
    const map = new Map<string, string>();
    const traverse = (currentNode: any) => {
      if (!currentNode || !currentNode.replies || !Array.isArray(currentNode.replies)) return;
      for (const replyNode of currentNode.replies) {
        if (replyNode?.post?.uri && currentNode?.post?.uri) {
          map.set(replyNode.post.uri, currentNode.post.uri);
        }
        traverse(replyNode);
      }
    };
    traverse(thread);
    return map;
  }, [thread]);

  // Build tree structure once (only recomputes when thread data changes)
  const threadTree = useMemo(() => {
    if (!rootPost || replies.length === 0) return null;
    return buildThreadTree(rootPost, replies);
  }, [rootPost, replies]);

  // Build flattened list items for FlatList (recomputes on collapse toggle)
  const listData = useMemo(() => {
    if (!rootPost) return [];

    const items: ThreadListItem[] = [];

    // 1. Root post
    items.push({ type: "root-post", post: rootPost, key: "root-post" });

    // 2. AI summary (if enough replies)
    if (replies.length >= 5) {
      items.push({
        type: "summary",
        posts: [rootPost, ...replies].map(p => p.post),
        threadUri: rootPost.post.uri,
        parentUris,
        key: "summary",
      });
    }

    // 3. Divider + reply nodes OR no-replies
    if (threadTree) {
      items.push({ type: "divider", key: "divider" });
      flattenThreadTree(threadTree, collapsedBranches, items);
    } else {
      items.push({ type: "no-replies", key: "no-replies" });
    }

    return items;
  }, [rootPost, replies, parentUris, threadTree, collapsedBranches]);

  // --- Handlers ---

  const toggleBranch = useCallback((uri: string) => {
    triggerHaptic("light");
    setCollapsedBranches((prev) => {
      const next = new Set(prev);
      if (next.has(uri)) {
        next.delete(uri);
      } else {
        next.add(uri);
      }
      return next;
    });
  }, []);

  const handleProfilePress = useCallback((pressedHandle: string) => {
    navigateToProfile(pressedHandle);
  }, [navigateToProfile]);

  const handleMentionPress = useCallback((mentionHandle: string, _did: string) => {
    navigateToProfile(mentionHandle);
  }, [navigateToProfile]);

  const handleHashtagPress = useCallback((tag: string) => {
    router.push({ pathname: '/(tabs)/(search)', params: { q: '#' + tag } } as any);
  }, [router]);

  const handleLike = useCallback((post: AppBskyFeedDefs.FeedViewPost) => {
    const { uri, cid, viewer } = post.post;
    if (viewer?.like) {
      triggerHaptic("light");
      unlikePost.mutate({ likeUri: viewer.like, postUri: uri });
    } else {
      triggerHaptic("light");
      likePost.mutate({ uri, cid });
    }
  }, [likePost, unlikePost]);

  const handleRepost = useCallback((post: AppBskyFeedDefs.FeedViewPost) => {
    const postView = post.post;
    const { uri, cid, viewer } = postView;
    const record = postView.record as any;

    if (viewer?.repost) {
      triggerHaptic("medium");
      deleteRepost.mutate({ repostUri: viewer.repost, postUri: uri });
      return;
    }

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Repost', 'Quote', 'Share'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            triggerHaptic("medium");
            repostMutation.mutate({ uri, cid });
          } else if (buttonIndex === 2) {
            navigateToCompose({
              quoteTo: {
                uri: postView.uri,
                cid: postView.cid,
                author: {
                  handle: postView.author.handle,
                  displayName: postView.author.displayName,
                  avatar: postView.author.avatar,
                },
                text: record?.text?.substring(0, 150) || '',
              },
            });
          } else if (buttonIndex === 3) {
            sharePost(post);
          }
        }
      );
    } else {
      Alert.alert(
        'Repost',
        'Choose an option',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Repost',
            onPress: () => {
              triggerHaptic("medium");
              repostMutation.mutate({ uri, cid });
            },
          },
          {
            text: 'Quote',
            onPress: () => {
              navigateToCompose({
                quoteTo: {
                  uri: postView.uri,
                  cid: postView.cid,
                  author: {
                    handle: postView.author.handle,
                    displayName: postView.author.displayName,
                    avatar: postView.author.avatar,
                  },
                  text: record?.text?.substring(0, 150) || '',
                },
              });
            },
          },
          {
            text: 'Share',
            onPress: () => sharePost(post),
          },
        ],
        { cancelable: true }
      );
    }
  }, [repostMutation, deleteRepost, navigateToCompose]);

  const handleReply = useCallback((post: AppBskyFeedDefs.FeedViewPost) => {
    const postView = post.post;
    const record = postView.record as any;
    navigateToCompose({
      replyTo: {
        uri: postView.uri,
        cid: postView.cid,
        author: {
          handle: postView.author.handle,
          displayName: postView.author.displayName,
          avatar: postView.author.avatar,
        },
        text: record?.text?.substring(0, 100) || '',
      },
    });
  }, [navigateToCompose]);

  const handleBookmark = useCallback((post: AppBskyFeedDefs.FeedViewPost) => {
    triggerHaptic("light");
    toggleBookmark(post.post);
  }, [toggleBookmark]);

  const handlePostReply = useCallback(async () => {
    if (!replyText.trim() || !rootPost) return;

    try {
      const rootUri = rootPost.post.uri;
      const rootCid = rootPost.post.cid;
      await createPost.mutateAsync({
        text: replyText.trim(),
        reply: {
          root: { uri: rootUri, cid: rootCid },
          parent: { uri: rootUri, cid: rootCid },
        },
      });
      setReplyText("");
      setIsReplyVisible(false);
      refetch();
      Alert.alert("Success", "Your reply has been posted!");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to post reply. Please try again.";
      Alert.alert("Error", errorMessage);
    }
  }, [replyText, rootPost, createPost, refetch]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  }, [refetch]);

  const handlePressLikeCount = useCallback((uri: string) => {
    const encodedUri = encodeURIComponent(uri);
    router.push(`/(app)/post/${encodedUri}/likes` as any);
  }, [router]);

  const handlePressRepostCount = useCallback((uri: string) => {
    const encodedUri = encodeURIComponent(uri);
    router.push(`/(app)/post/${encodedUri}/reposts` as any);
  }, [router]);

  const handlePressQuoteCount = useCallback((uri: string) => {
    const encodedUri = encodeURIComponent(uri);
    router.push(`/(app)/post/${encodedUri}/quotes` as any);
  }, [router]);

  const handleNavigateToPost = useCallback((index: number) => {
    // The ThreadNavigator gives indices into [rootPost, ...replies].
    // We need to find the corresponding FlatList index.
    // Index 0 = root post = FlatList index 0
    // Index N (N>0) = reply at position N-1 in replies array.
    // We search listData for the matching reply-node.
    if (index === 0) {
      flatListRef.current?.scrollToIndex({ index: 0, animated: true });
      return;
    }

    // Find the reply URI at this index in the flat replies array
    if (index - 1 < replies.length) {
      const targetUri = replies[index - 1].post.uri;
      const flatListIndex = listData.findIndex(
        (item) => item.type === "reply-node" && item.node.uri === targetUri
      );
      if (flatListIndex >= 0) {
        flatListRef.current?.scrollToIndex({
          index: flatListIndex,
          animated: true,
          viewPosition: 0,
        });
      }
    }
  }, [replies, listData]);

  // --- Render functions ---

  const renderReplyNode = useCallback((
    item: Extract<ThreadListItem, { type: "reply-node" }>,
  ) => {
    const { node, hasChildren, isCollapsed } = item;
    const depthColor = getDepthColor(node.depth, colors);

    return (
      <View style={styles.nodeContainer}>
        {/* Depth indicator line */}
        {node.depth > 0 && (
          <View
            style={[
              styles.depthLine,
              {
                left: (node.depth - 1) * 20 + 8,
                backgroundColor: depthColor,
              },
            ]}
          />
        )}

        {/* Post container with indentation */}
        <View
          style={[
            styles.postContainer,
            { marginLeft: node.depth * 20 },
          ]}
        >
          {/* Collapse/Expand button for branches with children */}
          {hasChildren && node.depth > 0 && (
            <TouchableOpacity
              style={[
                styles.collapseButton,
                { backgroundColor: depthColor },
              ]}
              onPress={() => toggleBranch(node.uri)}
              activeOpacity={0.7}
            >
              <Text style={styles.collapseIcon}>
                {isCollapsed ? "+" : "\u2212"}
              </Text>
            </TouchableOpacity>
          )}

          {/* Branch indicator for leaf nodes */}
          {node.depth > 0 && !hasChildren && (
            <View
              style={[
                styles.branchIndicator,
                { borderLeftColor: depthColor, borderTopColor: depthColor },
              ]}
            />
          )}

          {/* Post card */}
          <View style={styles.postCardWrapper}>
            <PostCard
              post={node.post}
              onPressProfile={handleProfilePress}
              onLike={() => handleLike(node.post)}
              onRepost={() => handleRepost(node.post)}
              onReply={() => handleReply(node.post)}
              onBookmark={() => handleBookmark(node.post)}
              isBookmarked={isBookmarked(node.post.post.uri)}
              onMentionPress={handleMentionPress}
              onHashtagPress={handleHashtagPress}
              onPressLikeCount={() => handlePressLikeCount(node.post.post.uri)}
              onPressRepostCount={() => handlePressRepostCount(node.post.post.uri)}
              onPressQuoteCount={() => handlePressQuoteCount(node.post.post.uri)}
            />
          </View>
        </View>
      </View>
    );
  }, [colors, styles, toggleBranch, handleProfilePress, handleLike, handleRepost, handleReply, handleBookmark, isBookmarked, handleMentionPress, handleHashtagPress, handlePressLikeCount, handlePressRepostCount, handlePressQuoteCount]);

  const renderCollapsedIndicator = useCallback((
    item: Extract<ThreadListItem, { type: "collapsed-indicator" }>,
  ) => {
    const depthColor = getDepthColor(item.depth, colors);
    return (
      <TouchableOpacity
        style={[
          styles.collapsedIndicator,
          { marginLeft: (item.depth + 1) * 20 },
        ]}
        onPress={() => toggleBranch(item.uri)}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.collapsedBadge,
            { backgroundColor: depthColor },
          ]}
        >
          <Text style={styles.collapsedText}>
            {item.descendantCount} hidden {item.descendantCount === 1 ? "reply" : "replies"}
          </Text>
          <Text style={styles.expandIcon}>{"\u203A"}</Text>
        </View>
      </TouchableOpacity>
    );
  }, [colors, styles, toggleBranch]);

  const renderItem: ListRenderItem<ThreadListItem> = useCallback(({ item }) => {
    switch (item.type) {
      case "root-post":
        return (
          <PostCard
            post={item.post}
            onPressProfile={handleProfilePress}
            onLike={() => handleLike(item.post)}
            onRepost={() => handleRepost(item.post)}
            onReply={() => handleReply(item.post)}
            onBookmark={() => handleBookmark(item.post)}
            isBookmarked={isBookmarked(item.post.post.uri)}
            onMentionPress={handleMentionPress}
            onHashtagPress={handleHashtagPress}
            onPressLikeCount={() => handlePressLikeCount(item.post.post.uri)}
            onPressRepostCount={() => handlePressRepostCount(item.post.post.uri)}
            onPressQuoteCount={() => handlePressQuoteCount(item.post.post.uri)}
          />
        );
      case "summary":
        return (
          <ThreadSummary
            posts={item.posts}
            threadUri={item.threadUri}
            parentUris={item.parentUris}
          />
        );
      case "divider":
        return <View style={styles.divider} />;
      case "reply-node":
        return renderReplyNode(item);
      case "collapsed-indicator":
        return renderCollapsedIndicator(item);
      case "no-replies":
        return (
          <View style={styles.noReplies}>
            <Text style={styles.noRepliesText}>No replies yet</Text>
          </View>
        );
      default:
        return null;
    }
  }, [styles, handleProfilePress, handleLike, handleRepost, handleReply, handleBookmark, isBookmarked, handleMentionPress, handleHashtagPress, handlePressLikeCount, handlePressRepostCount, handlePressQuoteCount, renderReplyNode, renderCollapsedIndicator]);

  const keyExtractor = useCallback((item: ThreadListItem) => item.key, []);

  const onScrollToIndexFailed = useCallback((info: { index: number; averageItemLength: number }) => {
    // Scroll to approximate position, then retry
    flatListRef.current?.scrollToOffset({
      offset: info.index * info.averageItemLength,
      animated: true,
    });
  }, []);

  // --- Early returns for loading/error states ---

  if (isResolvingUri || !postUri) {
    return <ThreadSkeleton />;
  }

  if (resolveError) {
    return <ErrorState message={resolveError} onRetry={() => setResolveRetry(n => n + 1)} />;
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

  if (!thread || !rootPost) {
    return <ErrorState message="Thread not found" />;
  }

  const isReplyDisabled = !replyText.trim() || replyText.length > MAX_REPLY_LENGTH;
  const replyCharCount = replyText.length;
  const isOverLimit = replyCharCount > MAX_REPLY_LENGTH;

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={listData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        onScrollToIndexFailed={onScrollToIndexFailed}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={7}
        initialNumToRender={10}
        updateCellsBatchingPeriod={50}
        style={styles.flatList}
      />

      {/* Reply Composer */}
      {isReplyVisible && (
        <View style={styles.replyComposer}>
          <View style={styles.replyHeader}>
            <Text style={styles.replyLabel}>Replying to @{rootPost.post.author.handle}</Text>
            <TouchableOpacity
              onPress={() => {
                setIsReplyVisible(false);
                setReplyText("");
              }}
            >
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.replyInput}
            placeholder="Write your reply..."
            placeholderTextColor={colors.textTertiary}
            multiline
            value={replyText}
            onChangeText={setReplyText}
            editable={!createPost.isPending}
            maxLength={MAX_REPLY_LENGTH + 50}
          />

          <View style={styles.replyFooter}>
            <Text style={[styles.charCount, isOverLimit && styles.charCountOver]}>
              {replyCharCount}/{MAX_REPLY_LENGTH}
            </Text>
            <TouchableOpacity
              style={[
                styles.replyButton,
                (isReplyDisabled || createPost.isPending) && styles.replyButtonDisabled,
              ]}
              onPress={handlePostReply}
              disabled={isReplyDisabled || createPost.isPending}
            >
              {createPost.isPending ? (
                <ActivityIndicator color={colors.text} size="small" />
              ) : (
                <Text style={styles.replyButtonText}>Reply</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Thread Navigator */}
      {replies.length > 3 && (
        <ThreadNavigator
          posts={[rootPost, ...replies]}
          onNavigate={handleNavigateToPost}
        />
      )}

      {/* Floating reply button */}
      {!isReplyVisible && (
        <TouchableOpacity
          style={styles.floatingReplyButton}
          onPress={() => setIsReplyVisible(true)}
        >
          <Text style={styles.floatingReplyButtonText}>💬 Reply</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    flatList: {
      flex: 1,
    },
    divider: {
      height: 1,
      backgroundColor: colors.surfaceElevated,
      marginVertical: 8,
    },
    noReplies: {
      padding: 24,
      alignItems: "center",
    },
    noRepliesText: {
      color: colors.textTertiary,
      fontSize: 14,
    },
    // Thread tree node styles
    nodeContainer: {
      position: "relative",
    },
    depthLine: {
      position: "absolute",
      top: 0,
      width: 2,
      height: "100%",
      opacity: 0.3,
    },
    postContainer: {
      flexDirection: "row",
      alignItems: "flex-start",
      position: "relative",
    },
    collapseButton: {
      width: 20,
      height: 20,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 8,
      marginTop: 16,
      zIndex: 1,
    },
    collapseIcon: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "bold",
      lineHeight: 20,
    },
    branchIndicator: {
      width: 12,
      height: 12,
      borderLeftWidth: 2,
      borderTopWidth: 2,
      borderTopLeftRadius: 4,
      marginRight: 8,
      marginTop: 20,
      marginLeft: 4,
    },
    postCardWrapper: {
      flex: 1,
    },
    collapsedIndicator: {
      marginTop: 8,
      marginBottom: 8,
    },
    collapsedBadge: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      elevation: 2,
      shadowColor: colors.borderDark,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
    },
    collapsedText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "500",
    },
    expandIcon: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "bold",
      marginLeft: 8,
    },
    // Reply composer styles
    replyComposer: {
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.surfaceElevated,
      padding: 16,
    },
    replyHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    replyLabel: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    cancelButton: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "600",
    },
    replyInput: {
      color: colors.text,
      fontSize: 16,
      minHeight: 80,
      maxHeight: 160,
      padding: 12,
      backgroundColor: colors.background,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.borderLight,
      textAlignVertical: "top",
    },
    replyFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 12,
    },
    charCount: {
      color: colors.textTertiary,
      fontSize: 13,
    },
    charCountOver: {
      color: colors.danger,
    },
    replyButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
      minWidth: 80,
      alignItems: "center",
    },
    replyButtonDisabled: {
      backgroundColor: colors.surface,
      opacity: 0.5,
    },
    replyButtonText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "600",
    },
    floatingReplyButton: {
      position: "absolute",
      bottom: 20,
      right: 20,
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 24,
      flexDirection: "row",
      alignItems: "center",
      elevation: 4,
      shadowColor: colors.borderDark,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
    },
    floatingReplyButtonText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "600",
    },
  });
}
