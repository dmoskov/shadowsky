import { BskyAgent } from "@atproto/api";
import { createLogger } from "../../utils/logger";
import {
  API_RETRY_OPTIONS,
  fetchWithRetry,
  retryWithBackoff,
  type RetryOptions,
} from "../../utils/retry";
import { getVideoUploadMetricsTracker } from "../../utils/video-upload-metrics";

export interface VideoUploadResult {
  blob: {
    ref: { $link: string };
    mimeType: string;
    size: number;
  };
  aspectRatio?: {
    width: number;
    height: number;
  };
  uploadId: string;
}

const logger = createLogger("VideoUploadService");
const metricsTracker = getVideoUploadMetricsTracker();

/**
 * Retry options optimized for video upload operations
 * - Service auth: 3 attempts, fast retries for token generation
 * - Status polling: 3 attempts, shorter delays to avoid blocking user
 * - Upload: Uses API_RETRY_OPTIONS for longer timeouts
 */
const VIDEO_SERVICE_AUTH_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 500,
  maxDelayMs: 2000,
  backoffFactor: 2,
  retryableErrors: (error: any) => {
    // Don't retry on authentication errors (401)
    if (error?.status === 401 || error?.message?.includes("401")) {
      return false;
    }

    // Don't retry on client errors (400, 403)
    if (
      error?.status === 400 ||
      error?.status === 403 ||
      error?.message?.includes("400") ||
      error?.message?.includes("403")
    ) {
      return false;
    }

    // Retry on network errors
    if (error instanceof TypeError) {
      return true;
    }

    // Retry on server errors (500, 503)
    if (error?.status >= 500 || error?.message?.includes("500") || error?.message?.includes("503")) {
      return true;
    }

    // Retry on rate limits (429)
    if (error?.status === 429 || error?.message?.includes("429")) {
      return true;
    }

    // Retry on timeout errors
    if (error?.message?.toLowerCase().includes("timeout")) {
      return true;
    }

    return false;
  },
};

const VIDEO_STATUS_POLLING_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 3000,
  backoffFactor: 2,
  retryableErrors: (error: any) => {
    // Retry on network errors
    if (error instanceof TypeError) {
      return true;
    }

    // Retry on server errors (500, 503)
    if (error?.status >= 500) {
      return true;
    }

    // Retry on rate limits (429)
    if (error?.status === 429 || error?.message?.includes("429")) {
      return true;
    }

    // Don't retry on other HTTP errors (job might be in failed state)
    return false;
  },
};

export class VideoUploadService {
  private agent: BskyAgent;

  constructor(agent: BskyAgent) {
    this.agent = agent;
  }

  async uploadVideo(
    videoData: Uint8Array,
    mimeType: string,
    onProgress?: (progress: number) => void,
    onUploadIdCreated?: (uploadId: string) => void,
  ): Promise<VideoUploadResult> {
    const uploadId = metricsTracker.startUpload(mimeType, videoData.length);

    if (onUploadIdCreated) {
      onUploadIdCreated(uploadId);
    }

    try {
      // Get service auth token with retry logic
      logger.log(`[${uploadId}] Getting service auth token for video upload`);
      const serviceAuth = await retryWithBackoff(
        async () => {
          try {
            return await this.agent.com.atproto.server.getServiceAuth({
              aud: "did:web:video.bsky.app",
            });
          } catch (error: any) {
            // Enhance error with status code if available
            if (error?.status) {
              const enhancedError: any = new Error(
                `Service auth failed: ${error.status} - ${error.message || "Unknown error"}`,
              );
              enhancedError.status = error.status;
              enhancedError.originalError = error;
              logger.error(
                `[${uploadId}] Service auth error (status ${error.status}):`,
                error,
              );
              throw enhancedError;
            }
            logger.error(`[${uploadId}] Service auth error:`, error);
            throw error;
          }
        },
        {
          ...VIDEO_SERVICE_AUTH_RETRY_OPTIONS,
          onRetry: (error, attempt) => {
            metricsTracker.trackRetry(uploadId);
            logger.warn(
              `[${uploadId}] Service auth retry attempt ${attempt}:`,
              error,
            );
          },
        },
      );
      logger.log(`[${uploadId}] Service auth token obtained successfully`);

      // Upload video with retry tracking
      const uploadUrl =
        "https://video.bsky.app/xrpc/app.bsky.video.uploadVideo";

      logger.log(
        `[${uploadId}] Starting video upload: ${(videoData.length / (1024 * 1024)).toFixed(2)} MB`,
      );

      const uploadResponse = await fetchWithRetry(
        uploadUrl,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceAuth.data.token}`,
            "Content-Type": mimeType,
            "Content-Length": videoData.length.toString(),
          },
          body: videoData as any,
        },
        {
          ...API_RETRY_OPTIONS,
          onRetry: (error, attempt) => {
            metricsTracker.trackRetry(uploadId);
            logger.warn(
              `[${uploadId}] Video upload retry attempt ${attempt}:`,
              error,
            );
          },
        },
      );

      const uploadResult = await uploadResponse.json();
      const jobId = uploadResult.jobId;

      if (!jobId) {
        const error = new Error("No job ID returned from video upload");
        logger.error(`[${uploadId}] Upload response missing jobId:`, uploadResult);
        metricsTracker.failUpload(uploadId, error);
        throw error;
      }

      logger.log(`[${uploadId}] Video upload successful, job ID: ${jobId}`);

      // Track transcoding start
      metricsTracker.startTranscoding(uploadId);

      // Poll for job status with retry logic
      let jobStatus;
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds timeout
      logger.log(
        `[${uploadId}] Starting job status polling for job ${jobId}`,
      );

      while (attempts < maxAttempts) {
        try {
          // Use retryWithBackoff for each status check to handle transient failures
          const statusResponse = await retryWithBackoff(
            async () => {
              try {
                return await this.agent.app.bsky.video.getJobStatus({
                  jobId,
                });
              } catch (error: any) {
                // Enhance error with job context
                if (error?.status) {
                  const enhancedError: any = new Error(
                    `Job status check failed: ${error.status} - ${error.message || "Unknown error"}`,
                  );
                  enhancedError.status = error.status;
                  enhancedError.jobId = jobId;
                  enhancedError.originalError = error;
                  throw enhancedError;
                }
                throw error;
              }
            },
            {
              ...VIDEO_STATUS_POLLING_RETRY_OPTIONS,
              onRetry: (error, retryAttempt) => {
                metricsTracker.trackRetry(uploadId);
                logger.warn(
                  `[${uploadId}] Job status polling retry attempt ${retryAttempt} (poll ${attempts + 1}/${maxAttempts}):`,
                  error,
                );
              },
            },
          );

          jobStatus = statusResponse.data.jobStatus;

          if (jobStatus.state === "JOB_STATE_COMPLETED" && jobStatus.blob) {
            // Track transcoding completion
            metricsTracker.completeTranscoding(uploadId, attempts + 1);

            // Complete upload successfully
            const blobRef =
              typeof jobStatus.blob.ref === "string"
                ? jobStatus.blob.ref
                : jobStatus.blob.ref.$link;
            metricsTracker.completeUpload(uploadId, blobRef);

            logger.log(
              `[${uploadId}] Video processing completed successfully after ${attempts + 1} polling attempts`,
            );

            return {
              blob: jobStatus.blob,
              uploadId,
            };
          } else if (jobStatus.state === "JOB_STATE_FAILED") {
            const error = new Error(
              `Video processing failed: ${jobStatus.error || "Unknown error"}`,
            );
            logger.error(
              `[${uploadId}] Video processing failed at server:`,
              jobStatus,
            );
            metricsTracker.failUpload(uploadId, error);
            throw error;
          }

          // Update progress if callback provided
          if (onProgress && jobStatus.progress) {
            onProgress(jobStatus.progress);
          }

          // Log progress periodically (every 10 attempts)
          if ((attempts + 1) % 10 === 0) {
            logger.log(
              `[${uploadId}] Job status polling: ${attempts + 1}/${maxAttempts} attempts, state: ${jobStatus.state}, progress: ${jobStatus.progress || 0}`,
            );
          }

          // Wait 1 second before next poll
          await new Promise((resolve) => setTimeout(resolve, 1000));
          attempts++;
        } catch (error: any) {
          // If polling fails after all retries, log and re-throw
          logger.error(
            `[${uploadId}] Job status polling failed after retries (attempt ${attempts + 1}/${maxAttempts}):`,
            error,
          );

          // If this was a non-retryable error or we're out of polling attempts, fail immediately
          if (
            !VIDEO_STATUS_POLLING_RETRY_OPTIONS.retryableErrors?.(error) ||
            attempts >= maxAttempts - 1
          ) {
            metricsTracker.failUpload(
              uploadId,
              error instanceof Error ? error : new Error(String(error)),
            );
            throw error;
          }

          // Otherwise, continue polling (the error might be transient)
          attempts++;
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      const timeoutError = new Error(
        `Video processing timeout after ${maxAttempts} polling attempts`,
      );
      logger.error(`[${uploadId}] Video processing timeout`, {
        attempts: maxAttempts,
        lastJobStatus: jobStatus,
      });
      metricsTracker.failUpload(uploadId, timeoutError);
      throw timeoutError;
    } catch (error: any) {
      // Classify error type for structured logging
      const errorType = this.classifyError(error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Log structured error with classification
      logger.error(`[${uploadId}] Video upload failed`, {
        errorType,
        errorMessage,
        status: error?.status,
        jobId: error?.jobId,
        stack: error?.stack,
      });

      // Track failure in metrics (only if not already tracked)
      // Check if error already tracked by looking at active uploads
      try {
        metricsTracker.failUpload(
          uploadId,
          error instanceof Error ? error : new Error(String(error)),
        );
      } catch (metricsError) {
        // Metrics tracking failed, but don't let it break the error flow
        logger.error(
          `[${uploadId}] Failed to track upload failure:`,
          metricsError,
        );
      }

      throw error;
    }
  }

  /**
   * Classify error types for structured logging and metrics
   */
  private classifyError(error: any): string {
    if (!error) {
      return "UNKNOWN_ERROR";
    }

    // Check error message patterns
    const message = error.message?.toLowerCase() || "";
    const status = error.status;

    // Timeout errors
    if (message.includes("timeout")) {
      return "TIMEOUT_ERROR";
    }

    // Network errors
    if (error instanceof TypeError && message.includes("fetch")) {
      return "NETWORK_ERROR";
    }

    // Rate limit errors
    if (status === 429 || message.includes("429") || message.includes("rate limit")) {
      return "RATE_LIMIT_ERROR";
    }

    // Authentication errors
    if (status === 401 || message.includes("401") || message.includes("unauthorized")) {
      return "AUTH_ERROR";
    }

    // Authorization errors
    if (status === 403 || message.includes("403") || message.includes("forbidden")) {
      return "FORBIDDEN_ERROR";
    }

    // Server errors
    if (status >= 500 || message.includes("500") || message.includes("503") || message.includes("server error")) {
      return "SERVER_ERROR";
    }

    // Client errors
    if (status >= 400 && status < 500) {
      return "CLIENT_ERROR";
    }

    // Processing errors
    if (message.includes("processing failed") || message.includes("job") || message.includes("transcoding")) {
      return "PROCESSING_ERROR";
    }

    // Service auth specific errors
    if (message.includes("service auth")) {
      return "SERVICE_AUTH_ERROR";
    }

    return "UNKNOWN_ERROR";
  }
}
