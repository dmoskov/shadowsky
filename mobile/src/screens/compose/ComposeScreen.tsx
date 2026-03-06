import React, { useMemo } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "../../components/Avatar";
import { EmojiPickerModal } from "../../components/EmojiPickerModal";
import { GifPicker } from "../../components/GifPicker";
import { ImageEditor } from "../../components/ImageEditor";
import { LanguagePicker } from "../../components/LanguagePicker";
import { LinkPreviewCard } from "../../components/LinkPreviewCard";
import { MentionSuggestions } from "../../components/MentionSuggestions";
import { ThreadComposer } from "../../components/ThreadComposer";
import { useTheme } from "../../contexts/ThemeContext";
import {
  AltTextModal,
  ComposeAIPanel,
  ComposeMediaPreview,
  ComposeQuotePreview,
  ComposeToolbar,
  TonePickerModal,
} from "./components";
import {
  useComposeAI,
  useComposeDraft,
  useComposeFacets,
  useComposeMedia,
} from "./hooks";
import {fontSize} from '../../utils/typography';

// Types are canonical in ComposeTypes.ts — re-export for backward compatibility
export type { ReplyToPost, QuoteToPost, ComposeScreenProps } from "./ComposeTypes";
import type { ComposeScreenProps } from "./ComposeTypes";

export function ComposeScreen(props: ComposeScreenProps = {}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // Core draft/thread state machine
  const draft = useComposeDraft(props);

  // Media handling (images, video, GIF, emoji)
  const media = useComposeMedia({
    imagePicker: draft.imagePicker,
    videoPicker: draft.videoPicker,
    gifPicker: draft.gifPicker,
    preferences: draft.preferences,
    setText: draft.setText,
  });

  // Mention/link detection
  const facets = useComposeFacets(draft.text, draft.setText);

  // AI features (panel, hashtags, feedback, style, tone)
  const ai = useComposeAI({
    text: draft.text,
    setText: draft.setText,
    setThreadPosts: draft.setThreadPosts,
    setIsThreadMode: draft.setIsThreadMode,
    clearImages: draft.imagePicker.clearImages,
    showToast: draft.showToast,
  });

  const placeholderText = draft.replyTo
    ? "Post your reply"
    : draft.quoteTo
      ? "Add your thoughts"
      : "What's happening?";

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={draft.handleClose}
          style={styles.cancelTouchable}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.cancelButton}>Cancel</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          {!draft.isThreadMode && (
            <TouchableOpacity
              onPress={() => draft.router.push("/(app)/drafts")}
              style={styles.draftsButton}
            >
              <Text style={styles.draftsButtonText}>Drafts</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[
            styles.postButton,
            (draft.isPostDisabled || draft.createPost.isPending) &&
              styles.postButtonDisabled,
          ]}
          onPress={draft.handlePost}
          disabled={draft.isPostDisabled || draft.createPost.isPending}
        >
          {draft.createPost.isPending ||
          draft.imagePicker.isUploading ||
          draft.videoPicker.isUploading ||
          draft.videoCompression.isCompressing ? (
            <ActivityIndicator color={colors.text} size="small" />
          ) : (
            <Text style={styles.postButtonText}>Post</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Reply Context */}
      {draft.replyTo && (
        <View style={styles.replyContext}>
          <View style={styles.replyHeader}>
            <TouchableOpacity
              onPress={() =>
                draft.router.push(
                  `/(app)/(tabs)/(home)/profile/${draft.replyTo!.author.handle}`,
                )
              }
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              accessibilityRole="link"
              accessibilityLabel={`View profile of ${draft.replyTo.author.displayName || draft.replyTo.author.handle}`}
            >
              <Text style={styles.replyingTo}>
                Replying to{" "}
                <Text style={styles.replyingToHandle}>
                  @{draft.replyTo.author.handle}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.parentPost}>
            <Avatar uri={draft.replyTo.author.avatar} size={36} />
            <View style={styles.parentPostContent}>
              <View style={styles.parentPostHeader}>
                <Text style={styles.parentPostAuthor} numberOfLines={1}>
                  {draft.replyTo.author.displayName ||
                    draft.replyTo.author.handle}
                </Text>
                <Text style={styles.parentPostHandle} numberOfLines={1}>
                  @{draft.replyTo.author.handle}
                </Text>
              </View>
              <Text style={styles.parentPostText} numberOfLines={2}>
                {draft.replyTo.text}
              </Text>
            </View>
          </View>
        </View>
      )}

      {draft.isThreadMode ? (
        <ThreadComposer
          posts={draft.threadPosts}
          onUpdatePost={draft.handleUpdateThreadPost}
          onAddPost={draft.handleAddThreadPost}
          onRemovePost={draft.handleRemoveThreadPost}
          onImagePicker={draft.handleThreadImagePicker}
          isUploading={draft.imagePicker.isUploading}
        />
      ) : (
        <>
          <TextInput
            style={styles.input}
            placeholder={placeholderText}
            placeholderTextColor={colors.textTertiary}
            multiline
            autoFocus
            value={draft.text}
            onChangeText={facets.handleTextChange}
            editable={
              !draft.createPost.isPending && !draft.imagePicker.isUploading
            }
          />

          {/* Link Preview */}
          {draft.linkPreview.metadata && !draft.gifPicker.selectedGif && (
            <LinkPreviewCard
              metadata={draft.linkPreview.metadata}
              onDismiss={draft.linkPreview.clearPreview}
            />
          )}

          {/* Media Previews */}
          <ComposeMediaPreview
            selectedImages={draft.imagePicker.selectedImages}
            onRemoveImage={media.handleRemoveImage}
            onAddAltText={media.handleAddAltText}
            isImageUploading={draft.imagePicker.isUploading}
            selectedVideo={draft.videoPicker.selectedVideo}
            onRemoveVideo={media.handleRemoveVideo}
            formatVideoDuration={draft.videoPicker.formatDuration}
            isVideoUploading={draft.videoPicker.isUploading}
            selectedGif={draft.gifPicker.selectedGif}
            onRemoveGif={media.handleRemoveGif}
            compressionState={draft.videoCompression.state}
            compressionStatusMessage={draft.videoCompression.getStatusMessage()}
            onCancelCompression={draft.videoCompression.cancel}
          />

          {/* Quote Preview */}
          {draft.quoteTo && <ComposeQuotePreview quoteTo={draft.quoteTo} />}
        </>
      )}

      {/* Mention Suggestions */}
      {facets.mentionQuery.length >= 2 && (
        <MentionSuggestions
          suggestions={facets.searchResults}
          onSelectMention={facets.handleSelectMention}
          isLoading={facets.isSearching}
        />
      )}

      <ComposeToolbar
        onImagePicker={media.handleImagePicker}
        onVideoPicker={media.handleVideoPicker}
        onGifPicker={media.handleGifPicker}
        onEmojiPicker={media.handleEmojiPicker}
        onToggleThreadMode={draft.handleToggleThreadMode}
        onLanguagePickerOpen={() => draft.setLanguagePickerVisible(true)}
        onTonePicker={ai.handleAIPanel}
        selectedImages={draft.imagePicker.selectedImages}
        selectedVideo={draft.videoPicker.selectedVideo}
        selectedGif={draft.gifPicker.selectedGif}
        isImageUploading={draft.imagePicker.isUploading}
        isVideoUploading={draft.videoPicker.isUploading}
        isThreadMode={draft.isThreadMode}
        replyTo={draft.replyTo}
        quoteTo={draft.quoteTo}
        charCount={draft.charCount}
        maxLength={300}
        selectedLanguages={draft.selectedLanguages}
        hasText={draft.text.trim().length > 0}
        bottomInset={insets.bottom}
      />

      {/* Alt Text Modal */}
      <AltTextModal
        visible={media.altTextModalVisible}
        onClose={() => media.setAltTextModalVisible(false)}
        imageUri={
          media.selectedImageIndex !== null
            ? draft.imagePicker.selectedImages[media.selectedImageIndex]?.uri
            : undefined
        }
        initialAltText={media.tempAltText}
        onSave={media.handleSaveAltText}
        onGenerateAltText={media.handleGenerateAltText}
        colors={colors}
      />

      {/* Language Picker Modal */}
      <LanguagePicker
        visible={draft.languagePickerVisible}
        onClose={() => draft.setLanguagePickerVisible(false)}
        selectedLanguages={draft.selectedLanguages}
        onSelectLanguages={draft.handleSelectLanguages}
        multiSelect={true}
      />

      {/* GIF Picker Modal */}
      <GifPicker
        visible={draft.gifPicker.isVisible}
        onSelectGif={media.handleSelectGif}
        onClose={draft.gifPicker.close}
        gifs={draft.gifPicker.gifs}
        loading={draft.gifPicker.loading}
        error={draft.gifPicker.error}
        searchQuery={draft.gifPicker.searchQuery}
        onSearch={draft.gifPicker.search}
      />

      {/* Emoji Picker Modal */}
      <EmojiPickerModal
        visible={media.emojiPicker.isVisible}
        onSelectEmoji={media.handleSelectEmoji}
        onClose={media.emojiPicker.close}
      />

      {/* Image Editor Modal */}
      <ImageEditor
        visible={media.imageEditorVisible}
        images={media.imagesToEdit}
        onSave={media.handleSaveEditedImages}
        onCancel={media.handleCancelImageEditor}
      />

      {/* AI Tone Picker Modal */}
      <TonePickerModal
        visible={ai.tonePickerVisible}
        onClose={() => ai.setTonePickerVisible(false)}
        onSelectTone={ai.handleSelectTone}
        isAdjusting={ai.isAdjustingTone}
        selectedTone={ai.selectedTone}
        previewText={ai.tonePreviewText}
        originalText={draft.text}
        onApplyTone={ai.handleApplyTone}
        onCancelPreview={ai.handleCancelTonePreview}
      />

      {/* AI Features Panel */}
      <ComposeAIPanel
        visible={ai.aiPanelVisible}
        onClose={ai.handleCloseAIPanel}
        text={draft.text}
        onTextChange={draft.setText}
        hashtagResult={ai.hashtagResult}
        isLoadingHashtags={ai.isLoadingHashtags}
        onRequestHashtags={ai.handleRequestHashtags}
        onInsertHashtag={ai.handleInsertHashtag}
        writingFeedback={ai.writingFeedback}
        isLoadingFeedback={ai.isLoadingFeedback}
        onRequestFeedback={ai.handleRequestFeedback}
        onApplyCorrected={ai.handleApplyCorrected}
        onApplyEnhanced={ai.handleApplyEnhanced}
        styleAnalysis={ai.styleAnalysis}
        isLoadingStyle={ai.isLoadingStyle}
        onRequestStyleAnalysis={ai.handleRequestStyleAnalysis}
        threadResult={ai.threadResult}
        isLoadingThread={ai.isLoadingThread}
        onRequestThreadOptimization={ai.handleRequestThreadOptimization}
        onApplyThreadOptimization={ai.handleApplyThreadOptimization}
      />
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceElevated,
    },
    headerCenter: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    draftsButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    draftsButtonText: {
      color: colors.primary,
      fontSize: fontSize.subheadline,
      fontWeight: "500",
    },
    cancelTouchable: {
      minHeight: 44,
      minWidth: 44,
      justifyContent: "center",
    },
    cancelButton: {
      color: colors.textSecondary,
      fontSize: fontSize.callout,
    },
    postButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 20,
      minHeight: 44,
      justifyContent: "center",
      minWidth: 70,
      alignItems: "center",
    },
    postButtonDisabled: {
      backgroundColor: colors.surface,
      opacity: 0.5,
    },
    postButtonText: {
      color: colors.text,
      fontSize: fontSize.callout,
      fontWeight: "600",
    },
    input: {
      flex: 1,
      color: colors.text,
      fontSize: fontSize.headline,
      padding: 16,
      textAlignVertical: "top",
    },
    replyContext: {
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceElevated,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    replyHeader: {
      marginBottom: 8,
    },
    replyingTo: {
      color: colors.textTertiary,
      fontSize: fontSize.subheadline,
      fontWeight: "500",
    },
    replyingToHandle: {
      color: colors.primary,
    },
    parentPost: {
      flexDirection: "row",
      gap: 8,
    },
    parentPostContent: {
      flex: 1,
    },
    parentPostHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 4,
    },
    parentPostAuthor: {
      color: colors.text,
      fontSize: fontSize.subheadline,
      fontWeight: "600",
      maxWidth: 150,
    },
    parentPostHandle: {
      color: colors.textTertiary,
      fontSize: fontSize.footnote,
      flex: 1,
    },
    parentPostText: {
      color: colors.textSecondary,
      fontSize: fontSize.subheadline,
      lineHeight: 18,
    },
  });
}
