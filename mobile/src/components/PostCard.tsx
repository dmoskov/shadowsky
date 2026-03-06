import React, {useMemo} from 'react';
import {StyleSheet, TouchableOpacity} from 'react-native';
import ContextMenu from 'react-native-context-menu-view';
import {PostCardContent} from './PostCardContent';
import {useContextMenuActions, useContextMenuHandler} from './PostCardContextMenu';
import {ContentLabelWarning} from './ContentLabelWarning';
import {ReportModal} from './ReportModal';
import {AppealLabelModal} from './AppealLabelModal';
import {SaveToCollectionModal} from './SaveToCollectionModal';
import {usePostCardState, type PostCardProps} from '../hooks/usePostCardState';

export type {PostCardProps};

function PostCardComponent(props: PostCardProps) {
  const state = usePostCardState(props);
  const {
    colors,
    isOnline,
    postView,
    author,
    record,
    postText,
    timestamp,
    cardRef,
    isLiked,
    isReposted,
    isOwnPost,
    isBookmarked,
    hideContent,
    warnContent,
    blurImages,
    labels,
    showReportModal,
    showSaveToCollection,
    appealLabel,
    handleCloseReportModal,
    handleCloseSaveToCollection,
    handleAppeal,
    handleCloseAppeal,
    likeAnimStyle,
    repostAnimStyle,
    bookmarkAnimStyle,
    translation,
    handleProfilePress,
    handleMorePress,
    handleLikePress,
    handleRepostPress,
    handleBookmarkPress,
    handleBookmarkLongPress,
    handleShare,
    handleBlockAfterReport,
    handleMuteAfterReport,
    handleCopyText,
    handleCardPress,
    accessibilityLabel,
    getContentWarningText,
  } = state;

  const styles = useMemo(() => createStyles(colors), [colors]);

  const contextMenuActions = useContextMenuActions({
    postText,
    isLiked,
    isReposted,
    isBookmarked,
    isOwnPost,
    authorHandle: author.handle,
    showTranslateButton: translation.showTranslateButton,
    isShowingTranslation: translation.isShowingTranslation,
    hasQuotePost: !!props.onQuotePost,
  });

  const handleContextMenuAction = useContextMenuHandler({
    handleCopyText,
    onReply: props.onReply,
    handleRepostPress,
    onQuotePost: props.onQuotePost,
    handleLikePress,
    handleBookmarkPress,
    handleShare,
    handleTranslate: translation.handleTranslate,
    handleDeletePost: state.handleDeletePost,
    handleMuteUser: state.handleMuteUser,
    handleBlockUser: state.handleBlockUser,
    handleReport: state.handleReport,
  });

  if (hideContent) {
    return null;
  }

  const postContent = (
    <PostCardContent
      post={props.post}
      postView={postView}
      author={author}
      record={record}
      timestamp={timestamp}
      colors={colors}
      isOnline={isOnline}
      isOwnPost={isOwnPost}
      isLiked={isLiked}
      isBookmarked={isBookmarked}
      isVisible={props.isVisible ?? false}
      blurImages={blurImages}
      labels={labels}
      hideContent={hideContent}
      likeAnimStyle={likeAnimStyle}
      repostAnimStyle={repostAnimStyle}
      bookmarkAnimStyle={bookmarkAnimStyle}
      translation={translation}
      handleProfilePress={handleProfilePress}
      handleMorePress={handleMorePress}
      handleLikePress={handleLikePress}
      handleRepostPress={handleRepostPress}
      handleBookmarkPress={handleBookmarkPress}
      handleBookmarkLongPress={handleBookmarkLongPress}
      handleShare={handleShare}
      onReply={props.onReply}
      onMentionPress={props.onMentionPress}
      onHashtagPress={props.onHashtagPress}
      onImagePress={props.onImagePress}
      onLinkPress={props.onLinkPress}
      onQuotePress={props.onQuotePress}
      onPressProfile={props.onPressProfile}
      onPressLikeCount={props.onPressLikeCount}
      onPressRepostCount={props.onPressRepostCount}
    />
  );

  return (
    <ContextMenu
      actions={contextMenuActions}
      onPress={handleContextMenuAction}
      onPreviewPress={handleCardPress}>
      <TouchableOpacity
        ref={cardRef}
        style={styles.container}
        onPress={handleCardPress}
        activeOpacity={0.9}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Double tap to view full post. Long press for more options">
        {warnContent ? (
          <ContentLabelWarning
            labels={labels}
            warningText={getContentWarningText(labels)}
            blurImages={blurImages}
            onAppeal={handleAppeal}>
            {postContent}
          </ContentLabelWarning>
        ) : (
          postContent
        )}

        {/* Appeal Label Modal */}
        {appealLabel && (
          <AppealLabelModal
            visible={!!appealLabel}
            onClose={handleCloseAppeal}
            subjectUri={postView.uri}
            subjectCid={postView.cid}
            labelerDid={appealLabel.src}
            labelVal={appealLabel.val}
          />
        )}

        {/* Report Modal */}
        <ReportModal
          visible={showReportModal}
          onClose={handleCloseReportModal}
          reportType="post"
          subjectUri={postView.uri}
          subjectCid={postView.cid}
          subjectDid={author.did}
          subjectHandle={author.handle}
          subjectDisplayName={author.displayName}
          subjectText={postText}
          onBlock={handleBlockAfterReport}
          onMute={handleMuteAfterReport}
        />

        {/* Save to Collection Modal */}
        <SaveToCollectionModal
          visible={showSaveToCollection}
          postUri={postView.uri}
          onClose={handleCloseSaveToCollection}
        />
      </TouchableOpacity>
    </ContextMenu>
  );
}

// Custom comparison function for React.memo
function arePropsEqual(prevProps: PostCardProps, nextProps: PostCardProps): boolean {
  if (prevProps.post.post.uri !== nextProps.post.post.uri) {
    return false;
  }

  if (
    prevProps.post.post.likeCount !== nextProps.post.post.likeCount ||
    prevProps.post.post.repostCount !== nextProps.post.post.repostCount ||
    prevProps.post.post.replyCount !== nextProps.post.post.replyCount ||
    prevProps.post.post.viewer?.like !== nextProps.post.post.viewer?.like ||
    prevProps.post.post.viewer?.repost !== nextProps.post.post.viewer?.repost
  ) {
    return false;
  }

  if (prevProps.isVisible !== nextProps.isVisible) {
    return false;
  }

  if (prevProps.isBookmarked !== nextProps.isBookmarked) {
    return false;
  }

  if (prevProps.currentUserDid !== nextProps.currentUserDid) {
    return false;
  }

  const prevLabels = prevProps.post.post.labels || [];
  const nextLabels = nextProps.post.post.labels || [];
  if (prevLabels.length !== nextLabels.length) {
    return false;
  }

  return true;
}

export const PostCard = React.memo(PostCardComponent, arePropsEqual);

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.cardBackground,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
  });
}
