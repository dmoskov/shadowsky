import React, { useState, useCallback, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Image, ScrollView, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Localization from "expo-localization";
import { useCreatePost } from "../../hooks/api/usePosts";
import { useSaveDraft, useDeleteDraft, useDrafts } from "../../hooks/api";
import { draftToComposerState, ComposerState } from "../../services/drafts";
import { ImageIcon, VideoIcon, GifIcon, EmojiIcon, PollIcon, ThreadIcon, CloseIcon, GlobeIcon } from "../../components/icons";
import { Avatar } from "../../components/Avatar";
import { useImagePicker, ImageAsset } from "../../hooks/useImagePicker";
import { useVideoPicker, VideoAsset } from "../../hooks/useVideoPicker";
import { colors } from "../../constants/theme";
import { useSearchActors } from "../../hooks/api/useProfile";
import { MentionSuggestions } from "../../components/MentionSuggestions";
import { ThreadComposer } from "../../components/ThreadComposer";
import { ThreadPost } from "../../components/ThreadPostItem";
import { triggerHaptic } from "../../utils/haptics";
import { LanguagePicker } from "../../components/LanguagePicker";
import { getLanguageShortName } from "../../constants/languages";
import { preferencesService } from "../../services/preferences";
import { useGifPicker } from "../../hooks/useGifPicker";
import { GifPicker } from "../../components/GifPicker";
import { useEmojiPicker } from "../../hooks/useEmojiPicker";
import { EmojiPickerModal } from "../../components/EmojiPickerModal";
import type { TenorGif } from "../../services/tenor";

const MAX_POST_LENGTH = 300;

export interface ReplyToPost {
  uri: string;
  cid: string;
  author: {
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  text: string;
}

export interface QuoteToPost {
  uri: string;
  cid: string;
  author: {
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  text: string;
}

export interface ComposeScreenProps {
  replyTo?: ReplyToPost;
  quoteTo?: QuoteToPost;
  draftId?: string;
}

export function ComposeScreen({ replyTo, quoteTo, draftId }: ComposeScreenProps = {}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [text, setText] = useState("");
  const createPost = useCreatePost();
  const imagePicker = useImagePicker();
  const videoPicker = useVideoPicker();
  const saveDraft = useSaveDraft();
  const deleteDraft = useDeleteDraft();
  const { data: draftsData } = useDrafts();
  const [loadedDraftId, setLoadedDraftId] = useState<string | undefined>(draftId);
  const [isDirty, setIsDirty] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [altTextModalVisible, setAltTextModalVisible] = useState(false);
  const [tempAltText, setTempAltText] = useState("");

  // Language selection state
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);

  // GIF picker state
  const gifPicker = useGifPicker();

  // Emoji picker state
  const emojiPicker = useEmojiPicker();

  // Mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartPos, setMentionStartPos] = useState<number | null>(null);
  const [debouncedMentionQuery, setDebouncedMentionQuery] = useState("");

  // Debounce mention query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedMentionQuery(mentionQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [mentionQuery]);

  // Initialize language from preferences or device locale
  useEffect(() => {
    const initLanguage = async () => {
      try {
        const prefs = await preferencesService.get();
        if (prefs.postLanguages && prefs.postLanguages.length > 0) {
          setSelectedLanguages(prefs.postLanguages);
        } else {
          // Default to device locale
          const locales = Localization.getLocales();
          const deviceLanguage = locales[0]?.languageCode || 'en';
          setSelectedLanguages([deviceLanguage]);
        }
      } catch (error) {
        // Fallback to English
        setSelectedLanguages(['en']);
      }
    };

    initLanguage();
  }, []);

  // Search for actors with debounced query
  const { data: searchResults, isLoading: isSearching } = useSearchActors(debouncedMentionQuery);

  // Detect @ mentions in text
  const detectMention = useCallback((newText: string, cursorPosition?: number) => {
    // Use cursor position or end of text
    const position = cursorPosition ?? newText.length;

    // Find the @ symbol before cursor
    let atIndex = -1;
    for (let i = position - 1; i >= 0; i--) {
      const char = newText[i];
      if (char === "@") {
        atIndex = i;
        break;
      }
      // Stop if we hit whitespace or newline (mention should be continuous)
      if (char === " " || char === "\n") {
        break;
      }
    }

    // If we found an @ and it's at start or after whitespace/newline
    if (atIndex !== -1) {
      const beforeAt = atIndex === 0 ? "" : newText[atIndex - 1];
      const isValidStart = atIndex === 0 || beforeAt === " " || beforeAt === "\n";

      if (isValidStart) {
        const textAfterAt = newText.substring(atIndex + 1, position);
        // Check if text after @ is valid (no spaces/newlines and 2+ chars for search)
        if (!textAfterAt.includes(" ") && !textAfterAt.includes("\n")) {
          setMentionQuery(textAfterAt);
          setMentionStartPos(atIndex);
          return;
        }
      }
    }

    // No valid mention found
    setMentionQuery("");
    setMentionStartPos(null);
  }, []);

  // Handle text change and detect mentions
  const handleTextChange = useCallback((newText: string) => {
    setText(newText);
    detectMention(newText);
  }, [detectMention]);

  // Handle mention selection
  const handleSelectMention = useCallback((handle: string) => {
    if (mentionStartPos !== null) {
      // Replace the partial mention with the full handle
      const beforeMention = text.substring(0, mentionStartPos);
      const afterMention = text.substring(mentionStartPos + mentionQuery.length + 1); // +1 for @
      const newText = `${beforeMention}@${handle} ${afterMention}`;
      setText(newText);

      // Clear mention state
      setMentionQuery("");
      setMentionStartPos(null);
    }
  }, [text, mentionQuery, mentionStartPos]);

  // Thread mode state
  const [isThreadMode, setIsThreadMode] = useState(false);
  const [threadPosts, setThreadPosts] = useState<ThreadPost[]>([{ text: "", images: [] }]);
  const [activeThreadPostIndex, setActiveThreadPostIndex] = useState<number | null>(null);

  // Load draft if draftId is provided
  useEffect(() => {
    if (draftId && draftsData) {
      const allDrafts = draftsData.pages.flatMap((page) => page.drafts);
      const draft = allDrafts.find((d) => d.id === draftId);

      if (draft) {
        draftToComposerState(draft).then((state) => {
          setText(state.text);
          // Load images one by one using the image picker API
          if (state.images && state.images.length > 0) {
            // Clear existing images first
            imagePicker.clearImages();
            // Add each image
            for (const img of state.images) {
              const imageAsset: ImageAsset = {
                uri: img.uri,
                width: 0,
                height: 0,
                mimeType: img.mimeType || 'image/jpeg',
                altText: img.altText || '',
              };
              imagePicker.selectedImages.push(imageAsset);
            }
          }
          setLoadedDraftId(draftId);
          setIsDirty(false);
        }).catch((error) => {
          console.error('Failed to load draft:', error);
          Alert.alert('Error', 'Failed to load draft');
        });
      }
    }
  }, [draftId, draftsData]);

  // Mark as dirty when content changes
  useEffect(() => {
    if (loadedDraftId || text || imagePicker.selectedImages.length > 0 || videoPicker.selectedVideo) {
      setIsDirty(true);
    }
  }, [text, imagePicker.selectedImages, videoPicker.selectedVideo]);

  const handleSaveDraft = async () => {
    try {
      const composerState: ComposerState = {
        text: text.trim(),
        images: imagePicker.selectedImages.length > 0
          ? imagePicker.selectedImages.map((img) => ({
              uri: img.uri,
              altText: img.altText,
              mimeType: img.mimeType,
            }))
          : undefined,
        quoteUri: quoteTo?.uri,
        quoteCid: quoteTo?.cid,
        replyToUri: replyTo?.uri,
        replyToCid: replyTo?.cid,
      };

      await saveDraft.mutateAsync({
        draftId: loadedDraftId,
        state: composerState,
      });

      triggerHaptic('success');
      Alert.alert('Success', 'Draft saved!');
      router.back();
    } catch (error) {
      triggerHaptic('error');
      Alert.alert('Error', 'Failed to save draft');
    }
  };

  const handleClose = () => {
    const hasContent = isThreadMode
      ? threadPosts.some(p => p.text.trim() || p.images.length > 0)
      : (imagePicker.selectedImages.length > 0 || videoPicker.selectedVideo || text.trim());

    if (hasContent && !isThreadMode) {
      // Offer to save as draft for single posts
      Alert.alert(
        "Save as draft?",
        "Would you like to save your post as a draft?",
        [
          { text: "Discard", style: "destructive", onPress: () => router.back() },
          { text: "Cancel", style: "cancel" },
          { text: "Save Draft", onPress: handleSaveDraft },
        ]
      );
    } else if (hasContent && isThreadMode) {
      // Thread mode - just confirm discard (threads not supported in drafts yet)
      Alert.alert(
        "Discard Thread?",
        "Are you sure you want to discard this thread?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Discard", style: "destructive", onPress: () => router.back() },
        ]
      );
    } else {
      router.back();
    }
  };

  const handleImagePicker = () => {
    // Check if video is already selected
    if (videoPicker.selectedVideo) {
      Alert.alert(
        "Media Type Conflict",
        "You can attach either images or a video, not both. Remove the video first to add images."
      );
      return;
    }

    Alert.alert(
      "Add Image",
      "Choose an option",
      [
        { text: "Take Photo", onPress: () => imagePicker.pickFromCamera() },
        { text: "Choose from Library", onPress: () => imagePicker.pickFromLibrary() },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const handleVideoPicker = () => {
    // Check if images are already selected
    if (imagePicker.selectedImages.length > 0) {
      Alert.alert(
        "Media Type Conflict",
        "You can attach either images or a video, not both. Remove the images first to add a video."
      );
      return;
    }

    Alert.alert(
      "Add Video",
      "Choose an option",
      [
        { text: "Record Video", onPress: () => videoPicker.recordVideo() },
        { text: "Choose from Library", onPress: () => videoPicker.pickFromLibrary() },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const handleRemoveVideo = () => {
    Alert.alert(
      "Remove Video",
      "Are you sure you want to remove this video?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => videoPicker.removeVideo() },
      ]
    );
  };

  const handleRemoveImage = (index: number) => {
    Alert.alert(
      "Remove Image",
      "Are you sure you want to remove this image?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => imagePicker.removeImage(index) },
      ]
    );
  };

  const handleAddAltText = (index: number) => {
    setSelectedImageIndex(index);
    setTempAltText(imagePicker.selectedImages[index].altText);
    setAltTextModalVisible(true);
  };

  const handleSaveAltText = () => {
    if (selectedImageIndex !== null) {
      imagePicker.updateAltText(selectedImageIndex, tempAltText);
    }
    setAltTextModalVisible(false);
    setSelectedImageIndex(null);
    setTempAltText("");
  };

  // Handle language selection
  const handleSelectLanguages = async (langs: string[]) => {
    setSelectedLanguages(langs);
    // Save to preferences
    try {
      await preferencesService.set('postLanguages', langs);
    } catch (error) {
      console.error('Failed to save language preference:', error);
    }
  };

  // Handle GIF picker
  const handleGifPicker = () => {
    // Check if images or video are already selected
    if (imagePicker.selectedImages.length > 0 || videoPicker.selectedVideo) {
      Alert.alert(
        "Media Already Attached",
        "Remove images or video first to add a GIF. GIFs are embedded as external links."
      );
      return;
    }

    // Check if GIF is already selected
    if (gifPicker.selectedGif) {
      Alert.alert(
        "GIF Already Added",
        "You already have a GIF attached. Remove it first to add a new one."
      );
      return;
    }

    gifPicker.open();
  };

  // Handle GIF selection
  const handleSelectGif = useCallback((gif: TenorGif) => {
    gifPicker.selectGif(gif);
    gifPicker.close();
    triggerHaptic('success');
  }, [gifPicker]);

  // Handle remove GIF
  const handleRemoveGif = () => {
    Alert.alert(
      "Remove GIF",
      "Are you sure you want to remove this GIF?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => gifPicker.clearSelection() },
      ]
    );
  };

  // Handle emoji picker
  const handleEmojiPicker = () => {
    emojiPicker.open();
  };

  // Handle emoji selection
  const handleSelectEmoji = useCallback((emoji: string) => {
    // Insert emoji at the current cursor position
    setText((prevText) => prevText + emoji);
    triggerHaptic('selection');
  }, []);

  // Thread mode handlers
  const handleToggleThreadMode = () => {
    if (isThreadMode) {
      // Switching from thread to single post
      if (threadPosts.some(p => p.text.trim() || p.images.length > 0)) {
        Alert.alert(
          "Exit Thread Mode?",
          "Your thread will be converted to a single post. Only the first post will be kept.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Continue",
              style: "destructive",
              onPress: () => {
                setText(threadPosts[0].text);
                imagePicker.clearImages();
                threadPosts[0].images.forEach(img => {
                  // Note: We can't easily restore images to the single post picker
                  // This is a limitation we'll document
                });
                setIsThreadMode(false);
                setThreadPosts([{ text: "", images: [] }]);
              },
            },
          ]
        );
      } else {
        setIsThreadMode(false);
        setThreadPosts([{ text: "", images: [] }]);
      }
    } else {
      // Switching from single post to thread
      const firstPost: ThreadPost = {
        text: text,
        images: imagePicker.selectedImages,
      };
      setThreadPosts([firstPost]);
      setText("");
      imagePicker.clearImages();
      setIsThreadMode(true);
    }
  };

  const handleUpdateThreadPost = (index: number, post: ThreadPost) => {
    const newPosts = [...threadPosts];
    newPosts[index] = post;
    setThreadPosts(newPosts);
  };

  const handleAddThreadPost = () => {
    setThreadPosts([...threadPosts, { text: "", images: [] }]);
  };

  const handleRemoveThreadPost = (index: number) => {
    if (threadPosts.length <= 1) return;
    const newPosts = threadPosts.filter((_, i) => i !== index);
    setThreadPosts(newPosts);
  };

  const handleThreadImagePicker = (postIndex: number) => {
    setActiveThreadPostIndex(postIndex);
    Alert.alert(
      "Add Image",
      "Choose an option",
      [
        { text: "Take Photo", onPress: () => handleThreadImageFromCamera(postIndex) },
        { text: "Choose from Library", onPress: () => handleThreadImageFromLibrary(postIndex) },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const handleThreadImageFromCamera = async (postIndex: number) => {
    const image = await imagePicker.pickFromCamera();
    if (image) {
      const newPosts = [...threadPosts];
      newPosts[postIndex].images.push(image);
      setThreadPosts(newPosts);
    }
  };

  const handleThreadImageFromLibrary = async (postIndex: number) => {
    const images = await imagePicker.pickFromLibrary();
    if (images && images.length > 0) {
      const newPosts = [...threadPosts];
      images.forEach(image => {
        newPosts[postIndex].images.push(image);
      });
      setThreadPosts(newPosts);
    }
  };

  const handlePost = async () => {
    if (isThreadMode) {
      return handlePostThread();
    }

    if (!text.trim() && imagePicker.selectedImages.length === 0 && !videoPicker.selectedVideo && !gifPicker.selectedGif) {
      return;
    }

    try {
      // Set uploading state on both pickers
      imagePicker.setIsUploading(true);
      videoPicker.setIsUploading(true);

      const postOptions: any = { text: text.trim() };

      // Add languages
      if (selectedLanguages.length > 0) {
        postOptions.langs = selectedLanguages;
      }

      // Add reply reference if replying
      if (replyTo) {
        postOptions.reply = {
          root: { uri: replyTo.uri, cid: replyTo.cid },
          parent: { uri: replyTo.uri, cid: replyTo.cid },
        };
      }

      // Add quote reference if quoting
      if (quoteTo) {
        postOptions.quote = { uri: quoteTo.uri, cid: quoteTo.cid };
      }

      // Add video if selected
      if (videoPicker.selectedVideo) {
        postOptions.video = {
          uri: videoPicker.selectedVideo.uri,
          alt: '', // Could add alt text support for videos later
        };
      }
      // Add images if any are selected
      else if (imagePicker.selectedImages.length > 0) {
        postOptions.images = imagePicker.selectedImages.map((img) => ({
          uri: img.uri,
          alt: img.altText,
        }));
      }
      // Add GIF as external embed if selected
      else if (gifPicker.selectedGif) {
        postOptions.external = {
          uri: gifPicker.selectedGif.url,
          title: gifPicker.selectedGif.title,
          description: 'GIF from Tenor',
        };
      }

      await createPost.mutateAsync(postOptions);

      // Delete draft if this was loaded from a draft
      if (loadedDraftId) {
        try {
          await deleteDraft.mutateAsync(loadedDraftId);
        } catch (error) {
          console.error('Failed to delete draft after posting:', error);
        }
      }

      imagePicker.clearImages();
      videoPicker.clearVideo();
      router.back();
      // Show success feedback with haptic
      triggerHaptic("success");
      const successMessage = replyTo ? "Reply posted!" : quoteTo ? "Quote posted!" : "Your post has been published!";
      Alert.alert("Success", successMessage);
    } catch (error) {
      // Show error feedback with haptic
      triggerHaptic("error");
      const errorMessage = error instanceof Error ? error.message : "Failed to create post. Please try again.";
      Alert.alert("Error", errorMessage);
    } finally {
      imagePicker.setIsUploading(false);
      imagePicker.setUploadProgress(0);
      videoPicker.setIsUploading(false);
      videoPicker.setUploadProgress(0);
    }
  };

  const handlePostThread = async () => {
    // Validate thread has content
    const validPosts = threadPosts.filter(p => p.text.trim() || p.images.length > 0);
    if (validPosts.length === 0) {
      Alert.alert("Error", "Thread must have at least one post with content.");
      return;
    }

    // Check for over-limit posts
    const overLimitPosts = validPosts.filter(p => p.text.length > 300);
    if (overLimitPosts.length > 0) {
      Alert.alert("Error", "Some posts exceed the 300 character limit.");
      return;
    }

    try {
      imagePicker.setIsUploading(true);

      // Import createThread dynamically to avoid circular dependencies
      const { createThread } = await import("../../services/atproto/posts");

      const threadOptions: any = {
        posts: validPosts.map(p => ({
          text: p.text.trim(),
          images: p.images.map(img => ({
            uri: img.uri,
            alt: img.altText,
          })),
          langs: selectedLanguages.length > 0 ? selectedLanguages : undefined,
        })),
      };

      // Add reply reference if replying
      if (replyTo) {
        threadOptions.reply = {
          root: { uri: replyTo.uri, cid: replyTo.cid },
          parent: { uri: replyTo.uri, cid: replyTo.cid },
        };
      }

      const result = await createThread(threadOptions);

      if (result.failureCount > 0) {
        Alert.alert(
          "Partial Success",
          `Posted ${result.successCount} of ${validPosts.length} posts. Some posts failed to publish.`
        );
      } else {
        Alert.alert("Success", `Thread with ${result.successCount} posts published!`);
      }

      router.back();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create thread. Please try again.";
      Alert.alert("Error", errorMessage);
    } finally {
      imagePicker.setIsUploading(false);
      imagePicker.setUploadProgress(0);
    }
  };

  const isPostDisabled = isThreadMode
    ? threadPosts.every(p => !p.text.trim() && p.images.length === 0) ||
      threadPosts.some(p => p.text.length > MAX_POST_LENGTH) ||
      imagePicker.isUploading || videoPicker.isUploading
    : (!text.trim() && imagePicker.selectedImages.length === 0 && !videoPicker.selectedVideo && !gifPicker.selectedGif) ||
      text.length > MAX_POST_LENGTH ||
      imagePicker.isUploading || videoPicker.isUploading;

  const charCount = text.length;
  const isOverLimit = charCount > MAX_POST_LENGTH;

  const placeholderText = replyTo
    ? "Post your reply"
    : quoteTo
    ? "Add your thoughts"
    : "What's happening?";

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleClose}
          style={styles.cancelTouchable}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.cancelButton}>Cancel</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          {!isThreadMode && (
            <TouchableOpacity onPress={() => router.push("/(app)/drafts")} style={styles.draftsButton}>
              <Text style={styles.draftsButtonText}>Drafts</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[
            styles.postButton,
            (isPostDisabled || createPost.isPending) && styles.postButtonDisabled
          ]}
          onPress={handlePost}
          disabled={isPostDisabled || createPost.isPending}
        >
          {createPost.isPending || imagePicker.isUploading || videoPicker.isUploading ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.postButtonText}>Post</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Reply Context */}
      {replyTo && (
        <View style={styles.replyContext}>
          <View style={styles.replyHeader}>
            <Text style={styles.replyingTo}>
              Replying to @{replyTo.author.handle}
            </Text>
          </View>
          <View style={styles.parentPost}>
            <Avatar uri={replyTo.author.avatar} size={36} />
            <View style={styles.parentPostContent}>
              <View style={styles.parentPostHeader}>
                <Text style={styles.parentPostAuthor} numberOfLines={1}>
                  {replyTo.author.displayName || replyTo.author.handle}
                </Text>
                <Text style={styles.parentPostHandle} numberOfLines={1}>
                  @{replyTo.author.handle}
                </Text>
              </View>
              <Text style={styles.parentPostText} numberOfLines={2}>
                {replyTo.text}
              </Text>
            </View>
          </View>
        </View>
      )}

      {isThreadMode ? (
        <ThreadComposer
          posts={threadPosts}
          onUpdatePost={handleUpdateThreadPost}
          onAddPost={handleAddThreadPost}
          onRemovePost={handleRemoveThreadPost}
          onImagePicker={handleThreadImagePicker}
          isUploading={imagePicker.isUploading}
        />
      ) : (
        <>
          <TextInput
            style={styles.input}
            placeholder={placeholderText}
            placeholderTextColor="#6b7280"
            multiline
            autoFocus
            value={text}
            onChangeText={handleTextChange}
            editable={!createPost.isPending && !imagePicker.isUploading}
          />

          {/* Image Previews */}
          {imagePicker.selectedImages.length > 0 && (
            <View style={styles.imagePreviewContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScrollView}>
                {imagePicker.selectedImages.map((image, index) => (
                  <View key={index} style={styles.imagePreviewWrapper}>
                    <Image source={{ uri: image.uri }} style={styles.imagePreview} />
                    {imagePicker.isUploading && (
                      <View style={styles.uploadingOverlay}>
                        <ActivityIndicator color="#ffffff" size="small" />
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => handleRemoveImage(index)}
                      disabled={imagePicker.isUploading}
                    >
                      <Text style={styles.removeImageText}>×</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.altTextButton}
                      onPress={() => handleAddAltText(index)}
                      disabled={imagePicker.isUploading}
                    >
                      <Text style={styles.altTextButtonText}>
                        {image.altText ? "✓ ALT" : "ALT"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
              {imagePicker.isUploading && (
                <Text style={styles.uploadingText}>
                  Uploading images...
                </Text>
              )}
            </View>
          )}

          {/* Video Preview */}
          {videoPicker.selectedVideo && (
            <View style={styles.videoPreviewContainer}>
              <View style={styles.videoPreviewWrapper}>
                {videoPicker.selectedVideo.thumbnail ? (
                  <Image
                    source={{ uri: videoPicker.selectedVideo.thumbnail }}
                    style={styles.videoPreview}
                  />
                ) : (
                  <View style={[styles.videoPreview, styles.videoPreviewPlaceholder]}>
                    <VideoIcon size={48} color="#6b7280" />
                  </View>
                )}
                {videoPicker.isUploading && (
                  <View style={styles.uploadingOverlay}>
                    <ActivityIndicator color="#ffffff" size="small" />
                  </View>
                )}
                <View style={styles.videoDurationBadge}>
                  <Text style={styles.videoDurationText}>
                    {videoPicker.formatDuration(videoPicker.selectedVideo.duration)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={handleRemoveVideo}
                  disabled={videoPicker.isUploading}
                >
                  <Text style={styles.removeImageText}>×</Text>
                </TouchableOpacity>
                <View style={styles.videoPlayIcon}>
                  <View style={styles.playIconTriangle} />
                </View>
              </View>
              {videoPicker.isUploading && (
                <Text style={styles.uploadingText}>
                  Uploading video... This may take a while.
                </Text>
              )}
            </View>
          )}

          {/* GIF Preview */}
          {gifPicker.selectedGif && (
            <View style={styles.gifPreviewContainer}>
              <View style={styles.gifPreviewWrapper}>
                <Image
                  source={{ uri: gifPicker.selectedGif.url }}
                  style={styles.gifPreview}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={handleRemoveGif}
                >
                  <Text style={styles.removeImageText}>×</Text>
                </TouchableOpacity>
                <View style={styles.gifBadge}>
                  <Text style={styles.gifBadgeText}>GIF</Text>
                </View>
              </View>
              <Text style={styles.gifHintText}>
                GIFs are embedded as external links
              </Text>
            </View>
          )}

          {/* Quote Preview */}
          {quoteTo && (
            <View style={styles.quotePreview}>
              <View style={styles.quoteCard}>
                <View style={styles.quoteHeader}>
                  <Avatar uri={quoteTo.author.avatar} size={32} />
                  <View style={styles.quoteAuthorInfo}>
                    <Text style={styles.quoteAuthorName} numberOfLines={1}>
                      {quoteTo.author.displayName || quoteTo.author.handle}
                    </Text>
                    <Text style={styles.quoteAuthorHandle} numberOfLines={1}>
                      @{quoteTo.author.handle}
                    </Text>
                  </View>
                </View>
                <Text style={styles.quoteText} numberOfLines={6}>
                  {quoteTo.text}
                </Text>
              </View>
            </View>
          )}
        </>
      )}

      {/* Mention Suggestions */}
      {mentionQuery.length >= 2 && (
        <MentionSuggestions
          suggestions={searchResults || []}
          onSelectMention={handleSelectMention}
          isLoading={isSearching}
        />
      )}

      <View style={[styles.toolbar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {isThreadMode ? (
          <TouchableOpacity
            style={styles.exitThreadButton}
            activeOpacity={0.7}
            onPress={handleToggleThreadMode}
          >
            <ThreadIcon size={18} color={colors.primary} />
            <Text style={styles.exitThreadText}>Exit Thread Mode</Text>
          </TouchableOpacity>
        ) : (
          <>
            <View style={styles.toolbarIcons}>
              <TouchableOpacity
                style={styles.toolbarButton}
                activeOpacity={0.7}
                onPress={handleImagePicker}
                disabled={imagePicker.isUploading || imagePicker.selectedImages.length >= 4 || videoPicker.selectedVideo !== null}
              >
                <ImageIcon size={22} color={(imagePicker.selectedImages.length >= 4 || videoPicker.selectedVideo) ? "#4b5563" : "#6b7280"} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.toolbarButton}
                activeOpacity={0.7}
                onPress={handleVideoPicker}
                disabled={videoPicker.isUploading || imagePicker.selectedImages.length > 0 || videoPicker.selectedVideo !== null}
              >
                <VideoIcon size={22} color={(imagePicker.selectedImages.length > 0 || videoPicker.selectedVideo) ? "#4b5563" : "#6b7280"} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.toolbarButton}
                activeOpacity={0.7}
                onPress={handleGifPicker}
                disabled={imagePicker.selectedImages.length > 0 || videoPicker.selectedVideo !== null || gifPicker.selectedGif !== null}
              >
                <GifIcon size={22} color={(imagePicker.selectedImages.length > 0 || videoPicker.selectedVideo || gifPicker.selectedGif) ? "#4b5563" : "#6b7280"} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.toolbarButton}
                activeOpacity={0.7}
                onPress={handleEmojiPicker}
              >
                <EmojiIcon size={22} color="#6b7280" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolbarButton} activeOpacity={0.7}>
                <PollIcon size={22} color="#6b7280" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.toolbarButton}
                activeOpacity={0.7}
                onPress={handleToggleThreadMode}
                disabled={replyTo !== undefined || quoteTo !== undefined}
              >
                <ThreadIcon size={22} color={isThreadMode ? colors.primary : "#6b7280"} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.languageButton}
                activeOpacity={0.7}
                onPress={() => setLanguagePickerVisible(true)}
              >
                <GlobeIcon size={18} color="#6b7280" />
                <Text style={styles.languageButtonText}>
                  {selectedLanguages.length > 0
                    ? selectedLanguages.map(getLanguageShortName).join(', ')
                    : 'EN'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={[
              styles.charCount,
              isOverLimit && styles.charCountOver
            ]}>
              {charCount}/{MAX_POST_LENGTH}
            </Text>
          </>
        )}
      </View>

      {/* Alt Text Modal */}
      <Modal
        visible={altTextModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAltTextModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Alt Text</Text>
              <TouchableOpacity onPress={() => setAltTextModalVisible(false)}>
                <Text style={styles.modalCloseButton}>×</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalDescription}>
              Describe this image for people who are blind or have low vision.
            </Text>
            {selectedImageIndex !== null && (
              <Image
                source={{ uri: imagePicker.selectedImages[selectedImageIndex].uri }}
                style={styles.modalImage}
              />
            )}
            <TextInput
              style={styles.altTextInput}
              placeholder="Describe this image..."
              placeholderTextColor="#6b7280"
              multiline
              value={tempAltText}
              onChangeText={setTempAltText}
              maxLength={1000}
              autoFocus
            />
            <TouchableOpacity
              style={styles.saveAltTextButton}
              onPress={handleSaveAltText}
            >
              <Text style={styles.saveAltTextButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Language Picker Modal */}
      <LanguagePicker
        visible={languagePickerVisible}
        onClose={() => setLanguagePickerVisible(false)}
        selectedLanguages={selectedLanguages}
        onSelectLanguages={handleSelectLanguages}
        multiSelect={true}
      />

      {/* GIF Picker Modal */}
      <GifPicker
        visible={gifPicker.isVisible}
        onSelectGif={handleSelectGif}
        onClose={gifPicker.close}
        gifs={gifPicker.gifs}
        loading={gifPicker.loading}
        error={gifPicker.error}
        searchQuery={gifPicker.searchQuery}
        onSearch={gifPicker.search}
      />

      {/* Emoji Picker Modal */}
      <EmojiPickerModal
        visible={emojiPicker.isVisible}
        onSelectEmoji={handleSelectEmoji}
        onClose={emojiPicker.close}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0f",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
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
    fontSize: 14,
    fontWeight: "500",
  },
  cancelTouchable: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
  },
  cancelButton: {
    color: "#9ca3af",
    fontSize: 16,
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
    backgroundColor: "#1e3a5f",
    opacity: 0.5,
  },
  postButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  input: {
    flex: 1,
    color: "#ffffff",
    fontSize: 18,
    padding: 16,
    textAlignVertical: "top",
  },
  toolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#1f2937",
  },
  toolbarIcons: {
    flexDirection: "row",
    gap: 16,
  },
  toolbarButton: {
    padding: 4,
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#111116',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  languageButtonText: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
  },
  charCount: {
    color: "#6b7280",
    fontSize: 14,
    fontWeight: "500",
  },
  charCountOver: {
    color: "#ef4444",
  },
  replyContext: {
    backgroundColor: "#111116",
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  replyHeader: {
    marginBottom: 8,
  },
  replyingTo: {
    color: "#6b7280",
    fontSize: 14,
    fontWeight: "500",
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
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
    maxWidth: 150,
  },
  parentPostHandle: {
    color: "#6b7280",
    fontSize: 13,
    flex: 1,
  },
  parentPostText: {
    color: "#9ca3af",
    fontSize: 14,
    lineHeight: 18,
  },
  quotePreview: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  quoteCard: {
    borderWidth: 1,
    borderColor: "#1f2937",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#111116",
  },
  quoteHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  quoteAuthorInfo: {
    flex: 1,
  },
  quoteAuthorName: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  quoteAuthorHandle: {
    color: "#6b7280",
    fontSize: 13,
  },
  quoteText: {
    color: "#e5e7eb",
    fontSize: 14,
    lineHeight: 18,
  },
  imagePreviewContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  imageScrollView: {
    flexDirection: "row",
  },
  imagePreviewWrapper: {
    position: "relative",
    marginRight: 12,
  },
  imagePreview: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: "#1f2937",
  },
  uploadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  removeImageButton: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#374151",
    justifyContent: "center",
    alignItems: "center",
  },
  removeImageText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 20,
  },
  altTextButton: {
    position: "absolute",
    bottom: 4,
    left: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  altTextButtonText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "600",
  },
  uploadingText: {
    color: "#9ca3af",
    fontSize: 12,
    marginTop: 8,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#0a0a0f",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
  },
  modalCloseButton: {
    color: "#9ca3af",
    fontSize: 32,
    lineHeight: 32,
  },
  modalDescription: {
    color: "#9ca3af",
    fontSize: 14,
    marginBottom: 12,
  },
  modalImage: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    backgroundColor: "#1f2937",
    marginBottom: 12,
    resizeMode: "contain",
  },
  altTextInput: {
    backgroundColor: "#111116",
    borderWidth: 1,
    borderColor: "#1f2937",
    borderRadius: 8,
    padding: 12,
    color: "#ffffff",
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: "top",
    marginBottom: 12,
  },
  saveAltTextButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  saveAltTextButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  exitThreadButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 8,
  },
  exitThreadText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  videoPreviewContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  videoPreviewWrapper: {
    position: "relative",
    width: 200,
    height: 200,
  },
  videoPreview: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
    backgroundColor: "#1f2937",
  },
  videoPreviewPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  videoDurationBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  videoDurationText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  videoPlayIcon: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -20,
    marginLeft: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  playIconTriangle: {
    width: 0,
    height: 0,
    marginLeft: 3,
    borderLeftWidth: 14,
    borderLeftColor: "#ffffff",
    borderTopWidth: 9,
    borderTopColor: "transparent",
    borderBottomWidth: 9,
    borderBottomColor: "transparent",
  },
  gifPreviewContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  gifPreviewWrapper: {
    position: "relative",
    width: 200,
    height: 200,
  },
  gifPreview: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
    backgroundColor: "#1f2937",
  },
  gifBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  gifBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  gifHintText: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 8,
  },
});
