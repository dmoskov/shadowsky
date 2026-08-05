import {useState, useCallback, useEffect, useMemo, useRef} from 'react';
import {Alert, Platform} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
  SharedValue,
} from 'react-native-reanimated';
import {AppBskyFeedDefs, AppBskyFeedPost} from '@atproto/api';
import {formatDistanceToNow} from '../i18n/format-date';
import {useNetwork} from '../contexts/NetworkContext';
import {sharePost} from '../utils/share';
import {useBlockUser, useMuteUser} from './api/useProfile';
import {useDeletePost} from './api/usePosts';
import {recordBlock, recordMute} from '../services/moderation-history';
import {canEditPost, isEdited} from '../services/atproto/post-edit';
import {useTheme} from '../contexts/ThemeContext';
import {triggerHaptic} from '../utils/haptics';
import {useModeration} from '../contexts/ModerationContext';
import {usePostTranslation} from './usePostTranslation';
import {useSharedTransition} from '../contexts/SharedTransitionContext';
import {useToast} from '../contexts/ToastContext';

export interface PostCardProps {
  post: AppBskyFeedDefs.FeedViewPost;
  isVisible?: boolean;
  onPress?: () => void;
  onPressProfile?: (handle: string) => void;
  onLike?: () => void;
  onRepost?: () => void;
  onReply?: () => void;
  onBookmark?: () => void;
  isBookmarked?: boolean;
  onMentionPress?: (handle: string, did: string) => void;
  onHashtagPress?: (tag: string) => void;
  onImagePress?: (images: Array<{thumb: string; fullsize: string; alt?: string}>, index: number) => void;
  onLinkPress?: (url: string) => void;
  onQuotePress?: (uri: string, handle: string) => void;
  onBlock?: (did: string) => void;
  onMute?: (did: string) => void;
  onReport?: (uri: string, cid: string) => void;
  currentUserDid?: string;
  onPressLikeCount?: () => void;
  onPressRepostCount?: () => void;
  onPressQuoteCount?: () => void;
  onQuotePost?: () => void;
}

function triggerBounce(scale: SharedValue<number>) {
  scale.value = withSequence(
    withSpring(0.7, {damping: 20, stiffness: 400, mass: 0.5}),
    withSpring(1, {damping: 12, stiffness: 200, mass: 0.8}),
  );
}

export function usePostCardState(props: PostCardProps) {
  const {
    post,
    onLike,
    onRepost,
    onReply,
    onBookmark,
    isBookmarked = false,
    onPress,
    onPressProfile,
    currentUserDid,
    onQuotePost,
  } = props;

  const {colors} = useTheme();
  const {isOnline} = useNetwork();
  const {showToast} = useToast();
  const {prepareTransition} = useSharedTransition();
  const cardRef = useRef<any>(null);

  // Micro-animation shared values
  const likeScale = useSharedValue(1);
  const repostScale = useSharedValue(1);
  const bookmarkScale = useSharedValue(1);

  const likeAnimStyle = useAnimatedStyle(() => ({
    transform: [{scale: likeScale.value}],
  }));
  const repostAnimStyle = useAnimatedStyle(() => ({
    transform: [{scale: repostScale.value}],
  }));
  const bookmarkAnimStyle = useAnimatedStyle(() => ({
    transform: [{scale: bookmarkScale.value}],
  }));

  const postView = post.post;
  const author = postView.author;

  // Modal state
  const [showReportModal, setShowReportModal] = useState(false);
  const [showSaveToCollection, setShowSaveToCollection] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [appealLabel, setAppealLabel] = useState<{val: string; src: string} | null>(null);

  const handleCloseReportModal = useCallback(() => setShowReportModal(false), []);
  const handleCloseSaveToCollection = useCallback(() => setShowSaveToCollection(false), []);
  const handleCloseEditModal = useCallback(() => setShowEditModal(false), []);
  const handleEditPost = useCallback(() => setShowEditModal(true), []);
  const handleAppeal = useCallback((labelVal: string, labelerDid: string) => {
    setAppealLabel({val: labelVal, src: labelerDid});
  }, []);
  const handleCloseAppeal = useCallback(() => setAppealLabel(null), []);

  // Mutations
  const blockMutation = useBlockUser();
  const muteMutation = useMuteUser();
  const deleteMutation = useDeletePost();

  // Moderation
  const {
    shouldHideContent,
    shouldWarnContent,
    shouldBlurImages,
    getContentWarningText,
  } = useModeration();

  // Record type guard
  const record = useMemo(
    (): AppBskyFeedPost.Record | undefined =>
      AppBskyFeedPost.isRecord(postView.record)
        ? (postView.record as AppBskyFeedPost.Record)
        : undefined,
    [postView.record],
  );

  const isLiked = useMemo(() => !!postView.viewer?.like, [postView.viewer?.like]);
  const isReposted = useMemo(() => !!postView.viewer?.repost, [postView.viewer?.repost]);
  const isOwnPost = useMemo(() => currentUserDid === author.did, [currentUserDid, author.did]);

  const postText = useMemo(
    () => (record && typeof record.text === 'string' ? record.text : ''),
    [record],
  );

  const postWasEdited = useMemo(() => isEdited(postView.record), [postView.record]);

  // Edit eligibility. The window closes with wall-clock time, so a row that is
  // editable when it mounts stops being editable while still on screen. Rather
  // than polling every post every second, schedule a single re-render at the
  // moment the window lapses — for the vast majority of rows (older than 15
  // minutes) no timer is created at all.
  const [editWindowLapsed, setEditWindowLapsed] = useState(0);
  const editEligibility = useMemo(
    () => canEditPost({post: postView, viewerDid: currentUserDid}),
    // editWindowLapsed is the tick that re-evaluates the window on expiry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [postView, currentUserDid, editWindowLapsed],
  );
  const canEdit = editEligibility.allowed;

  useEffect(() => {
    if (!editEligibility.allowed) return;
    const timer = setTimeout(
      () => setEditWindowLapsed((tick) => tick + 1),
      // Small cushion so the recheck lands after the boundary, not exactly on it.
      editEligibility.remainingMs + 250,
    );
    return () => clearTimeout(timer);
  }, [editEligibility.allowed, editEligibility.remainingMs]);

  // Handlers
  const handleProfilePress = useCallback(() => {
    if (onPressProfile) {
      onPressProfile(author.handle);
    }
  }, [onPressProfile, author.handle]);

  const handleMuteUser = useCallback(() => {
    Alert.alert(
      'Mute User',
      `Are you sure you want to mute @${author.handle}? You won't see their posts in your timeline.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Mute',
          style: 'destructive',
          onPress: async () => {
            try {
              await muteMutation.mutateAsync(author.did);
              recordMute({
                subjectDid: author.did,
                subjectHandle: author.handle,
                subjectDisplayName: author.displayName,
              });
              showToast('User muted', {type: 'success'});
            } catch (error) {
              Alert.alert('Error', 'Failed to mute user. Please try again.');
            }
          },
        },
      ],
    );
  }, [author.handle, author.did, author.displayName, muteMutation, showToast]);

  const handleBlockUser = useCallback(() => {
    Alert.alert(
      'Block User',
      `Are you sure you want to block @${author.handle}? They won't be able to follow you or view your posts.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockMutation.mutateAsync(author.did);
              recordBlock({
                id: `block_${author.did}_${Date.now()}`,
                subjectDid: author.did,
                subjectHandle: author.handle,
                subjectDisplayName: author.displayName,
              });
              showToast('User blocked', {type: 'success'});
            } catch (error) {
              Alert.alert('Error', 'Failed to block user. Please try again.');
            }
          },
        },
      ],
    );
  }, [author.handle, author.did, author.displayName, blockMutation, showToast]);

  const handleReport = useCallback(() => {
    setShowReportModal(true);
  }, []);

  const handleDeletePost = useCallback(() => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync(postView.uri);
              showToast('Post deleted', {type: 'success'});
            } catch {
              Alert.alert('Error', 'Failed to delete post. Please try again.');
            }
          },
        },
      ],
    );
  }, [postView.uri, deleteMutation, showToast]);

  const handleBlockAfterReport = useCallback(
    async (did: string) => {
      try {
        await blockMutation.mutateAsync(did);
        recordBlock({
          id: `block_${did}_${Date.now()}`,
          subjectDid: did,
          subjectHandle: author.handle,
          subjectDisplayName: author.displayName,
        });
        showToast('User blocked', {type: 'success'});
      } catch (error) {
        Alert.alert('Error', 'Failed to block user. Please try again.');
      }
    },
    [blockMutation, author.handle, author.displayName, showToast],
  );

  const handleMuteAfterReport = useCallback(
    async (did: string) => {
      try {
        await muteMutation.mutateAsync(did);
        recordMute({
          subjectDid: did,
          subjectHandle: author.handle,
          subjectDisplayName: author.displayName,
        });
        showToast('User muted', {type: 'success'});
      } catch (error) {
        Alert.alert('Error', 'Failed to mute user. Please try again.');
      }
    },
    [muteMutation, author.handle, author.displayName, showToast],
  );

  const handleShare = useCallback(() => {
    sharePost(post);
  }, [post]);

  const handleLikePress = useCallback(() => {
    triggerHaptic('light');
    triggerBounce(likeScale);
    onLike?.();
  }, [onLike]);

  const handleRepostPress = useCallback(() => {
    triggerHaptic('medium');
    triggerBounce(repostScale);
    onRepost?.();
  }, [onRepost]);

  const handleBookmarkPress = useCallback(() => {
    triggerHaptic('light');
    triggerBounce(bookmarkScale);
    onBookmark?.();
  }, [onBookmark]);

  const handleBookmarkLongPress = useCallback(() => {
    triggerHaptic('medium');
    if (!isBookmarked && onBookmark) {
      onBookmark();
    }
    setShowSaveToCollection(true);
  }, [isBookmarked, onBookmark]);

  const handleCopyText = useCallback(() => {
    if (postText) {
      try {
        Clipboard.setStringAsync(postText);
        showToast('Text copied', {type: 'success'});
      } catch {
        showToast('Failed to copy text', {type: 'error'});
      }
    }
  }, [postText, showToast]);

  // Computed values
  const timestamp = useMemo(
    () => formatDistanceToNow(new Date(postView.indexedAt), {addSuffix: true}),
    [postView.indexedAt],
  );

  // Translation
  const postLangs = useMemo(
    () => (record && Array.isArray(record.langs) ? (record.langs as string[]) : undefined),
    [record],
  );
  const translation = usePostTranslation({
    postUri: postView.uri,
    postText,
    postLangs,
  });

  const handleMorePress = useCallback(() => {
    if (Platform.OS !== 'ios') return;
    triggerHaptic('light');

    const options: string[] = ['Cancel'];
    const handlers: Array<() => void> = [];
    const destructiveIndices: number[] = [];

    if (postText) {
      options.push('Copy Text');
      handlers.push(handleCopyText);
    }

    options.push('Reply');
    handlers.push(() => onReply?.());

    options.push(isReposted ? 'Undo Repost' : 'Repost');
    handlers.push(handleRepostPress);

    if (onQuotePost) {
      options.push('Quote Post');
      handlers.push(onQuotePost);
    }

    options.push(isLiked ? 'Unlike' : 'Like');
    handlers.push(handleLikePress);

    options.push(isBookmarked ? 'Remove Bookmark' : 'Bookmark');
    handlers.push(handleBookmarkPress);

    options.push('Share');
    handlers.push(handleShare);

    if (translation.showTranslateButton) {
      options.push(translation.isShowingTranslation ? 'Show Original' : 'Translate');
      handlers.push(translation.handleTranslate);
    }

    if (isOwnPost) {
      if (canEdit) {
        options.push('Edit Post');
        handlers.push(handleEditPost);
      }

      options.push('Delete Post');
      destructiveIndices.push(options.length - 1);
      handlers.push(handleDeletePost);
    } else {
      options.push(`Mute @${author.handle}`);
      handlers.push(handleMuteUser);

      options.push(`Block @${author.handle}`);
      destructiveIndices.push(options.length - 1);
      handlers.push(handleBlockUser);

      options.push('Report Post');
      destructiveIndices.push(options.length - 1);
      handlers.push(handleReport);
    }

    const {ActionSheetIOS} = require('react-native');
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: 0,
        destructiveButtonIndex: destructiveIndices,
      },
      (buttonIndex: number) => {
        if (buttonIndex > 0 && buttonIndex <= handlers.length) {
          handlers[buttonIndex - 1]();
        }
      },
    );
  }, [isOwnPost, isReposted, isLiked, isBookmarked, postText, translation.showTranslateButton, translation.isShowingTranslation, author.handle, canEdit, handleEditPost, handleDeletePost, handleMuteUser, handleBlockUser, handleReport, handleCopyText, onReply, handleRepostPress, onQuotePost, handleLikePress, handleBookmarkPress, handleShare, translation.handleTranslate]);

  // Accessibility
  const postPreviewText = useMemo(
    () => (postText ? `${postText.substring(0, 100)}${postText.length > 100 ? '...' : ''}` : 'No text content'),
    [postText],
  );

  const accessibilityLabel = useMemo(
    () =>
      `Post by ${author.displayName || author.handle}. ${postPreviewText}. ${postView.likeCount || 0} likes, ${postView.repostCount || 0} reposts, ${postView.replyCount || 0} replies. Posted ${timestamp}`,
    [author.displayName, author.handle, postPreviewText, postView.likeCount, postView.repostCount, postView.replyCount, timestamp],
  );

  // Content moderation
  const labels = useMemo(() => postView.labels || [], [postView.labels]);
  const hideContent = useMemo(() => shouldHideContent(labels), [shouldHideContent, labels]);
  const warnContent = useMemo(() => shouldWarnContent(labels), [shouldWarnContent, labels]);
  const blurImages = useMemo(() => shouldBlurImages(labels), [shouldBlurImages, labels]);

  // Extract first image thumbnail for transition preview
  const firstImageThumb = useMemo(() => {
    const embed = postView.embed;
    if (!embed) return undefined;
    if ('images' in embed && Array.isArray(embed.images) && embed.images.length > 0) {
      return (embed.images[0] as any)?.thumb as string | undefined;
    }
    return undefined;
  }, [postView.embed]);

  // Handle press with shared element transition measurement
  const handleCardPress = useCallback(() => {
    if (!onPress) return;
    if (cardRef.current) {
      (cardRef.current as any).measureInWindow?.(
        (x: number, y: number, width: number, height: number) => {
          if (width > 0 && height > 0) {
            prepareTransition(
              {x, y, width, height},
              {
                uri: postView.uri,
                authorAvatar: author.avatar,
                authorName: author.displayName || undefined,
                authorHandle: author.handle,
                text: postText || undefined,
                imageThumb: firstImageThumb,
              },
            );
          }
          onPress();
        },
      );
    } else {
      onPress();
    }
  }, [onPress, prepareTransition, postView.uri, author.avatar, author.displayName, author.handle, postText, firstImageThumb]);

  return {
    // Core data
    colors,
    isOnline,
    postView,
    author,
    record,
    postText,
    timestamp,
    cardRef,

    // State flags
    isLiked,
    isReposted,
    isOwnPost,
    isBookmarked,
    canEdit,
    postWasEdited,
    hideContent,
    warnContent,
    blurImages,
    labels,

    // Modal state
    showReportModal,
    showSaveToCollection,
    showEditModal,
    appealLabel,
    handleCloseReportModal,
    handleCloseSaveToCollection,
    handleCloseEditModal,
    handleAppeal,
    handleCloseAppeal,

    // Animation styles
    likeAnimStyle,
    repostAnimStyle,
    bookmarkAnimStyle,

    // Translation
    translation,

    // Handlers
    handleProfilePress,
    handleMuteUser,
    handleBlockUser,
    handleReport,
    handleEditPost,
    handleDeletePost,
    handleBlockAfterReport,
    handleMuteAfterReport,
    handleShare,
    handleLikePress,
    handleRepostPress,
    handleBookmarkPress,
    handleBookmarkLongPress,
    handleCopyText,
    handleMorePress,
    handleCardPress,

    // Accessibility
    accessibilityLabel,

    // Content warning
    getContentWarningText,
  };
}
