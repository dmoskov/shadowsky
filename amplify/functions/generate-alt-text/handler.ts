import {
  CloudWatchClient,
  PutMetricDataCommand,
} from "@aws-sdk/client-cloudwatch";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import * as crypto from "crypto";
import {
  createConfigError,
  createExternalApiError,
  createInternalError,
  createInvalidParameterError,
  createMissingParameterError,
  createOptionsResponse,
  createSuccessResponse,
  createTimeoutError,
  getCorrelationId,
  isOptionsRequest,
  logError,
  logInfo,
  logWarning,
  parseEventBody,
} from "../shared/api-response";
import {
  categorizeError,
  logPerformance,
  publishMetrics,
  publishMonitoringMetrics,
} from "../shared/cloudwatch-metrics";

// Track invocations to periodically publish monitoring metrics
let invocationCount = 0;

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const cloudWatchClient = new CloudWatchClient({
  region: process.env.AWS_REGION,
});

const CACHE_TABLE_NAME = process.env.ALT_TEXT_CACHE_TABLE;
const CACHE_TTL_DAYS = 90;

interface RequestBody {
  imageUrl?: string;
}

/**
 * Generate a hash for the image URL to use as cache key
 */
function generateImageHash(imageUrl: string): string {
  return crypto.createHash("sha256").update(imageUrl).digest("hex");
}

/**
 * Send CloudWatch metric for cache hit/miss
 */
async function sendCacheMetric(
  metricName: "CacheHit" | "CacheMiss",
): Promise<void> {
  try {
    await cloudWatchClient.send(
      new PutMetricDataCommand({
        Namespace: "ShadowSky/AltTextGeneration",
        MetricData: [
          {
            MetricName: metricName,
            Value: 1,
            Unit: "Count",
            Timestamp: new Date(),
          },
        ],
      }),
    );
  } catch (error) {
    console.error("Failed to send CloudWatch metric:", error);
  }
}

/**
 * Get cached alt-text from DynamoDB
 */
async function getCachedAltText(
  imageHash: string,
  correlationId: string,
): Promise<string | null> {
  if (!CACHE_TABLE_NAME) {
    logWarning(
      "generate-alt-text",
      "Cache table name not configured, skipping cache lookup",
      correlationId,
    );
    return null;
  }

  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: CACHE_TABLE_NAME,
        Key: { imageHash },
      }),
    );

    if (result.Item && result.Item.altText) {
      await sendCacheMetric("CacheHit");
      return result.Item.altText;
    }

    await sendCacheMetric("CacheMiss");
    return null;
  } catch (error) {
    logError("generate-alt-text", error, correlationId, {
      operation: "cache-read",
    });
    await sendCacheMetric("CacheMiss");
    return null;
  }
}

/**
 * Store alt-text in DynamoDB cache
 */
async function cacheAltText(
  imageHash: string,
  imageUrl: string,
  altText: string,
  correlationId: string,
): Promise<void> {
  if (!CACHE_TABLE_NAME) {
    logWarning(
      "generate-alt-text",
      "Cache table name not configured, skipping cache storage",
      correlationId,
    );
    return;
  }

  try {
    const ttlTimestamp =
      Math.floor(Date.now() / 1000) + CACHE_TTL_DAYS * 24 * 60 * 60;

    await docClient.send(
      new PutCommand({
        TableName: CACHE_TABLE_NAME,
        Item: {
          imageHash,
          imageUrl,
          altText,
          ttl: ttlTimestamp,
          createdAt: new Date().toISOString(),
        },
      }),
    );
  } catch (error) {
    logError("generate-alt-text", error, correlationId, {
      operation: "cache-write",
    });
  }
}

/**
 * Fetch with timeout support
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      const timeoutError: any = new Error(
        `Request timeout after ${timeoutMs}ms`,
      );
      timeoutError.code = "TIMEOUT_ERROR";
      timeoutError.isTimeout = true;
      throw timeoutError;
    }
    throw error;
  }
}

/**
 * Retry a function with exponential backoff
 * Configured for alt-text generation: 8s timeout, 2 retries max, 1s/2s delays
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  initialDelay = 1000,
  correlationId?: string,
): Promise<T> {
  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry on authentication errors (401, 403)
      if (error.status === 401 || error.status === 403) {
        throw error;
      }

      // Don't retry on client errors (400) except rate limits (429)
      if (error.status >= 400 && error.status < 500 && error.status !== 429) {
        throw error;
      }

      // If this is the last attempt, throw the error
      if (attempt === maxAttempts) {
        if (error.isTimeout || error.code === "TIMEOUT_ERROR") {
          if (correlationId) {
            logError("generate-alt-text", error, correlationId, {
              attempt,
              maxAttempts,
              errorCode: "TIMEOUT_ERROR",
            });
          }
        }
        throw error;
      }

      // Log timeout errors on retry attempts
      if (error.isTimeout || error.code === "TIMEOUT_ERROR") {
        if (correlationId) {
          logWarning(
            "generate-alt-text",
            `Attempt ${attempt} timed out, retrying...`,
            correlationId,
            {
              attempt,
              maxAttempts,
            },
          );
        }
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(initialDelay * Math.pow(2, attempt - 1), 10000);

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export const handler = async (event: any) => {
  const correlationId = getCorrelationId(event);

  // Publish monitoring metrics every 10 invocations
  invocationCount++;
  if (invocationCount % 10 === 0) {
    publishMonitoringMetrics().catch((err) =>
      logError("generate-alt-text", err, correlationId, {
        operation: "monitoring-metrics",
      }),
    );
  }

  // Handle OPTIONS request for CORS preflight
  if (isOptionsRequest(event)) {
    return createOptionsResponse(event);
  }

  try {
    const body = parseEventBody<RequestBody>(event);
    const { imageUrl } = body || {};

    if (!imageUrl) {
      return createMissingParameterError("imageUrl", event, correlationId);
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return createConfigError("ANTHROPIC_API_KEY", event, correlationId);
    }

    // Check cache first
    const imageHash = generateImageHash(imageUrl);
    const cachedAltText = await getCachedAltText(imageHash, correlationId);

    if (cachedAltText) {
      logInfo("generate-alt-text", "Cache hit", correlationId, {
        imageHash: imageHash.substring(0, 8),
      });
      return createSuccessResponse(
        { altText: cachedAltText, cached: true },
        event,
        { correlationId },
      );
    }

    logInfo(
      "generate-alt-text",
      "Cache miss, generating alt text",
      correlationId,
      { imageHash: imageHash.substring(0, 8) },
    );

    let base64Image: string;
    let mimeType: string;

    // Handle data URLs (base64 encoded images)
    if (imageUrl.startsWith("data:")) {
      const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        return createInvalidParameterError(
          "imageUrl",
          "Invalid data URL format",
          event,
          correlationId,
        );
      }
      mimeType = matches[1];
      base64Image = matches[2];
    } else {
      // For HTTP URLs, fetch the image
      let absoluteUrl = imageUrl;

      // Convert relative URLs to absolute
      if (imageUrl.startsWith("/bsky-cdn/")) {
        absoluteUrl = imageUrl.replace("/bsky-cdn/", "https://cdn.bsky.app/");
      } else if (imageUrl.startsWith("/bsky-video/")) {
        absoluteUrl = imageUrl.replace(
          "/bsky-video/",
          "https://video.bsky.app/",
        );
      } else if (imageUrl.startsWith("/bsky-video-cdn/")) {
        absoluteUrl = imageUrl.replace(
          "/bsky-video-cdn/",
          "https://video.cdn.bsky.app/",
        );
      }

      // Fetch image with retry and 8s timeout
      const response = await retryWithBackoff(
        async () => {
          const res = await fetchWithTimeout(absoluteUrl, {}, 8000);
          if (!res.ok) {
            const error: any = new Error(
              `Failed to fetch image: ${res.status}`,
            );
            error.status = res.status;
            throw error;
          }
          return res;
        },
        3,
        1000,
        correlationId,
      );

      const arrayBuffer = await response.arrayBuffer();
      base64Image = Buffer.from(arrayBuffer).toString("base64");
      mimeType = response.headers.get("content-type") || "image/jpeg";
    }

    // Track API performance
    const startTime = Date.now();
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;

    try {
      // Call Anthropic API with retry and 8s timeout
      const anthropicResponse = await retryWithBackoff(
        async () => {
          const res = await fetchWithTimeout(
            "https://api.anthropic.com/v1/messages",
            {
              method: "POST",
              headers: {
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
              },
              body: JSON.stringify({
                model: "claude-sonnet-4-5-20250929",
                max_tokens: 300,
                messages: [
                  {
                    role: "user",
                    content: [
                      {
                        type: "image",
                        source: {
                          type: "base64",
                          media_type: mimeType,
                          data: base64Image,
                        },
                      },
                      {
                        type: "text",
                        text: "Generate alt text for this image that would help someone using a screen reader understand what's shown. Keep it concise (most descriptions should be brief), but you can use up to 500 characters when needed for complex images. Focus on the main subject and action.",
                      },
                    ],
                  },
                ],
              }),
            },
            8000,
          );

          if (!res.ok) {
            const error: any = new Error(`Anthropic API error: ${res.status}`);
            error.status = res.status;
            error.response = res;
            throw error;
          }

          return res;
        },
        3,
        1000,
        correlationId,
      );

      const data = await anthropicResponse.json();
      const altText = data.content[0].text;

      // Extract token usage from response
      if (data.usage) {
        inputTokens = data.usage.input_tokens;
        outputTokens = data.usage.output_tokens;
      }

      // Store in cache for future requests
      await cacheAltText(imageHash, imageUrl, altText, correlationId);

      const latencyMs = Date.now() - startTime;

      // Publish metrics and structured logs
      await publishMetrics({
        functionName: "generate-alt-text",
        latencyMs,
        inputTokens,
        outputTokens,
        success: true,
        timeout: false,
      });

      logPerformance({
        functionName: "generate-alt-text",
        latencyMs,
        inputTokens,
        outputTokens,
        success: true,
        timeout: false,
      });

      logInfo(
        "generate-alt-text",
        "Alt text generated successfully",
        correlationId,
        { latencyMs },
      );

      return createSuccessResponse({ altText, cached: false }, event, {
        correlationId,
      });
    } catch (apiError: any) {
      const latencyMs = Date.now() - startTime;
      const timeout = apiError.isTimeout || apiError.code === "TIMEOUT_ERROR";
      const errorType = categorizeError(apiError);

      // Publish error metrics
      await publishMetrics({
        functionName: "generate-alt-text",
        latencyMs,
        success: false,
        errorType,
        timeout,
      });

      logPerformance({
        functionName: "generate-alt-text",
        latencyMs,
        success: false,
        errorType,
        timeout,
      });

      if (timeout) {
        logError("generate-alt-text", apiError, correlationId, {
          errorType: "timeout",
          latencyMs,
        });
        return createTimeoutError("Anthropic API call", event, correlationId);
      }

      logError("generate-alt-text", apiError, correlationId, {
        errorType,
        latencyMs,
      });
      return createExternalApiError(
        "Anthropic",
        apiError.message,
        event,
        correlationId,
      );
    }
  } catch (error) {
    logError("generate-alt-text", error, correlationId);
    return createInternalError(error, event, correlationId);
  }
};
