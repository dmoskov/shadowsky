/**
 * Zod schemas for AT Protocol API response validation
 *
 * Provides runtime validation for all AT Protocol endpoints used in video upload pipeline:
 * - com.atproto.server.getServiceAuth
 * - app.bsky.video.uploadVideo
 * - com.atproto.repo.createRecord
 * - app.bsky.video.getJobStatus
 *
 * These schemas ensure API contracts are maintained and provide better error messages
 * when API responses change unexpectedly.
 */

import { z } from "zod";

/**
 * Schema for com.atproto.server.getServiceAuth response
 * Used to obtain service authentication tokens for video upload
 */
export const serviceAuthResponseSchema = z.object({
  data: z.object({
    token: z.string().min(1, "Service auth token cannot be empty"),
  }),
});

export type ServiceAuthResponse = z.infer<typeof serviceAuthResponseSchema>;

/**
 * Schema for app.bsky.video.uploadVideo response
 * Returns job ID for tracking video processing status
 */
export const uploadVideoResponseSchema = z.object({
  jobId: z.string().min(1, "Job ID cannot be empty"),
});

export type UploadVideoResponse = z.infer<typeof uploadVideoResponseSchema>;

/**
 * Schema for blob reference in video processing results
 */
export const blobRefSchema = z.union([
  z.object({
    $link: z.string(),
  }),
  z.string(),
]);

/**
 * Schema for video blob object
 */
export const videoBlobSchema = z.object({
  ref: blobRefSchema,
  mimeType: z.string(),
  size: z.number().int().positive(),
});

/**
 * Job state enum for video processing
 */
export const jobStateSchema = z.enum([
  "JOB_STATE_CREATED",
  "JOB_STATE_PROCESSING",
  "JOB_STATE_COMPLETED",
  "JOB_STATE_FAILED",
]);

export type JobState = z.infer<typeof jobStateSchema>;

/**
 * Schema for app.bsky.video.getJobStatus response
 * Tracks video transcoding and processing status
 */
export const jobStatusResponseSchema = z.object({
  data: z.object({
    jobStatus: z.object({
      jobId: z.string(),
      state: jobStateSchema,
      progress: z.number().min(0).max(100).optional(),
      blob: videoBlobSchema.optional(),
      error: z.string().optional(),
      message: z.string().optional(),
    }),
  }),
});

export type JobStatusResponse = z.infer<typeof jobStatusResponseSchema>;

/**
 * Schema for com.atproto.repo.createRecord response
 * Used when creating posts with video attachments
 */
export const createRecordResponseSchema = z.object({
  uri: z.string().min(1, "Record URI cannot be empty"),
  cid: z.string().min(1, "Record CID cannot be empty"),
  commit: z
    .object({
      cid: z.string(),
      rev: z.string(),
    })
    .optional(),
  validationStatus: z.string().optional(),
});

export type CreateRecordResponse = z.infer<typeof createRecordResponseSchema>;

/**
 * Schema for rate limit headers (standard HTTP rate limit headers)
 */
export const rateLimitHeadersSchema = z.object({
  "x-ratelimit-limit": z.string().optional(),
  "x-ratelimit-remaining": z.string().optional(),
  "x-ratelimit-reset": z.string().optional(),
  "retry-after": z.string().optional(),
});

export type RateLimitHeaders = z.infer<typeof rateLimitHeadersSchema>;

/**
 * Validate API response with detailed error reporting
 */
export function validateResponse<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  endpoint: string,
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(", ");
      throw new Error(
        `API contract validation failed for ${endpoint}: ${issues}. ` +
          `This may indicate an API change. Raw response: ${JSON.stringify(data)}`,
      );
    }
    throw error;
  }
}

/**
 * Extract and parse rate limit headers from Response object
 */
export function extractRateLimitHeaders(
  response: Response,
): RateLimitHeaders | null {
  try {
    const headers: Record<string, string> = {};

    const headerKeys = [
      "x-ratelimit-limit",
      "x-ratelimit-remaining",
      "x-ratelimit-reset",
      "retry-after",
    ];

    for (const key of headerKeys) {
      const value = response.headers.get(key);
      if (value) {
        headers[key] = value;
      }
    }

    if (Object.keys(headers).length === 0) {
      return null;
    }

    return rateLimitHeadersSchema.parse(headers);
  } catch {
    return null;
  }
}

/**
 * Parse rate limit headers into usable metrics
 */
export interface RateLimitMetrics {
  limit?: number;
  remaining?: number;
  resetTimestamp?: number;
  retryAfterSeconds?: number;
}

export function parseRateLimitHeaders(
  headers: RateLimitHeaders,
): RateLimitMetrics {
  const metrics: RateLimitMetrics = {};

  if (headers["x-ratelimit-limit"]) {
    metrics.limit = parseInt(headers["x-ratelimit-limit"], 10);
  }

  if (headers["x-ratelimit-remaining"]) {
    metrics.remaining = parseInt(headers["x-ratelimit-remaining"], 10);
  }

  if (headers["x-ratelimit-reset"]) {
    const reset = parseInt(headers["x-ratelimit-reset"], 10);
    metrics.resetTimestamp = reset > 1000000000000 ? reset : reset * 1000;
  }

  if (headers["retry-after"]) {
    const retryAfter = parseInt(headers["retry-after"], 10);
    if (!isNaN(retryAfter)) {
      metrics.retryAfterSeconds = retryAfter;
    }
  }

  return metrics;
}
