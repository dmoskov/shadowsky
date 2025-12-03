/**
 * Media Processing Platform Abstraction
 *
 * This module provides a unified interface for media processing operations
 * across different platforms (Web, iOS, Android). It automatically detects
 * the current platform and provides the appropriate implementation.
 *
 * Usage:
 *   import { getMediaService, getMediaProcessor, getResumableUploader } from './platform/media';
 *
 *   // Get the platform-appropriate media processor
 *   const processor = await getMediaProcessor();
 *   const result = await processor.compressImage(uri, { quality: 0.8, maxDimension: 2048 });
 *
 *   // Get the resumable uploader
 *   const uploader = await getResumableUploader();
 *   const uploadResult = await uploader.upload(blob, uploadUrl, metadata, onProgress);
 */

import { createLogger } from "../../utils/logger";
import type {
  IMediaProcessor,
  IMediaService,
  IResumableUploader,
  PlatformCapabilities,
} from "./types";

// Re-export types for convenience
export * from "./types";

const logger = createLogger("MediaPlatform");

/**
 * Detected platform type
 */
export type Platform = "web" | "ios" | "android";

/**
 * Detect the current platform
 */
export function detectPlatform(): Platform {
  const win = window as any;
  const userAgent = navigator.userAgent.toLowerCase();

  // Check for iOS WebView bridge
  if (
    win.webkit?.messageHandlers?.mediaProcessor ||
    win.IOSMediaBridge ||
    win.Capacitor?.getPlatform?.() === "ios"
  ) {
    return "ios";
  }

  // Check for Android WebView bridge
  if (
    win.AndroidMediaProcessor ||
    win.AndroidMediaBridge ||
    win.Capacitor?.getPlatform?.() === "android"
  ) {
    return "android";
  }

  // Check user agent for native apps without explicit bridge
  if (/iphone|ipad|ipod/.test(userAgent) && win.webkit?.messageHandlers) {
    return "ios";
  }

  if (/android/.test(userAgent) && win.AndroidInterface) {
    return "android";
  }

  // Default to web
  return "web";
}

// Singleton instances
let mediaProcessorInstance: IMediaProcessor | null = null;
let resumableUploaderInstance: IResumableUploader | null = null;
let mediaServiceInstance: IMediaService | null = null;
let currentPlatform: Platform | null = null;

/**
 * Get the platform-specific media processor
 * Uses lazy initialization and caching
 */
export async function getMediaProcessor(): Promise<IMediaProcessor> {
  if (mediaProcessorInstance) {
    return mediaProcessorInstance;
  }

  const platform = detectPlatform();
  currentPlatform = platform;

  logger.log(`Initializing media processor for platform: ${platform}`);

  switch (platform) {
    case "ios": {
      const { IOSMediaProcessor } = await import("./ios-media-processor");
      mediaProcessorInstance = new IOSMediaProcessor();
      break;
    }
    case "android": {
      const { AndroidMediaProcessor } =
        await import("./android-media-processor");
      mediaProcessorInstance = new AndroidMediaProcessor();
      break;
    }
    default: {
      const { WebMediaProcessor } = await import("./web-media-processor");
      mediaProcessorInstance = new WebMediaProcessor();
      break;
    }
  }

  return mediaProcessorInstance;
}

/**
 * Get the resumable uploader
 * Uses lazy initialization and caching
 */
export async function getResumableUploader(): Promise<IResumableUploader> {
  if (resumableUploaderInstance) {
    return resumableUploaderInstance;
  }

  const { ResumableUploader } = await import("./resumable-uploader");
  resumableUploaderInstance = new ResumableUploader();

  logger.log("Initialized resumable uploader");

  return resumableUploaderInstance;
}

/**
 * Combined media service with both processing and upload capabilities
 */
class MediaService implements IMediaService {
  private processor: IMediaProcessor | null = null;
  private uploader: IResumableUploader | null = null;
  private _initialized = false;
  readonly platform: Platform;

  constructor(platform: Platform) {
    this.platform = platform;
  }

  async initialize(): Promise<void> {
    if (this._initialized) return;

    this.processor = await getMediaProcessor();
    this.uploader = await getResumableUploader();
    this._initialized = true;

    logger.log(`MediaService initialized for ${this.platform}`);
  }

  isInitialized(): boolean {
    return this._initialized;
  }

  async shutdown(): Promise<void> {
    if (this.processor) {
      await this.processor.cleanup();
    }
    this._initialized = false;
    logger.log("MediaService shut down");
  }

  // IMediaProcessor methods
  async getCapabilities(): Promise<PlatformCapabilities> {
    await this.ensureInitialized();
    return this.processor!.getCapabilities();
  }

  async compressImage(
    uri: string,
    options: import("./types").ImageCompressionOptions,
    onProgress?: import("./types").ProgressCallback,
  ): Promise<import("./types").ProcessedMedia> {
    await this.ensureInitialized();
    return this.processor!.compressImage(uri, options, onProgress);
  }

  async compressVideo(
    uri: string,
    options: import("./types").VideoCompressionOptions,
    onProgress?: import("./types").ProgressCallback,
  ): Promise<import("./types").ProcessedMedia> {
    await this.ensureInitialized();
    return this.processor!.compressVideo(uri, options, onProgress);
  }

  async generateThumbnail(
    uri: string,
    timestamp: number,
    maxDimension?: number,
  ): Promise<string> {
    await this.ensureInitialized();
    return this.processor!.generateThumbnail(uri, timestamp, maxDimension);
  }

  async getMediaMetadata(
    uri: string,
  ): Promise<import("./types").MediaMetadata> {
    await this.ensureInitialized();
    return this.processor!.getMediaMetadata(uri);
  }

  async isVideoFile(uri: string): Promise<boolean> {
    await this.ensureInitialized();
    return this.processor!.isVideoFile(uri);
  }

  async isImageFile(uri: string): Promise<boolean> {
    await this.ensureInitialized();
    return this.processor!.isImageFile(uri);
  }

  async cleanup(): Promise<void> {
    if (this.processor) {
      await this.processor.cleanup();
    }
  }

  // IResumableUploader methods
  async upload(
    file: Blob | string,
    uploadUrl: string,
    metadata: Record<string, string>,
    onProgress?: (progress: import("./types").UploadProgress) => void,
  ): Promise<import("./types").UploadResult> {
    await this.ensureInitialized();
    return this.uploader!.upload(file, uploadUrl, metadata, onProgress);
  }

  async resume(
    uploadId: string,
    onProgress?: (progress: import("./types").UploadProgress) => void,
  ): Promise<import("./types").UploadResult> {
    await this.ensureInitialized();
    return this.uploader!.resume(uploadId, onProgress);
  }

  async pause(uploadId: string): Promise<void> {
    await this.ensureInitialized();
    return this.uploader!.pause(uploadId);
  }

  async cancel(uploadId: string): Promise<void> {
    await this.ensureInitialized();
    return this.uploader!.cancel(uploadId);
  }

  async getUploadState(
    uploadId: string,
  ): Promise<import("./types").ResumableUploadState | null> {
    await this.ensureInitialized();
    return this.uploader!.getUploadState(uploadId);
  }

  async getPendingUploads(): Promise<import("./types").ResumableUploadState[]> {
    await this.ensureInitialized();
    return this.uploader!.getPendingUploads();
  }

  async cleanupOldUploads(maxAgeMs: number): Promise<void> {
    await this.ensureInitialized();
    return this.uploader!.cleanupOldUploads(maxAgeMs);
  }

  private async ensureInitialized(): Promise<void> {
    if (!this._initialized) {
      await this.initialize();
    }
  }
}

/**
 * Get the combined media service with processing and upload capabilities
 * Uses lazy initialization and caching
 */
export async function getMediaService(): Promise<IMediaService> {
  if (mediaServiceInstance) {
    return mediaServiceInstance;
  }

  const platform = currentPlatform || detectPlatform();
  mediaServiceInstance = new MediaService(platform);
  await mediaServiceInstance.initialize();

  return mediaServiceInstance;
}

/**
 * Get the current platform
 */
export function getCurrentPlatform(): Platform {
  return currentPlatform || detectPlatform();
}

/**
 * Check if native media processing is available
 */
export function hasNativeMediaProcessing(): boolean {
  const platform = detectPlatform();
  return platform === "ios" || platform === "android";
}

/**
 * Reset the singleton instances (useful for testing)
 */
export function resetMediaInstances(): void {
  mediaProcessorInstance = null;
  resumableUploaderInstance = null;
  mediaServiceInstance = null;
  currentPlatform = null;
}
