/**
 * Video file validation utilities
 * Provides defense-in-depth validation for video uploads
 */

export interface VideoValidationError {
  code:
    | "INVALID_MIME_TYPE"
    | "EXTENSION_MISMATCH"
    | "FILE_TOO_LARGE"
    | "INVALID_FILE";
  message: string;
  context?: Record<string, any>;
}

export interface VideoValidationResult {
  valid: boolean;
  error?: VideoValidationError;
}

// Allowed video MIME types (as per security requirements)
const ALLOWED_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
] as const;

// MIME type to extension mapping for validation
const MIME_TO_EXTENSIONS: Record<string, string[]> = {
  "video/mp4": [".mp4", ".m4v", ".mp4v"],
  "video/quicktime": [".mov"],
  "video/webm": [".webm"],
  "video/x-m4v": [".m4v"],
};

// Maximum file size (500MB as per requirements)
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB in bytes

/**
 * Extract file extension from filename
 */
function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) return "";
  return filename.slice(lastDot).toLowerCase();
}

/**
 * Check if MIME type is in allowed list
 */
function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.includes(mimeType as any);
}

/**
 * Verify file extension matches the MIME type
 * This prevents malicious files disguised as videos
 */
function extensionMatchesMimeType(filename: string, mimeType: string): boolean {
  const extension = getFileExtension(filename);
  if (!extension) return false;

  const allowedExtensions = MIME_TO_EXTENSIONS[mimeType];
  if (!allowedExtensions) return false;

  return allowedExtensions.includes(extension);
}

/**
 * Validate video file before upload
 *
 * Performs comprehensive validation:
 * - MIME type must be in allowed list
 * - File extension must match MIME type
 * - File size must be under 500MB
 *
 * @param videoData - The video file data
 * @param mimeType - The MIME type of the file
 * @param filename - The filename (used for extension validation)
 * @returns Validation result with error details if invalid
 */
export function validateVideoFile(
  videoData: Uint8Array,
  mimeType: string,
  filename: string,
): VideoValidationResult {
  // Validate MIME type
  if (!isAllowedMimeType(mimeType)) {
    return {
      valid: false,
      error: {
        code: "INVALID_MIME_TYPE",
        message: `Invalid video format. Allowed formats: MP4, QuickTime (MOV), WebM, M4V`,
        context: {
          providedMimeType: mimeType,
          allowedMimeTypes: [...ALLOWED_MIME_TYPES],
        },
      },
    };
  }

  // Validate extension matches MIME type
  if (!extensionMatchesMimeType(filename, mimeType)) {
    const extension = getFileExtension(filename);
    const allowedExtensions = MIME_TO_EXTENSIONS[mimeType] || [];

    return {
      valid: false,
      error: {
        code: "EXTENSION_MISMATCH",
        message: `File extension "${extension}" does not match MIME type "${mimeType}". Expected: ${allowedExtensions.join(", ")}`,
        context: {
          filename,
          extension,
          mimeType,
          expectedExtensions: allowedExtensions,
        },
      },
    };
  }

  // Validate file size
  if (videoData.length > MAX_FILE_SIZE) {
    const sizeMB = Math.round(videoData.length / (1024 * 1024));
    const maxMB = MAX_FILE_SIZE / (1024 * 1024);

    return {
      valid: false,
      error: {
        code: "FILE_TOO_LARGE",
        message: `Video file is too large (${sizeMB}MB). Maximum size: ${maxMB}MB`,
        context: {
          fileSize: videoData.length,
          fileSizeMB: sizeMB,
          maxSize: MAX_FILE_SIZE,
          maxSizeMB: maxMB,
        },
      },
    };
  }

  // All validations passed
  return { valid: true };
}

/**
 * Get a user-friendly error message for a validation error
 */
export function getValidationErrorMessage(error: VideoValidationError): string {
  return error.message;
}

/**
 * Check if a validation error is recoverable (user can fix it)
 */
export function isRecoverableError(error: VideoValidationError): boolean {
  // File too large is recoverable (user can compress or choose different file)
  // Invalid MIME type and extension mismatch indicate potential security issues
  return error.code === "FILE_TOO_LARGE";
}
