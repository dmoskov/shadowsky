/**
 * ComposerRefactored - Refactored post composer with progressive disclosure
 *
 * This is the refactored version of Composer.tsx with layered progressive disclosure:
 * - Level 1 (Primary): ComposerTextArea + basic media upload - always visible
 * - Level 2 (Standard): ComposerThreading + ComposerScheduling - expandable section
 * - Level 3 (Advanced): ComposerAIFeatures (tone, hashtags, optimization) - expandable section
 *
 * Feature flag: enableProgressiveDisclosure controls the layered UI
 */

import { RichText } from "@atproto/api";
import {
  AlertCircle,
  CheckCircle,
  FileText,
  Image,
  Loader,
  MessageSquare,
  Plus,
  Save,
  Send,
  Split,
  Trash2,
  Undo,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useRef } from "react";
import { useGifPicker } from "../../hooks/useGifPicker";
import { PostgateService } from "../../services/atproto/postgate";
import { ThreadgateService } from "../../services/atproto/threadgate";
import {
  deleteDraft,
  generateDraftId,
  getDrafts,
  saveDraft,
  type ThreadDraft,
} from "../../services/drafts";
import type { TenorGif } from "../../services/tenor";
import { getBestGifUrl, getGifDimensions } from "../../services/tenor";
import { debug } from "../../shared/debug";
import { uploadBlobWithRetry } from "../../utils/blob-upload";
import { isGifFile } from "../../utils/gif-to-video";
import {
  compressImage,
  isCompressibleImage,
} from "../../utils/image-compression";
import { createLogger } from "../../utils/logger";
import { EmojiPicker } from "../EmojiPicker";
import { GifPicker } from "../GifPicker";
import type { MentionTypeaheadHandle } from "../MentionTypeahead";
import { QuoteControl, ReplyControls } from "../ReplyControls";
import { ThreadComposer } from "../ThreadComposer";
import { UploadProgressBar } from "../ui/UploadProgressBar";
import { ComposerAIFeatures } from "./ComposerAIFeatures";
import { ComposerMediaUpload } from "./ComposerMediaUpload";
import { ComposerSettings } from "./ComposerSettings";
import { ComposerTextArea } from "./ComposerTextArea";
import { ComposerThreadPreview } from "./ComposerThreadPreview";
import { ComposerToolbar } from "./ComposerToolbar";
import {
  MAX_IMAGE_SIZE,
  MAX_IMAGES_PER_POST,
  MAX_VIDEO_DURATION,
  MAX_VIDEO_SIZE,
  SUPPORTED_VIDEO_FORMATS,
  type ToneOption,
  type UploadedMedia,
} from "./types";
import { useComposerFeatureFlags } from "./useComposerFeatureFlags";
import { useComposerState } from "./useComposerState";
import { applyNumbering, generateMediaId, getVideoDuration } from "./utils";

const logger = createLogger("ComposerRefactored");

export function ComposerRefactored() {
  const state = useComposerState();
  const { enableProgressiveDisclosure, defaultDisclosureLevel } =
    useComposerFeatureFlags();
  const gifPicker = useGifPicker();

  const textareaRef = useRef<MentionTypeaheadHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Store the auto-generate alt text function in ref
  useEffect(() => {
    state.autoGenerateAltTextRef.current = autoGenerateAltTextForMedia;
  }, [autoGenerateAltTextForMedia]);

  // Paste handler
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const items = Array.from(e.clipboardData.items);
      const imageItems = items.filter(
        (item) => item.type.indexOf("image") !== -1,
      );

      if (imageItems.length === 0) return;

      e.preventDefault();

      // Check for GIF embed
      if (state.gifEmbed) {
        state.setPostStatus({
          type: "error",
          message: "Cannot add images when GIF is attached",
        });
        return;
      }

      const hasVideo = state.media.some((m) => m.type === "video");
      if (hasVideo) {
        state.setPostStatus({
          type: "error",
          message: "Cannot add images when a video is present",
        });
        return;
      }

      const currentImageCount = state.media.filter(
        (m) => m.type === "image",
      ).length;
      if (currentImageCount >= MAX_IMAGES_PER_POST) {
        state.setPostStatus({
          type: "error",
          message: `Maximum ${MAX_IMAGES_PER_POST} images per post`,
        });
        return;
      }

      for (const item of imageItems) {
        const blob = item.getAsFile();
        if (!blob) continue;

        let file = new File(
          [blob],
          `pasted-image-${Date.now()}.${blob.type.split("/")[1]}`,
          { type: blob.type },
        );

        if (file.size > MAX_IMAGE_SIZE && isCompressibleImage(file)) {
          try {
            state.setPostStatus({
              type: "loading",
              message: "Compressing image...",
            });
            file = await compressImage(file);
            state.setPostStatus(null);
          } catch (error) {
            logger.error("Failed to compress image:", error);
            state.setPostStatus({
              type: "error",
              message: "Failed to compress image",
            });
            continue;
          }
        }

        const previewUrl = URL.createObjectURL(blob);
        state.mediaUrlsRef.current.add(previewUrl);
        const newMedia: UploadedMedia = {
          id: generateMediaId(),
          file,
          preview: previewUrl,
          alt: "",
          type: "image",
        };

        state.setMedia((prev) => [...prev, newMedia]);
        state.setPostStatus({ type: "success", message: "Image pasted!" });
        setTimeout(() => state.setPostStatus({ type: "idle" }), 2000);

        if (state.autoGenerateAltText && state.autoGenerateAltTextRef.current) {
          setTimeout(() => {
            state.autoGenerateAltTextRef.current?.(newMedia.id);
          }, 100);
        }

        if (
          state.media.filter((m) => m.type === "image").length + 1 >=
          MAX_IMAGES_PER_POST
        ) {
          break;
        }
      }
    },
    [state],
  );

  // Media selection handler
  const handleMediaSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      // Check for GIF embed
      if (state.gifEmbed) {
        state.setPostStatus({
          type: "error",
          message: "Cannot add media when GIF is attached",
        });
        return;
      }

      const files = Array.from(e.target.files || []);
      const hasVideo = state.media.some((m) => m.type === "video");

      const validFiles = files.filter((file) => {
        const isImage = file.type.startsWith("image/");
        const isVideo =
          file.type.startsWith("video/") ||
          SUPPORTED_VIDEO_FORMATS.some((format) =>
            file.name.toLowerCase().endsWith(format),
          );

        if (!isImage && !isVideo) {
          state.setPostStatus({
            type: "error",
            message: `${file.name} is not a supported media file`,
          });
          return false;
        }

        if (isVideo && hasVideo) {
          state.setPostStatus({
            type: "error",
            message: "Only one video per post is allowed",
          });
          return false;
        }

        if (isVideo && state.media.length > 0) {
          state.setPostStatus({
            type: "error",
            message: "Cannot mix videos with images",
          });
          return false;
        }

        if (isImage && hasVideo) {
          state.setPostStatus({
            type: "error",
            message: "Cannot add images when a video is present",
          });
          return false;
        }

        if (isVideo && file.size > MAX_VIDEO_SIZE) {
          state.setPostStatus({
            type: "error",
            message: `${file.name} is too large (max 500MB for videos)`,
          });
          return false;
        }

        return true;
      });

      for (const file of validFiles) {
        if (state.isDev && isGifFile(file)) {
          // GIF conversion logic (dev only)
          try {
            state.setPostStatus({
              type: "posting",
              message: "Converting GIF to video...",
            });

            const reader = new FileReader();
            const dataUrl = await new Promise<string>((resolve, reject) => {
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });

            const response = await fetch(
              "http://localhost:3002/api/convert-gif",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ gifUrl: dataUrl }),
              },
            );

            if (!response.ok) throw new Error("Failed to convert GIF");

            const videoBlob = await response.blob();

            if (videoBlob.size > MAX_VIDEO_SIZE) {
              state.setPostStatus({
                type: "error",
                message: `Converted video is too large (${(videoBlob.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 500MB.`,
              });
              setTimeout(() => state.setPostStatus({ type: "idle" }), 3000);
              continue;
            }

            const videoFile = new File(
              [videoBlob],
              file.name.replace(".gif", ".mp4"),
              { type: "video/mp4" },
            );

            try {
              const duration = await getVideoDuration(videoFile);
              if (duration > MAX_VIDEO_DURATION) {
                state.setPostStatus({
                  type: "error",
                  message: `Converted video duration (${Math.round(duration)}s) exceeds maximum of ${MAX_VIDEO_DURATION} seconds`,
                });
                setTimeout(() => state.setPostStatus({ type: "idle" }), 3000);
                continue;
              }
            } catch {
              state.setPostStatus({
                type: "error",
                message: "Failed to validate video duration",
              });
              setTimeout(() => state.setPostStatus({ type: "idle" }), 3000);
              continue;
            }

            const previewUrl = URL.createObjectURL(videoBlob);
            state.mediaUrlsRef.current.add(previewUrl);
            const newMedia: UploadedMedia = {
              id: generateMediaId(),
              file: videoFile,
              preview: previewUrl,
              alt: "",
              type: "video",
            };

            state.setMedia((prev) => [...prev, newMedia]);
            state.setPostStatus({
              type: "success",
              message: "GIF converted to video!",
            });
            setTimeout(() => state.setPostStatus({ type: "idle" }), 2000);
          } catch (error) {
            logger.error("GIF conversion failed:", error);
            state.setPostStatus({
              type: "error",
              message: "Failed to convert GIF. Using static image.",
            });

            // Fallback to static image
            let processedFile = file;
            if (file.size > MAX_IMAGE_SIZE && isCompressibleImage(file)) {
              try {
                processedFile = await compressImage(file);
              } catch {
                // Continue with original file
              }
            }

            const previewUrl = URL.createObjectURL(processedFile);
            state.mediaUrlsRef.current.add(previewUrl);
            const newMedia: UploadedMedia = {
              id: generateMediaId(),
              file: processedFile,
              preview: previewUrl,
              alt: "",
              type: "image",
            };
            state.setMedia((prev) => [...prev, newMedia]);
          }
        } else {
          // Regular image/video handling
          let processedFile = file;

          if (
            !file.type.startsWith("video/") &&
            file.size > MAX_IMAGE_SIZE &&
            isCompressibleImage(file)
          ) {
            try {
              state.setPostStatus({
                type: "loading",
                message: `Compressing ${file.name}...`,
              });
              processedFile = await compressImage(file);
              state.setPostStatus({
                type: "success",
                message: "Image compressed!",
              });
              setTimeout(() => state.setPostStatus(null), 2000);
            } catch {
              // Continue with original file
            }
          }

          const isVideo =
            processedFile.type.startsWith("video/") ||
            SUPPORTED_VIDEO_FORMATS.some((format) =>
              processedFile.name.toLowerCase().endsWith(format),
            );

          if (isVideo) {
            try {
              const duration = await getVideoDuration(processedFile);
              if (duration > MAX_VIDEO_DURATION) {
                state.setPostStatus({
                  type: "error",
                  message: `Video duration (${Math.round(duration)}s) exceeds maximum of ${MAX_VIDEO_DURATION} seconds`,
                });
                setTimeout(() => state.setPostStatus({ type: "idle" }), 3000);
                continue;
              }
            } catch {
              state.setPostStatus({
                type: "error",
                message: "Failed to validate video duration",
              });
              setTimeout(() => state.setPostStatus({ type: "idle" }), 3000);
              continue;
            }
          }

          const previewUrl = URL.createObjectURL(processedFile);
          state.mediaUrlsRef.current.add(previewUrl);
          const newMedia: UploadedMedia = {
            id: generateMediaId(),
            file: processedFile,
            preview: previewUrl,
            alt: "",
            type: isVideo ? "video" : "image",
          };
          state.setMedia((prev) => [...prev, newMedia]);

          if (
            state.autoGenerateAltText &&
            newMedia.type === "image" &&
            state.autoGenerateAltTextRef.current
          ) {
            setTimeout(() => {
              state.autoGenerateAltTextRef.current?.(newMedia.id);
            }, 100);
          }
        }
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [state],
  );

  // Remove media handler
  const removeMedia = useCallback(
    (id: string) => {
      state.setMedia((prev) => {
        const removed = prev.find((m) => m.id === id);
        if (removed) {
          URL.revokeObjectURL(removed.preview);
          state.mediaUrlsRef.current.delete(removed.preview);

          if (
            removed.type === "video" &&
            state.videoUploadManager.isUploading
          ) {
            state.videoUploadManager.cancelUpload();
          }
        }
        return prev.filter((m) => m.id !== id);
      });
    },
    [state],
  );

  // Update media alt text handler
  const updateMediaAlt = useCallback(
    (id: string, alt: string) => {
      state.setMedia((prev) =>
        prev.map((m) => (m.id === id ? { ...m, alt } : m)),
      );
    },
    [state],
  );

  // Auto-generate alt text
  async function autoGenerateAltTextForMedia(mediaId: string) {
    const mediaItem = state.media.find((m) => m.id === mediaId);
    if (!mediaItem || mediaItem.type !== "image") return;

    state.setGeneratingAltTextFor(mediaId);

    try {
      const anthropicService = await state.loadAnthropicService();
      const altText = await anthropicService.generateAltText(mediaItem.preview);
      updateMediaAlt(mediaId, altText);
      state.setGeneratingAltTextFor(null);
      debug.log("Alt text generated successfully", {
        mediaId,
        altTextLength: altText.length,
      });
    } catch (error) {
      logger.error("Failed to generate alt text:", error);
      state.setGeneratingAltTextFor(null);

      const errorMessage =
        error instanceof Error ? error.message : "Failed to generate alt text";
      state.setPostStatus({ type: "error", message: errorMessage });
      setTimeout(() => state.setPostStatus(null), 3000);
    }
  }

  // Drag handlers for media
  const handleDragStart = useCallback(
    (e: React.DragEvent, media: UploadedMedia) => {
      state.setDraggedMedia(media);
      e.dataTransfer.effectAllowed = "move";
      if (e.currentTarget instanceof HTMLElement) {
        e.currentTarget.style.opacity = "0.5";
      }
    },
    [state],
  );

  const handleDragEnd = useCallback(
    (e: React.DragEvent) => {
      state.setDraggedMedia(null);
      state.setDragOverPostIndex(null);
      state.setDragOverMediaId(null);
      if (e.currentTarget instanceof HTMLElement) {
        e.currentTarget.style.opacity = "1";
      }
    },
    [state],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, postIndex: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      state.setDragOverPostIndex(postIndex);
    },
    [state],
  );

  const handleDragLeave = useCallback(() => {
    state.setDragOverPostIndex(null);
    state.setDragOverMediaId(null);
  }, [state]);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetPostIndex: number) => {
      e.preventDefault();
      e.stopPropagation();

      if (!state.draggedMedia) return;

      state.setMedia((prev) =>
        prev.map((m) =>
          m.id === state.draggedMedia!.id
            ? { ...m, postIndex: targetPostIndex }
            : m,
        ),
      );

      state.setDraggedMedia(null);
      state.setDragOverPostIndex(null);
    },
    [state],
  );

  const handleMediaDragOver = useCallback(
    (e: React.DragEvent, targetMedia: UploadedMedia) => {
      e.preventDefault();
      e.stopPropagation();

      if (!state.draggedMedia || state.draggedMedia.id === targetMedia.id)
        return;

      const draggedPostIndex = state.draggedMedia.postIndex ?? 0;
      const targetPostIndex = targetMedia.postIndex ?? 0;

      if (draggedPostIndex === targetPostIndex) {
        e.dataTransfer.dropEffect = "move";
        state.setDragOverMediaId(targetMedia.id);
      }
    },
    [state],
  );

  const handleMediaDrop = useCallback(
    (e: React.DragEvent, targetMedia: UploadedMedia) => {
      e.preventDefault();
      e.stopPropagation();

      if (!state.draggedMedia || state.draggedMedia.id === targetMedia.id)
        return;

      const draggedPostIndex = state.draggedMedia.postIndex ?? 0;
      const targetPostIndex = targetMedia.postIndex ?? 0;

      if (draggedPostIndex !== targetPostIndex) return;

      state.setMedia((prev) => {
        const newMedia = [...prev];
        const draggedIndex = newMedia.findIndex(
          (m) => m.id === state.draggedMedia!.id,
        );
        const targetIndex = newMedia.findIndex((m) => m.id === targetMedia.id);

        if (draggedIndex !== -1 && targetIndex !== -1) {
          const [removed] = newMedia.splice(draggedIndex, 1);
          newMedia.splice(targetIndex, 0, removed);
        }

        return newMedia;
      });

      state.setDraggedMedia(null);
      state.setDragOverMediaId(null);
    },
    [state],
  );

  // Post drag handlers
  const handlePostDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      state.setDraggedPostIndex(index);
      e.dataTransfer.effectAllowed = "move";
      if (e.currentTarget instanceof HTMLElement) {
        e.currentTarget.style.opacity = "0.5";
      }
    },
    [state],
  );

  const handlePostDragEnd = useCallback(
    (e: React.DragEvent) => {
      state.setDraggedPostIndex(null);
      state.setDragOverPostOrderIndex(null);
      if (e.currentTarget instanceof HTMLElement) {
        e.currentTarget.style.opacity = "1";
      }
    },
    [state],
  );

  const handlePostDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      state.setDragOverPostOrderIndex(index);
    },
    [state],
  );

  const handlePostDrop = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();

      if (
        state.draggedPostIndex === null ||
        state.draggedPostIndex === targetIndex
      )
        return;

      state.setIsReorderingPosts(true);

      const currentOrder =
        state.postOrder.length > 0
          ? state.postOrder
          : state.posts.map((_, i) => i);
      const newOrder = [...currentOrder];
      const [removed] = newOrder.splice(state.draggedPostIndex, 1);
      newOrder.splice(targetIndex, 0, removed);

      const reorderedPosts = newOrder.map((i) => state.posts[i]);

      state.setPostOrder(reorderedPosts.map((_, i) => i));
      const newText = reorderedPosts.join("\n---\n");
      state.setText(newText);

      state.setDraggedPostIndex(null);
      state.setDragOverPostOrderIndex(null);

      requestAnimationFrame(() => {
        setTimeout(() => {
          state.setIsReorderingPosts(false);
        }, 100);
      });
    },
    [state],
  );

  // Save draft handler
  const saveDraftHandler = useCallback(async () => {
    if (!state.text.trim()) {
      state.setPostStatus({
        type: "error",
        message: "Cannot save empty draft",
      });
      return;
    }

    let mediaData;
    try {
      mediaData = await Promise.all(
        state.media.map(async (m) => {
          if (m.preview.startsWith("data:")) {
            return {
              file: m.preview,
              alt: m.alt,
              type: m.type,
              postIndex: m.postIndex,
            };
          }

          return new Promise<{
            file: string;
            alt: string;
            type: "image" | "video";
            postIndex?: number;
          }>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve({
                file: reader.result as string,
                alt: m.alt,
                type: m.type,
                postIndex: m.postIndex,
              });
            };
            reader.onerror = () =>
              reject(new Error("Failed to read media file for draft"));
            reader.readAsDataURL(m.file);
          });
        }),
      );
    } catch {
      state.setPostStatus({
        type: "error",
        message: "Failed to save draft: could not read media files",
      });
      return;
    }

    const draft: ThreadDraft = {
      id: state.currentDraftId || generateDraftId(),
      title: state.draftTitle || state.text.substring(0, 50) + "...",
      content: state.text,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      posts: state.posts,
      postOrder: state.postOrder.length > 0 ? state.postOrder : undefined,
      media: mediaData,
      images: mediaData
        .filter(
          (m) => m.type === "image" && (!m.postIndex || m.postIndex === 0),
        )
        .map((m) => ({ file: m.file, alt: m.alt })),
    };

    saveDraft(draft);
    state.setCurrentDraftId(draft.id);
    state.setDrafts(getDrafts());
    state.setPostStatus({ type: "success", message: "Draft saved!" });

    setTimeout(() => {
      state.setPostStatus({ type: "idle" });
    }, 2000);
  }, [state]);

  // Load draft handler
  const loadDraft = useCallback(
    async (draft: ThreadDraft) => {
      state.setText(draft.content);
      state.setDraftTitle(draft.title);
      state.setCurrentDraftId(draft.id);
      state.setShowDrafts(false);

      const mediaToLoad =
        draft.media ||
        draft.images?.map((img) => ({
          file: img.file,
          alt: img.alt,
          type: "image" as const,
          postIndex: 0,
        })) ||
        [];

      const loadedMediaResults = await Promise.all(
        mediaToLoad.map(async (m) => {
          if (!m.file.startsWith("data:")) {
            // Non-data-URL strings (e.g. stale blob: URLs) cannot be recovered
            return null;
          }

          const response = await fetch(m.file);
          const blob = await response.blob();
          const filename = `draft-media-${Date.now()}.${m.type === "video" ? "mp4" : "jpg"}`;
          const file = new File([blob], filename, { type: blob.type });

          return {
            id: generateMediaId(),
            file,
            preview: m.file,
            alt: m.alt,
            type: m.type,
            postIndex: m.postIndex,
          };
        }),
      );

      const loadedMedia = loadedMediaResults.filter(
        (m): m is NonNullable<typeof m> => m !== null,
      );

      if (loadedMedia.length < mediaToLoad.length) {
        state.setPostStatus({
          type: "error",
          message:
            "Some media could not be restored from draft and was removed",
        });
        setTimeout(() => state.setPostStatus({ type: "idle" }), 3000);
      }

      state.media.forEach((m) => {
        if (m.preview && !m.preview.startsWith("data:")) {
          URL.revokeObjectURL(m.preview);
          state.mediaUrlsRef.current.delete(m.preview);
        }
      });

      state.setMedia(loadedMedia);
    },
    [state],
  );

  // Delete draft handler
  const deleteDraftHandler = useCallback(
    (id: string) => {
      deleteDraft(id);
      state.setDrafts(getDrafts());
      if (state.currentDraftId === id) {
        state.setCurrentDraftId(null);
        state.setDraftTitle("");
      }
    },
    [state],
  );

  // Cancel delayed send
  const cancelDelayedSend = useCallback(() => {
    if (state.countdownInterval.current) {
      clearInterval(state.countdownInterval.current);
      state.countdownInterval.current = null;
    }
    if (state.sendTimeout.current) {
      clearTimeout(state.sendTimeout.current);
      state.sendTimeout.current = null;
    }
    state.setCountdown(null);
    state.setPendingPost(null);
    state.setIsPosting(false);
    state.setPostStatus({ type: "idle" });
  }, [state]);

  // Execute post
  const executePost = async (
    postsToSend?: string[],
    mediaToSend?: UploadedMedia[],
  ) => {
    if (!state.agent) {
      logger.error("No agent available");
      state.setPostStatus({ type: "error", message: "Not logged in" });
      state.setIsPosting(false);
      return;
    }

    const originalPosts = postsToSend || state.pendingPost?.posts || [];
    const originalMedia = mediaToSend || state.pendingPost?.media || [];

    if (originalPosts.length === 0) {
      logger.error("No posts to send");
      state.setPostStatus({ type: "error", message: "No content to post" });
      state.setIsPosting(false);
      return;
    }

    state.setCountdown(null);

    const numberedPosts = applyNumbering(
      originalPosts,
      state.postOrder,
      state.numberingFormat,
      state.numberingPosition,
    );

    try {
      state.setPostStatus({ type: "posting", message: "Creating thread..." });

      const postMediaMap = new Map<
        number,
        Array<{
          data: Uint8Array;
          mimeType: string;
          alt?: string;
          type: "image" | "video";
          file?: File;
        }>
      >();

      for (const m of originalMedia) {
        const originalPostIndex = m.postIndex ?? 0;
        const reorderedIndex =
          state.postOrder.length > 0
            ? state.postOrder.indexOf(originalPostIndex)
            : originalPostIndex;

        if (!postMediaMap.has(reorderedIndex)) {
          postMediaMap.set(reorderedIndex, []);
        }

        const mediaData = {
          data: new Uint8Array(await m.file.arrayBuffer()),
          mimeType: m.file.type,
          alt: m.alt,
          type: m.type,
          file: m.file,
        };

        postMediaMap.get(reorderedIndex)!.push(mediaData);
      }

      // Resume from previous progress if retrying a partially-failed thread
      let rootPost: { uri: string; cid: string } | undefined =
        state.threadProgress?.rootPost;
      let lastPost: { uri: string; cid: string } | undefined =
        state.threadProgress?.lastPost;
      const startIndex = state.threadProgress?.publishedCount ?? 0;

      for (let i = startIndex; i < numberedPosts.length; i++) {
        state.setPostStatus({
          type: "posting",
          message:
            startIndex > 0
              ? `Resuming: posting ${i + 1}/${numberedPosts.length}...`
              : `Posting ${i + 1}/${numberedPosts.length}...`,
        });

        const postMedia = postMediaMap.get(i) || [];

        const rt = new RichText({ text: numberedPosts[i] });
        await rt.detectFacets(state.agent);

        const postData: any = {
          text: rt.text,
          facets: rt.facets,
        };

        // Add reply info for subsequent posts
        // root = first post in thread (stays constant)
        // parent = previous post in thread (changes each iteration)
        if (i > 0 && rootPost && lastPost) {
          postData.reply = {
            root: { uri: rootPost.uri, cid: rootPost.cid },
            parent: { uri: lastPost.uri, cid: lastPost.cid },
          };
        }

        if (postMedia.length > 0) {
          const videoMedia = postMedia.find((m) => m.type === "video");

          if (videoMedia) {
            const videoBlob = await state.videoUploadManager.startUpload(
              videoMedia.data,
              videoMedia.mimeType,
              videoMedia.file?.name || "video.mp4",
              (progress) => {
                logger.log(`Upload progress: ${progress}%`);
              },
            );

            if (!videoBlob) {
              const error = state.videoUploadManager.uploadState.error;
              if (error) throw new Error(error.message);
              throw new Error("Video upload was cancelled");
            }

            postData.embed = {
              $type: "app.bsky.embed.video",
              video: videoBlob.blob,
              aspectRatio: videoBlob.aspectRatio,
            };
          } else {
            const images = await Promise.all(
              postMedia.map(async (img) => {
                const uploadResult = await uploadBlobWithRetry(
                  state.agent!,
                  img.data,
                  { encoding: img.mimeType },
                );
                return {
                  alt: img.alt || "",
                  image: uploadResult.data.blob,
                };
              }),
            );

            postData.embed = {
              $type: "app.bsky.embed.images",
              images,
            };
          }
        }

        // Add GIF embed for first post (mutually exclusive with media)
        if (i === 0 && !postData.embed && state.gifEmbed) {
          try {
            // Fetch the GIF to upload as thumbnail
            const gifResponse = await fetch(state.gifEmbed.url);
            if (gifResponse.ok) {
              const gifBlob = await gifResponse.blob();
              const gifData = new Uint8Array(await gifBlob.arrayBuffer());

              const uploadResult = await uploadBlobWithRetry(
                state.agent!,
                gifData,
                { encoding: "image/gif" },
              );

              postData.embed = {
                $type: "app.bsky.embed.external",
                external: {
                  uri: state.gifEmbed.tenorUrl,
                  title: state.gifEmbed.title,
                  description: "GIF from Tenor",
                  thumb: uploadResult.data.blob,
                },
              };
            }
          } catch (error) {
            logger.error("Failed to upload GIF:", error);
            // Continue without GIF embed
          }
        }

        // Add external link embed for first post (if no GIF)
        if (
          i === 0 &&
          !postData.embed &&
          state.linkPreviewEnabled &&
          state.linkPreview.metadata
        ) {
          const externalEmbed: any = {
            $type: "app.bsky.embed.external",
            external: {
              uri: state.linkPreview.metadata.url,
              title: state.linkPreview.metadata.title,
              description: state.linkPreview.metadata.description,
            },
          };

          if (state.linkPreview.metadata.imageUrl) {
            try {
              const imageResponse = await fetch(
                state.linkPreview.metadata.imageUrl,
              );
              if (imageResponse.ok) {
                const imageBlob = await imageResponse.blob();
                const imageData = new Uint8Array(await imageBlob.arrayBuffer());

                const uploadResult = await uploadBlobWithRetry(
                  state.agent!,
                  imageData,
                  { encoding: imageBlob.type || "image/jpeg" },
                );

                externalEmbed.external.thumb = uploadResult.data.blob;
              }
            } catch {
              // Continue without thumbnail
            }
          }

          postData.embed = externalEmbed;
        }

        const result = await state.agent.post(postData);
        const currentPost = { uri: result.uri, cid: result.cid };

        // First post in thread becomes the root for all subsequent posts
        if (!rootPost) {
          rootPost = currentPost;
        }
        lastPost = currentPost;

        // Track progress so retries resume from here
        state.setThreadProgress({
          rootPost,
          lastPost,
          publishedCount: i + 1,
        });

        // Create threadgate for first post
        if (i === 0 && state.replyPermission !== "everyone") {
          try {
            const threadgateService = new ThreadgateService(state.agent);
            await threadgateService.createThreadgate(result.uri, {
              permission: state.replyPermission,
            });
          } catch {
            // Don't fail if threadgate creation fails
          }
        }

        // Create postgate to disable quoting/embedding
        if (state.quotingDisabled) {
          try {
            const postgateService = new PostgateService(state.agent);
            await postgateService.createPostgate(result.uri);
          } catch {
            // Don't fail if postgate creation fails
          }
        }

        if (i < numberedPosts.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      state.setPostStatus({
        type: "success",
        message: "Thread posted successfully!",
      });

      state.resetComposer();

      if (state.currentDraftId) {
        deleteDraft(state.currentDraftId);
        state.setDrafts(getDrafts());
      }

      setTimeout(() => {
        state.setPostStatus({ type: "idle" });
      }, 3000);
    } catch (error) {
      logger.error("Error posting thread:", error);
      const published = state.threadProgress?.publishedCount ?? 0;
      const total = numberedPosts.length;
      const baseMessage =
        error instanceof Error ? error.message : "Failed to post thread";
      const progressMessage =
        published > 0
          ? `${baseMessage} (${published}/${total} posts published — retry will resume from post ${published + 1})`
          : baseMessage;
      state.setPostStatus({
        type: "error",
        message: progressMessage,
      });
    } finally {
      state.setIsPosting(false);
    }
  };

  // Handle send
  const handleSend = async () => {
    if (!state.agent || state.posts.length === 0) return;

    state.setPendingPost({ posts: state.posts, media: state.media });
    state.setIsPosting(true);

    if (state.delaySeconds > 0) {
      state.setCountdown(state.delaySeconds);
      state.setPostStatus({
        type: "posting",
        message: `Sending in ${state.delaySeconds} seconds...`,
      });

      let timeLeft = state.delaySeconds;
      state.countdownInterval.current = setInterval(() => {
        timeLeft -= 1;
        state.setCountdown(timeLeft);

        if (timeLeft <= 0) {
          if (state.countdownInterval.current) {
            clearInterval(state.countdownInterval.current);
            state.countdownInterval.current = null;
          }
          state.setPostStatus({ type: "posting", message: "Sending now..." });
        } else {
          state.setPostStatus({
            type: "posting",
            message: `Sending in ${timeLeft} second${timeLeft !== 1 ? "s" : ""}...`,
          });
        }
      }, 1000);

      state.sendTimeout.current = setTimeout(async () => {
        await executePost(state.posts, state.media);
      }, state.delaySeconds * 1000);
    } else {
      state.setPostStatus({ type: "posting", message: "Creating thread..." });
      await executePost(state.posts, state.media);
    }
  };

  // GIF selection handler
  const handleSelectGif = useCallback(
    (gif: TenorGif) => {
      // GIFs are mutually exclusive with images and videos
      if (state.media.length > 0) {
        state.setPostStatus({
          type: "error",
          message: "Cannot add GIF when media is already attached",
        });
        return;
      }

      const url = getBestGifUrl(gif);
      const dimensions = getGifDimensions(gif);

      state.setGifEmbed({
        id: gif.id,
        url,
        title: gif.title || gif.content_description,
        width: dimensions.width,
        height: dimensions.height,
        tenorUrl: gif.url,
      });

      state.setPostStatus({
        type: "success",
        message: "GIF added!",
      });
      setTimeout(() => state.setPostStatus({ type: "idle" }), 2000);
    },
    [state],
  );

  // Emoji selection handler
  const handleSelectEmoji = useCallback(
    (emoji: string) => {
      if (textareaRef.current) {
        const start = textareaRef.current.selectionStart;
        const end = textareaRef.current.selectionEnd;
        const newText =
          state.text.substring(0, start) + emoji + state.text.substring(end);
        state.setText(newText);

        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(
              start + emoji.length,
              start + emoji.length,
            );
          }
        }, 0);
      }
      state.setShowEmojiPicker(false);
    },
    [state],
  );

  // Thread split handler
  const insertThreadSplit = useCallback(() => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const splitMarker = "\n---\n";
      const newText =
        state.text.substring(0, start) +
        splitMarker +
        state.text.substring(end);
      state.setText(newText);

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(
            start + splitMarker.length,
            start + splitMarker.length,
          );
        }
      }, 0);
    }
  }, [state]);

  // Tone adjustment handler
  const handleToneAdjustment = useCallback(
    async (tone: ToneOption) => {
      if (!state.text.trim()) {
        state.setPostStatus({
          type: "error",
          message: "Please write some text first",
        });
        return;
      }

      state.setIsAdjustingTone(true);
      state.setSelectedTone(tone);

      try {
        const anthropicService = await state.loadAnthropicService();
        const result = await anthropicService.adjustTone(state.text, tone);
        state.setTonePreview(result.adjustedText);
        state.setShowTonePreview(true);
        state.setShowToneOptions(false);
      } catch (error) {
        logger.error("Failed to adjust tone:", error);
        state.setPostStatus({
          type: "error",
          message:
            error instanceof Error ? error.message : "Failed to adjust tone",
        });
        state.setSelectedTone(null);
      } finally {
        state.setIsAdjustingTone(false);
      }
    },
    [state],
  );

  // Apply tone adjustment
  const applyToneAdjustment = useCallback(() => {
    if (state.tonePreview && state.selectedTone) {
      state.setText(state.tonePreview);
      state.setTonePreview(null);
      state.setShowTonePreview(false);
      state.setSelectedTone(null);
      state.setPostStatus({ type: "success", message: "Tone adjusted!" });
      setTimeout(() => state.setPostStatus({ type: "idle" }), 2000);
    }
  }, [state]);

  // Cancel tone adjustment
  const cancelToneAdjustment = useCallback(() => {
    state.setTonePreview(null);
    state.setShowTonePreview(false);
    state.setSelectedTone(null);
  }, [state]);

  // Apply thread optimization
  const applyThreadOptimization = useCallback(() => {
    if (state.threadOptimizationResult) {
      const optimizedText = state.threadOptimizationResult.segments
        .map((s) => s.text)
        .join("\n---\n");

      state.setText(optimizedText);
      state.setNumberingFormat(
        state.threadOptimizationResult.suggestedFormat as any,
      );
      state.setThreadOptimizationResult(null);
      state.setShowThreadPreview(false);

      state.setPostStatus({
        type: "success",
        message: `Thread optimized into ${state.threadOptimizationResult.segments.length} posts!`,
      });
      setTimeout(() => state.setPostStatus({ type: "idle" }), 2000);
    }
  }, [state]);

  // Cancel thread optimization
  const cancelThreadOptimization = useCallback(() => {
    state.setThreadOptimizationResult(null);
    state.setShowThreadPreview(false);
  }, [state]);

  // Apply hashtag
  const applyHashtag = useCallback(
    (tag: string) => {
      const currentText = state.text.trim();
      const hashtag = `#${tag}`;

      if (currentText.includes(hashtag)) return;

      const spacer = currentText && !currentText.match(/[\s\n]$/) ? " " : "";
      state.setText(currentText + spacer + hashtag);
    },
    [state],
  );

  // Writing feedback handler
  const handleWritingFeedback = useCallback(async () => {
    if (!state.text.trim()) {
      state.setPostStatus({
        type: "error",
        message: "Please write some text to get feedback",
      });
      return;
    }

    state.setIsLoadingFeedback(true);

    try {
      if (!state.agent) throw new Error("Not authenticated");
      const anthropicService = await state.loadAnthropicService();
      const feedback = await anthropicService.getStyleMatchedWritingFeedback(
        state.text,
        state.agent,
      );
      state.setWritingFeedback(feedback);
      state.setShowWritingFeedback(true);
    } catch (error) {
      logger.error("Failed to get writing feedback:", error);
      state.setPostStatus({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to get feedback",
      });
    } finally {
      state.setIsLoadingFeedback(false);
    }
  }, [state]);

  // Apply corrected version from feedback
  const applyCorrectedVersion = useCallback(() => {
    if (state.writingFeedback) {
      state.setText(state.writingFeedback.correctedVersion.text);
      state.setShowWritingFeedback(false);
      state.setWritingFeedback(null);
    }
  }, [state]);

  // Apply enhanced version from feedback
  const applyEnhancedVersion = useCallback(() => {
    if (state.writingFeedback) {
      state.setText(state.writingFeedback.enhancedVersion.text);
      state.setShowWritingFeedback(false);
      state.setWritingFeedback(null);
    }
  }, [state]);

  // Compute display posts
  const displayPosts = applyNumbering(
    state.posts,
    state.postOrder,
    state.numberingFormat,
    state.numberingPosition,
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-6">
      <div className="asph-card mb-6 p-4 md:p-6">
        {/* Settings Section */}
        <ComposerSettings
          showSettings={state.showSettings}
          onToggleSettings={() => state.setShowSettings(!state.showSettings)}
          numberingFormat={state.numberingFormat}
          onNumberingFormatChange={state.setNumberingFormat}
          numberingPosition={state.numberingPosition}
          onNumberingPositionChange={state.setNumberingPosition}
          delaySeconds={state.delaySeconds}
          onDelaySecondsChange={state.setDelaySeconds}
          autoGenerateAltText={state.autoGenerateAltText}
          enableHashtagSuggestions={state.enableHashtagSuggestions}
          onAISettingsChange={async (settings) => {
            state.setAutoGenerateAltText(settings.autoGenerateAltText);
            state.setEnableHashtagSuggestions(
              settings.enableHashtagSuggestions,
            );
            await state.saveAISettings(settings);
          }}
        />

        {/* Post Button and Thread Composer Button */}
        <div className="mb-4 flex items-center justify-between">
          <button
            className="asph-button-secondary flex items-center gap-2 px-4 py-2 text-sm font-medium"
            onClick={() => state.setShowThreadComposer(true)}
          >
            <MessageSquare size={16} />
            Create Thread
          </button>
          <button
            className="asph-button-primary flex items-center gap-2 px-6 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleSend}
            disabled={state.posts.length === 0 || state.isPosting}
            aria-label={
              state.posts.length > 1
                ? `Post thread with ${state.posts.length} posts${state.media.some((m) => m.type === "image" && !m.alt) ? ". Warning: some images are missing alt text" : ""}`
                : `Post${state.media.some((m) => m.type === "image" && !m.alt) ? ". Warning: some images are missing alt text" : ""}`
            }
          >
            <Send size={20} aria-hidden="true" />
            {state.isPosting && state.countdown
              ? `Sending in ${state.countdown}s...`
              : state.isPosting
                ? "Posting..."
                : state.posts.length > 1
                  ? `Post Thread (${state.posts.length} posts)`
                  : "Post"}
          </button>
        </div>

        {/* Text Area */}
        <ComposerTextArea
          text={state.text}
          onTextChange={state.setText}
          onPaste={handlePaste}
          isPosting={state.isPosting}
          textareaRef={textareaRef}
          linkPreviewEnabled={state.linkPreviewEnabled}
          linkPreview={{
            metadata: state.linkPreview.metadata,
            isLoading: state.linkPreview.isLoading,
            error: state.linkPreview.error,
            clearPreview: state.linkPreview.clearPreview,
          }}
          mediaCount={state.media.length}
          onLinkPreviewRemove={() => {
            state.setLinkPreviewEnabled(false);
            state.linkPreview.clearPreview();
          }}
          showHashtagSuggestions={state.showHashtagSuggestions}
          hashtagSuggestions={state.hashtagSuggestions}
          isLoadingHashtags={state.isLoadingHashtags}
          onApplyHashtag={applyHashtag}
        />

        {/* Draft Controls */}
        <div className="mb-3 mt-3 flex items-center gap-2">
          <input
            type="text"
            placeholder="Draft title (optional)"
            value={state.draftTitle}
            onChange={(e) => state.setDraftTitle(e.target.value)}
            className="flex-1 rounded-lg p-2 text-sm"
            style={{
              background: "var(--asph-bg-secondary)",
              border: "1px solid var(--asph-border-primary)",
              color: "var(--asph-text-primary)",
              outline: "none",
            }}
          />

          <button
            className="asph-button-secondary flex items-center gap-2 px-3 py-2 text-sm"
            onClick={saveDraftHandler}
            disabled={!state.text.trim()}
          >
            <Save size={14} />
            <span className="hidden sm:inline">
              {state.currentDraftId ? "Update" : "Save Draft"}
            </span>
          </button>

          <button
            className="asph-button-secondary flex items-center gap-2 px-3 py-2 text-sm"
            onClick={() => state.setShowDrafts(!state.showDrafts)}
          >
            <FileText size={14} />
            <span className="hidden sm:inline">
              Drafts ({state.drafts.length})
            </span>
          </button>

          {state.currentDraftId && (
            <button
              className="asph-button-secondary p-2 text-sm"
              onClick={() => {
                state.resetComposer();
                state.setPostStatus({
                  type: "success",
                  message: "Ready for new draft",
                });
                setTimeout(() => state.setPostStatus({ type: "idle" }), 2000);
              }}
              title="New Draft"
            >
              <Plus size={14} />
            </button>
          )}
        </div>

        {/* Character Count and Post Count */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            <span style={{ color: "var(--asph-text-secondary)" }}>
              {state.text.length}{" "}
              <span className="hidden sm:inline">characters</span>
            </span>
            {state.posts.length > 1 && (
              <>
                <span style={{ color: "var(--asph-text-tertiary)" }}>•</span>
                <span
                  className="flex items-center gap-1.5 font-medium"
                  style={{ color: "var(--asph-primary)" }}
                >
                  <Split size={14} />
                  {state.posts.length} posts
                </span>
              </>
            )}
          </div>

          {/* Toolbar */}
          <ComposerToolbar
            enableProgressiveDisclosure={enableProgressiveDisclosure}
            defaultDisclosureLevel={defaultDisclosureLevel}
            isPosting={state.isPosting}
            media={state.media}
            selectedTone={state.selectedTone}
            isAdjustingTone={state.isAdjustingTone}
            isLoadingFeedback={state.isLoadingFeedback}
            text={state.text}
            hasGif={state.gifEmbed !== null}
            isVideoUploading={state.videoUploadManager.isUploading}
            onInsertThreadSplit={insertThreadSplit}
            onAddImages={() => {
              if (fileInputRef.current) {
                fileInputRef.current.accept = "image/*";
                fileInputRef.current.multiple = true;
                fileInputRef.current.click();
              }
            }}
            onAddVideo={() => {
              if (fileInputRef.current) {
                fileInputRef.current.accept = "video/*,.mp4,.mpeg,.webm,.mov";
                fileInputRef.current.multiple = false;
                fileInputRef.current.click();
              }
            }}
            onOpenGiphy={() => gifPicker.open()}
            onOpenEmoji={() => state.setShowEmojiPicker(true)}
            onToggleToneOptions={() =>
              state.setShowToneOptions(!state.showToneOptions)
            }
            onRequestFeedback={handleWritingFeedback}
            fileInputRef={fileInputRef}
            onFileInputChange={handleMediaSelect}
          />
        </div>

        {/* Reply & Quote Controls */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <ReplyControls
            value={state.replyPermission}
            onChange={state.setReplyPermission}
            disabled={state.isPosting}
            compact
          />
          <QuoteControl
            quotingDisabled={state.quotingDisabled}
            onChange={state.setQuotingDisabled}
            disabled={state.isPosting}
          />
        </div>
      </div>

      {/* Media Upload Section */}
      <ComposerMediaUpload
        media={state.media}
        posts={state.posts}
        isPosting={state.isPosting}
        onRemoveMedia={removeMedia}
        onUpdateAlt={updateMediaAlt}
        onAutoGenerateAlt={autoGenerateAltTextForMedia}
        draggedMedia={state.draggedMedia}
        dragOverMediaId={state.dragOverMediaId}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onMediaDragOver={handleMediaDragOver}
        onMediaDrop={handleMediaDrop}
        onDragLeave={() => state.setDragOverMediaId(null)}
        generatingAltTextFor={state.generatingAltTextFor}
      />

      {/* GIF Preview Section */}
      {state.gifEmbed && (
        <div className="mb-4">
          <div
            className="relative inline-block max-w-sm overflow-hidden rounded-lg border"
            style={{ borderColor: "var(--asph-border-primary)" }}
          >
            <img
              src={state.gifEmbed.url}
              alt={state.gifEmbed.title}
              className="h-auto w-full"
              style={{ maxHeight: "300px", objectFit: "contain" }}
            />
            <button
              onClick={() => state.setGifEmbed(null)}
              className="absolute right-2 top-2 rounded-full bg-black bg-opacity-60 p-1.5 text-white transition-opacity hover:bg-opacity-80"
              aria-label="Remove GIF"
              disabled={state.isPosting}
            >
              <X size={16} />
            </button>
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 px-2 py-1">
              <p className="truncate text-xs text-white">
                {state.gifEmbed.title}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Thread Preview Section */}
      <ComposerThreadPreview
        posts={state.posts}
        displayPosts={displayPosts}
        postOrder={state.postOrder}
        media={state.media}
        text={state.text}
        draggedMedia={state.draggedMedia}
        dragOverPostIndex={state.dragOverPostIndex}
        dragOverMediaId={state.dragOverMediaId}
        onMediaDragStart={handleDragStart}
        onMediaDragEnd={handleDragEnd}
        onMediaDrop={handleDrop}
        onDragOverPost={handleDragOver}
        onDragLeave={handleDragLeave}
        onMediaReorderDragOver={handleMediaDragOver}
        onMediaReorderDrop={handleMediaDrop}
        setDragOverMediaId={state.setDragOverMediaId}
        draggedPostIndex={state.draggedPostIndex}
        dragOverPostOrderIndex={state.dragOverPostOrderIndex}
        onPostDragStart={handlePostDragStart}
        onPostDragEnd={handlePostDragEnd}
        onPostDragOver={handlePostDragOver}
        onPostDrop={handlePostDrop}
      />

      {/* Drafts Section */}
      {state.showDrafts && (
        <div className="asph-card mb-6 p-4 md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3
              className="text-lg font-semibold"
              style={{ color: "var(--asph-text-primary)" }}
            >
              Saved Drafts
            </h3>
            <button
              className="asph-button-secondary p-2"
              onClick={() => state.setShowDrafts(false)}
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-3">
            {state.drafts.length === 0 ? (
              <p
                className="py-8 text-center"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                No saved drafts
              </p>
            ) : (
              state.drafts.map((draft) => (
                <DraftCard
                  key={draft.id}
                  draft={draft}
                  onLoad={() => loadDraft(draft)}
                  onDelete={() => deleteDraftHandler(draft.id)}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Status Messages */}
      <div className="flex flex-col items-end gap-4">
        {state.postStatus && state.postStatus.type !== "idle" && (
          <div
            className={`flex w-full items-center gap-3 rounded-lg border p-4 ${
              state.postStatus.type === "posting"
                ? "border-blue-200 bg-blue-50"
                : state.postStatus.type === "success"
                  ? "border-green-200 bg-green-50"
                  : "border-red-200 bg-red-50"
            }`}
          >
            {state.postStatus.type === "posting" && (
              <Loader className="animate-spin text-blue-600" size={16} />
            )}
            {state.postStatus.type === "success" && (
              <CheckCircle className="text-green-600" size={16} />
            )}
            {state.postStatus.type === "error" && (
              <AlertCircle className="text-red-600" size={16} />
            )}
            <span
              className={`flex-1 text-sm ${
                state.postStatus.type === "posting"
                  ? "text-blue-700"
                  : state.postStatus.type === "success"
                    ? "text-green-700"
                    : "text-red-700"
              }`}
            >
              {state.postStatus.message}
            </span>
            {state.postStatus.type === "posting" && state.countdown && (
              <button
                className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                onClick={cancelDelayedSend}
              >
                <Undo size={14} />
                Undo
              </button>
            )}
          </div>
        )}

        {state.videoUploadManager.uploadState.uploadId && (
          <UploadProgressBar
            uploadId={state.videoUploadManager.uploadState.uploadId}
            fileName={state.videoUploadManager.uploadState.fileName}
            onRetry={() => state.videoUploadManager.retryUpload()}
            onCancel={() => state.videoUploadManager.cancelUpload()}
          />
        )}
      </div>

      {/* Modals */}
      {gifPicker.isOpen && (
        <GifPicker
          onSelectGif={handleSelectGif}
          onClose={gifPicker.close}
          gifs={gifPicker.gifs}
          loading={gifPicker.loading}
          error={gifPicker.error}
          searchQuery={gifPicker.searchQuery}
          onSearch={gifPicker.search}
        />
      )}

      {state.showEmojiPicker && (
        <EmojiPicker
          onSelectEmoji={handleSelectEmoji}
          onClose={() => state.setShowEmojiPicker(false)}
        />
      )}

      {/* AI Features Modals */}
      <ComposerAIFeatures
        text={state.text}
        onTextChange={state.setText}
        showToneOptions={state.showToneOptions}
        onToggleToneOptions={() =>
          state.setShowToneOptions(!state.showToneOptions)
        }
        selectedTone={state.selectedTone}
        isAdjustingTone={state.isAdjustingTone}
        tonePreview={state.tonePreview}
        showTonePreview={state.showTonePreview}
        onToneAdjustment={handleToneAdjustment}
        onApplyTone={applyToneAdjustment}
        onCancelTone={cancelToneAdjustment}
        threadOptimizationResult={state.threadOptimizationResult}
        showThreadPreview={state.showThreadPreview}
        onApplyThreadOptimization={applyThreadOptimization}
        onCancelThreadOptimization={cancelThreadOptimization}
        onNumberingFormatChange={state.setNumberingFormat}
        showWritingFeedback={state.showWritingFeedback}
        writingFeedback={state.writingFeedback}
        isLoadingFeedback={state.isLoadingFeedback}
        onRequestFeedback={handleWritingFeedback}
        onCloseFeedback={() => {
          state.setShowWritingFeedback(false);
          state.setWritingFeedback(null);
        }}
        onApplyCorrected={applyCorrectedVersion}
        onApplyEnhanced={applyEnhancedVersion}
      />

      {/* Thread Composer Modal */}
      <ThreadComposer
        isOpen={state.showThreadComposer}
        onClose={() => state.setShowThreadComposer(false)}
        onThreadPosted={() => {
          state.setPostStatus({ type: "success", message: "Thread posted!" });
          setTimeout(() => state.setPostStatus({ type: "idle" }), 3000);
        }}
      />
    </div>
  );
}

// Draft Card Component
interface DraftCardProps {
  draft: ThreadDraft;
  onLoad: () => void;
  onDelete: () => void;
}

const DraftCard: React.FC<DraftCardProps> = ({ draft, onLoad, onDelete }) => {
  const postCount = draft.posts?.length || 1;
  const mediaCount = draft.media?.length || draft.images?.length || 0;

  return (
    <div
      className="cursor-pointer rounded-lg border p-4 transition-all hover:shadow-sm"
      style={{
        borderColor: "var(--asph-border-primary)",
        background: "var(--asph-bg-secondary)",
      }}
    >
      <div className="mb-2 flex items-start justify-between">
        <h4
          className="font-medium"
          style={{ color: "var(--asph-text-primary)" }}
        >
          {draft.title}
        </h4>
        <button
          className="rounded p-1 text-red-600 hover:bg-red-100"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 size={16} />
        </button>
      </div>
      <p
        className="mb-2 line-clamp-2 text-sm"
        style={{ color: "var(--asph-text-secondary)" }}
      >
        {draft.content}
      </p>
      <div className="mb-2 flex items-center gap-3">
        {postCount > 1 && (
          <span
            className="flex items-center gap-1 rounded-full px-2 py-1 text-xs"
            style={{
              background: "var(--asph-bg-tertiary)",
              color: "var(--asph-primary)",
            }}
          >
            <Split size={12} />
            {postCount} posts
          </span>
        )}
        {mediaCount > 0 && (
          <span
            className="flex items-center gap-1 rounded-full px-2 py-1 text-xs"
            style={{
              background: "var(--asph-bg-tertiary)",
              color: "var(--asph-text-secondary)",
            }}
          >
            <Image size={12} />
            {mediaCount} media
          </span>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span
          className="text-xs"
          style={{ color: "var(--asph-text-tertiary)" }}
        >
          Updated {new Date(draft.updatedAt).toLocaleString()}
        </span>
        <button
          className="asph-button-secondary px-3 py-1 text-sm"
          onClick={onLoad}
        >
          Load
        </button>
      </div>
    </div>
  );
};

export default ComposerRefactored;
