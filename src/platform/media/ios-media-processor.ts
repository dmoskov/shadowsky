/**
 * iOS Native Media Processor Implementation
 *
 * This is a stub implementation that will interface with native iOS code
 * through a JavaScript bridge (React Native, Capacitor, or custom WebView bridge).
 *
 * Native iOS Implementation Notes:
 * - Uses UIKit ImageIO for image compression (CGImageDestination, CGImageSource)
 * - Uses AVFoundation for video encoding (AVAssetExportSession, AVAssetReader/Writer)
 * - Uses Photos framework for asset handling (PHAsset, PHImageManager)
 * - Hardware acceleration via VideoToolbox for H.264/HEVC encoding
 */

import { createLogger } from "../../utils/logger";
import type {
  IMediaProcessor,
  ImageCompressionOptions,
  MediaMetadata,
  PlatformCapabilities,
  ProcessedMedia,
  ProgressCallback,
  VideoCompressionOptions,
} from "./types";

const logger = createLogger("iOSMediaProcessor");

/**
 * iOS platform capabilities
 */
const IOS_CAPABILITIES: PlatformCapabilities = {
  hasHardwareVideoEncoding: true, // VideoToolbox provides hardware H.264/HEVC
  hasHardwareImageProcessing: true, // Core Image uses GPU
  maxVideoResolution: 4096, // 4K support on modern iPhones
  supportedVideoCodecs: ["h264", "hevc"],
  supportedImageFormats: [
    "image/jpeg",
    "image/png",
    "image/heic",
    "image/heif",
    "image/webp",
    "image/gif",
  ],
  supportsResumableUploads: true,
  maxConcurrentOperations: 4,
  supportsBackgroundProcessing: true, // iOS supports background tasks
};

/**
 * Interface for the native iOS bridge
 * This should be implemented by the native code and injected into the WebView
 */
interface IOSNativeBridge {
  compressImage(
    uri: string,
    quality: number,
    maxDimension: number,
    format: string,
  ): Promise<{
    uri: string;
    size: number;
    width: number;
    height: number;
    mimeType: string;
  }>;

  compressVideo(
    uri: string,
    quality: string,
    maxWidth: number,
    maxHeight: number,
    preserveAudio: boolean,
  ): Promise<{
    uri: string;
    size: number;
    width: number;
    height: number;
    duration: number;
    mimeType: string;
  }>;

  generateThumbnail(
    uri: string,
    timestamp: number,
    maxDimension: number,
  ): Promise<{ uri: string }>;

  getMediaMetadata(uri: string): Promise<{
    mimeType: string;
    size: number;
    width: number;
    height: number;
    duration?: number;
    hasAudio?: boolean;
    createdAt?: string;
    orientation?: number;
  }>;

  isVideoFile(uri: string): Promise<boolean>;
  isImageFile(uri: string): Promise<boolean>;
  cleanup(): Promise<void>;

  // Progress callbacks are handled via events
  onProgress(callback: (progress: number, stage: string) => void): void;
}

/**
 * Get the native bridge if available
 */
function getNativeBridge(): IOSNativeBridge | null {
  // Check for common bridge injection points
  const win = window as any;

  // React Native WebView
  if (win.ReactNativeWebView?.postMessage && win.IOSMediaBridge) {
    return win.IOSMediaBridge;
  }

  // Capacitor
  if (win.Capacitor?.Plugins?.MediaProcessor) {
    return win.Capacitor.Plugins.MediaProcessor;
  }

  // Custom WebView bridge
  if (win.webkit?.messageHandlers?.mediaProcessor) {
    return createWebKitBridge(win.webkit.messageHandlers.mediaProcessor);
  }

  return null;
}

/**
 * Create a bridge adapter for WKWebView message handlers
 */
function createWebKitBridge(messageHandler: any): IOSNativeBridge {
  let progressCallback: ((progress: number, stage: string) => void) | null =
    null;
  let callId = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingCalls = new Map<
    number,
    { resolve: (value: any) => void; reject: (reason?: any) => void }
  >();

  // Set up global callback receiver
  (window as any).__iOSMediaCallback = (
    id: number,
    error: string | null,
    result: any,
  ) => {
    const pending = pendingCalls.get(id);
    if (pending) {
      pendingCalls.delete(id);
      if (error) {
        pending.reject(new Error(error));
      } else {
        pending.resolve(result);
      }
    }
  };

  (window as any).__iOSMediaProgress = (progress: number, stage: string) => {
    progressCallback?.(progress, stage);
  };

  function callNative<T>(method: string, args: any[]): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = ++callId;
      pendingCalls.set(id, { resolve, reject });

      messageHandler.postMessage({
        id,
        method,
        args,
      });

      // Timeout after 5 minutes for video processing
      setTimeout(
        () => {
          if (pendingCalls.has(id)) {
            pendingCalls.delete(id);
            reject(new Error(`Native call ${method} timed out`));
          }
        },
        5 * 60 * 1000,
      );
    });
  }

  return {
    compressImage: (uri, quality, maxDimension, format) =>
      callNative("compressImage", [uri, quality, maxDimension, format]),
    compressVideo: (uri, quality, maxWidth, maxHeight, preserveAudio) =>
      callNative("compressVideo", [
        uri,
        quality,
        maxWidth,
        maxHeight,
        preserveAudio,
      ]),
    generateThumbnail: (uri, timestamp, maxDimension) =>
      callNative("generateThumbnail", [uri, timestamp, maxDimension]),
    getMediaMetadata: (uri) => callNative("getMediaMetadata", [uri]),
    isVideoFile: (uri) => callNative("isVideoFile", [uri]),
    isImageFile: (uri) => callNative("isImageFile", [uri]),
    cleanup: () => callNative("cleanup", []),
    onProgress: (callback) => {
      progressCallback = callback;
    },
  };
}

/**
 * iOS native media processor
 * Falls back to web implementation if native bridge is not available
 */
export class IOSMediaProcessor implements IMediaProcessor {
  private bridge: IOSNativeBridge | null = null;
  private webFallback: IMediaProcessor | null = null;

  constructor() {
    this.bridge = getNativeBridge();
    if (!this.bridge) {
      logger.warn(
        "iOS native bridge not available, will use web fallback when needed",
      );
    }
  }

  /**
   * Lazy load web fallback
   */
  private async getWebFallback(): Promise<IMediaProcessor> {
    if (!this.webFallback) {
      const { WebMediaProcessor } = await import("./web-media-processor");
      this.webFallback = new WebMediaProcessor();
    }
    return this.webFallback;
  }

  async getCapabilities(): Promise<PlatformCapabilities> {
    if (this.bridge) {
      return IOS_CAPABILITIES;
    }
    const fallback = await this.getWebFallback();
    return fallback.getCapabilities();
  }

  async compressImage(
    uri: string,
    options: ImageCompressionOptions,
    onProgress?: ProgressCallback,
  ): Promise<ProcessedMedia> {
    if (!this.bridge) {
      const fallback = await this.getWebFallback();
      return fallback.compressImage(uri, options, onProgress);
    }

    try {
      // Set up progress handler
      this.bridge.onProgress((progress, stage) => {
        onProgress?.({
          stage: stage as any,
          progress,
          message: `${stage}...`,
        });
      });

      const originalMetadata = await this.bridge.getMediaMetadata(uri);
      const originalSize = originalMetadata.size;

      onProgress?.({
        stage: "processing",
        progress: 0,
        message: "Compressing image...",
      });

      const result = await this.bridge.compressImage(
        uri,
        options.quality,
        options.maxDimension,
        options.format || "auto",
      );

      onProgress?.({
        stage: "finalizing",
        progress: 100,
        message: "Complete",
      });

      // Fetch the compressed image blob
      const response = await fetch(result.uri);
      const blob = await response.blob();

      return {
        blob,
        mimeType: result.mimeType,
        size: result.size,
        width: result.width,
        height: result.height,
        wasCompressed: result.size < originalSize,
        originalSize,
        compressionRatio: originalSize / result.size,
      };
    } catch (error) {
      logger.error("iOS image compression failed, falling back to web:", error);
      const fallback = await this.getWebFallback();
      return fallback.compressImage(uri, options, onProgress);
    }
  }

  async compressVideo(
    uri: string,
    options: VideoCompressionOptions,
    onProgress?: ProgressCallback,
  ): Promise<ProcessedMedia> {
    if (!this.bridge) {
      const fallback = await this.getWebFallback();
      return fallback.compressVideo(uri, options, onProgress);
    }

    try {
      // Set up progress handler
      this.bridge.onProgress((progress, stage) => {
        onProgress?.({
          stage: stage as any,
          progress,
          message: `${stage}...`,
        });
      });

      const originalMetadata = await this.bridge.getMediaMetadata(uri);
      const originalSize = originalMetadata.size;

      onProgress?.({
        stage: "loading",
        progress: 0,
        message: "Loading video...",
      });

      const result = await this.bridge.compressVideo(
        uri,
        options.quality,
        options.maxWidth || 1920,
        options.maxHeight || 1080,
        options.preserveAudio !== false,
      );

      onProgress?.({
        stage: "finalizing",
        progress: 100,
        message: "Complete",
      });

      // Fetch the compressed video blob
      const response = await fetch(result.uri);
      const blob = await response.blob();

      return {
        blob,
        mimeType: result.mimeType,
        size: result.size,
        width: result.width,
        height: result.height,
        duration: result.duration,
        wasCompressed: result.size < originalSize,
        originalSize,
        compressionRatio: originalSize / result.size,
      };
    } catch (error) {
      logger.error("iOS video compression failed, falling back to web:", error);
      const fallback = await this.getWebFallback();
      return fallback.compressVideo(uri, options, onProgress);
    }
  }

  async generateThumbnail(
    uri: string,
    timestamp: number,
    maxDimension: number = 400,
  ): Promise<string> {
    if (!this.bridge) {
      const fallback = await this.getWebFallback();
      return fallback.generateThumbnail(uri, timestamp, maxDimension);
    }

    try {
      const result = await this.bridge.generateThumbnail(
        uri,
        timestamp,
        maxDimension,
      );
      return result.uri;
    } catch (error) {
      logger.error(
        "iOS thumbnail generation failed, falling back to web:",
        error,
      );
      const fallback = await this.getWebFallback();
      return fallback.generateThumbnail(uri, timestamp, maxDimension);
    }
  }

  async getMediaMetadata(uri: string): Promise<MediaMetadata> {
    if (!this.bridge) {
      const fallback = await this.getWebFallback();
      return fallback.getMediaMetadata(uri);
    }

    try {
      const result = await this.bridge.getMediaMetadata(uri);
      return {
        mimeType: result.mimeType,
        size: result.size,
        width: result.width,
        height: result.height,
        duration: result.duration,
        hasAudio: result.hasAudio,
        createdAt: result.createdAt ? new Date(result.createdAt) : undefined,
        orientation: result.orientation,
        aspectRatio: result.width / result.height,
      };
    } catch (error) {
      logger.error("iOS getMediaMetadata failed, falling back to web:", error);
      const fallback = await this.getWebFallback();
      return fallback.getMediaMetadata(uri);
    }
  }

  async isVideoFile(uri: string): Promise<boolean> {
    if (!this.bridge) {
      const fallback = await this.getWebFallback();
      return fallback.isVideoFile(uri);
    }

    try {
      return await this.bridge.isVideoFile(uri);
    } catch {
      return false;
    }
  }

  async isImageFile(uri: string): Promise<boolean> {
    if (!this.bridge) {
      const fallback = await this.getWebFallback();
      return fallback.isImageFile(uri);
    }

    try {
      return await this.bridge.isImageFile(uri);
    } catch {
      return false;
    }
  }

  async cleanup(): Promise<void> {
    if (this.bridge) {
      try {
        await this.bridge.cleanup();
      } catch (error) {
        logger.error("iOS cleanup failed:", error);
      }
    }

    if (this.webFallback) {
      await this.webFallback.cleanup();
    }
  }
}

/**
 * Example Swift implementation notes for the native side:
 *
 * ```swift
 * import UIKit
 * import AVFoundation
 * import Photos
 *
 * class MediaProcessor {
 *     // Image compression using ImageIO
 *     func compressImage(uri: String, quality: CGFloat, maxDimension: CGFloat, format: String) async throws -> [String: Any] {
 *         let source = CGImageSourceCreateWithURL(URL(string: uri)! as CFURL, nil)!
 *         let image = CGImageSourceCreateImageAtIndex(source, 0, nil)!
 *
 *         // Calculate new dimensions
 *         let width = CGFloat(image.width)
 *         let height = CGFloat(image.height)
 *         let scale = min(maxDimension / max(width, height), 1.0)
 *         let newWidth = Int(width * scale)
 *         let newHeight = Int(height * scale)
 *
 *         // Create compressed image
 *         let destURL = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".jpg")
 *         let dest = CGImageDestinationCreateWithURL(destURL as CFURL, kUTTypeJPEG, 1, nil)!
 *
 *         let options: [CFString: Any] = [
 *             kCGImageDestinationLossyCompressionQuality: quality,
 *             kCGImageDestinationImageMaxPixelSize: max(newWidth, newHeight)
 *         ]
 *
 *         CGImageDestinationAddImage(dest, image, options as CFDictionary)
 *         CGImageDestinationFinalize(dest)
 *
 *         let attrs = try FileManager.default.attributesOfItem(atPath: destURL.path)
 *         let size = attrs[.size] as! Int
 *
 *         return [
 *             "uri": destURL.absoluteString,
 *             "size": size,
 *             "width": newWidth,
 *             "height": newHeight,
 *             "mimeType": "image/jpeg"
 *         ]
 *     }
 *
 *     // Video compression using AVFoundation
 *     func compressVideo(uri: String, quality: String, maxWidth: Int, maxHeight: Int, preserveAudio: Bool) async throws -> [String: Any] {
 *         let asset = AVAsset(url: URL(string: uri)!)
 *         let preset = AVAssetExportPresetMediumQuality
 *
 *         let export = AVAssetExportSession(asset: asset, presetName: preset)!
 *         let destURL = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".mp4")
 *
 *         export.outputURL = destURL
 *         export.outputFileType = .mp4
 *         export.shouldOptimizeForNetworkUse = true
 *
 *         // Video composition for resizing
 *         // ... (composition setup)
 *
 *         await export.export()
 *
 *         // Return result
 *         // ...
 *     }
 * }
 * ```
 */
