/**
 * Hook for managing video compression on mobile before upload.
 *
 * Uses the native VideoCompressor module (AVAssetExportSession on iOS) for
 * hardware-accelerated compression. Automatically selects quality based on
 * network conditions, or allows user-specified quality overrides.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  compressVideo,
  cancelCompression,
  cleanupTempFiles,
  getVideoInfo,
  onCompressionProgress,
} from "../../modules/video-compressor";
import type {
  CompressionQuality,
  CompressionResult,
  VideoInfo,
} from "../../modules/video-compressor";
import { useNetwork } from "../contexts/NetworkContext";
import { createLogger } from "../utils/logger";

const logger = createLogger("VideoCompression");

// Thresholds for compression decisions
const COMPRESSION_THRESHOLD = 10 * 1024 * 1024; // 10MB - files under this skip compression
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB Bluesky recommended max
const ABSOLUTE_MAX_SIZE = 500 * 1024 * 1024; // 500MB absolute max

export type CompressionStatus =
  | "idle"
  | "analyzing"
  | "compressing"
  | "complete"
  | "skipped"
  | "error";

export interface VideoCompressionState {
  status: CompressionStatus;
  progress: number; // 0-1
  originalSize: number;
  compressedSize: number | null;
  compressionRatio: number | null;
  error: string | null;
  videoInfo: VideoInfo | null;
}

const initialState: VideoCompressionState = {
  status: "idle",
  progress: 0,
  originalSize: 0,
  compressedSize: null,
  compressionRatio: null,
  error: null,
  videoInfo: null,
};

export interface UseVideoCompressionOptions {
  /** Override automatic quality selection */
  quality?: CompressionQuality;
  /** Auto-select quality based on network. Defaults to true. */
  autoQuality?: boolean;
}

export function useVideoCompression(
  options: UseVideoCompressionOptions = {},
) {
  const { quality: qualityOverride, autoQuality = true } = options;

  const [state, setState] = useState<VideoCompressionState>(initialState);
  const processingRef = useRef(false);
  const network = useNetwork();

  // Clean up temp files on unmount
  useEffect(() => {
    return () => {
      cleanupTempFiles();
    };
  }, []);

  /**
   * Determine compression quality based on network conditions.
   */
  const getAutoQuality = useCallback((): CompressionQuality => {
    if (qualityOverride) return qualityOverride;
    if (!autoQuality) return "medium";

    const { connectionType, networkQuality } = network;

    if (connectionType === "wifi" && networkQuality === "good") {
      return "high";
    }

    if (networkQuality === "poor") {
      return "low";
    }

    // Cellular with decent connection
    return "medium";
  }, [qualityOverride, autoQuality, network]);

  /**
   * Check if a video file should be compressed.
   */
  const shouldCompress = useCallback(
    (fileSize: number): boolean => {
      if (fileSize <= COMPRESSION_THRESHOLD) return false;
      if (fileSize > ABSOLUTE_MAX_SIZE) return false; // too large to process
      return true;
    },
    [],
  );

  /**
   * Check if a video is too large to upload.
   */
  const isTooLarge = useCallback((fileSize: number): boolean => {
    return fileSize > ABSOLUTE_MAX_SIZE;
  }, []);

  /**
   * Compress a video file.
   * Returns the compressed URI, or the original URI if compression is skipped/fails gracefully.
   */
  const compress = useCallback(
    async (
      uri: string,
      fileSize?: number,
    ): Promise<{
      uri: string;
      wasCompressed: boolean;
      compressedSize?: number;
    }> => {
      if (processingRef.current) {
        logger.warn("Compression already in progress");
        return { uri, wasCompressed: false };
      }

      processingRef.current = true;
      setState({
        ...initialState,
        status: "analyzing",
        originalSize: fileSize || 0,
      });

      try {
        // Get video info for analysis
        const info = await getVideoInfo(uri);
        if (info) {
          setState((prev) => ({
            ...prev,
            videoInfo: info,
            originalSize: info.fileSize || fileSize || 0,
          }));
        }

        const actualSize = info?.fileSize || fileSize || 0;

        // Check if too large
        if (isTooLarge(actualSize)) {
          const sizeMB = Math.round(actualSize / (1024 * 1024));
          const error = `Video is too large (${sizeMB}MB). Maximum size is ${Math.round(ABSOLUTE_MAX_SIZE / (1024 * 1024))}MB.`;
          setState((prev) => ({ ...prev, status: "error", error }));
          processingRef.current = false;
          throw new Error(error);
        }

        // Check if compression is needed
        if (!shouldCompress(actualSize)) {
          logger.log(
            `Video does not need compression (${Math.round(actualSize / (1024 * 1024))}MB)`,
          );
          setState({
            ...initialState,
            status: "skipped",
            originalSize: actualSize,
            compressedSize: actualSize,
            compressionRatio: 1,
            videoInfo: info,
          });
          processingRef.current = false;
          return { uri, wasCompressed: false };
        }

        // Start compression
        const quality = getAutoQuality();
        logger.log(
          `Starting compression: quality=${quality}, size=${Math.round(actualSize / (1024 * 1024))}MB`,
        );

        setState((prev) => ({
          ...prev,
          status: "compressing",
          progress: 0,
        }));

        // Subscribe to progress events
        const unsubscribe = onCompressionProgress(({ progress }) => {
          setState((prev) => ({
            ...prev,
            progress,
          }));
        });

        let result: CompressionResult | null;
        try {
          result = await compressVideo(uri, quality);
        } finally {
          unsubscribe();
        }

        if (!result) {
          // Native module not available, skip compression
          logger.warn("Native compression not available, using original video");
          setState({
            ...initialState,
            status: "skipped",
            originalSize: actualSize,
            compressedSize: actualSize,
            compressionRatio: 1,
            videoInfo: info,
          });
          processingRef.current = false;
          return { uri, wasCompressed: false };
        }

        const ratio =
          result.compressedSize > 0
            ? result.originalSize / result.compressedSize
            : 1;

        logger.log(
          `Compression complete: ${Math.round(result.originalSize / (1024 * 1024))}MB -> ${Math.round(result.compressedSize / (1024 * 1024))}MB (${ratio.toFixed(1)}x)`,
        );

        setState({
          status: "complete",
          progress: 1,
          originalSize: result.originalSize,
          compressedSize: result.compressedSize,
          compressionRatio: ratio,
          error: null,
          videoInfo: info,
        });

        processingRef.current = false;
        return {
          uri: result.uri,
          wasCompressed: true,
          compressedSize: result.compressedSize,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to compress video";
        logger.error("Video compression failed:", error);

        // If compression fails, allow using original if under size limit
        const actualSize = state.originalSize || fileSize || 0;
        if (actualSize <= MAX_VIDEO_SIZE) {
          logger.log("Falling back to original video (under size limit)");
          setState((prev) => ({
            ...prev,
            status: "skipped",
            error: `Compression failed, using original: ${errorMessage}`,
          }));
          processingRef.current = false;
          return { uri, wasCompressed: false };
        }

        setState((prev) => ({
          ...prev,
          status: "error",
          error: errorMessage,
        }));
        processingRef.current = false;
        throw error;
      }
    },
    [getAutoQuality, shouldCompress, isTooLarge, state.originalSize],
  );

  /**
   * Cancel ongoing compression.
   */
  const cancel = useCallback(() => {
    cancelCompression();
    processingRef.current = false;
    setState({
      ...initialState,
      error: "Compression cancelled",
    });
  }, []);

  /**
   * Reset compression state.
   */
  const reset = useCallback(() => {
    processingRef.current = false;
    setState(initialState);
  }, []);

  /**
   * Get a human-readable status message.
   */
  const getStatusMessage = useCallback((): string => {
    switch (state.status) {
      case "idle":
        return "";
      case "analyzing":
        return "Analyzing video...";
      case "compressing": {
        const pct = Math.round(state.progress * 100);
        return `Compressing video... ${pct}%`;
      }
      case "complete": {
        if (state.compressionRatio && state.compressionRatio > 1) {
          const savedMB = Math.round(
            ((state.originalSize - (state.compressedSize || 0)) /
              (1024 * 1024)) *
              10,
          ) / 10;
          return `Compressed (saved ${savedMB}MB)`;
        }
        return "Ready to upload";
      }
      case "skipped":
        return "Ready to upload";
      case "error":
        return state.error || "Compression failed";
      default:
        return "";
    }
  }, [state]);

  return {
    // State
    state,
    isCompressing:
      state.status === "compressing" || state.status === "analyzing",
    isComplete: state.status === "complete" || state.status === "skipped",
    isError: state.status === "error",

    // Actions
    compress,
    cancel,
    reset,

    // Utilities
    shouldCompress,
    isTooLarge,
    getAutoQuality,
    getStatusMessage,
  };
}
