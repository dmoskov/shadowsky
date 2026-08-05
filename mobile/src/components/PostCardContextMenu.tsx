import {useMemo, useCallback} from 'react';
import {ContextMenuOnPressNativeEvent} from 'react-native-context-menu-view';

interface UseContextMenuActionsParams {
  postText: string;
  isLiked: boolean;
  isReposted: boolean;
  isBookmarked: boolean;
  isOwnPost: boolean;
  authorHandle: string;
  showTranslateButton: boolean;
  isShowingTranslation: boolean;
  hasQuotePost: boolean;
  /**
   * Whether the post is still inside its edit window. Expired edits are hidden
   * rather than shown disabled — a greyed-out row invites a tap that can never
   * succeed, and the window is short enough that it is normally already gone.
   */
  canEdit: boolean;
}

interface UseContextMenuHandlersParams {
  handleCopyText: () => void;
  onReply?: () => void;
  handleRepostPress: () => void;
  onQuotePost?: () => void;
  handleLikePress: () => void;
  handleBookmarkPress: () => void;
  handleShare: () => void;
  handleTranslate: () => void;
  handleEditPost: () => void;
  handleDeletePost: () => void;
  handleMuteUser: () => void;
  handleBlockUser: () => void;
  handleReport: () => void;
}

export function useContextMenuActions({
  postText,
  isLiked,
  isReposted,
  isBookmarked,
  isOwnPost,
  authorHandle,
  showTranslateButton,
  isShowingTranslation,
  hasQuotePost,
  canEdit,
}: UseContextMenuActionsParams) {
  return useMemo(() => {
    const actions: Array<{title: string; systemIcon?: string; destructive?: boolean}> = [];

    if (postText) {
      actions.push({title: 'Copy Text', systemIcon: 'doc.on.doc'});
    }

    actions.push(
      {title: 'Reply', systemIcon: 'arrowshape.turn.up.left'},
      {title: isReposted ? 'Undo Repost' : 'Repost', systemIcon: 'arrow.2.squarepath'},
    );

    if (hasQuotePost) {
      actions.push({title: 'Quote Post', systemIcon: 'quote.bubble'});
    }

    actions.push(
      {title: isLiked ? 'Unlike' : 'Like', systemIcon: isLiked ? 'heart.slash' : 'heart'},
      {
        title: isBookmarked ? 'Remove Bookmark' : 'Bookmark',
        systemIcon: isBookmarked ? 'bookmark.slash' : 'bookmark',
      },
      {title: 'Share', systemIcon: 'square.and.arrow.up'},
    );

    if (showTranslateButton) {
      actions.push({
        title: isShowingTranslation ? 'Show Original' : 'Translate',
        systemIcon: 'character.book.closed',
      });
    }

    if (isOwnPost) {
      if (canEdit) {
        actions.push({title: 'Edit Post', systemIcon: 'pencil'});
      }
      actions.push({title: 'Delete Post', systemIcon: 'trash', destructive: true});
    } else {
      actions.push(
        {title: `Mute @${authorHandle}`, systemIcon: 'speaker.slash'},
        {title: `Block @${authorHandle}`, systemIcon: 'hand.raised', destructive: true},
        {title: 'Report Post', systemIcon: 'exclamationmark.bubble', destructive: true},
      );
    }

    return actions;
  }, [isLiked, isReposted, isBookmarked, isOwnPost, authorHandle, postText, hasQuotePost, showTranslateButton, isShowingTranslation, canEdit]);
}

export function useContextMenuHandler({
  handleCopyText,
  onReply,
  handleRepostPress,
  onQuotePost,
  handleLikePress,
  handleBookmarkPress,
  handleShare,
  handleTranslate,
  handleEditPost,
  handleDeletePost,
  handleMuteUser,
  handleBlockUser,
  handleReport,
}: UseContextMenuHandlersParams) {
  return useCallback(
    (e: {nativeEvent: ContextMenuOnPressNativeEvent}) => {
      const {name} = e.nativeEvent;

      switch (name) {
        case 'Copy Text':
          handleCopyText();
          break;
        case 'Reply':
          onReply?.();
          break;
        case 'Repost':
        case 'Undo Repost':
          handleRepostPress();
          break;
        case 'Quote Post':
          onQuotePost?.();
          break;
        case 'Like':
        case 'Unlike':
          handleLikePress();
          break;
        case 'Bookmark':
        case 'Remove Bookmark':
          handleBookmarkPress();
          break;
        case 'Share':
          handleShare();
          break;
        case 'Translate':
        case 'Show Original':
          handleTranslate();
          break;
        case 'Edit Post':
          handleEditPost();
          break;
        case 'Delete Post':
          handleDeletePost();
          break;
        case 'Report Post':
          handleReport();
          break;
        default:
          if (name.startsWith('Mute')) handleMuteUser();
          else if (name.startsWith('Block')) handleBlockUser();
          break;
      }
    },
    [
      onReply,
      handleRepostPress,
      onQuotePost,
      handleLikePress,
      handleBookmarkPress,
      handleShare,
      handleTranslate,
      handleEditPost,
      handleDeletePost,
      handleMuteUser,
      handleBlockUser,
      handleReport,
      handleCopyText,
    ],
  );
}
