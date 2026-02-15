import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ActionSheetIOS,
  Platform,
  RefreshControl,
} from "react-native";
import { AppBskyFeedDefs } from "@atproto/api";
import { useRouter } from "expo-router";
import { usePostThread } from "../../hooks/api/useFeed";
import { useLikePost, useUnlikePost, useRepost, useDeleteRepost, useCreatePost } from "../../hooks/api/usePosts";
import { useAppNavigation } from "../../hooks/useNavigation";
import { PostCard } from "../../components/PostCard";
import { ErrorState } from "../../components/ErrorState";
import { ThreadSkeleton } from "../../components/ThreadSkeleton";
import { ThreadSummary } from "../../components/ThreadSummary";
import { ThreadTreeView } from "../../components/ThreadTreeView";
import { ThreadNavigator } from "../../components/ThreadNavigator";
import { getAtProtoClient } from "../../services/atproto/client";
import { colors } from "../../constants/theme";
import { sharePost } from "../../utils/share";
import { triggerHaptic } from "../../utils/haptics";


import { createLogger } from '../../utils/logger';

const logger = createLogger('Threadscreenx');
interface ThreadScreenProps {
  handle: string;
  postId: string;
}

const MAX_REPLY_LENGTH = 300;

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
 * Recursively extract all reply posts from thread
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
      // Recursively get nested replies
      const nestedReplies = extractReplies(replyNode);
      replies.push(...nestedReplies);
    }
  }

  return replies;
}

export function ThreadScreen({ handle, postId }: ThreadScreenProps) {
  const router = useRouter();
  const [postUri, setPostUri] = useState<string | null>(null);
  const [isResolvingUri, setIsResolvingUri] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isReplyVisible, setIsReplyVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const scrollViewRef = React.useRef<ScrollView>(null);
  const [scrollPositions, setScrollPositions] = React.useState<Map<number, number>>(new Map());

  const { navigateToProfile, navigateToThread, navigateToCompose } = useAppNavigation();
  const likePost = useLikePost();
  const unlikePost = useUnlikePost();
  const repost = useRepost();
  const deleteRepost = useDeleteRepost();
  const createPost = useCreatePost();

  // Resolve handle to URI on mount
  React.useEffect(() => {
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

  // Extract root post
  const rootPost = threadNodeToFeedViewPost(thread);

  if (!rootPost) {
    return <ErrorState message="Invalid thread data" />;
  }

  // Extract replies
  const replies = extractReplies(thread);

  // Build parent URIs map for depth calculation in AI summary
  const buildParentUris = (node: any): Map<string, string> => {
    const map = new Map<string, string>();

    const traverse = (currentNode: any) => {
      if (!currentNode || !currentNode.replies || !Array.isArray(currentNode.replies)) {
        return;
      }

      for (const replyNode of currentNode.replies) {
        if (replyNode?.post?.uri && currentNode?.post?.uri) {
          map.set(replyNode.post.uri, currentNode.post.uri);
        }
        traverse(replyNode);
      }
    };

    traverse(node);
    return map;
  };

  const parentUris = buildParentUris(thread);

  const handleProfilePress = (pressedHandle: string) => {
    navigateToProfile(pressedHandle);
  };

  const handleMentionPress = (handle: string, did: string) => {
    navigateToProfile(handle);
  };

  const handleHashtagPress = (tag: string) => {
    router.push({ pathname: '/(tabs)/(search)', params: { q: '#' + tag } } as any);
  };

  const handleLike = (post: AppBskyFeedDefs.FeedViewPost) => {
    const { uri, cid, viewer } = post.post;

    if (viewer?.like) {
      triggerHaptic("light");
      unlikePost.mutate({ likeUri: viewer.like, postUri: uri });
    } else {
      triggerHaptic("light");
      likePost.mutate({ uri, cid });
    }
  };

  const handleRepost = (post: AppBskyFeedDefs.FeedViewPost) => {
    const postView = post.post;
    const { uri, cid, viewer } = postView;
    const record = postView.record as any;

    // If already reposted, just unrepost
    if (viewer?.repost) {
      triggerHaptic("medium");
      deleteRepost.mutate({ repostUri: viewer.repost, postUri: uri });
      return;
    }

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
            // Quote
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
            // Share
            handleShare(post);
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
            onPress: () => handleShare(post),
          },
        ],
        { cancelable: true }
      );
    }
  };

  const handleReply = (post: AppBskyFeedDefs.FeedViewPost) => {
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
  };

  const handleShare = (post: AppBskyFeedDefs.FeedViewPost) => {
    sharePost(post);
  };

  const handlePostReply = async () => {
    if (!replyText.trim()) {
      return;
    }

    try {
      // Get root post for reply reference
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
      refetch(); // Refresh thread to show new reply
      Alert.alert("Success", "Your reply has been posted!");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to post reply. Please try again.";
      Alert.alert("Error", errorMessage);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const handlePressLikeCount = (postUri: string) => {
    const encodedUri = encodeURIComponent(postUri);
    router.push(`/(app)/post/${encodedUri}/likes` as any);
  };

  const handlePressRepostCount = (postUri: string) => {
    const encodedUri = encodeURIComponent(postUri);
    router.push(`/(app)/post/${encodedUri}/reposts` as any);
  };

  const handlePressQuoteCount = (postUri: string) => {
    const encodedUri = encodeURIComponent(postUri);
    router.push(`/(app)/post/${encodedUri}/quotes` as any);
  };

  const isReplyDisabled = !replyText.trim() || replyText.length > MAX_REPLY_LENGTH;
  const replyCharCount = replyText.length;
  const isOverLimit = replyCharCount > MAX_REPLY_LENGTH;

  const handleNavigateToPost = (index: number) => {
    // Scroll to the post at the given index
    // For simplicity, scroll by estimated post height
    const estimatedPostHeight = 200; // Approximate height
    const yOffset = index * estimatedPostHeight;

    scrollViewRef.current?.scrollTo({
      y: yOffset,
      animated: true,
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Root Post */}
        <PostCard
          post={rootPost}
          onPressProfile={handleProfilePress}
          onLike={() => handleLike(rootPost)}
          onRepost={() => handleRepost(rootPost)}
          onReply={() => handleReply(rootPost)}
          onMentionPress={handleMentionPress}
          onHashtagPress={handleHashtagPress}
          onPressLikeCount={() => handlePressLikeCount(rootPost.post.uri)}
          onPressRepostCount={() => handlePressRepostCount(rootPost.post.uri)}
          onPressQuoteCount={() => handlePressQuoteCount(rootPost.post.uri)}
        />

        {/* AI Thread Summary */}
        {replies.length >= 5 && (
          <ThreadSummary
            posts={[rootPost, ...replies].map(p => p.post)}
            threadUri={rootPost.post.uri}
            parentUris={parentUris}
          />
        )}

        {/* Divider */}
        {replies.length > 0 && <View style={styles.divider} />}

        {/* Thread Tree View - Hierarchical with collapse/expand */}
        {replies.length > 0 ? (
          <ThreadTreeView
            rootPost={rootPost}
            replies={replies}
            onPressProfile={handleProfilePress}
            onLike={handleLike}
            onRepost={handleRepost}
            onReply={handleReply}
            onMentionPress={handleMentionPress}
            onHashtagPress={handleHashtagPress}
            onPressLikeCount={handlePressLikeCount}
            onPressRepostCount={handlePressRepostCount}
            onPressQuoteCount={handlePressQuoteCount}
          />
        ) : (
          /* No replies message */
          <View style={styles.noReplies}>
            <Text style={styles.noRepliesText}>No replies yet</Text>
          </View>
        )}
      </ScrollView>

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
            maxLength={MAX_REPLY_LENGTH + 50} // Allow typing a bit over to show error
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

      {/* Thread Navigator - Jump to reply navigation */}
      {replies.length > 3 && (
        <ThreadNavigator
          posts={[rootPost, ...replies]}
          onNavigate={handleNavigateToPost}
        />
      )}

      {/* Show reply button if composer is hidden */}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
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
