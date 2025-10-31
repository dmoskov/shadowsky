import { BskyAgent } from "@atproto/api";
import { createLogger } from "./logger";
import { RetryOptions, retryWithBackoff } from "./retry";

const logger = createLogger("BlobUpload");

/**
 * Retry options optimized for blob uploads
 */
const UPLOAD_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 5000,
  backoffFactor: 2,
  retryableErrors: (error: any) => {
    // Retry on network errors
    if (error instanceof TypeError) {
      return true;
    }

    // Retry on rate limits (429)
    if (error?.status === 429 || error?.message?.includes("429")) {
      return true;
    }

    // Retry on server errors (500, 503)
    if (error?.status >= 500) {
      return true;
    }

    // Retry on timeout errors
    if (error?.message?.toLowerCase().includes("timeout")) {
      return true;
    }

    return false;
  },
};

/**
 * Upload a blob with retry logic
 *
 * @param agent - BskyAgent instance
 * @param data - Blob data to upload (File, Blob, or Uint8Array)
 * @param options - Upload options including encoding
 * @returns Upload response with blob reference
 *
 * @example
 * const result = await uploadBlobWithRetry(agent, file, { encoding: 'image/jpeg' });
 */
export async function uploadBlobWithRetry(
  agent: BskyAgent,
  data: Uint8Array | Blob | File,
  options: { encoding: string },
): Promise<{ data: { blob: any } }> {
  return retryWithBackoff(
    async () => {
      logger.log("Uploading blob...", {
        size: data instanceof Uint8Array ? data.byteLength : data.size,
        encoding: options.encoding,
      });

      const result = await agent.uploadBlob(data, options);

      logger.log("Blob uploaded successfully");
      return result;
    },
    {
      ...UPLOAD_RETRY_OPTIONS,
      onRetry: (error, attempt) => {
        logger.log(`Upload failed, retry attempt ${attempt}:`, error);
      },
    },
  );
}
