/**
 * Video compression utility using FFmpeg.wasm
 *
 * Features:
 * - Client-side video compression with configurable quality settings
 * - Progress tracking during compression
 * - Thumbnail generation from video frames
 * - MIME type detection and validation
 * - Bluesky API compatibility (100MB recommended max)
 */

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { createLogger } from "./logger";

const logger = createLogger("VideoCompression");

// Bluesky video limits
const BLUESKY_MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB recommended
const BLUESKY_ABSOLUTE_MAX_SIZE = 500 * 1024 * 1024; // 500MB absolute max
const MIN_COMPRESSION_THRESHOLD = 10 * 1024 * 1024; // 10MB - files under this don't need compression

// Compression presets optimized for social media
export interface CompressionPreset {
  name: string;
  crf: number; // Constant Rate Factor (18-28, lower = better quality)
  preset: string; // FFmpeg preset (ultrafast, fast, medium, slow)
  maxBitrate?: string; // Max bitrate constraint
  audioBitrate: string;
  targetSizeMB?: number; // Target file size in MB
}

export const COMPRESSION_PRESETS: Record<string, CompressionPreset> = {
  high: {
    name: "High Quality",
    crf: 20,
    preset: "medium",
    audioBitrate: "128k",
    targetSizeMB: 80,
  },
  medium: {
    name: "Balanced",
    crf: 23,
    preset: "fast",
    audioBitrate: "96k",
    targetSizeMB: 50,
  },
  low: {
    name: "Smaller File",
    crf: 28,
    preset: "fast",
    audioBitrate: "64k",
    targetSizeMB: 25,
  },
  auto: {
    name: "Auto (Optimize for Bluesky)",
    crf: 23,
    preset: "fast",
    audioBitrate: "96k",
  },
};

export interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
  mimeType: string;
  size: number;
  hasAudio: boolean;
}

export interface CompressionProgress {
  stage: "analyzing" | "compressing" | "finalizing";
  progress: number; // 0-100
  estimatedTimeRemaining?: number; // seconds
}

export interface CompressionResult {
  blob: Blob;
  mimeType: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  metadata: VideoMetadata;
}

export interface ThumbnailResult {
  blob: Blob;
  width: number;
  height: number;
}

// Shared FFmpeg instance for reuse
let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoading = false;
let ffmpegLoadPromise: Promise<FFmpeg> | null = null;

/**
 * Load FFmpeg with proper error handling and caching
 */
export async function loadFFmpegInstance(): Promise<FFmpeg> {
  // Return existing instance if available
  if (ffmpegInstance) {
    return ffmpegInstance;
  }

  // Wait for existing load if in progress
  if (ffmpegLoading && ffmpegLoadPromise) {
    return ffmpegLoadPromise;
  }

  ffmpegLoading = true;

  ffmpegLoadPromise = (async () => {
    logger.log("Loading FFmpeg for video compression...");

    const ffmpeg = new FFmpeg();

    // Set up logging for debugging
    ffmpeg.on("log", ({ message }) => {
      logger.log("FFmpeg:", message);
    });

    try {
      const baseURL = window.location.origin;

      await ffmpeg.load({
        coreURL: `${baseURL}/ffmpeg/ffmpeg-core.js`,
        wasmURL: `${baseURL}/ffmpeg/ffmpeg-core.wasm`,
      });

      logger.log("FFmpeg loaded successfully for compression");
      ffmpegInstance = ffmpeg;
      return ffmpeg;
    } catch (error) {
      logger.error("Failed to load FFmpeg:", error);
      ffmpegLoading = false;
      ffmpegLoadPromise = null;
      throw new Error(
        "Failed to initialize video compression. Please try again.",
      );
    }
  })();

  return ffmpegLoadPromise;
}

/**
 * Detect video MIME type from file magic bytes
 */
export function detectVideoMimeType(data: Uint8Array): string | null {
  if (data.length < 12) {
    return null;
  }

  // Check for common video format signatures

  // MP4/M4V - 'ftyp' box at offset 4
  if (
    data[4] === 0x66 &&
    data[5] === 0x74 &&
    data[6] === 0x79 &&
    data[7] === 0x70
  ) {
    // Check specific brand
    const brand = String.fromCharCode(data[8], data[9], data[10], data[11]);
    if (brand === "M4V " || brand === "M4VP") {
      return "video/x-m4v";
    }
    if (brand === "qt  ") {
      return "video/quicktime";
    }
    return "video/mp4";
  }

  // WebM - EBML header
  if (
    data[0] === 0x1a &&
    data[1] === 0x45 &&
    data[2] === 0xdf &&
    data[3] === 0xa3
  ) {
    return "video/webm";
  }

  // QuickTime - 'moov' or 'mdat' at start
  if (
    (data[4] === 0x6d &&
      data[5] === 0x6f &&
      data[6] === 0x6f &&
      data[7] === 0x76) || // moov
    (data[4] === 0x6d &&
      data[5] === 0x64 &&
      data[6] === 0x61 &&
      data[7] === 0x74) // mdat
  ) {
    return "video/quicktime";
  }

  // AVI - RIFF....AVI
  if (
    data[0] === 0x52 &&
    data[1] === 0x49 &&
    data[2] === 0x46 &&
    data[3] === 0x46 &&
    data[8] === 0x41 &&
    data[9] === 0x56 &&
    data[10] === 0x49
  ) {
    return "video/x-msvideo";
  }

  return null;
}

/**
 * Check if a file is a video based on MIME type
 */
export function isVideoFile(file: File): boolean {
  const videoMimeTypes = [
    "video/mp4",
    "video/quicktime",
    "video/webm",
    "video/x-m4v",
    "video/x-msvideo",
    "video/mpeg",
  ];

  return videoMimeTypes.includes(file.type);
}

/**
 * Check if video needs compression based on file size
 */
export function shouldCompressVideo(file: File): boolean {
  // Compress if over threshold and under absolute max
  return (
    file.size > MIN_COMPRESSION_THRESHOLD &&
    file.size <= BLUESKY_ABSOLUTE_MAX_SIZE
  );
}

/**
 * Check if video is too large to process
 */
export function isVideoTooLarge(file: File): boolean {
  return file.size > BLUESKY_ABSOLUTE_MAX_SIZE;
}

/**
 * Get video metadata using HTML5 video element
 */
export async function getVideoMetadata(file: File): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";

    const objectUrl = URL.createObjectURL(file);

    video.onloadedmetadata = () => {
      // Check for audio tracks
      const hasAudio =
        video.mozHasAudio !== undefined
          ? (video as any).mozHasAudio
          : video.webkitAudioDecodedByteCount !== undefined
            ? (video as any).webkitAudioDecodedByteCount > 0
            : (video as any).audioTracks !== undefined
              ? (video as any).audioTracks.length > 0
              : true; // Assume audio by default

      const metadata: VideoMetadata = {
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration,
        mimeType: file.type || "video/mp4",
        size: file.size,
        hasAudio,
      };

      URL.revokeObjectURL(objectUrl);
      resolve(metadata);
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to read video metadata"));
    };

    video.src = objectUrl;
  });
}

/**
 * Calculate optimal CRF based on target size and duration
 */
function calculateOptimalCrf(
  currentSize: number,
  duration: number,
  targetSize: number = BLUESKY_MAX_VIDEO_SIZE * 0.9,
): number {
  // If already under target, use high quality
  if (currentSize <= targetSize) {
    return 20;
  }

  // Calculate compression ratio needed
  const compressionRatio = currentSize / targetSize;

  // Adjust CRF based on needed compression
  // Higher ratio = higher CRF (more compression)
  if (compressionRatio > 10) {
    return 32; // Very aggressive
  } else if (compressionRatio > 5) {
    return 28;
  } else if (compressionRatio > 3) {
    return 26;
  } else if (compressionRatio > 2) {
    return 24;
  } else {
    return 22;
  }
}

/**
 * Compress video using FFmpeg.wasm
 */
export async function compressVideo(
  file: File,
  preset: keyof typeof COMPRESSION_PRESETS = "auto",
  onProgress?: (progress: CompressionProgress) => void,
): Promise<CompressionResult> {
  const originalSize = file.size;
  const startTime = Date.now();

  logger.log(
    `Starting video compression: ${file.name} (${formatBytes(originalSize)})`,
  );

  onProgress?.({
    stage: "analyzing",
    progress: 0,
  });

  // Get video metadata
  const metadata = await getVideoMetadata(file);
  logger.log("Video metadata:", metadata);

  // Load FFmpeg
  const ffmpeg = await loadFFmpegInstance();

  onProgress?.({
    stage: "analyzing",
    progress: 10,
  });

  // Determine compression settings
  const presetConfig = COMPRESSION_PRESETS[preset];
  let crf = presetConfig.crf;

  // For 'auto' preset, calculate optimal CRF
  if (preset === "auto") {
    crf = calculateOptimalCrf(originalSize, metadata.duration);
    logger.log(
      `Auto preset: calculated CRF ${crf} for ${formatBytes(originalSize)} file`,
    );
  }

  // Set up progress tracking
  ffmpeg.on("progress", ({ progress }) => {
    const overallProgress = 10 + progress * 85; // 10-95%
    onProgress?.({
      stage: "compressing",
      progress: Math.round(overallProgress),
      estimatedTimeRemaining: estimateTimeRemaining(startTime, progress),
    });
  });

  try {
    // Write input file
    const inputData = await fetchFile(file);
    await ffmpeg.writeFile("input.mp4", inputData);

    onProgress?.({
      stage: "compressing",
      progress: 15,
    });

    // Build FFmpeg command
    const ffmpegArgs = buildFFmpegArgs(crf, presetConfig, metadata);
    logger.log("FFmpeg args:", ffmpegArgs.join(" "));

    // Execute compression
    await ffmpeg.exec(ffmpegArgs);

    onProgress?.({
      stage: "finalizing",
      progress: 95,
    });

    // Read output
    const outputData = await ffmpeg.readFile("output.mp4");

    // Clean up
    await ffmpeg.deleteFile("input.mp4");
    await ffmpeg.deleteFile("output.mp4");

    const compressedBlob = new Blob([outputData], { type: "video/mp4" });
    const compressedSize = compressedBlob.size;
    const compressionRatio = originalSize / compressedSize;

    onProgress?.({
      stage: "finalizing",
      progress: 100,
    });

    logger.log(
      `Compression complete: ${formatBytes(originalSize)} -> ${formatBytes(compressedSize)} (${compressionRatio.toFixed(2)}x reduction)`,
    );

    return {
      blob: compressedBlob,
      mimeType: "video/mp4",
      originalSize,
      compressedSize,
      compressionRatio,
      metadata: {
        ...metadata,
        size: compressedSize,
        mimeType: "video/mp4",
      },
    };
  } catch (error) {
    logger.error("Video compression failed:", error);
    throw new Error("Failed to compress video. Please try a different file.");
  }
}

/**
 * Build FFmpeg command arguments for compression
 */
function buildFFmpegArgs(
  crf: number,
  preset: CompressionPreset,
  metadata: VideoMetadata,
): string[] {
  const args = ["-i", "input.mp4"];

  // Video codec settings
  args.push("-c:v", "libx264");
  args.push("-crf", crf.toString());
  args.push("-preset", preset.preset);

  // Pixel format for compatibility
  args.push("-pix_fmt", "yuv420p");

  // Scale if video is very large (max 1920x1080)
  if (metadata.width > 1920 || metadata.height > 1080) {
    args.push(
      "-vf",
      "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease,pad=ceil(iw/2)*2:ceil(ih/2)*2",
    );
  } else {
    // Ensure even dimensions
    args.push("-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2");
  }

  // Audio settings
  if (metadata.hasAudio) {
    args.push("-c:a", "aac");
    args.push("-b:a", preset.audioBitrate);
  } else {
    args.push("-an"); // No audio
  }

  // Optimize for web streaming
  args.push("-movflags", "+faststart");

  // Output
  args.push("-y", "output.mp4");

  return args;
}

/**
 * Generate a thumbnail from a video at a specific time
 */
export async function generateVideoThumbnail(
  file: File,
  timeSeconds: number = 0,
  maxWidth: number = 400,
): Promise<ThumbnailResult> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      reject(new Error("Failed to create canvas context"));
      return;
    }

    const objectUrl = URL.createObjectURL(file);

    video.onloadedmetadata = () => {
      // Seek to the specified time
      const seekTime = Math.min(timeSeconds, video.duration * 0.5); // Cap at 50% of video
      video.currentTime = seekTime;
    };

    video.onseeked = () => {
      // Calculate dimensions maintaining aspect ratio
      const aspectRatio = video.videoWidth / video.videoHeight;
      let width = Math.min(video.videoWidth, maxWidth);
      let height = width / aspectRatio;

      // Ensure even dimensions
      width = Math.ceil(width / 2) * 2;
      height = Math.ceil(height / 2) * 2;

      canvas.width = width;
      canvas.height = height;

      // Draw the frame
      ctx.drawImage(video, 0, 0, width, height);

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);

          if (!blob) {
            reject(new Error("Failed to create thumbnail"));
            return;
          }

          resolve({
            blob,
            width,
            height,
          });
        },
        "image/jpeg",
        0.85,
      );
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load video for thumbnail"));
    };

    video.src = objectUrl;
    video.load();
  });
}

/**
 * Generate multiple thumbnails at different times
 */
export async function generateVideoThumbnails(
  file: File,
  count: number = 4,
  maxWidth: number = 200,
): Promise<ThumbnailResult[]> {
  const metadata = await getVideoMetadata(file);
  const thumbnails: ThumbnailResult[] = [];

  // Generate thumbnails at evenly spaced intervals
  for (let i = 0; i < count; i++) {
    const time = (metadata.duration / (count + 1)) * (i + 1);
    try {
      const thumbnail = await generateVideoThumbnail(file, time, maxWidth);
      thumbnails.push(thumbnail);
    } catch (error) {
      logger.warn(`Failed to generate thumbnail at ${time}s:`, error);
    }
  }

  return thumbnails;
}

/**
 * Estimate remaining time based on progress
 */
function estimateTimeRemaining(startTime: number, progress: number): number {
  if (progress === 0) return 0;

  const elapsed = (Date.now() - startTime) / 1000;
  const totalEstimated = elapsed / progress;
  return Math.max(0, Math.round(totalEstimated - elapsed));
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Get recommended compression preset based on file size and network conditions
 */
export function getRecommendedPreset(
  fileSize: number,
): keyof typeof COMPRESSION_PRESETS {
  if (fileSize <= BLUESKY_MAX_VIDEO_SIZE * 0.8) {
    return "high"; // File is already small, use high quality
  } else if (fileSize <= BLUESKY_MAX_VIDEO_SIZE * 2) {
    return "medium"; // Moderate compression needed
  } else {
    return "low"; // Aggressive compression for large files
  }
}

// Export constants for use in components
export {
  BLUESKY_ABSOLUTE_MAX_SIZE,
  BLUESKY_MAX_VIDEO_SIZE,
  MIN_COMPRESSION_THRESHOLD,
};
