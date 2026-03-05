import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { View, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import * as Localization from "expo-localization";
import { useCreatePost } from "../../hooks/api/usePosts";
import { useSaveDraft, useDeleteDraft, useDrafts } from "../../hooks/api";
import { draftToComposerState, ComposerState } from "../../services/drafts";
import { useImagePicker, ImageAsset } from "../../hooks/useImagePicker";
import { useVideoPicker } from "../../hooks/useVideoPicker";
import { useVideoCompression } from "../../hooks/useVideoCompression";
import { useTheme } from "../../contexts/ThemeContext";
import { useSearchActors } from "../../hooks/api/useProfile";
import { useGifPicker } from "../../hooks/useGifPicker";
import { useEmojiPicker } from "../../hooks/useEmojiPicker";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { triggerHaptic } from "../../utils/haptics";
import { preferencesService } from "../../services/preferences";
import { usePreferences } from "../../contexts/PreferencesContext";
import { useToast } from "../../contexts/ToastContext";
import { useTranslation } from "../../hooks/useTranslation";
import { generateAltText } from "../../services/ai-service";
import { useLinkPreview } from "../../hooks/useLinkPreview";
import { createLogger } from "../../utils/logger";
import {
  NativeComposeView,
  setMentionSearchResults,
  setGeneratedAltText,
  setPostResult,
} from "../../../modules/native-compose";
import type { ComposeScreenProps } from "./ComposeScreen";

const logger = createLogger("ComposeScreenNative");

export function ComposeScreenNative({
  replyTo,
  quoteTo,
  draftId,
  sharedUrl,
  sharedText,
  initialText,
  sharedImages,
}: ComposeScreenProps = {}) {
  const { colors } = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  usePreferences();
  const { showToast } = useToast();

  // Core state
  const [text, setText] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [loadedDraftId, setLoadedDraftId] = useState<string | undefined>(draftId);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [isThreadMode, setIsThreadMode] = useState(false);
  const [threadPosts, setThreadPosts] = useState<Array<{ text: string; images: ImageAsset[] }>>([
    { text: "", images: [] },
  ]);

  // Hooks
  const createPost = useCreatePost();
  const imagePicker = useImagePicker();
  const videoPicker = useVideoPicker();
  const videoCompression = useVideoCompression();
  const saveDraft = useSaveDraft();
  const deleteDraft = useDeleteDraft();
  const { data: draftsData } = useDrafts();
  const gifPicker = useGifPicker();
  const emojiPicker = useEmojiPicker();
  const linkPreview = useLinkPreview(text);

  // Mention search
  const [mentionQuery, setMentionQuery] = useState("");
  const [debouncedMentionQuery, setDebouncedMentionQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedMentionQuery(mentionQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [mentionQuery]);

  const { data: searchResults } = useSearchActors(debouncedMentionQuery);

  // Forward mention results to native
  useEffect(() => {
    if (searchResults && searchResults.length > 0) {
      const serialized = searchResults.map(
        (actor: { did: string; handle: string; displayName?: string; avatar?: string }) => ({
          did: actor.did,
          handle: actor.handle,
          displayName: actor.displayName || null,
          avatar: actor.avatar || null,
        })
      );
      setMentionSearchResults(JSON.stringify(serialized));
    } else {
      setMentionSearchResults("[]");
    }
  }, [searchResults]);

  // Initialize language from preferences
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
      } catch {
        setSelectedLanguages(["en"]);
      }
    };
    initLanguage();
  }, []);

  // Initialize with shared content
  useEffect(() => {
    if (initialText) {
      setText(initialText);
    } else if (sharedUrl || sharedText) {
      let composedText = "";
      if (sharedText) composedText = sharedText;
      if (sharedUrl) {
        composedText = composedText ? `${composedText}\n\n${sharedUrl}` : sharedUrl;
      }
      setText(composedText);
    }
  }, [sharedUrl, sharedText, initialText]);

  // Load shared images
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

  // Load draft
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
          })
          .catch((error) => {
            logger.error("Failed to load draft:", error);
          });
      }
    }
  }, [draftId, draftsData]);

  // Auto-compress video
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

  // Build media JSON for native view
  const mediaJson = useMemo(() => {
    const media: any[] = [];
    imagePicker.selectedImages.forEach((img, i) => {
      media.push({
        id: `img-${i}`,
        uri: img.uri,
        mimeType: img.mimeType,
        altText: img.altText || "",
        width: img.width,
        height: img.height,
        isVideo: false,
      });
    });
    if (videoPicker.selectedVideo) {
      media.push({
        id: "video-0",
        uri: videoPicker.selectedVideo.uri,
        mimeType: "video/mp4",
        altText: "",
        width: 0,
        height: 0,
        isVideo: true,
        thumbnail: videoPicker.selectedVideo.thumbnail,
        duration: videoPicker.selectedVideo.duration,
      });
    }
    if (gifPicker.selectedGif) {
      media.push({
        id: "gif-0",
        uri: gifPicker.selectedGif.url,
        mimeType: "image/gif",
        altText: gifPicker.selectedGif.title,
        width: 0,
        height: 0,
        isVideo: false,
      });
    }
    return media.length > 0 ? JSON.stringify(media) : undefined;
  }, [imagePicker.selectedImages, videoPicker.selectedVideo, gifPicker.selectedGif]);

  // Build reply/quote JSON
  const replyToJson = useMemo(() => {
    if (!replyTo) return undefined;
    return JSON.stringify({
      uri: replyTo.uri,
      cid: replyTo.cid,
      authorHandle: replyTo.author.handle,
      authorDisplayName: replyTo.author.displayName,
      authorAvatar: replyTo.author.avatar,
      text: replyTo.text,
    });
  }, [replyTo]);

  const quoteToJson = useMemo(() => {
    if (!quoteTo) return undefined;
    return JSON.stringify({
      uri: quoteTo.uri,
      cid: quoteTo.cid,
      authorHandle: quoteTo.author.handle,
      authorDisplayName: quoteTo.author.displayName,
      authorAvatar: quoteTo.author.avatar,
      text: quoteTo.text,
    });
  }, [quoteTo]);

  // MARK: - Event Handlers

  const handleClose = useCallback(() => {
    const hasContent =
      isThreadMode
        ? threadPosts.some((p) => p.text.trim() || p.images.length > 0)
        : imagePicker.selectedImages.length > 0 ||
          videoPicker.selectedVideo ||
          text.trim();

    if (hasContent && !isThreadMode) {
      Alert.alert(t("compose.save_draft_title"), t("compose.save_draft_message"), [
        {
          text: t("compose.discard_button"),
          style: "destructive",
          onPress: () => router.back(),
        },
        { text: t("compose.cancel_button"), style: "cancel" },
        { text: t("compose.save_draft_button"), onPress: handleSaveDraft },
      ]);
    } else if (hasContent && isThreadMode) {
      Alert.alert(t("compose.discard_thread_title"), t("compose.discard_thread_message"), [
        { text: t("compose.cancel_button"), style: "cancel" },
        {
          text: t("compose.discard_button"),
          style: "destructive",
          onPress: () => router.back(),
        },
      ]);
    } else {
      router.back();
    }
  }, [text, isThreadMode, threadPosts, imagePicker.selectedImages, videoPicker.selectedVideo]);

  const handleSaveDraft = useCallback(async () => {
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
      triggerHaptic("success");
      showToast("Draft saved", { type: "success" });
      router.back();
    } catch {
      triggerHaptic("error");
      Alert.alert("Error", "Failed to save draft");
    }
  }, [text, imagePicker.selectedImages, quoteTo, replyTo, loadedDraftId]);

  const handlePost = useCallback(
    async (event: {
      nativeEvent: {
        text: string;
        isThreadMode: boolean;
        languages?: string[];
        threadPosts?: Array<{ text: string; images: any[] }>;
      };
    }) => {
      const { text: postText, isThreadMode: isThread } = event.nativeEvent;

      if (isThread) {
        return handlePostThread();
      }

      if (
        !postText.trim() &&
        imagePicker.selectedImages.length === 0 &&
        !videoPicker.selectedVideo &&
        !gifPicker.selectedGif
      ) {
        setPostResult(false, "No content to post");
        return;
      }

      try {
        setIsPosting(true);
        imagePicker.setIsUploading(true);
        videoPicker.setIsUploading(true);

        const postOptions: any = { text: postText.trim() };

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

        setPostResult(true);
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
          error instanceof Error ? error.message : "Failed to create post. Please try again.";
        setPostResult(false, errorMessage);
        Alert.alert("Error", errorMessage);
      } finally {
        setIsPosting(false);
        setIsUploading(false);
        imagePicker.setIsUploading(false);
        imagePicker.setUploadProgress(0);
        videoPicker.setIsUploading(false);
        videoPicker.setUploadProgress(0);
      }
    },
    [
      selectedLanguages,
      replyTo,
      quoteTo,
      imagePicker.selectedImages,
      videoPicker.selectedVideo,
      gifPicker.selectedGif,
      linkPreview.metadata,
      loadedDraftId,
    ]
  );

  const handlePostThread = useCallback(async () => {
    const validPosts = threadPosts.filter((p) => p.text.trim() || p.images.length > 0);
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
      setIsPosting(true);
      imagePicker.setIsUploading(true);

      const { createThread } = await import("../../services/atproto/posts");

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
      setPostResult(true);

      if (result.failureCount > 0) {
        showToast(
          `Posted ${result.successCount} of ${validPosts.length} posts. Some posts failed.`,
          { type: "warning" }
        );
      } else {
        showToast("Thread published!", { type: "success" });
      }

      router.back();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create thread. Please try again.";
      setPostResult(false, errorMessage);
      Alert.alert("Error", errorMessage);
    } finally {
      setIsPosting(false);
      setIsUploading(false);
      imagePicker.setIsUploading(false);
      imagePicker.setUploadProgress(0);
    }
  }, [threadPosts, selectedLanguages, replyTo]);

  const handleTextChange = useCallback((event: { nativeEvent: { text: string } }) => {
    setText(event.nativeEvent.text);
  }, []);

  const handleImagePicker = useCallback(() => {
    if (videoPicker.selectedVideo) {
      Alert.alert(
        "Media Type Conflict",
        "You can attach either images or a video, not both. Remove the video first to add images."
      );
      return;
    }
    Alert.alert("Add Image", "Choose an option", [
      {
        text: "Take Photo",
        onPress: async () => {
          const image = await imagePicker.pickFromCamera(false);
          if (image) imagePicker.addImages([image]);
        },
      },
      {
        text: "Choose from Library",
        onPress: async () => {
          const images = await imagePicker.pickFromLibrary(false);
          if (images && images.length > 0) imagePicker.addImages(images);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [videoPicker.selectedVideo]);

  const handleVideoPicker = useCallback(() => {
    if (imagePicker.selectedImages.length > 0) {
      Alert.alert(
        "Media Type Conflict",
        "You can attach either images or a video, not both. Remove the images first to add a video."
      );
      return;
    }
    Alert.alert("Add Video", "Choose an option", [
      { text: "Record Video", onPress: () => videoPicker.recordVideo() },
      { text: "Choose from Library", onPress: () => videoPicker.pickFromLibrary() },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [imagePicker.selectedImages.length]);

  const handleGifPicker = useCallback(() => {
    if (imagePicker.selectedImages.length > 0 || videoPicker.selectedVideo) {
      Alert.alert(
        "Media Already Attached",
        "Remove images or video first to add a GIF."
      );
      return;
    }
    if (gifPicker.selectedGif) {
      Alert.alert("GIF Already Added", "You already have a GIF attached. Remove it first.");
      return;
    }
    gifPicker.open();
  }, [imagePicker.selectedImages.length, videoPicker.selectedVideo, gifPicker.selectedGif]);

  const handleEmojiPicker = useCallback(() => {
    emojiPicker.open();
  }, []);

  const handleRemoveMedia = useCallback(
    (event: { nativeEvent: { index: number } }) => {
      const { index } = event.nativeEvent;
      // Determine if it's an image, video, or GIF
      const imageCount = imagePicker.selectedImages.length;
      if (index < imageCount) {
        imagePicker.removeImage(index);
      } else if (videoPicker.selectedVideo) {
        videoCompression.cancel();
        videoCompression.reset();
        processedVideoUrisRef.current.clear();
        videoPicker.removeVideo();
      } else if (gifPicker.selectedGif) {
        gifPicker.clearSelection();
      }
    },
    [imagePicker.selectedImages.length, videoPicker.selectedVideo, gifPicker.selectedGif]
  );

  const handleGenerateAltText = useCallback(
    async (event: { nativeEvent: { index: number } }) => {
      const { index } = event.nativeEvent;
      if (index >= imagePicker.selectedImages.length) return;
      try {
        const imageUri = imagePicker.selectedImages[index].uri;
        const generatedText = await generateAltText(imageUri);
        imagePicker.updateAltText(index, generatedText);
        setGeneratedAltText(index, generatedText);
        triggerHaptic("success");
      } catch (error) {
        logger.error("Failed to generate alt text:", error);
        setGeneratedAltText(index, "");
        triggerHaptic("error");
      }
    },
    [imagePicker.selectedImages]
  );

  const handleSaveAltText = useCallback(
    (event: { nativeEvent: { index: number; altText: string } }) => {
      const { index, altText } = event.nativeEvent;
      imagePicker.updateAltText(index, altText);
    },
    []
  );

  const handleMentionSearch = useCallback(
    async (event: { nativeEvent: { query: string } }) => {
      setMentionQuery(event.nativeEvent.query);
    },
    []
  );

  const handleLanguagePicker = useCallback(() => {
    // Bridge to JS language picker modal
    // For now, cycle through common languages
    Alert.alert("Select Language", "Choose post language", [
      {
        text: "English",
        onPress: () => {
          setSelectedLanguages(["en"]);
          preferencesService.set("postLanguages", ["en"]).catch(err => logger.error('Failed to save language preference:', err));
        },
      },
      {
        text: "Spanish",
        onPress: () => {
          setSelectedLanguages(["es"]);
          preferencesService.set("postLanguages", ["es"]).catch(err => logger.error('Failed to save language preference:', err));
        },
      },
      {
        text: "Portuguese",
        onPress: () => {
          setSelectedLanguages(["pt"]);
          preferencesService.set("postLanguages", ["pt"]).catch(err => logger.error('Failed to save language preference:', err));
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, []);

  const handleToggleThreadMode = useCallback(
    (event: { nativeEvent: { isThreadMode: boolean } }) => {
      setIsThreadMode(event.nativeEvent.isThreadMode);
    },
    []
  );

  const handleUpdateThreadPost = useCallback(
    (event: { nativeEvent: { index: number; text: string } }) => {
      const { index, text: postText } = event.nativeEvent;
      setThreadPosts((prev) => {
        const next = [...prev];
        if (next[index]) {
          next[index] = { ...next[index], text: postText };
        }
        return next;
      });
    },
    []
  );

  // Keyboard shortcut
  useKeyboardShortcuts({
    onCmdEnter: () => {
      if (!isPosting && text.trim()) {
        handlePost({
          nativeEvent: {
            text,
            isThreadMode,
          },
        });
      }
    },
  });

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <NativeComposeView
        style={styles.composeView}
        text={text}
        draftId={loadedDraftId}
        selectedLanguages={JSON.stringify(selectedLanguages)}
        mediaJson={mediaJson}
        replyToJson={replyToJson}
        quoteToJson={quoteToJson}
        isThreadMode={isThreadMode}
        isPosting={isPosting || createPost.isPending}
        isUploading={
          isUploading ||
          imagePicker.isUploading ||
          videoPicker.isUploading ||
          videoCompression.isCompressing
        }
        onClose={handleClose}
        onPost={handlePost}
        onSaveDraft={handleSaveDraft}
        onOpenDrafts={() => router.push("/(app)/drafts")}
        onTextChange={handleTextChange}
        onImagePicker={handleImagePicker}
        onVideoPicker={handleVideoPicker}
        onGifPicker={handleGifPicker}
        onEmojiPicker={handleEmojiPicker}
        onLanguagePicker={handleLanguagePicker}
        onRemoveMedia={handleRemoveMedia}
        onGenerateAltText={handleGenerateAltText}
        onSaveAltText={handleSaveAltText}
        onToggleThreadMode={handleToggleThreadMode}
        onAddThreadPost={() =>
          setThreadPosts((prev) => [...prev, { text: "", images: [] }])
        }
        onRemoveThreadPost={(event) => {
          const { index } = event.nativeEvent;
          setThreadPosts((prev) => prev.filter((_, i) => i !== index));
        }}
        onUpdateThreadPost={handleUpdateThreadPost}
        onMentionSearch={handleMentionSearch}
        onThreadImagePicker={(event) => {
          const { index } = event.nativeEvent;
          Alert.alert("Add Image", "Choose an option", [
            {
              text: "Take Photo",
              onPress: async () => {
                const image = await imagePicker.pickFromCamera(true);
                if (image) {
                  setThreadPosts((prev) => {
                    const next = [...prev];
                    if (next[index]) {
                      next[index] = {
                        ...next[index],
                        images: [...next[index].images, image],
                      };
                    }
                    return next;
                  });
                }
              },
            },
            {
              text: "Choose from Library",
              onPress: async () => {
                const images = await imagePicker.pickFromLibrary(true);
                if (images && images.length > 0) {
                  setThreadPosts((prev) => {
                    const next = [...prev];
                    if (next[index]) {
                      next[index] = {
                        ...next[index],
                        images: [...next[index].images, ...images],
                      };
                    }
                    return next;
                  });
                }
              },
            },
            { text: "Cancel", style: "cancel" },
          ]);
        }}
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
    composeView: {
      flex: 1,
    },
  });
}
