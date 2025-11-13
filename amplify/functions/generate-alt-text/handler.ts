import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import * as crypto from 'crypto';
import { publishMetrics, logPerformance, categorizeError, publishMonitoringMetrics } from '../shared/cloudwatch-metrics';

// Track invocations to periodically publish monitoring metrics
let invocationCount = 0;

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const cloudWatchClient = new CloudWatchClient({ region: process.env.AWS_REGION });

const CACHE_TABLE_NAME = process.env.ALT_TEXT_CACHE_TABLE;
const CACHE_TTL_DAYS = 90;

/**
 * Generate a hash for the image URL to use as cache key
 */
function generateImageHash(imageUrl: string): string {
  return crypto.createHash('sha256').update(imageUrl).digest('hex');
}

/**
 * Send CloudWatch metric for cache hit/miss
 */
async function sendCacheMetric(metricName: 'CacheHit' | 'CacheMiss'): Promise<void> {
  try {
    await cloudWatchClient.send(
      new PutMetricDataCommand({
        Namespace: 'ShadowSky/AltTextGeneration',
        MetricData: [
          {
            MetricName: metricName,
            Value: 1,
            Unit: 'Count',
            Timestamp: new Date(),
          },
        ],
      })
    );
  } catch (error) {
    console.error('Failed to send CloudWatch metric:', error);
  }
}

/**
 * Get cached alt-text from DynamoDB
 */
async function getCachedAltText(imageHash: string): Promise<string | null> {
  if (!CACHE_TABLE_NAME) {
    console.warn('Cache table name not configured, skipping cache lookup');
    return null;
  }

  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: CACHE_TABLE_NAME,
        Key: { imageHash },
      })
    );

    if (result.Item && result.Item.altText) {
      await sendCacheMetric('CacheHit');
      return result.Item.altText;
    }

    await sendCacheMetric('CacheMiss');
    return null;
  } catch (error) {
    console.error('Error reading from cache:', error);
    await sendCacheMetric('CacheMiss');
    return null;
  }
}

/**
 * Store alt-text in DynamoDB cache
 */
async function cacheAltText(imageHash: string, imageUrl: string, altText: string): Promise<void> {
  if (!CACHE_TABLE_NAME) {
    console.warn('Cache table name not configured, skipping cache storage');
    return;
  }

  try {
    const ttlTimestamp = Math.floor(Date.now() / 1000) + CACHE_TTL_DAYS * 24 * 60 * 60;

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
      })
    );
  } catch (error) {
    console.error('Error writing to cache:', error);
  }
}

/**
 * Fetch with timeout support
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
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
        `Request timeout after ${timeoutMs}ms`
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
  initialDelay = 1000
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
        // Log timeout errors with distinct error code
        if (error.isTimeout || error.code === "TIMEOUT_ERROR") {
          console.error(
            `[TIMEOUT_ERROR] Alt-text generation failed after ${maxAttempts} attempts - final timeout error`,
            {
              attempt,
              maxAttempts,
              errorCode: "TIMEOUT_ERROR",
              message: error.message,
            }
          );
        }
        throw error;
      }

      // Log timeout errors on retry attempts
      if (error.isTimeout || error.code === "TIMEOUT_ERROR") {
        console.warn(
          `[TIMEOUT_ERROR] Attempt ${attempt} timed out, retrying...`,
          {
            attempt,
            maxAttempts,
            errorCode: "TIMEOUT_ERROR",
          }
        );
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(initialDelay * Math.pow(2, attempt - 1), 10000);
      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export const handler = async (event: any) => {
  // Publish monitoring metrics every 10 invocations
  invocationCount++;
  if (invocationCount % 10 === 0) {
    publishMonitoringMetrics().catch(err =>
      console.error('Failed to publish monitoring metrics:', err)
    );
  }

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Content-Type": "application/json",
  };

  // Handle OPTIONS request for CORS
  const method = event.requestContext?.http?.method || event.httpMethod;
  if (method === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { imageUrl } = body;

    if (!imageUrl) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing imageUrl" }),
      };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Server API key not configured" }),
      };
    }

    // Check cache first
    const imageHash = generateImageHash(imageUrl);
    const cachedAltText = await getCachedAltText(imageHash);

    if (cachedAltText) {
      console.log('Cache hit for image:', imageHash);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ altText: cachedAltText, cached: true }),
      };
    }

    console.log('Cache miss for image:', imageHash);

    let base64Image: string;
    let mimeType: string;

    // Handle data URLs (base64 encoded images)
    if (imageUrl.startsWith("data:")) {
      const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Invalid data URL format" }),
        };
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
          "https://video.bsky.app/"
        );
      } else if (imageUrl.startsWith("/bsky-video-cdn/")) {
        absoluteUrl = imageUrl.replace(
          "/bsky-video-cdn/",
          "https://video.cdn.bsky.app/"
        );
      }

      // Fetch image with retry and 8s timeout
      // maxAttempts=3 (1 initial + 2 retries), delays: 1s, 2s
      const response = await retryWithBackoff(async () => {
        const res = await fetchWithTimeout(absoluteUrl, {}, 8000);
        if (!res.ok) {
          const error: any = new Error(`Failed to fetch image: ${res.status}`);
          error.status = res.status;
          throw error;
        }
        return res;
      }, 3, 1000);

      const arrayBuffer = await response.arrayBuffer();
      base64Image = Buffer.from(arrayBuffer).toString("base64");
      mimeType = response.headers.get("content-type") || "image/jpeg";
    }

    // Track API performance
    const startTime = Date.now();
    let success = false;
    let errorType: string | undefined;
    let timeout = false;
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;

    try {
      // Call Anthropic API with retry and 8s timeout
      // maxAttempts=3 (1 initial + 2 retries), delays: 1s, 2s
      const anthropicResponse = await retryWithBackoff(async () => {
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
          8000
        );

        if (!res.ok) {
          const error: any = new Error(`Anthropic API error: ${res.status}`);
          error.status = res.status;
          error.response = res;
          throw error;
        }

        return res;
      }, 3, 1000);

      const data = await anthropicResponse.json();
      const altText = data.content[0].text;

      // Extract token usage from response
      if (data.usage) {
        inputTokens = data.usage.input_tokens;
        outputTokens = data.usage.output_tokens;
      }

      // Store in cache for future requests
      await cacheAltText(imageHash, imageUrl, altText);

      success = true;
      const latencyMs = Date.now() - startTime;

      // Publish metrics and structured logs
      await publishMetrics({
        functionName: 'generate-alt-text',
        latencyMs,
        inputTokens,
        outputTokens,
        success: true,
        timeout: false,
      });

      logPerformance({
        functionName: 'generate-alt-text',
        latencyMs,
        inputTokens,
        outputTokens,
        success: true,
        timeout: false,
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ altText, cached: false }),
      };
    } catch (apiError: any) {
      const latencyMs = Date.now() - startTime;
      timeout = apiError.isTimeout || apiError.code === 'TIMEOUT_ERROR';
      errorType = categorizeError(apiError);

      // Publish error metrics
      await publishMetrics({
        functionName: 'generate-alt-text',
        latencyMs,
        success: false,
        errorType,
        timeout,
      });

      logPerformance({
        functionName: 'generate-alt-text',
        latencyMs,
        success: false,
        errorType,
        timeout,
      });

      throw apiError;
    }
  } catch (error) {
    console.error("Error generating alt text:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
    };
  }
};
