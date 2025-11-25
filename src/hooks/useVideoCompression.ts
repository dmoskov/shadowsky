/**
 * Hook for managing video compression state and operations
 *
 * Integrates with the video upload flow to provide client-side compression
 * before uploading to Bluesky servers.
 */

import { useCallback, useRef, useState } from "react";
import { createLogger } from "../utils/logger";
import {
  BLUESKY_MAX_VIDEO_SIZE,
  COMPRESSION_PRESETS,
  compressVideo,
  generateVideoThumbnail,
  getRecommendedPreset,
  getVideoMetadata,
  isVideoTooLarge,
  shouldCompressVideo,
  type CompressionProgress,
  type CompressionResult,
  type ThumbnailResult,
  type VideoMetadata,
} from "../utils/video-compression";

const logger = createLogger("VideoCompression");

export type CompressionStatus =
  | "idle"
  | "analyzing"
  | "compressing"
  | "complete"
  | "error";

export interface VideoCompressionState {
  status: CompressionStatus;
  progress: number; // 0-100
  stage: CompressionProgress["stage"] | null;
  originalSize: number;
  compressedSize: number | null;
  compressionRatio: number | null;
  estimatedTimeRemaining: number | null;
  error: string | null;
  metadata: VideoMetadata | null;
  thumbnail: ThumbnailResult | null;
}

const initialState: VideoCompressionState = {
  status: "idle",
  progress: 0,
  stage: null,
  originalSize: 0,
  compressedSize: null,
  compressionRatio: null,
  estimatedTimeRemaining: null,
  error: null,
  metadata: null,
  thumbnail: null,
};

export interface UseVideoCompressionOptions {
  preset?: keyof typeof COMPRESSION_PRESETS;
  generateThumbnail?: boolean;
  thumbnailTime?: number;
}

export function useVideoCompression(options: UseVideoCompressionOptions = {}) {
  const {
    preset = "auto",
    generateThumbnail = true,
    thumbnailTime = 1,
  } = options;

  const [state, setState] = useState<VideoCompressionState>(initialState);
  const abortRef = useRef<boolean>(false);
  const processingRef = useRef<boolean>(false);

  /**
   * Reset compression state
   */
  const reset = useCallback(() => {
    abortRef.current = false;
    processingRef.current = false;
    setState(initialState);
  }, []);

  /**
   * Cancel ongoing compression
   */
  const cancel = useCallback(() => {
    abortRef.current = true;
    setState((prev) => ({
      ...prev,
      status: "idle",
      progress: 0,
      stage: null,
      error: "Compression cancelled",
    }));
  }, []);

  /**
   * Check if a file needs compression
   */
  const needsCompression = useCallback((file: File): boolean => {
    return shouldCompressVideo(file);
  }, []);

  /**
   * Check if a file is too large to process
   */
  const isTooLarge = useCallback((file: File): boolean => {
    return isVideoTooLarge(file);
  }, []);

  /**
   * Get recommended preset for a file
   */
  const getPreset = useCallback(
    (file: File): keyof typeof COMPRESSION_PRESETS => {
      return getRecommendedPreset(file.size);
    },
    [],
  );

  /**
   * Analyze a video file without compressing
   */
  const analyzeVideo = useCallback(
    async (file: File): Promise<VideoMetadata | null> => {
      try {
        const metadata = await getVideoMetadata(file);
        setState((prev) => ({ ...prev, metadata }));
        return metadata;
      } catch (error) {
        logger.error("Failed to analyze video:", error);
        return null;
      }
    },
    [],
  );

  /**
   * Compress a video file
   *
   * Returns the compressed file if successful, or the original file if compression
   * is not needed or fails gracefully.
   */
  const compressVideoFile = useCallback(
    async (
      file: File,
      presetOverride?: keyof typeof COMPRESSION_PRESETS,
    ): Promise<{
      file: File;
      wasCompressed: boolean;
      thumbnail?: ThumbnailResult;
    }> => {
      // Prevent concurrent processing
      if (processingRef.current) {
        logger.warn("Compression already in progress");
        return { file, wasCompressed: false };
      }

      // Reset state
      abortRef.current = false;
      processingRef.current = true;

      setState({
        ...initialState,
        status: "analyzing",
        originalSize: file.size,
      });

      try {
        // Check if file is too large
        if (isVideoTooLarge(file)) {
          const error = `Video is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum size is 500MB.`;
          setState((prev) => ({
            ...prev,
            status: "error",
            error,
          }));
          throw new Error(error);
        }

        // Analyze video
        const metadata = await getVideoMetadata(file);
        setState((prev) => ({ ...prev, metadata }));

        // Check for cancellation
        if (abortRef.current) {
          processingRef.current = false;
          return { file, wasCompressed: false };
        }

        // Check if compression is needed
        if (!shouldCompressVideo(file)) {
          logger.log("Video does not need compression, file size:", file.size);

          // Generate thumbnail if requested
          let thumbnail: ThumbnailResult | null = null;
          if (generateThumbnail) {
            try {
              thumbnail = await generateVideoThumbnail(file, thumbnailTime);
              setState((prev) => ({ ...prev, thumbnail }));
            } catch (thumbError) {
              logger.warn("Failed to generate thumbnail:", thumbError);
            }
          }

          setState({
            ...initialState,
            status: "complete",
            originalSize: file.size,
            compressedSize: file.size,
            compressionRatio: 1,
            metadata,
            thumbnail,
          });

          processingRef.current = false;
          return {
            file,
            wasCompressed: false,
            thumbnail: thumbnail ?? undefined,
          };
        }

        // Start compression
        setState((prev) => ({
          ...prev,
          status: "compressing",
          stage: "analyzing",
          progress: 0,
        }));

        const selectedPreset = presetOverride || preset;
        logger.log(`Starting compression with preset: ${selectedPreset}`);

        const result = await compressVideo(file, selectedPreset, (progress) => {
          if (abortRef.current) return;

          setState((prev) => ({
            ...prev,
            stage: progress.stage,
            progress: progress.progress,
            estimatedTimeRemaining: progress.estimatedTimeRemaining ?? null,
          }));
        });

        // Check for cancellation
        if (abortRef.current) {
          processingRef.current = false;
          return { file, wasCompressed: false };
        }

        // Generate thumbnail from compressed video
        let thumbnail: ThumbnailResult | undefined;
        if (generateThumbnail) {
          try {
            const compressedFile = new File([result.blob], file.name, {
              type: result.mimeType,
            });
            thumbnail = await generateVideoThumbnail(
              compressedFile,
              thumbnailTime,
            );
          } catch (thumbError) {
            logger.warn("Failed to generate thumbnail:", thumbError);
          }
        }

        // Create the compressed file
        const compressedFile = new File(
          [result.blob],
          file.name.replace(/\.[^.]+$/, ".mp4"), // Ensure .mp4 extension
          { type: result.mimeType },
        );

        setState({
          status: "complete",
          progress: 100,
          stage: "finalizing",
          originalSize: result.originalSize,
          compressedSize: result.compressedSize,
          compressionRatio: result.compressionRatio,
          estimatedTimeRemaining: null,
          error: null,
          metadata: result.metadata,
          thumbnail: thumbnail || null,
        });

        logger.log(
          `Compression complete: ${(result.originalSize / (1024 * 1024)).toFixed(1)}MB -> ${(result.compressedSize / (1024 * 1024)).toFixed(1)}MB (${result.compressionRatio.toFixed(2)}x)`,
        );

        processingRef.current = false;
        return { file: compressedFile, wasCompressed: true, thumbnail };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to compress video";
        logger.error("Video compression failed:", error);

        setState((prev) => ({
          ...prev,
          status: "error",
          error: errorMessage,
        }));

        processingRef.current = false;
        throw error;
      }
    },
    [preset, generateThumbnail, thumbnailTime],
  );

  /**
   * Get a human-readable description of the compression state
   */
  const getStatusMessage = useCallback((): string => {
    switch (state.status) {
      case "idle":
        return "Ready";
      case "analyzing":
        return "Analyzing video...";
      case "compressing":
        if (state.stage === "analyzing") return "Analyzing video frames...";
        if (state.stage === "compressing")
          return `Compressing video... ${state.progress}%`;
        if (state.stage === "finalizing") return "Finalizing output...";
        return "Compressing video...";
      case "complete":
        if (state.compressionRatio && state.compressionRatio > 1) {
          return `Compressed ${state.compressionRatio.toFixed(1)}x smaller`;
        }
        return "Ready to upload";
      case "error":
        return state.error || "Compression failed";
      default:
        return "";
    }
  }, [state]);

  /**
   * Check if video will exceed Bluesky limits after compression (estimate)
   */
  const estimateCompressedSize = useCallback(
    (
      file: File,
      targetPreset: keyof typeof COMPRESSION_PRESETS = "auto",
    ): number => {
      const preset = COMPRESSION_PRESETS[targetPreset];

      if (preset.targetSizeMB) {
        // Use the target size from the preset
        return Math.min(file.size, preset.targetSizeMB * 1024 * 1024);
      }

      // Estimate based on CRF (rough approximation)
      // CRF 20 = ~70% of original, CRF 28 = ~30% of original
      const crfRatio = 1 - (preset.crf - 18) * 0.05;
      return Math.round(file.size * Math.max(0.2, crfRatio));
    },
    [],
  );

  /**
   * Check if compression would help meet size requirements
   */
  const wouldCompressionHelp = useCallback(
    (file: File): boolean => {
      if (file.size <= BLUESKY_MAX_VIDEO_SIZE) {
        return false; // Already under limit
      }

      const estimatedSize = estimateCompressedSize(file, "low");
      return estimatedSize < file.size * 0.8; // Would reduce by at least 20%
    },
    [estimateCompressedSize],
  );

  return {
    // State
    state,
    isProcessing: processingRef.current,
    isCompressing: state.status === "compressing",
    isComplete: state.status === "complete",
    isError: state.status === "error",

    // Actions
    compressVideo: compressVideoFile,
    analyzeVideo,
    cancel,
    reset,

    // Utilities
    needsCompression,
    isTooLarge,
    getPreset,
    getStatusMessage,
    estimateCompressedSize,
    wouldCompressionHelp,
  };
}

// Re-export types for convenience
export type {
  CompressionProgress,
  CompressionResult,
  ThumbnailResult,
  VideoMetadata,
};
