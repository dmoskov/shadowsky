import {Stack, useLocalSearchParams, useRouter} from 'expo-router';
import {QuotesScreen} from '../../../../src/screens/shared/QuotesScreen';
import {ErrorState} from '../../../../src/components/ErrorState';
import {useLikePost, useUnlikePost, useRepost, useDeleteRepost} from '../../../../src/hooks/api/usePosts';
import {useAuth} from '../../../../src/contexts/AuthContext';
import {useBookmarks} from '../../../../src/hooks/api/useBookmarks';
import {AppBskyFeedDefs} from '@atproto/api';
import {triggerHaptic} from '../../../../src/utils/haptics';
import {Platform, ActionSheetIOS, Alert} from 'react-native';

export default function PostQuotesRoute() {
  const {uri} = useLocalSearchParams<{uri: string}>();
  const router = useRouter();
  const {account} = useAuth();
  const {isBookmarked, addBookmark, removeBookmark} = useBookmarks();

  const likePostMutation = useLikePost();
  const unlikePostMutation = useUnlikePost();
  const repostMutation = useRepost();
  const deleteRepostMutation = useDeleteRepost();

  if (!uri) {
    return <ErrorState message="Missing post URI parameter" />;
  }

  // Decode the URI since it comes URL-encoded from the router
  const decodedUri = decodeURIComponent(uri);

  const handleNavigateToProfile = (handle: string) => {
    router.push(`/(app)/(tabs)/(home)/profile/${handle}`);
  };

  const handleNavigateToPost = (postUri: string, handle: string) => {
    // Extract post ID from URI (last part after the last /)
    const postId = postUri.split('/').pop();
    if (postId) {
      router.push({
        pathname: '/(app)/(tabs)/(home)/thread/[postId]',
        params: {postId, handle},
      });
    }
  };

  const handleLike = (postUri: string, cid: string, isLiked: boolean, likeUri?: string) => {
    if (isLiked && likeUri) {
      triggerHaptic('light');
      unlikePostMutation.mutate({likeUri, postUri});
    } else {
      triggerHaptic('light');
      likePostMutation.mutate({uri: postUri, cid});
    }
  };

  const handleRepost = (postUri: string, cid: string, isReposted: boolean, repostUri?: string) => {
    if (isReposted && repostUri) {
      triggerHaptic('medium');
      deleteRepostMutation.mutate({repostUri, postUri});
      return;
    }

    // Show repost menu
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Repost', 'Quote'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            triggerHaptic('medium');
            repostMutation.mutate({uri: postUri, cid});
          } else if (buttonIndex === 2) {
            router.push({
              pathname: '/(app)/(tabs)/(home)/compose',
              params: {quoteUri: postUri, quoteCid: cid},
            });
          }
        }
      );
    } else {
      Alert.alert('Repost', 'Choose an action', [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Repost',
          onPress: () => {
            triggerHaptic('medium');
            repostMutation.mutate({uri: postUri, cid});
          },
        },
        {
          text: 'Quote',
          onPress: () => {
            router.push({
              pathname: '/(app)/(tabs)/(home)/compose',
              params: {quoteUri: postUri, quoteCid: cid},
            });
          },
        },
      ]);
    }
  };

  const handleReply = (post: AppBskyFeedDefs.PostView) => {
    router.push({
      pathname: '/(app)/(tabs)/(home)/compose',
      params: {
        replyToUri: post.uri,
        replyToCid: post.cid,
        replyToHandle: post.author.handle,
      },
    });
  };

  const handleBookmark = (postUri: string, cid: string) => {
    if (isBookmarked(postUri)) {
      removeBookmark(postUri);
    } else {
      addBookmark(postUri, cid);
    }
  };

  const handleMentionPress = (handle: string, did: string) => {
    handleNavigateToProfile(handle);
  };

  const handleHashtagPress = (tag: string) => {
    router.push({
      pathname: '/(app)/(tabs)/(search)',
      params: {q: '#' + tag},
    });
  };

  const handleLinkPress = (url: string) => {
    // Handle external links - you might want to open in browser
    console.log('Link pressed:', url);
  };

  const handleQuotePress = (quoteUri: string, handle: string) => {
    handleNavigateToPost(quoteUri, handle);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Quotes',
          headerShown: true,
        }}
      />
      <QuotesScreen
        postUri={decodedUri}
        onPressProfile={handleNavigateToProfile}
        onPressPost={handleNavigateToPost}
        onLike={handleLike}
        onRepost={handleRepost}
        onReply={handleReply}
        onBookmark={handleBookmark}
        isBookmarked={isBookmarked}
        onMentionPress={handleMentionPress}
        onHashtagPress={handleHashtagPress}
        onLinkPress={handleLinkPress}
        onQuotePress={handleQuotePress}
        currentUserDid={account?.did}
      />
    </>
  );
}
