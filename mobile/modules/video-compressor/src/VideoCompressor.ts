import { Platform } from "react-native";
import { EventEmitter, type Subscription } from "expo-modules-core";

let VideoCompressorModule: {
  getVideoInfo(uri: string): Promise<VideoInfo>;
  compressVideo(uri: string, quality: string): Promise<CompressionResult>;
  cancelCompression(): void;
  cleanupTempFiles(): void;
  isPresetCompatible(uri: string, quality: string): Promise<boolean>;
} | null = null;

let emitter: EventEmitter | null = null;

try {
  const { requireNativeModule } = require("expo-modules-core");
  VideoCompressorModule = requireNativeModule("VideoCompressor");
  if (VideoCompressorModule) {
    emitter = new EventEmitter(VideoCompressorModule as any);
  }
} catch {
  // Module not available (web or not built with native modules)
}

export interface VideoInfo {
  duration: number;
  width: number;
  height: number;
  fileSize: number;
  hasAudio: boolean;
}

export interface CompressionResult {
  uri: string;
  originalSize: number;
  compressedSize: number;
  mimeType: string;
}

export interface CompressionProgress {
  progress: number;
  stage: "compressing" | "complete";
}

export type CompressionQuality = "low" | "medium" | "high" | "highest";

/**
 * Get video metadata (duration, dimensions, file size).
 */
export async function getVideoInfo(uri: string): Promise<VideoInfo | null> {
  if (Platform.OS !== "ios" || !VideoCompressorModule) {
    return null;
  }
  try {
    return await VideoCompressorModule.getVideoInfo(uri);
  } catch {
    return null;
  }
}

/**
 * Compress a video file with the given quality preset.
 * Returns the compressed file URI and size info.
 */
export async function compressVideo(
  uri: string,
  quality: CompressionQuality = "medium",
): Promise<CompressionResult | null> {
  if (Platform.OS !== "ios" || !VideoCompressorModule) {
    return null;
  }
  return await VideoCompressorModule.compressVideo(uri, quality);
}

/**
 * Cancel any ongoing compression.
 */
export function cancelCompression(): void {
  if (Platform.OS !== "ios" || !VideoCompressorModule) {
    return;
  }
  try {
    VideoCompressorModule.cancelCompression();
  } catch {
    // Silently ignore
  }
}

/**
 * Clean up temporary compressed video files.
 */
export function cleanupTempFiles(): void {
  if (Platform.OS !== "ios" || !VideoCompressorModule) {
    return;
  }
  try {
    VideoCompressorModule.cleanupTempFiles();
  } catch {
    // Silently ignore
  }
}

/**
 * Check if a quality preset is compatible with the given video.
 */
export async function isPresetCompatible(
  uri: string,
  quality: CompressionQuality,
): Promise<boolean> {
  if (Platform.OS !== "ios" || !VideoCompressorModule) {
    return false;
  }
  try {
    return await VideoCompressorModule.isPresetCompatible(uri, quality);
  } catch {
    return false;
  }
}

/**
 * Subscribe to compression progress events.
 * Returns an unsubscribe function.
 */
export function onCompressionProgress(
  callback: (progress: CompressionProgress) => void,
): () => void {
  if (!emitter) {
    return () => {};
  }

  const subscription: Subscription = emitter.addListener(
    "onProgress",
    callback,
  );

  return () => subscription.remove();
}
