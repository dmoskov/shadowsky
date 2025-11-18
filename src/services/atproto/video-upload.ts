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
import { ATProtoEndpointType, getGlobalRateLimiter } from "./rate-limiter";
import {
  extractRateLimitHeaders,
  jobStatusResponseSchema,
  parseRateLimitHeaders,
  serviceAuthResponseSchema,
  uploadVideoResponseSchema,
  validateResponse,
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
 * Secure in-memory token storage with automatic expiration
 * Tokens are never persisted to localStorage or cookies
 */
interface TokenEntry {
  token: string;
  expiresAt: number;
  uploadId: string;
}

class TokenManager {
  private tokens = new Map<string, TokenEntry>();
  private cleanupIntervalId: NodeJS.Timeout | null = null;
  private readonly CLEANUP_INTERVAL_MS = 60000; // Clean up every 60 seconds
  private readonly TOKEN_BUFFER_MS = 5000; // Consider token expired 5 seconds early to account for network delays

  constructor() {
    this.startCleanupInterval();
  }

  /**
   * Store a service auth token with expiration tracking
   * Decodes JWT to extract expiration time
   */
  storeToken(token: string, uploadId: string): void {
    try {
      const expiresAt = this.decodeTokenExpiration(token);
      this.tokens.set(uploadId, { token, expiresAt, uploadId });
      logger.log(
        `[${uploadId}] Service auth token stored (expires at ${new Date(expiresAt).toISOString()})`,
      );
    } catch (error) {
      logger.warn(
        `[${uploadId}] Failed to decode token expiration, using default TTL:`,
        error,
      );
      // Default to 60 seconds if we can't decode the JWT
      const expiresAt = Date.now() + 60000;
      this.tokens.set(uploadId, { token, expiresAt, uploadId });
    }
  }

  /**
   * Retrieve a token if it exists and is not expired
   */
  getToken(uploadId: string): string | null {
    const entry = this.tokens.get(uploadId);
    if (!entry) {
      return null;
    }

    // Check if token is expired (with buffer)
    if (Date.now() >= entry.expiresAt - this.TOKEN_BUFFER_MS) {
      logger.log(`[${uploadId}] Service auth token expired, clearing`);
      this.clearToken(uploadId);
      return null;
    }

    return entry.token;
  }

  /**
   * Clear a specific token from memory
   */
  clearToken(uploadId: string): void {
    const wasDeleted = this.tokens.delete(uploadId);
    if (wasDeleted) {
      logger.log(`[${uploadId}] Service auth token cleared from memory`);
    }
  }

  /**
   * Clear all tokens (used for cleanup)
   */
  clearAllTokens(): void {
    const count = this.tokens.size;
    this.tokens.clear();
    if (count > 0) {
      logger.log(`Cleared ${count} service auth tokens from memory`);
    }
  }

  /**
   * Decode JWT to extract expiration time
   * Note: This does NOT verify the signature, only extracts the exp claim
   */
  private decodeTokenExpiration(token: string): number {
    try {
      // JWT format: header.payload.signature
      const parts = token.split(".");
      if (parts.length !== 3) {
        throw new Error("Invalid JWT format");
      }

      // Decode base64url payload
      const payload = parts[1];
      const decodedPayload = this.base64UrlDecode(payload);
      const claims = JSON.parse(decodedPayload);

      // Extract exp claim (Unix timestamp in seconds)
      if (typeof claims.exp !== "number") {
        throw new Error("JWT missing exp claim");
      }

      // Convert to milliseconds
      return claims.exp * 1000;
    } catch (error) {
      throw new Error(
        `Failed to decode JWT expiration: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Decode base64url string (JWT uses base64url encoding, not standard base64)
   */
  private base64UrlDecode(str: string): string {
    // Convert base64url to base64
    let base64 = str.replace(/-/g, "+").replace(/_/g, "/");

    // Add padding if necessary
    while (base64.length % 4 !== 0) {
      base64 += "=";
    }

    // Decode base64
    try {
      return atob(base64);
    } catch (error) {
      throw new Error("Invalid base64url encoding");
    }
  }

  /**
   * Periodically clean up expired tokens
   */
  private startCleanupInterval(): void {
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupExpiredTokens();
    }, this.CLEANUP_INTERVAL_MS);
  }

  /**
   * Remove expired tokens from memory
   */
  private cleanupExpiredTokens(): void {
    const now = Date.now();
    const expiredUploadIds: string[] = [];

    for (const [uploadId, entry] of this.tokens.entries()) {
      if (now >= entry.expiresAt) {
        expiredUploadIds.push(uploadId);
      }
    }

    for (const uploadId of expiredUploadIds) {
      this.tokens.delete(uploadId);
      logger.log(
        `[${uploadId}] Expired service auth token automatically cleared`,
      );
    }
  }

  /**
   * Stop the cleanup interval (for testing or cleanup)
   */
  stopCleanupInterval(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
  }
}

// Global token manager instance (module-level singleton)
const tokenManager = new TokenManager();

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
    if (
      error?.status >= 500 ||
      error?.message?.includes("500") ||
      error?.message?.includes("503")
    ) {
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

  /**
   * Get a valid service auth token, refreshing if expired or near expiration
   * @param uploadId Upload tracking ID
   * @param forceRefresh Force token refresh even if cached token exists
   * @returns Valid auth token
   */
  private async getServiceAuthToken(
    uploadId: string,
    forceRefresh: boolean = false,
  ): Promise<string> {
    // Check if we have a valid cached token (unless force refresh requested)
    let authToken = forceRefresh ? null : tokenManager.getToken(uploadId);

    if (!authToken) {
      logger.log(
        `[${uploadId}] ${forceRefresh ? "Refreshing" : "Obtaining"} service auth token`,
      );

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
        throw new Error(error.message);
      }

      const serviceAuth = await retryWithBackoff(
        async () => {
          try {
            const response = await this.agent.com.atproto.server.getServiceAuth(
              {
                aud: "did:web:video.bsky.app",
              },
            );

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

      authToken = serviceAuth.data.token;

      // Store token in secure memory with automatic expiration
      tokenManager.storeToken(authToken, uploadId);
      logger.log(
        `[${uploadId}] Service auth token obtained and stored successfully`,
      );
    } else {
      logger.log(`[${uploadId}] Using cached service auth token`);
    }

    return authToken;
  }

  async uploadVideo(
    videoData: Uint8Array,
    mimeType: string,
    onProgress?: (progress: number) => void,
    onUploadIdCreated?: (uploadId: string) => void,
  ): Promise<VideoUploadResult> {
    const uploadId = metricsTracker.startUpload(mimeType, videoData.length);
    const uploadStartTime = Date.now();

    if (onUploadIdCreated) {
      onUploadIdCreated(uploadId);
    }

    try {
      // Get or refresh service auth token with rate limiting and validation
      logger.log(`[${uploadId}] Getting service auth token for video upload`);
      let authToken = await this.getServiceAuthToken(uploadId);

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
            Authorization: `Bearer ${authToken}`,
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
        this.rateLimiter.trackRateLimitHeaders(
          ATProtoEndpointType.UPLOAD,
          metrics,
        );

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
      const TOKEN_ROTATION_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
      logger.log(`[${uploadId}] Starting job status polling for job ${jobId}`);

      while (attempts < maxAttempts) {
        try {
          // Check if token needs rotation for long-running uploads
          const uploadDuration = Date.now() - uploadStartTime;
          if (
            uploadDuration > TOKEN_ROTATION_INTERVAL_MS &&
            uploadDuration % TOKEN_ROTATION_INTERVAL_MS < 1000
          ) {
            // Upload has been running for more than 10 minutes, rotate token
            logger.log(
              `[${uploadId}] Upload running for ${Math.floor(uploadDuration / 60000)} minutes, rotating service auth token`,
            );
            try {
              authToken = await this.getServiceAuthToken(uploadId, true);
              logger.log(
                `[${uploadId}] Service auth token rotated successfully for long-running upload`,
              );
            } catch (rotationError) {
              logger.warn(
                `[${uploadId}] Failed to rotate token, continuing with existing token:`,
                rotationError,
              );
              // Continue with existing token - rotation is best-effort
            }
          }

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

            // Clear service auth token after successful upload
            tokenManager.clearToken(uploadId);

            // Normalize blob ref to expected format
            const normalizedBlob = {
              ref:
                typeof jobStatus.blob.ref === "string"
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
            metricsTracker.failUpload(
              uploadId,
              new Error(standardError.message),
            );

            // Clear service auth token on processing failure
            tokenManager.clearToken(uploadId);

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

      const timeoutError = createVideoTimeoutError(
        uploadId,
        jobId,
        maxAttempts,
      );
      logError(timeoutError, "videoProcessingTimeout");
      metricsTracker.failUpload(uploadId, new Error(timeoutError.message));

      // Clear service auth token on timeout
      tokenManager.clearToken(uploadId);

      throw new Error(timeoutError.message);
    } catch (error: any) {
      // Clear service auth token on any error to prevent token leakage
      tokenManager.clearToken(uploadId);

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
