import { type EventSubscription } from "expo-modules-core";
import { Platform } from "react-native";

interface ImageCompressorNativeModule {
  getImageInfo(uri: string): Promise<ImageInfo>;
  compressImage(
    uri: string,
    options: CompressOptions,
  ): Promise<CompressionResult>;
  cropImage(uri: string, options: CropOptions): Promise<CropResult>;
  resizeImage(uri: string, options: ResizeOptions): Promise<ResizeResult>;
  cleanupTempFiles(): void;
  addListener(
    eventName: string,
    listener: (event: ImageCompressionProgress) => void,
  ): EventSubscription;
}

let ImageCompressorModule: ImageCompressorNativeModule | null = null;

try {
  const { requireNativeModule } = require("expo-modules-core");
  ImageCompressorModule = requireNativeModule("ImageCompressor");
} catch {
  // Module not available (web or not built with native modules)
}

export interface ImageInfo {
  width: number;
  height: number;
  fileSize: number;
  format: string;
}

export interface CompressOptions {
  /** JPEG quality 0.0–1.0. Default: 0.85 */
  quality?: number;
  /** Target max file size in bytes. Default: 1000000 (1MB) */
  maxFileSize?: number;
  /** Max dimension (width or height). Default: 2000 */
  maxDimension?: number;
  /** Output format: "jpeg" | "png". Default: "jpeg" */
  format?: string;
}

export interface CompressionResult {
  uri: string;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
  mimeType: string;
}

export interface CropOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  /** JPEG quality 0.0–1.0. Default: 0.9 */
  quality?: number;
  /** Output format: "jpeg" | "png". Default: "jpeg" */
  format?: string;
}

export interface CropResult {
  uri: string;
  width: number;
  height: number;
  fileSize: number;
  mimeType: string;
}

export interface ResizeOptions {
  maxWidth: number;
  maxHeight: number;
  /** JPEG quality 0.0–1.0. Default: 0.9 */
  quality?: number;
  /** Output format: "jpeg" | "png". Default: "jpeg" */
  format?: string;
}

export interface ResizeResult {
  uri: string;
  width: number;
  height: number;
  fileSize: number;
  mimeType: string;
}

export interface ImageCompressionProgress {
  progress: number;
  stage: "loading" | "resizing" | "compressing" | "complete";
}

/**
 * Get image metadata (dimensions, file size, format).
 */
export async function getImageInfo(uri: string): Promise<ImageInfo | null> {
  if (Platform.OS !== "ios" || !ImageCompressorModule) {
    return null;
  }
  try {
    return await ImageCompressorModule.getImageInfo(uri);
  } catch {
    return null;
  }
}

/**
 * Compress an image to fit within a target file size.
 * Uses progressive quality reduction to ensure the result fits.
 */
export async function compressImage(
  uri: string,
  options: CompressOptions = {},
): Promise<CompressionResult | null> {
  if (Platform.OS !== "ios" || !ImageCompressorModule) {
    return null;
  }
  return await ImageCompressorModule.compressImage(uri, options);
}

/**
 * Crop an image to the specified region.
 */
export async function cropImage(
  uri: string,
  options: CropOptions,
): Promise<CropResult | null> {
  if (Platform.OS !== "ios" || !ImageCompressorModule) {
    return null;
  }
  return await ImageCompressorModule.cropImage(uri, options);
}

/**
 * Resize an image to fit within max dimensions (maintains aspect ratio).
 */
export async function resizeImage(
  uri: string,
  options: ResizeOptions,
): Promise<ResizeResult | null> {
  if (Platform.OS !== "ios" || !ImageCompressorModule) {
    return null;
  }
  return await ImageCompressorModule.resizeImage(uri, options);
}

/**
 * Clean up temporary compressed/cropped image files.
 */
export function cleanupTempFiles(): void {
  if (Platform.OS !== "ios" || !ImageCompressorModule) {
    return;
  }
  try {
    ImageCompressorModule.cleanupTempFiles();
  } catch {
    // Silently ignore
  }
}

/**
 * Subscribe to compression progress events.
 * Returns an unsubscribe function.
 */
export function onCompressionProgress(
  callback: (progress: ImageCompressionProgress) => void,
): () => void {
  if (!ImageCompressorModule) {
    return () => {};
  }

  const subscription = ImageCompressorModule.addListener(
    "onProgress",
    callback,
  );

  return () => subscription.remove();
}
