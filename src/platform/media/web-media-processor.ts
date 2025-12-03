/**
 * Web/Browser Media Processor Implementation
 *
 * Uses Canvas API for image manipulation and FFmpeg.wasm for video encoding.
 * This is the reference implementation for the IMediaProcessor interface.
 */

import { createLogger } from "../../utils/logger";
import {
  compressImageAdvanced,
  getImageDimensions,
} from "../../utils/media-compression";
import {
  isVideoFile as checkIsVideoFile,
  compressVideo as ffmpegCompressVideo,
  generateVideoThumbnail as ffmpegGenerateThumbnail,
  getVideoMetadata as ffmpegGetVideoMetadata,
  loadFFmpegInstance,
} from "../../utils/video-compression";
import type {
  IMediaProcessor,
  ImageCompressionOptions,
  MediaMetadata,
  PlatformCapabilities,
  ProcessedMedia,
  ProgressCallback,
  VideoCompressionOptions,
} from "./types";

const logger = createLogger("WebMediaProcessor");

/**
 * Default image compression options
 */
const DEFAULT_IMAGE_OPTIONS: ImageCompressionOptions = {
  quality: 0.85,
  maxDimension: 2048,
  format: "auto",
  preserveExif: false,
  targetSize: 1024 * 1024, // 1MB
};

/**
 * Default video compression options
 */
const DEFAULT_VIDEO_OPTIONS: VideoCompressionOptions = {
  quality: "auto",
  maxWidth: 1920,
  maxHeight: 1080,
  preserveAudio: true,
};

/**
 * Web platform capabilities
 */
const WEB_CAPABILITIES: PlatformCapabilities = {
  hasHardwareVideoEncoding: false, // FFmpeg.wasm uses software encoding
  hasHardwareImageProcessing: true, // Canvas can use GPU
  maxVideoResolution: 1920,
  supportedVideoCodecs: ["h264"],
  supportedImageFormats: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  supportsResumableUploads: true,
  maxConcurrentOperations: 2, // Limited due to WASM memory
  supportsBackgroundProcessing: false, // Web workers are limited
};

/**
 * Map of quality presets to FFmpeg options
 */
const QUALITY_TO_PRESET: Record<
  VideoCompressionOptions["quality"],
  "high" | "medium" | "low" | "auto"
> = {
  high: "high",
  medium: "medium",
  low: "low",
  auto: "auto",
};

/**
 * Web-based media processor using Canvas API and FFmpeg.wasm
 */
export class WebMediaProcessor implements IMediaProcessor {
  private ffmpegLoaded = false;

  /**
   * Get platform capabilities
   */
  async getCapabilities(): Promise<PlatformCapabilities> {
    return WEB_CAPABILITIES;
  }

  /**
   * Compress an image using Canvas API
   */
  async compressImage(
    uri: string,
    options: ImageCompressionOptions = DEFAULT_IMAGE_OPTIONS,
    onProgress?: ProgressCallback,
  ): Promise<ProcessedMedia> {
    const opts = { ...DEFAULT_IMAGE_OPTIONS, ...options };

    onProgress?.({
      stage: "loading",
      progress: 0,
      message: "Loading image...",
    });

    try {
      // Fetch the image if it's a URL
      const file = await this.uriToFile(uri, "image");

      onProgress?.({
        stage: "analyzing",
        progress: 20,
        message: "Analyzing image...",
      });

      // Get original dimensions
      const originalDimensions = await getImageDimensions(file);
      const originalSize = file.size;

      onProgress?.({
        stage: "processing",
        progress: 40,
        message: "Compressing image...",
      });

      // Use the existing compression utility
      const result = await compressImageAdvanced(file, {
        targetSize: opts.targetSize,
        maxWidth: opts.maxDimension,
        maxHeight: opts.maxDimension,
        quality: opts.quality,
        format: opts.format === "auto" ? "auto" : opts.format,
        preserveExif: opts.preserveExif,
      });

      onProgress?.({
        stage: "finalizing",
        progress: 100,
        message: "Complete",
      });

      // Read the file as blob
      const blob = new Blob([await result.file.arrayBuffer()], {
        type: result.format,
      });

      logger.log(
        `Image compressed: ${this.formatBytes(originalSize)} -> ${this.formatBytes(result.compressedSize)}`,
      );

      return {
        blob,
        mimeType: result.format,
        size: result.compressedSize,
        width: result.dimensions.width,
        height: result.dimensions.height,
        wasCompressed: result.wasCompressed,
        originalSize,
        compressionRatio: originalSize / result.compressedSize,
      };
    } catch (error) {
      logger.error("Image compression failed:", error);
      throw new Error(
        `Failed to compress image: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Compress a video using FFmpeg.wasm
   */
  async compressVideo(
    uri: string,
    options: VideoCompressionOptions = DEFAULT_VIDEO_OPTIONS,
    onProgress?: ProgressCallback,
  ): Promise<ProcessedMedia> {
    const opts = { ...DEFAULT_VIDEO_OPTIONS, ...options };

    onProgress?.({
      stage: "loading",
      progress: 0,
      message: "Loading video...",
    });

    try {
      // Ensure FFmpeg is loaded
      if (!this.ffmpegLoaded) {
        onProgress?.({
          stage: "loading",
          progress: 5,
          message: "Loading FFmpeg...",
        });
        await loadFFmpegInstance();
        this.ffmpegLoaded = true;
      }

      // Get the file
      const file = await this.uriToFile(uri, "video");
      const originalSize = file.size;

      onProgress?.({
        stage: "analyzing",
        progress: 10,
        message: "Analyzing video...",
      });

      // Get metadata
      const metadata = await ffmpegGetVideoMetadata(file);

      // Use existing compression utility
      const result = await ffmpegCompressVideo(
        file,
        QUALITY_TO_PRESET[opts.quality],
        (progress) => {
          onProgress?.({
            stage: progress.stage === "analyzing" ? "analyzing" : "processing",
            progress: Math.round(10 + progress.progress * 0.85),
            message:
              progress.stage === "analyzing"
                ? "Analyzing video..."
                : "Encoding video...",
            estimatedTimeRemaining: progress.estimatedTimeRemaining,
          });
        },
      );

      onProgress?.({
        stage: "finalizing",
        progress: 100,
        message: "Complete",
      });

      logger.log(
        `Video compressed: ${this.formatBytes(originalSize)} -> ${this.formatBytes(result.compressedSize)} (${result.compressionRatio.toFixed(2)}x)`,
      );

      return {
        blob: result.blob,
        mimeType: result.mimeType,
        size: result.compressedSize,
        width: result.metadata.width,
        height: result.metadata.height,
        duration: result.metadata.duration,
        wasCompressed: result.compressionRatio > 1,
        originalSize,
        compressionRatio: result.compressionRatio,
      };
    } catch (error) {
      logger.error("Video compression failed:", error);
      throw new Error(
        `Failed to compress video: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Generate a thumbnail from a video
   */
  async generateThumbnail(
    uri: string,
    timestamp: number,
    maxDimension: number = 400,
  ): Promise<string> {
    try {
      const file = await this.uriToFile(uri, "video");
      const result = await ffmpegGenerateThumbnail(
        file,
        timestamp,
        maxDimension,
      );

      // Convert blob to data URL
      return URL.createObjectURL(result.blob);
    } catch (error) {
      logger.error("Thumbnail generation failed:", error);
      throw new Error(
        `Failed to generate thumbnail: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get metadata for a media file
   */
  async getMediaMetadata(uri: string): Promise<MediaMetadata> {
    try {
      // Try as video first
      const isVideo = await this.isVideoFile(uri);

      if (isVideo) {
        const file = await this.uriToFile(uri, "video");
        const metadata = await ffmpegGetVideoMetadata(file);

        return {
          mimeType: metadata.mimeType,
          size: metadata.size,
          width: metadata.width,
          height: metadata.height,
          duration: metadata.duration,
          hasAudio: metadata.hasAudio,
          aspectRatio: metadata.width / metadata.height,
        };
      } else {
        // Handle as image
        const file = await this.uriToFile(uri, "image");
        const dimensions = await getImageDimensions(file);

        return {
          mimeType: file.type,
          size: file.size,
          width: dimensions.width,
          height: dimensions.height,
          aspectRatio: dimensions.width / dimensions.height,
        };
      }
    } catch (error) {
      logger.error("Failed to get media metadata:", error);
      throw new Error(
        `Failed to get media metadata: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Check if a file is a supported video format
   */
  async isVideoFile(uri: string): Promise<boolean> {
    try {
      const file = await this.uriToFile(uri, "unknown");
      return checkIsVideoFile(file);
    } catch {
      return false;
    }
  }

  /**
   * Check if a file is a supported image format
   */
  async isImageFile(uri: string): Promise<boolean> {
    try {
      const file = await this.uriToFile(uri, "unknown");
      return WEB_CAPABILITIES.supportedImageFormats.includes(file.type);
    } catch {
      return false;
    }
  }

  /**
   * Clean up temporary files created during processing
   */
  async cleanup(): Promise<void> {
    // Web implementation doesn't need explicit cleanup
    // Blob URLs should be revoked by the caller
    logger.log("Cleanup called - no action needed for web platform");
  }

  /**
   * Convert a URI to a File object
   */
  private async uriToFile(
    uri: string,
    type: "image" | "video" | "unknown",
  ): Promise<File> {
    // Check if it's already a File or Blob
    if (uri.startsWith("blob:")) {
      const response = await fetch(uri);
      const blob = await response.blob();
      return new File([blob], `media.${this.getExtension(blob.type)}`, {
        type: blob.type,
      });
    }

    // Check if it's a data URL
    if (uri.startsWith("data:")) {
      const response = await fetch(uri);
      const blob = await response.blob();
      return new File([blob], `media.${this.getExtension(blob.type)}`, {
        type: blob.type,
      });
    }

    // Assume it's a remote URL
    const response = await fetch(uri);
    const blob = await response.blob();
    const mimeType = blob.type || this.guessMimeType(uri, type);

    return new File(
      [blob],
      this.getFilename(uri) || `media.${this.getExtension(mimeType)}`,
      {
        type: mimeType,
      },
    );
  }

  /**
   * Get file extension from MIME type
   */
  private getExtension(mimeType: string): string {
    const extensions: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "video/mp4": "mp4",
      "video/webm": "webm",
      "video/quicktime": "mov",
    };
    return extensions[mimeType] || "bin";
  }

  /**
   * Guess MIME type from URL
   */
  private guessMimeType(
    uri: string,
    type: "image" | "video" | "unknown",
  ): string {
    const ext = uri.split(".").pop()?.toLowerCase();

    const mimeTypes: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      gif: "image/gif",
      mp4: "video/mp4",
      webm: "video/webm",
      mov: "video/quicktime",
    };

    if (ext && mimeTypes[ext]) {
      return mimeTypes[ext];
    }

    // Default based on type hint
    if (type === "image") return "image/jpeg";
    if (type === "video") return "video/mp4";
    return "application/octet-stream";
  }

  /**
   * Get filename from URL
   */
  private getFilename(uri: string): string | null {
    try {
      const url = new URL(uri);
      const pathname = url.pathname;
      const parts = pathname.split("/");
      return parts[parts.length - 1] || null;
    } catch {
      return null;
    }
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
