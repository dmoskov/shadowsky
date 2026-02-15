import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Alert,
  ActionSheetIOS,
  Platform,
} from "react-native";
import { AppBskyFeedDefs } from "@atproto/api";
import { useRouter } from "expo-router";
import { usePostThread } from "../../hooks/api/useFeed";
import { useLikePost, useUnlikePost, useRepost, useDeleteRepost } from "../../hooks/api/usePosts";
import { useAppNavigation } from "../../hooks/useNavigation";
import { ThreadSkeleton } from "../../components/ThreadSkeleton";
import { ErrorState } from "../../components/ErrorState";
import { getAtProtoClient } from "../../services/atproto/client";
import { colors } from "../../constants/theme";
import { sharePost } from "../../utils/share";
import { triggerHaptic } from "../../utils/haptics";
import { createLogger } from '../../utils/logger';
import { NativeThreadView } from '../../../modules/native-thread-view';
import { ThreadBridge } from '../../../modules/thread-bridge';

const logger = createLogger('ThreadScreenNative');

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

export function ThreadScreenNative({ handle, postId }: ThreadScreenProps) {
  const router = useRouter();
  const [postUri, setPostUri] = useState<string | null>(null);
  const [isResolvingUri, setIsResolvingUri] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  // Sync thread data to native module
  useEffect(() => {
    if (thread && AppBskyFeedDefs.isThreadViewPost(thread)) {
      ThreadBridge.setThreadData(thread);
    } else {
      ThreadBridge.clearThreadData();
    }

    return () => {
      // Clean up on unmount
      ThreadBridge.clearThreadData();
    };
  }, [thread]);

  // Update native module when like/repost changes
  useEffect(() => {
    // Listen for mutation success and update the bridge
    // This ensures the native view stays in sync
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const handlePostPress = (event: { nativeEvent: { uri: string; handle: string } }) => {
    const { uri, handle } = event.nativeEvent;
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

      // Update native view optimistically
      ThreadBridge.updatePost(uri, {
        likeCount: -1, // Decrement (native will handle relative update)
        viewer: { like: undefined },
      });
    } else {
      triggerHaptic("light");
      likePost.mutate({ uri, cid });

      // Update native view optimistically
      ThreadBridge.updatePost(uri, {
        likeCount: 1, // Increment
        viewer: { like: 'pending' },
      });
    }
  };

  const handleRepost = (event: { nativeEvent: { uri: string; cid: string; repostUri?: string } }) => {
    const { uri, cid, repostUri } = event.nativeEvent;

    // If already reposted, just unrepost
    if (repostUri) {
      triggerHaptic("medium");
      deleteRepost.mutate({ repostUri, postUri: uri });

      ThreadBridge.updatePost(uri, {
        repostCount: -1,
        viewer: { repost: undefined },
      });
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

            ThreadBridge.updatePost(uri, {
              repostCount: 1,
              viewer: { repost: 'pending' },
            });
          } else if (buttonIndex === 2) {
            // Quote - navigate to compose
            navigateToCompose({
              quoteTo: {
                uri,
                cid,
                author: { handle: '', displayName: '', avatar: '' }, // TODO: Get from post
                text: '',
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

              ThreadBridge.updatePost(uri, {
                repostCount: 1,
                viewer: { repost: 'pending' },
              });
            },
          },
          {
            text: 'Quote',
            onPress: () => {
              navigateToCompose({
                quoteTo: {
                  uri,
                  cid,
                  author: { handle: '', displayName: '', avatar: '' },
                  text: '',
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
    const { uri, cid, handle } = event.nativeEvent;

    navigateToCompose({
      replyTo: {
        uri,
        cid,
        author: {
          handle,
          displayName: '',
          avatar: '',
        },
        text: '',
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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  threadView: {
    flex: 1,
  },
});
