import { BskyAgent } from "@atproto/api";
import { createLogger } from "../../utils/logger";
import {
  API_RETRY_OPTIONS,
  fetchWithRetry,
  retryWithBackoff,
  type RetryOptions,
} from "../../utils/retry";
import { getVideoUploadMetricsTracker } from "../../utils/video-upload-metrics";
import {
  createVideoProcessingError,
  createVideoTimeoutError,
  logError,
  mapATProtoError,
  type StandardErrorResponse,
} from "./error-handler";
import {
  ATProtoEndpointType,
  getGlobalRateLimiter,
} from "./rate-limiter";
import {
  extractRateLimitHeaders,
  parseRateLimitHeaders,
  validateResponse,
  jobStatusResponseSchema,
  serviceAuthResponseSchema,
  uploadVideoResponseSchema,
} from "./schemas";

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
  private rateLimiter = getGlobalRateLimiter();

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
      // Get service auth token with rate limiting and validation
      logger.log(`[${uploadId}] Getting service auth token for video upload`);

      // Check rate limit before making request
      const rateLimitAllowed = await this.rateLimiter.waitForAllowance(
        ATProtoEndpointType.AUTH,
        1,
        5000,
      );

      if (!rateLimitAllowed) {
        const error = mapATProtoError(
          new Error("Rate limit exceeded for auth endpoint"),
          "com.atproto.server.getServiceAuth",
          { uploadId },
        );
        logError(error, "getServiceAuth");
        metricsTracker.failUpload(uploadId, new Error(error.message));
        throw new Error(error.message);
      }

      const serviceAuth = await retryWithBackoff(
        async () => {
          try {
            const response = await this.agent.com.atproto.server.getServiceAuth({
              aud: "did:web:video.bsky.app",
            });

            // Validate response schema
            const validatedResponse = validateResponse(
              serviceAuthResponseSchema,
              response,
              "com.atproto.server.getServiceAuth",
            );

            return validatedResponse;
          } catch (error: any) {
            // Map to standardized error format
            const standardError = mapATProtoError(
              error,
              "com.atproto.server.getServiceAuth",
              { uploadId },
            );
            logError(standardError, "getServiceAuth");

            // Re-throw with enhanced context
            const enhancedError: any = new Error(standardError.message);
            enhancedError.status = standardError.context.status;
            enhancedError.code = standardError.code;
            enhancedError.retryable = standardError.retryable;
            throw enhancedError;
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

      // Upload video with rate limiting and retry tracking
      const uploadUrl =
        "https://video.bsky.app/xrpc/app.bsky.video.uploadVideo";

      logger.log(
        `[${uploadId}] Starting video upload: ${(videoData.length / (1024 * 1024)).toFixed(2)} MB`,
      );

      // Check rate limit for upload endpoint
      const uploadRateLimitAllowed = await this.rateLimiter.waitForAllowance(
        ATProtoEndpointType.UPLOAD,
        1,
        10000,
      );

      if (!uploadRateLimitAllowed) {
        const error = mapATProtoError(
          new Error("Rate limit exceeded for upload endpoint"),
          "app.bsky.video.uploadVideo",
          { uploadId },
        );
        logError(error, "uploadVideo");
        metricsTracker.failUpload(uploadId, new Error(error.message));
        throw new Error(error.message);
      }

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

      // Extract and track rate limit headers
      const rateLimitHeaders = extractRateLimitHeaders(uploadResponse);
      if (rateLimitHeaders) {
        const metrics = parseRateLimitHeaders(rateLimitHeaders);
        this.rateLimiter.trackRateLimitHeaders(ATProtoEndpointType.UPLOAD, metrics);

        // Track in CloudWatch metrics
        metricsTracker.trackRateLimitMetrics(uploadId, {
          ...metrics,
          endpoint: "app.bsky.video.uploadVideo",
        });

        logger.log(`[${uploadId}] Rate limit metrics:`, metrics);
      }

      // Parse and validate response
      const uploadResult = await uploadResponse.json();

      let validatedUploadResult;
      try {
        validatedUploadResult = validateResponse(
          uploadVideoResponseSchema,
          uploadResult,
          "app.bsky.video.uploadVideo",
        );
      } catch (validationError: any) {
        const error = mapATProtoError(
          validationError,
          "app.bsky.video.uploadVideo",
          { uploadId, rawResponse: uploadResult },
        );
        logError(error, "uploadVideo");
        metricsTracker.failUpload(uploadId, new Error(error.message));
        throw new Error(error.message);
      }

      const jobId = validatedUploadResult.jobId;
      logger.log(`[${uploadId}] Video upload successful, job ID: ${jobId}`);

      // Track transcoding start
      metricsTracker.startTranscoding(uploadId);

      // Poll for job status with retry logic and validation
      let jobStatus;
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds timeout
      logger.log(
        `[${uploadId}] Starting job status polling for job ${jobId}`,
      );

      while (attempts < maxAttempts) {
        try {
          // Check rate limit before polling
          const pollRateLimitAllowed = this.rateLimiter.canProceed(
            ATProtoEndpointType.FEED,
            1,
          );

          if (!pollRateLimitAllowed) {
            logger.warn(
              `[${uploadId}] Rate limit reached for polling, waiting before retry`,
            );
            await new Promise((resolve) => setTimeout(resolve, 2000));
            attempts++;
            continue;
          }

          // Use retryWithBackoff for each status check to handle transient failures
          const statusResponse = await retryWithBackoff(
            async () => {
              try {
                const response = await this.agent.app.bsky.video.getJobStatus({
                  jobId,
                });

                // Validate response schema
                const validatedResponse = validateResponse(
                  jobStatusResponseSchema,
                  response,
                  "app.bsky.video.getJobStatus",
                );

                return validatedResponse;
              } catch (error: any) {
                // Map to standardized error format
                const standardError = mapATProtoError(
                  error,
                  "app.bsky.video.getJobStatus",
                  { uploadId, jobId, pollingAttempt: attempts + 1 },
                );

                // Re-throw with enhanced context
                const enhancedError: any = new Error(standardError.message);
                enhancedError.status = standardError.context.status;
                enhancedError.code = standardError.code;
                enhancedError.retryable = standardError.retryable;
                enhancedError.jobId = jobId;
                throw enhancedError;
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

            // Normalize blob ref to expected format
            const normalizedBlob = {
              ref: typeof jobStatus.blob.ref === "string"
                ? { $link: jobStatus.blob.ref }
                : jobStatus.blob.ref,
              mimeType: jobStatus.blob.mimeType,
              size: jobStatus.blob.size,
            };

            return {
              blob: normalizedBlob,
              uploadId,
            };
          } else if (jobStatus.state === "JOB_STATE_FAILED") {
            const standardError = createVideoProcessingError(
              uploadId,
              jobId,
              jobStatus.error || jobStatus.message,
            );
            logError(standardError, "videoProcessing");
            metricsTracker.failUpload(uploadId, new Error(standardError.message));
            throw new Error(standardError.message);
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

      const timeoutError = createVideoTimeoutError(uploadId, jobId, maxAttempts);
      logError(timeoutError, "videoProcessingTimeout");
      metricsTracker.failUpload(uploadId, new Error(timeoutError.message));
      throw new Error(timeoutError.message);
    } catch (error: any) {
      // Map error to standardized format if not already mapped
      let standardError: StandardErrorResponse;

      if (error.code && error.message && error.context) {
        // Already a standardized error
        standardError = error as StandardErrorResponse;
      } else {
        // Map to standardized format
        standardError = mapATProtoError(error, "videoUpload", { uploadId });
      }

      // Log structured error
      logError(standardError, "videoUpload");

      // Track failure in metrics (only if not already tracked)
      try {
        const activeUpload = metricsTracker.getActiveUpload(uploadId);
        if (activeUpload) {
          metricsTracker.failUpload(
            uploadId,
            error instanceof Error ? error : new Error(standardError.message),
          );
        }
      } catch (metricsError) {
        logger.error(
          `[${uploadId}] Failed to track upload failure:`,
          metricsError,
        );
      }

      throw error;
    }
  }

}
