/**
 * Hook for managing image compression on mobile before upload.
 *
 * Uses the native ImageCompressor module (CoreGraphics + ImageIO on iOS) for
 * hardware-accelerated compression. Automatically ensures images fit within
 * Bluesky's 1MB upload limit by progressively reducing quality and dimensions.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  compressImage,
  cleanupTempFiles,
  getImageInfo,
} from "../../modules/image-compressor";
import type {
  CompressOptions,
} from "../../modules/image-compressor";
import { createLogger } from "../utils/logger";
const logger = createLogger("ImageCompression");
// Bluesky image limits
const MAX_IMAGE_SIZE = 1_000_000; // 1MB
const MAX_IMAGE_DIMENSION = 2000; // 2000px per side
const COMPRESSION_THRESHOLD = 800_000; // Compress if over 800KB (leave buffer)
const DEFAULT_QUALITY = 0.85;
export type ImageCompressionStatus =
  | "idle"
  | "analyzing"
  | "compressing"
  | "complete"
  | "skipped"
  | "error";
export interface ImageCompressionState {
  status: ImageCompressionStatus;
  progress: number; // 0-1
  processedCount: number;
  totalCount: number;
  error: string | null;
}
const initialState: ImageCompressionState = {
  status: "idle",
  progress: 0,
  processedCount: 0,
  totalCount: 0,
  error: null,
};
export interface CompressedImage {
  uri: string;
  width: number;
  height: number;
  mimeType: string;
  originalSize: number;
  compressedSize: number;
  wasCompressed: boolean;
}
export interface UseImageCompressionOptions {
  /** JPEG quality 0.0–1.0. Default: 0.85 */
  quality?: number;
  /** Max file size in bytes. Default: 1000000 (1MB) */
  maxFileSize?: number;
  /** Max dimension per side. Default: 2000 */
  maxDimension?: number;
}
export function useImageCompression(
  options: UseImageCompressionOptions = {},
) {
  const {
    quality = DEFAULT_QUALITY,
    maxFileSize = MAX_IMAGE_SIZE,
    maxDimension = MAX_IMAGE_DIMENSION,
  } = options;
  const [state, setState] = useState<ImageCompressionState>(initialState);
  const processingRef = useRef(false);
  // Clean up temp files on unmount
  useEffect(() => {
    return () => {
      cleanupTempFiles();
    };
  }, []);
  /**
   * Check if an image needs compression based on file size or dimensions.
   */
  const shouldCompress = useCallback(
    (fileSize?: number, width?: number, height?: number): boolean => {
      if (fileSize && fileSize > COMPRESSION_THRESHOLD) return true;
      if (width && width > maxDimension) return true;
      if (height && height > maxDimension) return true;
      return false;
    },
    [maxDimension],
  );
  /**
   * Compress a single image.
   * Returns the compressed URI and metadata, or the original if compression
   * is not needed or the native module is unavailable.
   */
  const compressSingle = useCallback(
    async (
      uri: string,
      fileSize?: number,
      width?: number,
      height?: number,
    ): Promise<CompressedImage> => {
      // Get image info if not provided
      let actualSize = fileSize;
      let actualWidth = width;
      let actualHeight = height;
      if (!actualSize || !actualWidth || !actualHeight) {
        const info = await getImageInfo(uri);
        if (info) {
          actualSize = actualSize || info.fileSize;
          actualWidth = actualWidth || info.width;
          actualHeight = actualHeight || info.height;
        }
      }
      // Check if compression is needed
      if (!shouldCompress(actualSize, actualWidth, actualHeight)) {
        return {
          uri,
          width: actualWidth || 0,
          height: actualHeight || 0,
          mimeType: "image/jpeg",
          originalSize: actualSize || 0,
          compressedSize: actualSize || 0,
          wasCompressed: false,
        };
      }
      // Determine output format
      const isPng = uri.toLowerCase().endsWith(".png");
      const format = isPng ? "png" : "jpeg";
      const compressOptions: CompressOptions = {
        quality,
        maxFileSize,
        maxDimension,
        format,
      };
      const result = await compressImage(uri, compressOptions);
      if (!result) {
        // Native module not available, return original
        logger.warn("Native image compression not available, using original");
        return {
          uri,
          width: actualWidth || 0,
          height: actualHeight || 0,
          mimeType: isPng ? "image/png" : "image/jpeg",
          originalSize: actualSize || 0,
          compressedSize: actualSize || 0,
          wasCompressed: false,
        };
      }
      const ratio =
        result.compressedSize > 0
          ? result.originalSize / result.compressedSize
          : 1;
      logger.log(
        `Image compressed: ${Math.round(result.originalSize / 1024)}KB -> ${Math.round(result.compressedSize / 1024)}KB (${ratio.toFixed(1)}x)`,
      );
      return {
        uri: result.uri,
        width: result.width,
        height: result.height,
        mimeType: result.mimeType,
        originalSize: result.originalSize,
        compressedSize: result.compressedSize,
        wasCompressed: true,
      };
    },
    [quality, maxFileSize, maxDimension, shouldCompress],
  );
  /**
   * Compress multiple images (batch processing).
   * Processes sequentially to avoid memory pressure.
   */
  const compressBatch = useCallback(
    async (
      images: Array<{
        uri: string;
        fileSize?: number;
        width?: number;
        height?: number;
      }>,
    ): Promise<CompressedImage[]> => {
      if (processingRef.current) {
        logger.warn("Image compression already in progress");
        return images.map((img) => ({
          uri: img.uri,
          width: img.width || 0,
          height: img.height || 0,
          mimeType: "image/jpeg",
          originalSize: img.fileSize || 0,
          compressedSize: img.fileSize || 0,
          wasCompressed: false,
        }));
      }
      processingRef.current = true;
      setState({
        status: "analyzing",
        progress: 0,
        processedCount: 0,
        totalCount: images.length,
        error: null,
      });
      const results: CompressedImage[] = [];
      try {
        for (let i = 0; i < images.length; i++) {
          setState((prev) => ({
            ...prev,
            status: "compressing",
            progress: i / images.length,
            processedCount: i,
          }));
          const img = images[i];
          const result = await compressSingle(
            img.uri,
            img.fileSize,
            img.width,
            img.height,
          );
          results.push(result);
        }
        setState({
          status: "complete",
          progress: 1,
          processedCount: images.length,
          totalCount: images.length,
          error: null,
        });
        processingRef.current = false;
        return results;
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to compress images";
        logger.error("Image compression batch failed:", error);
        setState((prev) => ({
          ...prev,
          status: "error",
          error: errorMessage,
        }));
        processingRef.current = false;
        throw error;
      }
    },
    [compressSingle],
  );
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
        return "Analyzing images...";
      case "compressing":
        return `Compressing image ${state.processedCount + 1} of ${state.totalCount}...`;
      case "complete":
        return "Images ready";
      case "skipped":
        return "Images ready";
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
    compressSingle,
    compressBatch,
    reset,
    // Utilities
    shouldCompress,
    getStatusMessage,
  };
}
