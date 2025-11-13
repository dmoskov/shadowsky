import { BskyAgent } from "@atproto/api";
import { createLogger } from "../../utils/logger";
import { API_RETRY_OPTIONS, fetchWithRetry } from "../../utils/retry";
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
}

const logger = createLogger("VideoUploadService");
const metricsTracker = getVideoUploadMetricsTracker();

export class VideoUploadService {
  private agent: BskyAgent;

  constructor(agent: BskyAgent) {
    this.agent = agent;
  }

  async uploadVideo(
    videoData: Uint8Array,
    mimeType: string,
    onProgress?: (progress: number) => void,
  ): Promise<VideoUploadResult> {
    const uploadId = metricsTracker.startUpload(mimeType, videoData.length);

    try {
      // Get service auth token
      const serviceAuth = await this.agent.com.atproto.server.getServiceAuth({
        aud: "did:web:video.bsky.app",
      });

      // Upload video with retry tracking
      const uploadUrl =
        "https://video.bsky.app/xrpc/app.bsky.video.uploadVideo";

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
          onRetry: (_error, attempt) => {
            metricsTracker.trackRetry(uploadId);
            logger.log(`Retry attempt ${attempt} for upload ${uploadId}`);
          },
        },
      );

      const uploadResult = await uploadResponse.json();
      const jobId = uploadResult.jobId;

      // Track transcoding start
      metricsTracker.startTranscoding(uploadId);

      // Poll for job status
      let jobStatus;
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds timeout

      while (attempts < maxAttempts) {
        const statusResponse = await this.agent.app.bsky.video.getJobStatus({
          jobId,
        });
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

          return {
            blob: jobStatus.blob,
          };
        } else if (jobStatus.state === "JOB_STATE_FAILED") {
          const error = new Error(
            `Video processing failed: ${jobStatus.error || "Unknown error"}`,
          );
          metricsTracker.failUpload(uploadId, error);
          throw error;
        }

        // Update progress if callback provided
        if (onProgress && jobStatus.progress) {
          onProgress(jobStatus.progress);
        }

        // Wait 1 second before next poll
        await new Promise((resolve) => setTimeout(resolve, 1000));
        attempts++;
      }

      const timeoutError = new Error("Video processing timeout");
      metricsTracker.failUpload(uploadId, timeoutError);
      throw timeoutError;
    } catch (error) {
      logger.error("Video upload error:", error);
      metricsTracker.failUpload(
        uploadId,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }
}
