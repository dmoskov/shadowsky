/**
 * Comprehensive media compression pipeline
 * Handles both images and videos with automatic compression to target sizes
 */

import { createLogger } from "./logger";
import { compressVideo, isVideoFile } from "./video-compression";

const logger = createLogger("MediaCompression");

// Target sizes for automatic compression
export const TARGET_IMAGE_SIZE = 1 * 1024 * 1024; // 1MB (Bluesky's limit)
export const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB (with warning)
export const TARGET_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB recommended
export const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB Bluesky limit

export interface CompressionOptions {
  targetSize?: number;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: "jpeg" | "png" | "webp" | "auto";
  preserveExif?: boolean;
}

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  wasCompressed: boolean;
  format: string;
  dimensions: { width: number; height: number };
}

const DEFAULT_OPTIONS: CompressionOptions = {
  targetSize: TARGET_IMAGE_SIZE,
  maxWidth: 2048,
  maxHeight: 2048,
  quality: 0.85,
  format: "auto",
  preserveExif: false,
};

/**
 * Compress an image to meet size requirements
 */
export async function compressImageAdvanced(
  file: File,
  options: CompressionOptions = {},
): Promise<CompressionResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const originalSize = file.size;

  // If already under target size, still check dimensions
  if (file.size <= opts.targetSize!) {
    const dimensions = await getImageDimensions(file);
    if (
      dimensions.width <= opts.maxWidth! &&
      dimensions.height <= opts.maxHeight!
    ) {
      return {
        file,
        originalSize,
        compressedSize: file.size,
        wasCompressed: false,
        format: file.type,
        dimensions,
      };
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = async () => {
        try {
          // Calculate dimensions
          let width = img.width;
          let height = img.height;

          // Scale down if needed
          if (width > opts.maxWidth! || height > opts.maxHeight!) {
            const scale = Math.min(
              opts.maxWidth! / width,
              opts.maxHeight! / height,
            );
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }

          // Create canvas
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Failed to get canvas context"));
            return;
          }

          canvas.width = width;
          canvas.height = height;

          // High quality rendering
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";

          // Draw image
          ctx.drawImage(img, 0, 0, width, height);

          // Determine output format
          let outputFormat: string;
          if (opts.format === "auto") {
            // Use WebP for best compression if supported, otherwise JPEG
            outputFormat =
              file.type === "image/png" && hasTransparency(ctx, width, height)
                ? "image/png"
                : "image/jpeg";
          } else {
            outputFormat = `image/${opts.format}`;
          }

          // Progressive compression
          let quality = opts.quality!;
          let blob: Blob | null = null;

          while (quality >= 0.1) {
            blob = await new Promise<Blob | null>((resolve) => {
              canvas.toBlob((b) => resolve(b), outputFormat, quality);
            });

            if (!blob) break;

            if (blob.size <= opts.targetSize!) {
              break;
            }

            quality -= 0.05;
          }

          // If still too large, try more aggressive compression
          if (!blob || blob.size > opts.targetSize!) {
            // Try JPEG at lower quality
            blob = await new Promise<Blob | null>((resolve) => {
              canvas.toBlob((b) => resolve(b), "image/jpeg", 0.6);
            });
            outputFormat = "image/jpeg";

            // If still too large, reduce dimensions
            if (blob && blob.size > opts.targetSize!) {
              const scale = Math.sqrt(opts.targetSize! / blob.size);
              canvas.width = Math.round(width * scale);
              canvas.height = Math.round(height * scale);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

              blob = await new Promise<Blob | null>((resolve) => {
                canvas.toBlob((b) => resolve(b), "image/jpeg", 0.7);
              });
              width = canvas.width;
              height = canvas.height;
            }
          }

          if (!blob) {
            reject(new Error("Failed to compress image"));
            return;
          }

          // Create file with proper extension
          const ext = outputFormat === "image/png" ? ".png" : ".jpg";
          const fileName = file.name.replace(/\.[^.]+$/, ext);
          const compressedFile = new File([blob], fileName, {
            type: outputFormat,
          });

          logger.log(
            `Compressed image: ${formatBytes(originalSize)} -> ${formatBytes(blob.size)} (${Math.round((1 - blob.size / originalSize) * 100)}% reduction)`,
          );

          resolve({
            file: compressedFile,
            originalSize,
            compressedSize: blob.size,
            wasCompressed: true,
            format: outputFormat,
            dimensions: { width, height },
          });
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Check if image has transparency
 */
function hasTransparency(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): boolean {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Check every 100th pixel for transparency
  for (let i = 3; i < data.length; i += 400) {
    if (data[i] < 255) {
      return true;
    }
  }
  return false;
}

/**
 * Get image dimensions without loading full image
 */
export async function getImageDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

/**
 * Compress media file (image or video) automatically
 */
export async function compressMedia(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<CompressionResult> {
  if (isVideoFile(file)) {
    // Use video compression
    const result = await compressVideo(file, "auto", (p) => {
      onProgress?.(p.progress);
    });

    return {
      file: new File([result.blob], file.name.replace(/\.[^.]+$/, ".mp4"), {
        type: "video/mp4",
      }),
      originalSize: result.originalSize,
      compressedSize: result.compressedSize,
      wasCompressed: result.compressionRatio > 1,
      format: "video/mp4",
      dimensions: {
        width: result.metadata.width,
        height: result.metadata.height,
      },
    };
  } else {
    // Use image compression
    return compressImageAdvanced(file);
  }
}

/**
 * Validate media file before upload
 */
export interface MediaValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
  needsCompression: boolean;
  estimatedCompressedSize?: number;
}

export function validateMedia(file: File): MediaValidationResult {
  const isVideo = isVideoFile(file);

  if (isVideo) {
    if (file.size > 500 * 1024 * 1024) {
      return {
        valid: false,
        error: "Video is too large. Maximum size is 500MB.",
        needsCompression: false,
      };
    }

    if (file.size > MAX_VIDEO_SIZE) {
      return {
        valid: true,
        warning: `Video is ${formatBytes(file.size)}. Will be compressed to under ${formatBytes(MAX_VIDEO_SIZE)}.`,
        needsCompression: true,
        estimatedCompressedSize: TARGET_VIDEO_SIZE,
      };
    }

    return {
      valid: true,
      needsCompression: false,
    };
  } else {
    // Image validation
    if (file.size > 50 * 1024 * 1024) {
      return {
        valid: false,
        error: "Image is too large. Maximum size is 50MB.",
        needsCompression: false,
      };
    }

    if (file.size > TARGET_IMAGE_SIZE) {
      return {
        valid: true,
        warning: `Image is ${formatBytes(file.size)}. Will be compressed automatically.`,
        needsCompression: true,
        estimatedCompressedSize: TARGET_IMAGE_SIZE,
      };
    }

    return {
      valid: true,
      needsCompression: false,
    };
  }
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Calculate estimated compression time
 */
export function estimateCompressionTime(file: File): number {
  const isVideo = isVideoFile(file);
  const sizeMB = file.size / (1024 * 1024);

  if (isVideo) {
    // Video: ~5 seconds per MB
    return Math.round(sizeMB * 5);
  } else {
    // Image: ~0.5 seconds per MB
    return Math.round(sizeMB * 0.5);
  }
}
