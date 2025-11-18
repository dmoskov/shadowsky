import { useCallback, useEffect, useRef, useState } from "react";
import type { BskyAgent } from "@atproto/api";
import { VideoUploadService, type VideoUploadResult } from "../services/atproto/video-upload";
import { createLogger } from "../utils/logger";
import type { StandardErrorResponse } from "../services/atproto/error-handler";
import { validateVideoFile, isRecoverableError } from "../utils/video-validation";

const logger = createLogger("VideoUploadManager");

export type UploadStatus = "idle" | "uploading" | "processing" | "complete" | "error" | "cancelled";

export interface VideoUploadState {
  uploadId: string | null;
  status: UploadStatus;
  progress: number;
  error: StandardErrorResponse | null;
  result: VideoUploadResult | null;
  fileName?: string;
}

interface ActiveUpload {
  uploadId: string;
  fileName: string;
  abortController: AbortController;
  videoData: Uint8Array;
  mimeType: string;
  startTime: number;
}

const initialState: VideoUploadState = {
  uploadId: null,
  status: "idle",
  progress: 0,
  error: null,
  result: null,
};

/**
 * Hook for managing video upload state with proper cleanup and duplicate prevention
 *
 * Features:
 * - Prevents duplicate uploads
 * - Automatic cleanup on unmount
 * - Optimistic UI updates with rollback
 * - Memory leak prevention
 * - React 18 concurrent mode compatible
 */
export function useVideoUploadManager(agent: BskyAgent | null) {
  const [uploadState, setUploadState] = useState<VideoUploadState>(initialState);
  const activeUploadRef = useRef<ActiveUpload | null>(null);
  const isMountedRef = useRef(true);
  const videoServiceRef = useRef<VideoUploadService | null>(null);

  // Initialize video service when agent is available
  useEffect(() => {
    if (agent && !videoServiceRef.current) {
      videoServiceRef.current = new VideoUploadService(agent);
    }
  }, [agent]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      // Cancel any active uploads
      if (activeUploadRef.current) {
        logger.log(
          `[${activeUploadRef.current.uploadId}] Component unmounting, cancelling upload`
        );
        activeUploadRef.current.abortController.abort();
        activeUploadRef.current = null;
      }

      // Reset video service
      videoServiceRef.current = null;
    };
  }, []);

  /**
   * Check if an upload is currently in progress
   */
  const isUploading = useCallback((): boolean => {
    return activeUploadRef.current !== null ||
           uploadState.status === "uploading" ||
           uploadState.status === "processing";
  }, [uploadState.status]);

  /**
   * Start a new video upload
   * Returns false if an upload is already in progress (duplicate prevention)
   */
  const startUpload = useCallback(
    async (
      videoData: Uint8Array,
      mimeType: string,
      fileName: string,
      onProgress?: (progress: number) => void
    ): Promise<VideoUploadResult | null> => {
      // Prevent duplicate uploads
      if (isUploading()) {
        logger.warn("Upload already in progress, rejecting new upload request");
        return null;
      }

      if (!videoServiceRef.current) {
        const error: StandardErrorResponse = {
          code: "CLIENT_BAD_REQUEST" as any,
          message: "Video service not initialized. Please ensure you're logged in.",
          context: { timestamp: new Date().toISOString() },
          retryable: false,
        };

        if (isMountedRef.current) {
          setUploadState({
            uploadId: null,
            status: "error",
            progress: 0,
            error,
            result: null,
            fileName,
          });
        }
        return null;
      }

      // Validate video file before upload
      const validationResult = validateVideoFile(videoData, mimeType, fileName);

      if (!validationResult.valid && validationResult.error) {
        logger.error(`Video validation failed: ${validationResult.error.message}`, validationResult.error.context);

        const error: StandardErrorResponse = {
          code: "CLIENT_BAD_REQUEST" as any,
          message: validationResult.error.message,
          context: {
            ...validationResult.error.context,
            validationCode: validationResult.error.code,
            timestamp: new Date().toISOString(),
          },
          retryable: isRecoverableError(validationResult.error),
        };

        if (isMountedRef.current) {
          setUploadState({
            uploadId: null,
            status: "error",
            progress: 0,
            error,
            result: null,
            fileName,
          });
        }
        return null;
      }

      const abortController = new AbortController();
      let uploadId: string | null = null;

      try {
        logger.log(`Starting video upload: ${fileName} (${videoData.length} bytes)`);

        // Set optimistic uploading state
        if (isMountedRef.current) {
          setUploadState({
            uploadId: null,
            status: "uploading",
            progress: 0,
            error: null,
            result: null,
            fileName,
          });
        }

        // Start the upload
        const result = await videoServiceRef.current.uploadVideo(
          videoData,
          mimeType,
          (progress) => {
            if (isMountedRef.current && !abortController.signal.aborted) {
              setUploadState((prev) => ({
                ...prev,
                progress: Math.min(95, progress), // Cap at 95% until processing starts
              }));
              onProgress?.(progress);
            }
          },
          (id) => {
            uploadId = id;
            if (isMountedRef.current) {
              setUploadState((prev) => ({
                ...prev,
                uploadId: id,
              }));
            }

            // Track active upload for cleanup
            activeUploadRef.current = {
              uploadId: id,
              fileName,
              abortController,
              videoData,
              mimeType,
              startTime: Date.now(),
            };
          }
        );

        // Check if upload was cancelled during processing
        if (abortController.signal.aborted) {
          logger.log(`[${uploadId}] Upload was cancelled`);
          return null;
        }

        // Success - update state
        if (isMountedRef.current) {
          setUploadState({
            uploadId: result.uploadId,
            status: "complete",
            progress: 100,
            error: null,
            result,
            fileName,
          });
        }

        // Clear active upload reference
        activeUploadRef.current = null;

        logger.log(`[${result.uploadId}] Upload completed successfully`);
        return result;
      } catch (error: any) {
        // Check if this was a cancellation
        if (abortController.signal.aborted) {
          if (isMountedRef.current) {
            setUploadState({
              uploadId,
              status: "cancelled",
              progress: 0,
              error: null,
              result: null,
              fileName,
            });
          }
          return null;
        }

        // Handle actual errors
        logger.error(`[${uploadId}] Upload failed:`, error);

        const standardError: StandardErrorResponse = error.code && error.message
          ? error
          : {
              code: "UNKNOWN" as any,
              message: error.message || "Unknown upload error",
              context: {
                uploadId: uploadId || undefined,
                timestamp: new Date().toISOString(),
              },
              retryable: true,
            };

        if (isMountedRef.current) {
          setUploadState({
            uploadId,
            status: "error",
            progress: 0,
            error: standardError,
            result: null,
            fileName,
          });
        }

        // Clear active upload reference
        activeUploadRef.current = null;

        return null;
      }
    },
    [isUploading]
  );

  /**
   * Cancel the current upload
   */
  const cancelUpload = useCallback(() => {
    if (activeUploadRef.current) {
      logger.log(`[${activeUploadRef.current.uploadId}] Cancelling upload`);
      activeUploadRef.current.abortController.abort();

      if (isMountedRef.current) {
        setUploadState((prev) => ({
          ...prev,
          status: "cancelled",
          progress: 0,
        }));
      }

      activeUploadRef.current = null;
    }
  }, []);

  /**
   * Retry a failed upload
   * Returns false if no upload to retry or if an upload is already in progress
   */
  const retryUpload = useCallback(
    async (onProgress?: (progress: number) => void): Promise<VideoUploadResult | null> => {
      const previousUpload = activeUploadRef.current;

      // Can only retry if there was a previous upload and no current upload
      if (!previousUpload || isUploading()) {
        logger.warn("Cannot retry: no previous upload or upload already in progress");
        return null;
      }

      logger.log(`[${previousUpload.uploadId}] Retrying upload`);

      return startUpload(
        previousUpload.videoData,
        previousUpload.mimeType,
        previousUpload.fileName,
        onProgress
      );
    },
    [isUploading, startUpload]
  );

  /**
   * Reset the upload state to initial values
   */
  const resetUpload = useCallback(() => {
    if (activeUploadRef.current) {
      activeUploadRef.current.abortController.abort();
      activeUploadRef.current = null;
    }

    if (isMountedRef.current) {
      setUploadState(initialState);
    }
  }, []);

  /**
   * Check if we can start a new upload (no active upload in progress)
   */
  const canStartUpload = useCallback((): boolean => {
    return !isUploading();
  }, [isUploading]);

  return {
    // State
    uploadState,
    isUploading: isUploading(),
    canStartUpload: canStartUpload(),

    // Actions
    startUpload,
    cancelUpload,
    retryUpload,
    resetUpload,
  };
}
