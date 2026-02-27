import * as Localization from "expo-localization";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { ThreadPost } from "../../../components/ThreadPostItem";
import { usePreferences } from "../../../contexts/PreferencesContext";
import { useToast } from "../../../contexts/ToastContext";
import { useDeleteDraft, useDrafts, useSaveDraft } from "../../../hooks/api";
import { useCreatePost } from "../../../hooks/api/usePosts";
import {
  clearAutoSavedCompose,
  consumeAutoSavedCompose,
  useComposeAutoSave,
} from "../../../hooks/useComposeAutoSave";
import { useGifPicker } from "../../../hooks/useGifPicker";
import { ImageAsset, useImagePicker } from "../../../hooks/useImagePicker";
import { useKeyboardShortcuts } from "../../../hooks/useKeyboardShortcuts";
import { useLinkPreview } from "../../../hooks/useLinkPreview";
import { useTranslation } from "../../../hooks/useTranslation";
import { useVideoCompression } from "../../../hooks/useVideoCompression";
import { useVideoPicker } from "../../../hooks/useVideoPicker";
import { generateAltText } from "../../../services/ai-service";
import { ComposerState, draftToComposerState } from "../../../services/drafts";
import { preferencesService } from "../../../services/preferences";
import { triggerHaptic } from "../../../utils/haptics";
import { createLogger } from "../../../utils/logger";
import type { ComposeScreenProps } from "../ComposeScreen";

const logger = createLogger("ComposeScreen");
export const MAX_POST_LENGTH = 300;

export function useComposeDraft(props: ComposeScreenProps = {}) {
  const {
    replyTo,
    quoteTo,
    draftId,
    sharedUrl,
    sharedText,
    initialText,
    sharedImages,
  } = props;

  const router = useRouter();
  const { t } = useTranslation();
  const { preferences } = usePreferences();
  const { showToast } = useToast();

  // Core text state
  const [text, setText] = useState("");

  // Hooks
  const createPost = useCreatePost();
  const imagePicker = useImagePicker();
  const videoPicker = useVideoPicker();
  const videoCompression = useVideoCompression();
  const saveDraft = useSaveDraft();
  const deleteDraft = useDeleteDraft();
  const { data: draftsData } = useDrafts();
  const gifPicker = useGifPicker();
  const linkPreview = useLinkPreview(text);

  // Draft state
  const [loadedDraftId, setLoadedDraftId] = useState<string | undefined>(
    draftId,
  );
  const [, setIsDirty] = useState(false);

  // Language selection state
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);

  // Thread mode state
  const [isThreadMode, setIsThreadMode] = useState(false);
  const [threadPosts, setThreadPosts] = useState<ThreadPost[]>([
    { text: "", images: [] },
  ]);
  const [, setActiveThreadPostIndex] = useState<number | null>(null);

  // Auto-save compose text to MMKV when the app backgrounds
  useComposeAutoSave(text);

  // Restore auto-saved compose text on mount (if no other content is provided)
  useEffect(() => {
    if (draftId || sharedUrl || sharedText || initialText || replyTo || quoteTo)
      return;
    const saved = consumeAutoSavedCompose();
    if (saved) {
      setText(saved);
      showToast("Restored unsaved compose text", { type: "info" });
    }
  }, []);

  // Initialize language from preferences or device locale
  useEffect(() => {
    const initLanguage = async () => {
      try {
        const prefs = await preferencesService.get();
        if (prefs.postLanguages && prefs.postLanguages.length > 0) {
          setSelectedLanguages(prefs.postLanguages);
        } else {
          const locales = Localization.getLocales();
          const deviceLanguage = locales[0]?.languageCode || "en";
          setSelectedLanguages([deviceLanguage]);
        }
      } catch (error) {
        setSelectedLanguages(["en"]);
      }
    };
    initLanguage();
  }, []);

  // Load draft if draftId is provided
  useEffect(() => {
    if (draftId && draftsData) {
      const allDrafts = draftsData.pages.flatMap((page) => page.drafts);
      const draft = allDrafts.find((d) => d.id === draftId);

      if (draft) {
        draftToComposerState(draft)
          .then((state) => {
            setText(state.text);
            if (state.images && state.images.length > 0) {
              imagePicker.clearImages();
              const imageAssets: ImageAsset[] = state.images.map((img) => ({
                uri: img.uri,
                width: 0,
                height: 0,
                mimeType: img.mimeType || "image/jpeg",
                altText: img.altText || "",
              }));
              imagePicker.addImages(imageAssets);
            }
            setLoadedDraftId(draftId);
            setIsDirty(false);
          })
          .catch((error) => {
            logger.error("Failed to load draft:", error);
            Alert.alert("Error", "Failed to load draft");
          });
      }
    }
  }, [draftId, draftsData]);

  // Initialize with shared content from Share Extension
  useEffect(() => {
    if (initialText) {
      setText(initialText);
    } else if (sharedUrl || sharedText) {
      let composedText = "";
      if (sharedText) {
        composedText = sharedText;
      }
      if (sharedUrl) {
        composedText = composedText
          ? `${composedText}\n\n${sharedUrl}`
          : sharedUrl;
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
      mimeType: "image/jpeg",
      altText: "",
    }));
    imagePicker.addImages(imageAssets);
  }, [sharedImages]);

  // Auto-compress video when selected
  const processedVideoUrisRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const video = videoPicker.selectedVideo;
    if (!video) return;
    if (processedVideoUrisRef.current.has(video.uri)) return;
    processedVideoUrisRef.current.add(video.uri);

    if (video.fileSize && videoCompression.shouldCompress(video.fileSize)) {
      videoCompression
        .compress(video.uri, video.fileSize)
        .then((result) => {
          if (result.wasCompressed && result.uri) {
            processedVideoUrisRef.current.add(result.uri);
            videoPicker.updateVideoUri(result.uri, result.compressedSize);
            triggerHaptic("success");
          }
        })
        .catch((error) => {
          logger.error("Auto-compression failed:", error);
        });
    }
  }, [videoPicker.selectedVideo?.uri]);

  // Mark as dirty when content changes
  useEffect(() => {
    if (
      loadedDraftId ||
      text ||
      imagePicker.selectedImages.length > 0 ||
      videoPicker.selectedVideo
    ) {
      setIsDirty(true);
    }
  }, [text, imagePicker.selectedImages, videoPicker.selectedVideo]);

  // Handle language selection
  const handleSelectLanguages = async (langs: string[]) => {
    setSelectedLanguages(langs);
    try {
      await preferencesService.set("postLanguages", langs);
    } catch (error) {
      logger.error("Failed to save language preference:", error);
    }
  };

  // Save draft
  const handleSaveDraft = async () => {
    try {
      const composerState: ComposerState = {
        text: text.trim(),
        images:
          imagePicker.selectedImages.length > 0
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

      clearAutoSavedCompose();
      triggerHaptic("success");
      showToast("Draft saved", { type: "success" });
      router.back();
    } catch (error) {
      triggerHaptic("error");
      Alert.alert("Error", "Failed to save draft");
    }
  };

  // Close / discard
  const handleClose = () => {
    const hasContent = isThreadMode
      ? threadPosts.some((p) => p.text.trim() || p.images.length > 0)
      : imagePicker.selectedImages.length > 0 ||
        videoPicker.selectedVideo ||
        text.trim();

    if (hasContent && !isThreadMode) {
      Alert.alert(
        t("compose.save_draft_title"),
        t("compose.save_draft_message"),
        [
          {
            text: t("compose.discard_button"),
            style: "destructive",
            onPress: () => {
              clearAutoSavedCompose();
              router.back();
            },
          },
          { text: t("compose.cancel_button"), style: "cancel" },
          { text: t("compose.save_draft_button"), onPress: handleSaveDraft },
        ],
      );
    } else if (hasContent && isThreadMode) {
      Alert.alert(
        t("compose.discard_thread_title"),
        t("compose.discard_thread_message"),
        [
          { text: t("compose.cancel_button"), style: "cancel" },
          {
            text: t("compose.discard_button"),
            style: "destructive",
            onPress: () => {
              clearAutoSavedCompose();
              router.back();
            },
          },
        ],
      );
    } else {
      clearAutoSavedCompose();
      router.back();
    }
  };

  // Thread mode handlers
  const handleToggleThreadMode = () => {
    if (isThreadMode) {
      if (threadPosts.some((p) => p.text.trim() || p.images.length > 0)) {
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
                setIsThreadMode(false);
                setThreadPosts([{ text: "", images: [] }]);
              },
            },
          ],
        );
      } else {
        setIsThreadMode(false);
        setThreadPosts([{ text: "", images: [] }]);
      }
    } else {
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
    Alert.alert("Add Image", "Choose an option", [
      {
        text: "Take Photo",
        onPress: () => handleThreadImageFromCamera(postIndex),
      },
      {
        text: "Choose from Library",
        onPress: () => handleThreadImageFromLibrary(postIndex),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleThreadImageFromCamera = async (postIndex: number) => {
    const image = await imagePicker.pickFromCamera(true);
    if (image) {
      const newPosts = [...threadPosts];
      newPosts[postIndex].images.push(image);
      setThreadPosts(newPosts);

      if (
        preferences?.autoGenerateAltText &&
        (!image.altText || image.altText.trim() === "")
      ) {
        try {
          const altText = await generateAltText(image.uri);
          image.altText = altText;
          const updatedPosts = [...newPosts];
          setThreadPosts(updatedPosts);
        } catch (error) {
          logger.error(
            "Failed to auto-generate alt text for thread image:",
            error,
          );
        }
      }
    }
  };

  const handleThreadImageFromLibrary = async (postIndex: number) => {
    const images = await imagePicker.pickFromLibrary(true);
    if (images && images.length > 0) {
      const newPosts = [...threadPosts];
      images.forEach((image) => {
        newPosts[postIndex].images.push(image);
      });
      setThreadPosts(newPosts);

      if (preferences?.autoGenerateAltText) {
        for (const image of images) {
          if (!image.altText || image.altText.trim() === "") {
            try {
              const altText = await generateAltText(image.uri);
              image.altText = altText;
            } catch (error) {
              logger.error(
                "Failed to auto-generate alt text for thread image:",
                error,
              );
            }
          }
        }
        const updatedPosts = [...newPosts];
        setThreadPosts(updatedPosts);
      }
    }
  };

  // Post submission
  const handlePost = async () => {
    if (isThreadMode) {
      return handlePostThread();
    }

    if (
      !text.trim() &&
      imagePicker.selectedImages.length === 0 &&
      !videoPicker.selectedVideo &&
      !gifPicker.selectedGif
    ) {
      return;
    }

    try {
      imagePicker.setIsUploading(true);
      videoPicker.setIsUploading(true);

      const postOptions: any = { text: text.trim() };

      if (selectedLanguages.length > 0) {
        postOptions.langs = selectedLanguages;
      }

      if (replyTo) {
        postOptions.reply = {
          root: { uri: replyTo.uri, cid: replyTo.cid },
          parent: { uri: replyTo.uri, cid: replyTo.cid },
        };
      }

      if (quoteTo) {
        postOptions.quote = { uri: quoteTo.uri, cid: quoteTo.cid };
      }

      if (videoPicker.selectedVideo) {
        postOptions.video = {
          uri: videoPicker.selectedVideo.uri,
          alt: "",
        };
      } else if (imagePicker.selectedImages.length > 0) {
        postOptions.images = imagePicker.selectedImages.map((img) => ({
          uri: img.uri,
          alt: img.altText,
        }));
      } else if (gifPicker.selectedGif) {
        postOptions.external = {
          uri: gifPicker.selectedGif.url,
          title: gifPicker.selectedGif.title,
          description: "GIF from Tenor",
        };
      } else if (linkPreview.metadata) {
        postOptions.external = {
          uri: linkPreview.metadata.url,
          title: linkPreview.metadata.title,
          description: linkPreview.metadata.description,
          thumb: linkPreview.metadata.imageUrl,
        };
      }

      await createPost.mutateAsync(postOptions);

      if (loadedDraftId) {
        try {
          await deleteDraft.mutateAsync(loadedDraftId);
        } catch (error) {
          logger.error("Failed to delete draft after posting:", error);
        }
      }

      clearAutoSavedCompose();
      imagePicker.clearImages();
      videoPicker.clearVideo();
      router.back();
      triggerHaptic("success");
      const successMessage = replyTo
        ? "Reply posted!"
        : quoteTo
          ? "Quote posted!"
          : "Post published!";
      showToast(successMessage, { type: "success" });
    } catch (error) {
      triggerHaptic("error");
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to create post. Please try again.";
      Alert.alert("Error", errorMessage);
    } finally {
      imagePicker.setIsUploading(false);
      imagePicker.setUploadProgress(0);
      videoPicker.setIsUploading(false);
      videoPicker.setUploadProgress(0);
    }
  };

  const handlePostThread = async () => {
    const validPosts = threadPosts.filter(
      (p) => p.text.trim() || p.images.length > 0,
    );
    if (validPosts.length === 0) {
      Alert.alert("Error", "Thread must have at least one post with content.");
      return;
    }

    const overLimitPosts = validPosts.filter((p) => p.text.length > 300);
    if (overLimitPosts.length > 0) {
      Alert.alert("Error", "Some posts exceed the 300 character limit.");
      return;
    }

    try {
      imagePicker.setIsUploading(true);

      const { createThread } = await import("../../../services/atproto/posts");

      const threadOptions: any = {
        posts: validPosts.map((p) => ({
          text: p.text.trim(),
          images: p.images.map((img) => ({
            uri: img.uri,
            alt: img.altText,
          })),
          langs: selectedLanguages.length > 0 ? selectedLanguages : undefined,
        })),
      };

      if (replyTo) {
        threadOptions.reply = {
          root: { uri: replyTo.uri, cid: replyTo.cid },
          parent: { uri: replyTo.uri, cid: replyTo.cid },
        };
      }

      const result = await createThread(threadOptions);

      if (result.failureCount > 0) {
        showToast(
          `Posted ${result.successCount} of ${validPosts.length} posts. Some posts failed.`,
          { type: "warning" },
        );
      } else {
        showToast("Thread published!", { type: "success" });
      }

      router.back();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to create thread. Please try again.";
      Alert.alert("Error", errorMessage);
    } finally {
      imagePicker.setIsUploading(false);
      imagePicker.setUploadProgress(0);
    }
  };

  const isPostDisabled = isThreadMode
    ? threadPosts.every((p) => !p.text.trim() && p.images.length === 0) ||
      threadPosts.some((p) => p.text.length > MAX_POST_LENGTH) ||
      imagePicker.isUploading ||
      videoPicker.isUploading
    : (!text.trim() &&
        imagePicker.selectedImages.length === 0 &&
        !videoPicker.selectedVideo &&
        !gifPicker.selectedGif) ||
      text.length > MAX_POST_LENGTH ||
      imagePicker.isUploading ||
      videoPicker.isUploading ||
      videoCompression.isCompressing;

  // Enable cmd+Enter keyboard shortcut to submit post
  useKeyboardShortcuts({
    onCmdEnter: () => {
      if (!isPostDisabled && !createPost.isPending) {
        handlePost();
      }
    },
  });

  return {
    // Text
    text,
    setText,
    charCount: text.length,

    // Post
    createPost,
    handlePost,
    isPostDisabled,

    // Draft
    handleSaveDraft,
    handleClose,

    // Thread
    isThreadMode,
    threadPosts,
    setIsThreadMode,
    setThreadPosts,
    handleToggleThreadMode,
    handleUpdateThreadPost,
    handleAddThreadPost,
    handleRemoveThreadPost,
    handleThreadImagePicker,

    // Language
    selectedLanguages,
    languagePickerVisible,
    setLanguagePickerVisible,
    handleSelectLanguages,

    // Media pickers (pass-through)
    imagePicker,
    videoPicker,
    videoCompression,
    gifPicker,
    linkPreview,
    processedVideoUrisRef,

    // Props pass-through
    replyTo,
    quoteTo,
    preferences,
    router,
    showToast,
  };
}
