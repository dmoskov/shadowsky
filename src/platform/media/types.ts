/**
 * Media Processing Platform Abstraction Types
 *
 * These types define the contract for media processing operations
 * across different platforms (Web, iOS, Android).
 */

/**
 * Result of media processing operations
 */
export interface ProcessedMedia {
  /** The processed media as a Blob */
  blob: Blob;
  /** MIME type of the processed media */
  mimeType: string;
  /** Size in bytes */
  size: number;
  /** Width in pixels (for images/video) */
  width: number;
  /** Height in pixels (for images/video) */
  height: number;
  /** Duration in seconds (for video) */
  duration?: number;
  /** Whether compression was applied */
  wasCompressed: boolean;
  /** Original size before compression */
  originalSize: number;
  /** Compression ratio (original / compressed) */
  compressionRatio: number;
}

/**
 * Options for video compression
 */
export interface VideoCompressionOptions {
  /** Target quality preset */
  quality: "high" | "medium" | "low" | "auto";
  /** Maximum file size in bytes (optional) */
  maxSize?: number;
  /** Maximum width (optional) */
  maxWidth?: number;
  /** Maximum height (optional) */
  maxHeight?: number;
  /** Target bitrate in kbps (optional) */
  targetBitrate?: number;
  /** Whether to preserve audio (default: true) */
  preserveAudio?: boolean;
}

/**
 * Options for image compression
 */
export interface ImageCompressionOptions {
  /** Target quality (0.0 - 1.0) */
  quality: number;
  /** Maximum dimension for longest side */
  maxDimension: number;
  /** Output format */
  format?: "jpeg" | "png" | "webp" | "auto";
  /** Whether to preserve EXIF data (default: false) */
  preserveExif?: boolean;
  /** Target file size in bytes (optional) */
  targetSize?: number;
}

/**
 * Metadata for media files
 */
export interface MediaMetadata {
  /** MIME type */
  mimeType: string;
  /** File size in bytes */
  size: number;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** Duration in seconds (for video) */
  duration?: number;
  /** Whether the media has audio (for video) */
  hasAudio?: boolean;
  /** Creation date */
  createdAt?: Date;
  /** Orientation from EXIF */
  orientation?: number;
  /** Aspect ratio (width / height) */
  aspectRatio: number;
}

/**
 * Progress callback for long-running operations
 */
export interface MediaProcessingProgress {
  /** Current stage of processing */
  stage: "loading" | "analyzing" | "processing" | "encoding" | "finalizing";
  /** Progress percentage (0-100) */
  progress: number;
  /** Estimated time remaining in seconds */
  estimatedTimeRemaining?: number;
  /** Current operation description */
  message?: string;
}

/**
 * Progress callback type
 */
export type ProgressCallback = (progress: MediaProcessingProgress) => void;

/**
 * Resumable upload state for tus.io protocol
 */
export interface ResumableUploadState {
  /** Unique upload ID */
  uploadId: string;
  /** File being uploaded */
  fileUri: string;
  /** Target URL for upload */
  uploadUrl: string;
  /** Current offset (bytes uploaded) */
  offset: number;
  /** Total file size */
  totalSize: number;
  /** Upload metadata */
  metadata: Record<string, string>;
  /** Upload status */
  status: "pending" | "uploading" | "paused" | "completed" | "failed";
  /** Error message if failed */
  error?: string;
  /** Created timestamp */
  createdAt: number;
  /** Last activity timestamp */
  lastActivityAt: number;
  /** Retry count */
  retryCount: number;
}

/**
 * Upload progress callback
 */
export interface UploadProgress {
  /** Bytes uploaded */
  bytesUploaded: number;
  /** Total bytes to upload */
  totalBytes: number;
  /** Upload percentage (0-100) */
  percentage: number;
  /** Upload speed in bytes/second */
  speed?: number;
  /** Estimated time remaining in seconds */
  estimatedTimeRemaining?: number;
}

/**
 * Result of a resumable upload
 */
export interface UploadResult {
  /** Whether upload completed successfully */
  success: boolean;
  /** Upload ID */
  uploadId: string;
  /** Remote URL/reference of uploaded file */
  remoteUrl?: string;
  /** Server response blob reference */
  blobRef?: {
    ref: { $link: string };
    mimeType: string;
    size: number;
  };
  /** Error if upload failed */
  error?: string;
}

/**
 * Platform capabilities
 */
export interface PlatformCapabilities {
  /** Whether hardware video encoding is available */
  hasHardwareVideoEncoding: boolean;
  /** Whether hardware image processing is available */
  hasHardwareImageProcessing: boolean;
  /** Maximum video dimension supported */
  maxVideoResolution: number;
  /** Supported video codecs */
  supportedVideoCodecs: string[];
  /** Supported image formats */
  supportedImageFormats: string[];
  /** Whether resumable uploads are supported */
  supportsResumableUploads: boolean;
  /** Maximum concurrent processing operations */
  maxConcurrentOperations: number;
  /** Whether background processing is supported */
  supportsBackgroundProcessing: boolean;
}

/**
 * Main interface for media processing operations
 * Each platform (Web, iOS, Android) implements this interface
 */
export interface IMediaProcessor {
  /**
   * Get platform capabilities
   */
  getCapabilities(): Promise<PlatformCapabilities>;

  /**
   * Compress an image
   * @param uri - URI or path to the image
   * @param options - Compression options
   * @param onProgress - Progress callback
   * @returns Processed media result
   */
  compressImage(
    uri: string,
    options: ImageCompressionOptions,
    onProgress?: ProgressCallback,
  ): Promise<ProcessedMedia>;

  /**
   * Compress a video
   * @param uri - URI or path to the video
   * @param options - Compression options
   * @param onProgress - Progress callback
   * @returns Processed media result
   */
  compressVideo(
    uri: string,
    options: VideoCompressionOptions,
    onProgress?: ProgressCallback,
  ): Promise<ProcessedMedia>;

  /**
   * Generate a thumbnail from a video
   * @param uri - URI or path to the video
   * @param timestamp - Time in seconds to capture thumbnail
   * @param maxDimension - Maximum dimension for thumbnail
   * @returns URI of generated thumbnail
   */
  generateThumbnail(
    uri: string,
    timestamp: number,
    maxDimension?: number,
  ): Promise<string>;

  /**
   * Get metadata for a media file
   * @param uri - URI or path to the media
   * @returns Media metadata
   */
  getMediaMetadata(uri: string): Promise<MediaMetadata>;

  /**
   * Check if a file is a supported video format
   * @param uri - URI or path to check
   * @returns Whether file is a supported video
   */
  isVideoFile(uri: string): Promise<boolean>;

  /**
   * Check if a file is a supported image format
   * @param uri - URI or path to check
   * @returns Whether file is a supported image
   */
  isImageFile(uri: string): Promise<boolean>;

  /**
   * Clean up temporary files created during processing
   */
  cleanup(): Promise<void>;
}

/**
 * Interface for resumable upload operations
 */
export interface IResumableUploader {
  /**
   * Start or resume an upload
   * @param file - Blob or URI to upload
   * @param uploadUrl - tus.io endpoint URL
   * @param metadata - Upload metadata
   * @param onProgress - Progress callback
   * @returns Upload result
   */
  upload(
    file: Blob | string,
    uploadUrl: string,
    metadata: Record<string, string>,
    onProgress?: (progress: UploadProgress) => void,
  ): Promise<UploadResult>;

  /**
   * Resume a paused or failed upload
   * @param uploadId - ID of upload to resume
   * @param onProgress - Progress callback
   * @returns Upload result
   */
  resume(
    uploadId: string,
    onProgress?: (progress: UploadProgress) => void,
  ): Promise<UploadResult>;

  /**
   * Pause an in-progress upload
   * @param uploadId - ID of upload to pause
   */
  pause(uploadId: string): Promise<void>;

  /**
   * Cancel an upload
   * @param uploadId - ID of upload to cancel
   */
  cancel(uploadId: string): Promise<void>;

  /**
   * Get the current state of an upload
   * @param uploadId - ID of upload
   * @returns Upload state or null if not found
   */
  getUploadState(uploadId: string): Promise<ResumableUploadState | null>;

  /**
   * Get all pending/paused uploads
   * @returns List of upload states
   */
  getPendingUploads(): Promise<ResumableUploadState[]>;

  /**
   * Clean up completed/failed uploads older than specified time
   * @param maxAgeMs - Maximum age in milliseconds
   */
  cleanupOldUploads(maxAgeMs: number): Promise<void>;
}

/**
 * Combined media service interface
 */
export interface IMediaService extends IMediaProcessor, IResumableUploader {
  /** Platform identifier */
  readonly platform: "web" | "ios" | "android";

  /**
   * Initialize the media service
   */
  initialize(): Promise<void>;

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean;

  /**
   * Shut down the service and clean up resources
   */
  shutdown(): Promise<void>;
}
