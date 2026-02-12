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
} from "react-native";
import { AppBskyFeedDefs } from "@atproto/api";
import { usePostThread } from "../../hooks/api/useFeed";
import { useLikePost, useUnlikePost, useRepost, useDeleteRepost, useCreatePost } from "../../hooks/api/usePosts";
import { useAppNavigation } from "../../hooks/useNavigation";
import { PostCard } from "../../components/PostCard";
import { LoadingState } from "../../components/LoadingState";
import { ErrorState } from "../../components/ErrorState";
import { getAtProtoClient } from "../../services/atproto/client";

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
  const [postUri, setPostUri] = useState<string | null>(null);
  const [isResolvingUri, setIsResolvingUri] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isReplyVisible, setIsReplyVisible] = useState(false);

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
        console.error("Failed to resolve post URI:", error);
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
    return <LoadingState message="Loading thread..." />;
  }

  if (resolveError) {
    return <ErrorState message={resolveError} onRetry={refetch} />;
  }

  if (isLoading) {
    return <LoadingState message="Loading thread..." />;
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

  const handleProfilePress = (pressedHandle: string) => {
    navigateToProfile(pressedHandle);
  };

  const handleMentionPress = (handle: string, did: string) => {
    navigateToProfile(handle);
  };

  const handleHashtagPress = (tag: string) => {
    // TODO: Navigate to search with hashtag query
    // For now, just log it
    console.log('Hashtag pressed:', tag);
  };

  const handleLike = (post: AppBskyFeedDefs.FeedViewPost) => {
    const { uri, cid, viewer } = post.post;

    if (viewer?.like) {
      unlikePost.mutate(viewer.like);
    } else {
      likePost.mutate({ uri, cid });
    }
  };

  const handleRepost = (post: AppBskyFeedDefs.FeedViewPost) => {
    const postView = post.post;
    const { uri, cid, viewer } = postView;
    const record = postView.record as any;

    // If already reposted, just unrepost
    if (viewer?.repost) {
      deleteRepost.mutate(viewer.repost);
      return;
    }

    // Show menu: Repost or Quote
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Repost', 'Quote'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            // Repost
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
            onPress: () => repost.mutate({ uri, cid }),
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

  const isReplyDisabled = !replyText.trim() || replyText.length > MAX_REPLY_LENGTH;
  const replyCharCount = replyText.length;
  const isOverLimit = replyCharCount > MAX_REPLY_LENGTH;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Root Post */}
        <PostCard
          post={rootPost}
          onPressProfile={handleProfilePress}
          onLike={() => handleLike(rootPost)}
          onRepost={() => handleRepost(rootPost)}
          onReply={() => handleReply(rootPost)}
          onMentionPress={handleMentionPress}
          onHashtagPress={handleHashtagPress}
        />

        {/* Divider */}
        {replies.length > 0 && <View style={styles.divider} />}

        {/* Replies */}
        {replies.map((reply, index) => (
          <View key={reply.post.uri} style={styles.replyContainer}>
            <PostCard
              post={reply}
              onPressProfile={handleProfilePress}
              onLike={() => handleLike(reply)}
              onRepost={() => handleRepost(reply)}
              onReply={() => handleReply(reply)}
              onMentionPress={handleMentionPress}
              onHashtagPress={handleHashtagPress}
            />
          </View>
        ))}

        {/* No replies message */}
        {replies.length === 0 && (
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
            placeholderTextColor="#6b7280"
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
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.replyButtonText}>Reply</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
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
    backgroundColor: "#0a0a0f",
  },
  scrollView: {
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: "#1f2937",
    marginVertical: 8,
  },
  replyContainer: {
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: "#374151",
  },
  noReplies: {
    padding: 24,
    alignItems: "center",
  },
  noRepliesText: {
    color: "#6b7280",
    fontSize: 14,
  },
  replyComposer: {
    backgroundColor: "#1a1a1f",
    borderTopWidth: 1,
    borderTopColor: "#1f2937",
    padding: 16,
  },
  replyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  replyLabel: {
    color: "#9ca3af",
    fontSize: 14,
  },
  cancelButton: {
    color: "#3b82f6",
    fontSize: 14,
    fontWeight: "600",
  },
  replyInput: {
    color: "#ffffff",
    fontSize: 16,
    minHeight: 80,
    maxHeight: 160,
    padding: 12,
    backgroundColor: "#0a0a0f",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#374151",
    textAlignVertical: "top",
  },
  replyFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  charCount: {
    color: "#6b7280",
    fontSize: 13,
  },
  charCountOver: {
    color: "#ef4444",
  },
  replyButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 80,
    alignItems: "center",
  },
  replyButtonDisabled: {
    backgroundColor: "#1e3a5f",
    opacity: 0.5,
  },
  replyButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  floatingReplyButton: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: "#3b82f6",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  floatingReplyButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
