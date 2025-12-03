/**
 * Android Native Media Processor Implementation
 *
 * This is a stub implementation that will interface with native Android code
 * through a JavaScript bridge (React Native, Capacitor, or custom WebView bridge).
 *
 * Native Android Implementation Notes:
 * - Uses BitmapFactory for image loading and compression
 * - Uses MediaCodec for hardware video encoding (H.264/HEVC)
 * - Uses MediaMuxer for video container creation
 * - Uses ExoPlayer for video playback optimization and analysis
 * - Android MediaStore for file management
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

const logger = createLogger("AndroidMediaProcessor");

/**
 * Android platform capabilities
 */
const ANDROID_CAPABILITIES: PlatformCapabilities = {
  hasHardwareVideoEncoding: true, // MediaCodec provides hardware encoding
  hasHardwareImageProcessing: true, // RenderScript/GPU support
  maxVideoResolution: 4096, // 4K on modern devices
  supportedVideoCodecs: ["h264", "hevc", "vp8", "vp9"],
  supportedImageFormats: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/heif",
  ],
  supportsResumableUploads: true,
  maxConcurrentOperations: 4,
  supportsBackgroundProcessing: true, // WorkManager support
};

/**
 * Interface for the native Android bridge
 * This should be implemented by the native code and injected into the WebView
 */
interface AndroidNativeBridge {
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
    targetBitrate?: number,
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

  // Android-specific: Get device codec capabilities
  getCodecCapabilities(): Promise<{
    videoEncoders: string[];
    maxVideoResolution: number;
    hasHardwareEncoder: boolean;
  }>;
}

/**
 * Get the native bridge if available
 */
function getNativeBridge(): AndroidNativeBridge | null {
  const win = window as any;

  // React Native WebView
  if (win.ReactNativeWebView?.postMessage && win.AndroidMediaBridge) {
    return win.AndroidMediaBridge;
  }

  // Capacitor
  if (win.Capacitor?.Plugins?.MediaProcessor) {
    return win.Capacitor.Plugins.MediaProcessor;
  }

  // Custom WebView JavaScript interface (addJavascriptInterface)
  if (win.AndroidMediaProcessor) {
    return createAndroidBridge(win.AndroidMediaProcessor);
  }

  return null;
}

/**
 * Create a bridge adapter for Android addJavascriptInterface
 * Android's addJavascriptInterface provides synchronous methods,
 * so we wrap them in Promises for consistency
 */
function createAndroidBridge(nativeInterface: any): AndroidNativeBridge {
  let progressCallback: ((progress: number, stage: string) => void) | null =
    null;

  // Set up global callback receiver for progress updates
  (window as any).__androidMediaProgress = (
    progress: number,
    stage: string,
  ) => {
    progressCallback?.(progress, stage);
  };

  // Set up global callback receiver for async results
  let callId = 0;
  const pendingCalls = new Map<
    number,
    { resolve: Function; reject: Function }
  >();

  (window as any).__androidMediaCallback = (
    id: number,
    error: string | null,
    resultJson: string,
  ) => {
    const pending = pendingCalls.get(id);
    if (pending) {
      pendingCalls.delete(id);
      if (error) {
        pending.reject(new Error(error));
      } else {
        try {
          pending.resolve(JSON.parse(resultJson));
        } catch {
          pending.resolve(resultJson);
        }
      }
    }
  };

  function callNative<T>(method: string, args: any[]): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = ++callId;
      pendingCalls.set(id, { resolve, reject });

      try {
        // Call the native method with callback ID
        nativeInterface[method](id, JSON.stringify(args));
      } catch (error) {
        pendingCalls.delete(id);
        reject(error);
      }

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
    compressVideo: (
      uri,
      quality,
      maxWidth,
      maxHeight,
      preserveAudio,
      targetBitrate,
    ) =>
      callNative("compressVideo", [
        uri,
        quality,
        maxWidth,
        maxHeight,
        preserveAudio,
        targetBitrate,
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
    getCodecCapabilities: () => callNative("getCodecCapabilities", []),
  };
}

/**
 * Android native media processor
 * Falls back to web implementation if native bridge is not available
 */
export class AndroidMediaProcessor implements IMediaProcessor {
  private bridge: AndroidNativeBridge | null = null;
  private webFallback: IMediaProcessor | null = null;
  private cachedCapabilities: PlatformCapabilities | null = null;

  constructor() {
    this.bridge = getNativeBridge();
    if (!this.bridge) {
      logger.warn(
        "Android native bridge not available, will use web fallback when needed",
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
    if (!this.bridge) {
      const fallback = await this.getWebFallback();
      return fallback.getCapabilities();
    }

    // Cache capabilities since they don't change
    if (this.cachedCapabilities) {
      return this.cachedCapabilities;
    }

    try {
      const codecCaps = await this.bridge.getCodecCapabilities();

      this.cachedCapabilities = {
        ...ANDROID_CAPABILITIES,
        supportedVideoCodecs: codecCaps.videoEncoders,
        maxVideoResolution: codecCaps.maxVideoResolution,
        hasHardwareVideoEncoding: codecCaps.hasHardwareEncoder,
      };

      return this.cachedCapabilities;
    } catch {
      return ANDROID_CAPABILITIES;
    }
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
      logger.error(
        "Android image compression failed, falling back to web:",
        error,
      );
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
        options.targetBitrate,
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
      logger.error(
        "Android video compression failed, falling back to web:",
        error,
      );
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
        "Android thumbnail generation failed, falling back to web:",
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
      logger.error(
        "Android getMediaMetadata failed, falling back to web:",
        error,
      );
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
        logger.error("Android cleanup failed:", error);
      }
    }

    if (this.webFallback) {
      await this.webFallback.cleanup();
    }
  }
}

/**
 * Example Kotlin implementation notes for the native side:
 *
 * ```kotlin
 * package com.shadowsky.media
 *
 * import android.graphics.Bitmap
 * import android.graphics.BitmapFactory
 * import android.media.MediaCodec
 * import android.media.MediaCodecInfo
 * import android.media.MediaCodecList
 * import android.media.MediaExtractor
 * import android.media.MediaFormat
 * import android.media.MediaMetadataRetriever
 * import android.media.MediaMuxer
 * import android.webkit.JavascriptInterface
 * import org.json.JSONArray
 * import org.json.JSONObject
 * import java.io.File
 * import java.io.FileOutputStream
 * import kotlin.concurrent.thread
 *
 * class MediaProcessor(private val context: Context) {
 *
 *     @JavascriptInterface
 *     fun compressImage(callbackId: Int, argsJson: String) {
 *         thread {
 *             try {
 *                 val args = JSONArray(argsJson)
 *                 val uri = args.getString(0)
 *                 val quality = args.getDouble(1)
 *                 val maxDimension = args.getInt(2)
 *                 val format = args.getString(3)
 *
 *                 // Load bitmap with sampling
 *                 val options = BitmapFactory.Options().apply {
 *                     inJustDecodeBounds = true
 *                 }
 *                 BitmapFactory.decodeFile(uri, options)
 *
 *                 // Calculate sample size
 *                 val scale = maxOf(options.outWidth, options.outHeight) / maxDimension
 *                 options.inJustDecodeBounds = false
 *                 options.inSampleSize = maxOf(1, scale)
 *
 *                 val bitmap = BitmapFactory.decodeFile(uri, options)
 *
 *                 // Scale to exact dimensions if needed
 *                 val scaledBitmap = if (bitmap.width > maxDimension || bitmap.height > maxDimension) {
 *                     val ratio = minOf(
 *                         maxDimension.toFloat() / bitmap.width,
 *                         maxDimension.toFloat() / bitmap.height
 *                     )
 *                     Bitmap.createScaledBitmap(
 *                         bitmap,
 *                         (bitmap.width * ratio).toInt(),
 *                         (bitmap.height * ratio).toInt(),
 *                         true
 *                     )
 *                 } else {
 *                     bitmap
 *                 }
 *
 *                 // Save compressed
 *                 val outputFile = File.createTempFile("compressed_", ".jpg", context.cacheDir)
 *                 FileOutputStream(outputFile).use { out ->
 *                     scaledBitmap.compress(
 *                         Bitmap.CompressFormat.JPEG,
 *                         (quality * 100).toInt(),
 *                         out
 *                     )
 *                 }
 *
 *                 val result = JSONObject().apply {
 *                     put("uri", outputFile.absolutePath)
 *                     put("size", outputFile.length())
 *                     put("width", scaledBitmap.width)
 *                     put("height", scaledBitmap.height)
 *                     put("mimeType", "image/jpeg")
 *                 }
 *
 *                 callback(callbackId, null, result.toString())
 *             } catch (e: Exception) {
 *                 callback(callbackId, e.message, null)
 *             }
 *         }
 *     }
 *
 *     @JavascriptInterface
 *     fun compressVideo(callbackId: Int, argsJson: String) {
 *         thread {
 *             try {
 *                 val args = JSONArray(argsJson)
 *                 val uri = args.getString(0)
 *                 val quality = args.getString(1)
 *                 val maxWidth = args.getInt(2)
 *                 val maxHeight = args.getInt(3)
 *                 val preserveAudio = args.getBoolean(4)
 *
 *                 // Use MediaCodec for hardware-accelerated encoding
 *                 val extractor = MediaExtractor()
 *                 extractor.setDataSource(uri)
 *
 *                 // Find video track
 *                 var videoTrackIndex = -1
 *                 var audioTrackIndex = -1
 *                 for (i in 0 until extractor.trackCount) {
 *                     val format = extractor.getTrackFormat(i)
 *                     val mime = format.getString(MediaFormat.KEY_MIME)
 *                     if (mime?.startsWith("video/") == true) {
 *                         videoTrackIndex = i
 *                     } else if (mime?.startsWith("audio/") == true && preserveAudio) {
 *                         audioTrackIndex = i
 *                     }
 *                 }
 *
 *                 // Set up encoder with hardware acceleration
 *                 val codecList = MediaCodecList(MediaCodecList.ALL_CODECS)
 *                 val encoderInfo = codecList.findEncoderForFormat(videoFormat)
 *                 val encoder = MediaCodec.createByCodecName(encoderInfo)
 *
 *                 // ... encoding pipeline setup ...
 *
 *                 // Output result
 *                 val result = JSONObject().apply {
 *                     put("uri", outputFile.absolutePath)
 *                     put("size", outputFile.length())
 *                     // ... other properties
 *                 }
 *
 *                 callback(callbackId, null, result.toString())
 *             } catch (e: Exception) {
 *                 callback(callbackId, e.message, null)
 *             }
 *         }
 *     }
 *
 *     @JavascriptInterface
 *     fun getCodecCapabilities(callbackId: Int, argsJson: String) {
 *         thread {
 *             try {
 *                 val codecList = MediaCodecList(MediaCodecList.ALL_CODECS)
 *                 val encoders = mutableListOf<String>()
 *                 var hasHardwareEncoder = false
 *                 var maxResolution = 1920
 *
 *                 for (info in codecList.codecInfos) {
 *                     if (info.isEncoder) {
 *                         for (type in info.supportedTypes) {
 *                             if (type.startsWith("video/")) {
 *                                 encoders.add(type.removePrefix("video/"))
 *                                 if (!info.isSoftwareOnly) {
 *                                     hasHardwareEncoder = true
 *                                     val caps = info.getCapabilitiesForType(type)
 *                                     maxResolution = maxOf(
 *                                         maxResolution,
 *                                         caps.videoCapabilities.supportedWidths.upper
 *                                     )
 *                                 }
 *                             }
 *                         }
 *                     }
 *                 }
 *
 *                 val result = JSONObject().apply {
 *                     put("videoEncoders", JSONArray(encoders.distinct()))
 *                     put("maxVideoResolution", maxResolution)
 *                     put("hasHardwareEncoder", hasHardwareEncoder)
 *                 }
 *
 *                 callback(callbackId, null, result.toString())
 *             } catch (e: Exception) {
 *                 callback(callbackId, e.message, null)
 *             }
 *         }
 *     }
 *
 *     private fun callback(id: Int, error: String?, result: String?) {
 *         val js = "window.__androidMediaCallback($id, ${error?.let { "\"$it\"" } ?: "null"}, ${result ?: "null"})"
 *         webView.post { webView.evaluateJavascript(js, null) }
 *     }
 *
 *     private fun reportProgress(progress: Int, stage: String) {
 *         val js = "window.__androidMediaProgress($progress, \"$stage\")"
 *         webView.post { webView.evaluateJavascript(js, null) }
 *     }
 * }
 * ```
 */
