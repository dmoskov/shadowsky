import React, { useState, useCallback, useEffect, useMemo } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Modal } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Localization from "expo-localization";
import { useCreatePost } from "../../hooks/api/usePosts";
import { useSaveDraft, useDeleteDraft, useDrafts } from "../../hooks/api";
import { draftToComposerState, ComposerState } from "../../services/drafts";
import { Avatar } from "../../components/Avatar";
import { useImagePicker, ImageAsset } from "../../hooks/useImagePicker";
import { useVideoPicker } from "../../hooks/useVideoPicker";
import { useTheme } from "../../contexts/ThemeContext";
import { useSearchActors } from "../../hooks/api/useProfile";
import { MentionSuggestions } from "../../components/MentionSuggestions";
import { ThreadComposer } from "../../components/ThreadComposer";
import { ThreadPost } from "../../components/ThreadPostItem";
import { triggerHaptic } from "../../utils/haptics";
import { LanguagePicker } from "../../components/LanguagePicker";
import { preferencesService } from "../../services/preferences";
import { useGifPicker } from "../../hooks/useGifPicker";
import { GifPicker } from "../../components/GifPicker";
import { useEmojiPicker } from "../../hooks/useEmojiPicker";
import { EmojiPickerModal } from "../../components/EmojiPickerModal";
import type { TenorGif } from "../../services/tenor";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { ImageEditor } from "../../components/ImageEditor";
import { useTranslation } from "../../hooks/useTranslation";
import { ComposeToolbar, ComposeMediaPreview, ComposeQuotePreview } from "./components";
import { generateAltText } from "../../services/ai-service";
import { usePreferences } from "../../contexts/PreferencesContext";
import { useLinkPreview } from "../../hooks/useLinkPreview";
import { LinkPreviewCard } from "../../components/LinkPreviewCard";

import { createLogger } from '../../utils/logger';

const logger = createLogger('ComposeScreen');
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
  sharedUrl?: string;
  sharedText?: string;
  initialText?: string;
  sharedImages?: string[];
}

export function ComposeScreen({ replyTo, quoteTo, draftId, sharedUrl, sharedText, initialText, sharedImages }: ComposeScreenProps = {}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { preferences } = usePreferences();
  const [text, setText] = useState("");
  const createPost = useCreatePost();
  const imagePicker = useImagePicker();
  const videoPicker = useVideoPicker();
  const saveDraft = useSaveDraft();
  const deleteDraft = useDeleteDraft();
  const { data: draftsData } = useDrafts();
  const [loadedDraftId, setLoadedDraftId] = useState<string | undefined>(draftId);
  const [, setIsDirty] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [altTextModalVisible, setAltTextModalVisible] = useState(false);
  const [tempAltText, setTempAltText] = useState("");
  const [isGeneratingAltText, setIsGeneratingAltText] = useState(false);

  // Language selection state
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);

  // GIF picker state
  const gifPicker = useGifPicker();

  // Emoji picker state
  const emojiPicker = useEmojiPicker();

  // Link preview
  const linkPreview = useLinkPreview(text);

  // Image editor state
  const [imageEditorVisible, setImageEditorVisible] = useState(false);
  const [imagesToEdit, setImagesToEdit] = useState<ImageAsset[]>([]);

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
  const [, setActiveThreadPostIndex] = useState<number | null>(null);

  // Load draft if draftId is provided
  useEffect(() => {
    if (draftId && draftsData) {
      const allDrafts = draftsData.pages.flatMap((page) => page.drafts);
      const draft = allDrafts.find((d) => d.id === draftId);

      if (draft) {
        draftToComposerState(draft).then((state) => {
          setText(state.text);
          // Load images using the image picker API
          if (state.images && state.images.length > 0) {
            imagePicker.clearImages();
            const imageAssets: ImageAsset[] = state.images.map((img) => ({
              uri: img.uri,
              width: 0,
              height: 0,
              mimeType: img.mimeType || 'image/jpeg',
              altText: img.altText || '',
            }));
            imagePicker.addImages(imageAssets);
          }
          setLoadedDraftId(draftId);
          setIsDirty(false);
        }).catch((error) => {
          logger.error('Failed to load draft:', error);
          Alert.alert('Error', 'Failed to load draft');
        });
      }
    }
  }, [draftId, draftsData]);

  // Initialize with shared content from Share Extension
  useEffect(() => {
    if (initialText) {
      setText(initialText);
    } else if (sharedUrl || sharedText) {
      let composedText = '';

      if (sharedText) {
        composedText = sharedText;
      }

      if (sharedUrl) {
        // Add URL on a new line if there's text, otherwise just add the URL
        composedText = composedText ? `${composedText}\n\n${sharedUrl}` : sharedUrl;
      }

      setText(composedText);
    }
  }, [sharedUrl, sharedText, initialText]);

  // Load shared images from Share Extension into the image picker
  useEffect(() => {
    if (!sharedImages || sharedImages.length === 0) return;

    const imageAssets: ImageAsset[] = sharedImages.map((uri) => ({
      uri,
      width: 0,
      height: 0,
      mimeType: 'image/jpeg',
      altText: '',
    }));
    imagePicker.addImages(imageAssets);
  }, [sharedImages]);

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
        t("compose.save_draft_title"),
        t("compose.save_draft_message"),
        [
          { text: t("compose.discard_button"), style: "destructive", onPress: () => router.back() },
          { text: t("compose.cancel_button"), style: "cancel" },
          { text: t("compose.save_draft_button"), onPress: handleSaveDraft },
        ]
      );
    } else if (hasContent && isThreadMode) {
      // Thread mode - just confirm discard (threads not supported in drafts yet)
      Alert.alert(
        t("compose.discard_thread_title"),
        t("compose.discard_thread_message"),
        [
          { text: t("compose.cancel_button"), style: "cancel" },
          { text: t("compose.discard_button"), style: "destructive", onPress: () => router.back() },
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
        { text: "Take Photo", onPress: handleTakePhoto },
        { text: "Choose from Library", onPress: handleChooseFromLibrary },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const handleTakePhoto = async () => {
    const image = await imagePicker.pickFromCamera(false);
    if (image) {
      setImagesToEdit([image]);
      setImageEditorVisible(true);
    }
  };

  const handleChooseFromLibrary = async () => {
    const images = await imagePicker.pickFromLibrary(false);
    if (images && images.length > 0) {
      setImagesToEdit(images);
      setImageEditorVisible(true);
    }
  };

  const handleSaveEditedImages = async (editedImages: Array<{ originalAsset: ImageAsset; editedAsset: ImageAsset }>) => {
    // Add edited images to the picker
    const assetsToAdd = editedImages.map(img => img.editedAsset);
    imagePicker.addImages(assetsToAdd);
    setImageEditorVisible(false);
    setImagesToEdit([]);

    // Auto-generate alt text if enabled and images don't have alt text
    if (preferences?.autoGenerateAltText) {
      for (let i = 0; i < assetsToAdd.length; i++) {
        const asset = assetsToAdd[i];
        // Only generate if alt text is empty
        if (!asset.altText || asset.altText.trim() === "") {
          try {
            const altText = await generateAltText(asset.uri);
            // Find the index in selectedImages array
            const imageIndex = imagePicker.selectedImages.findIndex(
              img => img.uri === asset.uri
            );
            if (imageIndex !== -1) {
              imagePicker.updateAltText(imageIndex, altText);
            }
          } catch (error) {
            // Silently handle errors - log but don't block compose flow
            logger.error("Failed to auto-generate alt text:", error);
          }
        }
      }
    }
  };

  const handleCancelImageEditor = () => {
    setImageEditorVisible(false);
    setImagesToEdit([]);
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

  const handleGenerateAltText = async () => {
    if (selectedImageIndex === null) return;

    setIsGeneratingAltText(true);
    try {
      const imageUri = imagePicker.selectedImages[selectedImageIndex].uri;
      const generatedText = await generateAltText(imageUri);
      setTempAltText(generatedText);
      triggerHaptic('success');
    } catch (error) {
      logger.error('Failed to generate alt text:', error);
      Alert.alert(
        'Generation Failed',
        error instanceof Error ? error.message : 'Failed to generate alt text. Please try again.',
        [{ text: 'OK' }]
      );
      triggerHaptic('error');
    } finally {
      setIsGeneratingAltText(false);
    }
  };

  // Handle language selection
  const handleSelectLanguages = async (langs: string[]) => {
    setSelectedLanguages(langs);
    // Save to preferences
    try {
      await preferencesService.set('postLanguages', langs);
    } catch (error) {
      logger.error('Failed to save language preference:', error);
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
                threadPosts[0].images.forEach(_img => {
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
    const image = await imagePicker.pickFromCamera(true);
    if (image) {
      const newPosts = [...threadPosts];
      newPosts[postIndex].images.push(image);
      setThreadPosts(newPosts);

      // Auto-generate alt text if enabled
      if (preferences?.autoGenerateAltText && (!image.altText || image.altText.trim() === "")) {
        try {
          const altText = await generateAltText(image.uri);
          image.altText = altText;
          // Update the post with the new alt text
          const updatedPosts = [...newPosts];
          setThreadPosts(updatedPosts);
        } catch (error) {
          logger.error("Failed to auto-generate alt text for thread image:", error);
        }
      }
    }
  };

  const handleThreadImageFromLibrary = async (postIndex: number) => {
    const images = await imagePicker.pickFromLibrary(true);
    if (images && images.length > 0) {
      const newPosts = [...threadPosts];
      images.forEach(image => {
        newPosts[postIndex].images.push(image);
      });
      setThreadPosts(newPosts);

      // Auto-generate alt text if enabled for each image
      if (preferences?.autoGenerateAltText) {
        for (const image of images) {
          if (!image.altText || image.altText.trim() === "") {
            try {
              const altText = await generateAltText(image.uri);
              image.altText = altText;
            } catch (error) {
              logger.error("Failed to auto-generate alt text for thread image:", error);
            }
          }
        }
        // Update the posts with the new alt text
        const updatedPosts = [...newPosts];
        setThreadPosts(updatedPosts);
      }
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
      // Add link preview as external embed if detected
      else if (linkPreview.metadata) {
        postOptions.external = {
          uri: linkPreview.metadata.url,
          title: linkPreview.metadata.title,
          description: linkPreview.metadata.description,
          thumb: linkPreview.metadata.imageUrl,
        };
      }

      await createPost.mutateAsync(postOptions);

      // Delete draft if this was loaded from a draft
      if (loadedDraftId) {
        try {
          await deleteDraft.mutateAsync(loadedDraftId);
        } catch (error) {
          logger.error('Failed to delete draft after posting:', error);
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

  // Enable cmd+Enter keyboard shortcut to submit post
  useKeyboardShortcuts({
    onCmdEnter: () => {
      if (!isPostDisabled && !createPost.isPending) {
        handlePost();
      }
    },
  });

  const charCount = text.length;

  const placeholderText = replyTo
    ? "Post your reply"
    : quoteTo
    ? "Add your thoughts"
    : "What's happening?";

  const styles = useMemo(() => createStyles(colors), [colors]);

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
            <ActivityIndicator color={colors.text} size="small" />
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
            placeholderTextColor={colors.textTertiary}
            multiline
            autoFocus
            value={text}
            onChangeText={handleTextChange}
            editable={!createPost.isPending && !imagePicker.isUploading}
          />

          {/* Link Preview */}
          {linkPreview.metadata && !gifPicker.selectedGif && (
            <LinkPreviewCard
              metadata={linkPreview.metadata}
              onDismiss={linkPreview.clearPreview}
            />
          )}

          {/* Media Previews */}
          <ComposeMediaPreview
            selectedImages={imagePicker.selectedImages}
            onRemoveImage={handleRemoveImage}
            onAddAltText={handleAddAltText}
            isImageUploading={imagePicker.isUploading}
            selectedVideo={videoPicker.selectedVideo}
            onRemoveVideo={handleRemoveVideo}
            formatVideoDuration={videoPicker.formatDuration}
            isVideoUploading={videoPicker.isUploading}
            selectedGif={gifPicker.selectedGif}
            onRemoveGif={handleRemoveGif}
          />

          {/* Quote Preview */}
          {quoteTo && <ComposeQuotePreview quoteTo={quoteTo} />}
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

      <ComposeToolbar
        onImagePicker={handleImagePicker}
        onVideoPicker={handleVideoPicker}
        onGifPicker={handleGifPicker}
        onEmojiPicker={handleEmojiPicker}
        onToggleThreadMode={handleToggleThreadMode}
        onLanguagePickerOpen={() => setLanguagePickerVisible(true)}
        selectedImages={imagePicker.selectedImages}
        selectedVideo={videoPicker.selectedVideo}
        selectedGif={gifPicker.selectedGif}
        isImageUploading={imagePicker.isUploading}
        isVideoUploading={videoPicker.isUploading}
        isThreadMode={isThreadMode}
        replyTo={replyTo}
        quoteTo={quoteTo}
        charCount={charCount}
        maxLength={MAX_POST_LENGTH}
        selectedLanguages={selectedLanguages}
        bottomInset={insets.bottom}
      />

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
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            )}
            <TouchableOpacity
              style={[styles.generateAltTextButton, isGeneratingAltText && styles.generateAltTextButtonDisabled]}
              onPress={handleGenerateAltText}
              disabled={isGeneratingAltText}
            >
              {isGeneratingAltText ? (
                <>
                  <ActivityIndicator size="small" color={colors.primary} style={styles.generateButtonSpinner} />
                  <Text style={styles.generateAltTextButtonText}>Generating...</Text>
                </>
              ) : (
                <Text style={styles.generateAltTextButtonText}>✨ Generate with AI</Text>
              )}
            </TouchableOpacity>
            <TextInput
              style={styles.altTextInput}
              placeholder="Describe this image..."
              placeholderTextColor={colors.textTertiary}
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

      {/* Image Editor Modal */}
      <ImageEditor
        visible={imageEditorVisible}
        images={imagesToEdit}
        onSave={handleSaveEditedImages}
        onCancel={handleCancelImageEditor}
      />
    </View>
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
    fontSize: 14,
    fontWeight: "500",
  },
  cancelTouchable: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
  },
  cancelButton: {
    color: colors.textSecondary,
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
    backgroundColor: colors.surface,
    opacity: 0.5,
  },
  postButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 18,
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
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    maxWidth: 150,
  },
  parentPostHandle: {
    color: colors.textTertiary,
    fontSize: 13,
    flex: 1,
  },
  parentPostText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.background,
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
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
  },
  modalCloseButton: {
    color: colors.textSecondary,
    fontSize: 32,
    lineHeight: 32,
  },
  modalDescription: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 12,
  },
  modalImage: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    marginBottom: 12,
    resizeMode: "contain",
  },
  generateAltTextButton: {
    backgroundColor: colors.surfaceElevated,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    flexDirection: "row",
  },
  generateAltTextButtonDisabled: {
    opacity: 0.6,
  },
  generateAltTextButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  generateButtonSpinner: {
    marginRight: 8,
  },
  altTextInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.surfaceElevated,
    borderRadius: 8,
    padding: 12,
    color: colors.text,
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
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  });
}
