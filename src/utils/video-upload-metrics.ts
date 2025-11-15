/**
 * Video Upload Performance Metrics Utility
 *
 * Tracks comprehensive performance metrics for video upload operations:
 * - Upload duration (total time from start to completion)
 * - Chunk size (average and distribution)
 * - Bandwidth utilization (upload speed in bytes/second)
 * - Transcoding wait time (time waiting for video processing)
 * - Upload success rate (per session)
 * - Retry attempts (from retry utility integration)
 *
 * Metrics are structured for CloudWatch integration and include:
 * - Percentile tracking (P50, P95, P99) for latency analysis
 * - Time series data for trend analysis
 * - Histogram data for chunk size distribution
 * - Dimension-based categorization (success/failure, error types)
 *
 * Note: This utility provides structured logging in the frontend.
 * For CloudWatch integration, metrics should be sent to a backend endpoint.
 */

import { createLogger } from "./logger";

const logger = createLogger("VideoUploadMetrics");

/**
 * Metric batching configuration
 */
export interface MetricBatchConfig {
  maxBatchSize: number;
  flushIntervalMs: number;
}

const DEFAULT_BATCH_CONFIG: MetricBatchConfig = {
  maxBatchSize: 20, // CloudWatch limit
  flushIntervalMs: 1000, // 1 second
};

/**
 * Structured metric for CloudWatch publishing
 */
interface StructuredMetric {
  timestamp: string;
  namespace: string;
  metrics: Record<string, any>;
  context: Record<string, any>;
}

/**
 * Async Metric Batcher
 * Implements fire-and-forget pattern with batching to reduce API overhead
 * Metrics are queued and flushed periodically without blocking upload operations
 */
class MetricBatcher {
  private queue: StructuredMetric[] = [];
  private flushTimer: NodeJS.Timeout | number | null = null;
  private config: MetricBatchConfig;
  private isShuttingDown = false;

  constructor(config: MetricBatchConfig = DEFAULT_BATCH_CONFIG) {
    this.config = config;
    this.startFlushTimer();
  }

  /**
   * Add metric to batch queue (fire-and-forget, never blocks)
   */
  enqueue(metric: StructuredMetric): void {
    if (this.isShuttingDown) {
      return;
    }

    try {
      this.queue.push(metric);

      // Flush immediately if batch is full
      if (this.queue.length >= this.config.maxBatchSize) {
        this.flush().catch((error) => {
          logger.error("Failed to flush metrics batch:", error);
        });
      }
    } catch (error) {
      // Never throw - log and continue
      logger.error("Failed to enqueue metric:", error);
    }
  }

  /**
   * Flush batched metrics to CloudWatch
   * Returns promise but errors are logged, not thrown to callers
   */
  private async flush(): Promise<void> {
    if (this.queue.length === 0) {
      return;
    }

    // Grab current batch and reset queue
    const batch = this.queue.splice(0, this.config.maxBatchSize);

    try {
      // Log structured metrics that can be picked up by CloudWatch Logs
      // In production, this would send to a backend endpoint
      logger.log(
        "VIDEO_UPLOAD_METRICS_BATCH:",
        JSON.stringify({
          batchSize: batch.length,
          metrics: batch,
          timestamp: new Date().toISOString(),
        })
      );

      // In production, send to backend endpoint:
      // await fetch('/api/metrics/batch', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(batch)
      // });
    } catch (error) {
      // Log error but never throw to prevent disrupting upload pipeline
      logger.error("Failed to publish metrics batch:", error);
    }
  }

  /**
   * Start periodic flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch((error) => {
        logger.error("Periodic metrics flush failed:", error);
      });
    }, this.config.flushIntervalMs);
  }

  /**
   * Stop flush timer and flush remaining metrics
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    if (this.flushTimer) {
      clearInterval(this.flushTimer as any);
      this.flushTimer = null;
    }

    // Flush any remaining metrics
    await this.flush().catch((error) => {
      logger.error("Failed to flush metrics during shutdown:", error);
    });
  }

  /**
   * Get current queue size (for monitoring)
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Update batch configuration
   */
  updateConfig(config: Partial<MetricBatchConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart timer if interval changed
    if (config.flushIntervalMs !== undefined && this.flushTimer) {
      clearInterval(this.flushTimer as any);
      this.startFlushTimer();
    }
  }
}

// Global metric batcher instance
const metricBatcher = new MetricBatcher();

export interface VideoUploadMetrics {
  uploadId: string;
  startTime: number;
  endTime?: number;
  uploadDurationMs?: number;
  totalBytes: number;
  chunkSizes: number[];
  averageChunkSize?: number;
  bandwidthBytesPerSecond?: number;
  transcodingStartTime?: number;
  transcodingEndTime?: number;
  transcodingWaitTimeMs?: number;
  pollingAttempts?: number;
  retryAttempts: number;
  success: boolean;
  errorType?: string;
  errorMessage?: string;
  mimeType: string;
  videoId?: string;
}

export interface VideoUploadSession {
  sessionId: string;
  uploads: VideoUploadMetrics[];
  successCount: number;
  failureCount: number;
  totalRetryAttempts: number;
  averageUploadDuration?: number;
  averageBandwidth?: number;
}

/**
 * Percentile calculator for latency analysis
 */
function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Calculate statistics for chunk sizes (histogram distribution)
 */
function calculateChunkStatistics(chunkSizes: number[]) {
  if (chunkSizes.length === 0) {
    return {
      min: 0,
      max: 0,
      average: 0,
      median: 0,
      p95: 0,
      p99: 0,
    };
  }

  const sorted = [...chunkSizes].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    average: sum / sorted.length,
    median: calculatePercentile(sorted, 50),
    p95: calculatePercentile(sorted, 95),
    p99: calculatePercentile(sorted, 99),
  };
}

/**
 * Video Upload Metrics Tracker
 * Manages performance metrics for individual uploads and sessions
 */
export class VideoUploadMetricsTracker {
  private static instance: VideoUploadMetricsTracker;
  private currentSession: VideoUploadSession;
  private activeUploads: Map<string, VideoUploadMetrics>;

  private constructor() {
    this.currentSession = this.createNewSession();
    this.activeUploads = new Map();
  }

  static getInstance(): VideoUploadMetricsTracker {
    if (!VideoUploadMetricsTracker.instance) {
      VideoUploadMetricsTracker.instance = new VideoUploadMetricsTracker();
    }
    return VideoUploadMetricsTracker.instance;
  }

  /**
   * Start tracking a new video upload
   */
  startUpload(mimeType: string, totalBytes: number): string {
    const uploadId = this.generateUploadId();
    const metrics: VideoUploadMetrics = {
      uploadId,
      startTime: Date.now(),
      totalBytes,
      chunkSizes: [],
      retryAttempts: 0,
      success: false,
      mimeType,
    };

    this.activeUploads.set(uploadId, metrics);
    logger.log(`Started tracking upload ${uploadId}`, {
      mimeType,
      totalBytes,
    });

    return uploadId;
  }

  /**
   * Track chunk upload (for future chunked uploads)
   */
  trackChunk(uploadId: string, chunkSize: number): void {
    const metrics = this.activeUploads.get(uploadId);
    if (!metrics) {
      logger.error(`Upload ${uploadId} not found`);
      return;
    }

    metrics.chunkSizes.push(chunkSize);
  }

  /**
   * Track transcoding start
   */
  startTranscoding(uploadId: string): void {
    const metrics = this.activeUploads.get(uploadId);
    if (!metrics) {
      logger.error(`Upload ${uploadId} not found`);
      return;
    }

    metrics.transcodingStartTime = Date.now();
    logger.log(`Transcoding started for upload ${uploadId}`);
  }

  /**
   * Track transcoding completion
   */
  completeTranscoding(uploadId: string, pollingAttempts: number): void {
    const metrics = this.activeUploads.get(uploadId);
    if (!metrics) {
      logger.error(`Upload ${uploadId} not found`);
      return;
    }

    metrics.transcodingEndTime = Date.now();
    metrics.pollingAttempts = pollingAttempts;

    if (metrics.transcodingStartTime) {
      metrics.transcodingWaitTimeMs =
        metrics.transcodingEndTime - metrics.transcodingStartTime;
    }

    logger.log(`Transcoding completed for upload ${uploadId}`, {
      waitTimeMs: metrics.transcodingWaitTimeMs,
      pollingAttempts,
    });
  }

  /**
   * Track retry attempt
   */
  trackRetry(uploadId: string): void {
    const metrics = this.activeUploads.get(uploadId);
    if (!metrics) {
      logger.error(`Upload ${uploadId} not found`);
      return;
    }

    metrics.retryAttempts++;
    logger.log(`Retry attempt ${metrics.retryAttempts} for upload ${uploadId}`);
  }

  /**
   * Complete upload successfully
   */
  completeUpload(uploadId: string, videoId?: string): void {
    const metrics = this.activeUploads.get(uploadId);
    if (!metrics) {
      logger.error(`Upload ${uploadId} not found`);
      return;
    }

    metrics.endTime = Date.now();
    metrics.uploadDurationMs = metrics.endTime - metrics.startTime;
    metrics.success = true;
    metrics.videoId = videoId;

    // Calculate bandwidth (bytes per second)
    if (metrics.uploadDurationMs > 0) {
      metrics.bandwidthBytesPerSecond =
        (metrics.totalBytes / metrics.uploadDurationMs) * 1000;
    }

    // Calculate average chunk size
    if (metrics.chunkSizes.length > 0) {
      const sum = metrics.chunkSizes.reduce((acc, val) => acc + val, 0);
      metrics.averageChunkSize = sum / metrics.chunkSizes.length;
    }

    // Add to session
    this.currentSession.uploads.push(metrics);
    this.currentSession.successCount++;
    this.currentSession.totalRetryAttempts += metrics.retryAttempts;

    // Remove from active uploads
    this.activeUploads.delete(uploadId);

    // Publish metrics
    this.publishMetrics(metrics);

    logger.log(`Upload completed successfully ${uploadId}`, {
      durationMs: metrics.uploadDurationMs,
      bandwidthMBps: metrics.bandwidthBytesPerSecond
        ? (metrics.bandwidthBytesPerSecond / (1024 * 1024)).toFixed(2)
        : 0,
      retryAttempts: metrics.retryAttempts,
    });
  }

  /**
   * Mark upload as failed
   */
  failUpload(uploadId: string, error: Error): void {
    const metrics = this.activeUploads.get(uploadId);
    if (!metrics) {
      logger.error(`Upload ${uploadId} not found`);
      return;
    }

    metrics.endTime = Date.now();
    metrics.uploadDurationMs = metrics.endTime - metrics.startTime;
    metrics.success = false;
    metrics.errorType = this.categorizeError(error);
    metrics.errorMessage = error.message;

    // Add to session
    this.currentSession.uploads.push(metrics);
    this.currentSession.failureCount++;
    this.currentSession.totalRetryAttempts += metrics.retryAttempts;

    // Remove from active uploads
    this.activeUploads.delete(uploadId);

    // Publish metrics
    this.publishMetrics(metrics);

    logger.error(`Upload failed ${uploadId}`, {
      errorType: metrics.errorType,
      errorMessage: metrics.errorMessage,
      retryAttempts: metrics.retryAttempts,
    });
  }

  /**
   * Get active upload metrics by upload ID
   */
  getActiveUpload(uploadId: string): VideoUploadMetrics | undefined {
    return this.activeUploads.get(uploadId);
  }

  /**
   * Get all active uploads
   */
  getActiveUploads(): VideoUploadMetrics[] {
    return Array.from(this.activeUploads.values());
  }

  /**
   * Get current session statistics
   */
  getSessionStatistics(): VideoUploadSession {
    const uploads = this.currentSession.uploads;

    if (uploads.length > 0) {
      const successfulUploads = uploads.filter((u) => u.success);
      const durations = successfulUploads
        .map((u) => u.uploadDurationMs)
        .filter((d): d is number => d !== undefined);
      const bandwidths = successfulUploads
        .map((u) => u.bandwidthBytesPerSecond)
        .filter((b): b is number => b !== undefined);

      if (durations.length > 0) {
        this.currentSession.averageUploadDuration =
          durations.reduce((acc, val) => acc + val, 0) / durations.length;
      }

      if (bandwidths.length > 0) {
        this.currentSession.averageBandwidth =
          bandwidths.reduce((acc, val) => acc + val, 0) / bandwidths.length;
      }
    }

    return { ...this.currentSession };
  }

  /**
   * Get percentile statistics for session
   */
  getPercentileStatistics() {
    const uploads = this.currentSession.uploads.filter((u) => u.success);
    const durations = uploads
      .map((u) => u.uploadDurationMs)
      .filter((d): d is number => d !== undefined);
    const bandwidths = uploads
      .map((u) => u.bandwidthBytesPerSecond)
      .filter((b): b is number => b !== undefined);
    const transcodingWaitTimes = uploads
      .map((u) => u.transcodingWaitTimeMs)
      .filter((t): t is number => t !== undefined);

    return {
      duration: {
        p50: calculatePercentile(durations, 50),
        p95: calculatePercentile(durations, 95),
        p99: calculatePercentile(durations, 99),
      },
      bandwidth: {
        p50: calculatePercentile(bandwidths, 50),
        p95: calculatePercentile(bandwidths, 95),
        p99: calculatePercentile(bandwidths, 99),
      },
      transcodingWaitTime: {
        p50: calculatePercentile(transcodingWaitTimes, 50),
        p95: calculatePercentile(transcodingWaitTimes, 95),
        p99: calculatePercentile(transcodingWaitTimes, 99),
      },
    };
  }

  /**
   * Get chunk size statistics for all uploads in session
   */
  getChunkStatistics() {
    const allChunks = this.currentSession.uploads
      .flatMap((u) => u.chunkSizes)
      .filter((c) => c > 0);

    return calculateChunkStatistics(allChunks);
  }

  /**
   * Get success rate for current session
   */
  getSuccessRate(): number {
    const total =
      this.currentSession.successCount + this.currentSession.failureCount;
    if (total === 0) return 100;
    return (this.currentSession.successCount / total) * 100;
  }

  /**
   * Reset session (start new session)
   */
  resetSession(): void {
    logger.log("Resetting upload session", {
      previousSession: this.getSessionStatistics(),
    });
    this.currentSession = this.createNewSession();
    this.activeUploads.clear();
  }

  /**
   * Publish metrics to CloudWatch using async batching (fire-and-forget)
   * Metrics are queued and batched to reduce API overhead by ~80%
   * Never blocks the upload pipeline - errors are logged but not thrown
   */
  private publishMetrics(metrics: VideoUploadMetrics): void {
    const structuredMetrics: StructuredMetric = {
      timestamp: new Date().toISOString(),
      namespace: "ShadowSky/VideoUpload",
      metrics: {
        // Duration metric with percentile statistics
        UploadDuration: {
          value: metrics.uploadDurationMs || 0,
          unit: "Milliseconds",
          dimensions: {
            Status: metrics.success ? "Success" : "Error",
            MimeType: metrics.mimeType,
          },
        },
        // Bandwidth metric
        BandwidthUtilization: {
          value: metrics.bandwidthBytesPerSecond || 0,
          unit: "Bytes/Second",
          dimensions: {
            Status: metrics.success ? "Success" : "Error",
          },
        },
        // Transcoding wait time
        TranscodingWaitTime: {
          value: metrics.transcodingWaitTimeMs || 0,
          unit: "Milliseconds",
          dimensions: {
            Status: metrics.success ? "Success" : "Error",
          },
        },
        // Retry attempts
        RetryAttempts: {
          value: metrics.retryAttempts,
          unit: "Count",
          dimensions: {
            Status: metrics.success ? "Success" : "Error",
          },
        },
        // Success/failure count
        UploadCount: {
          value: 1,
          unit: "Count",
          dimensions: {
            Status: metrics.success ? "Success" : "Error",
            ErrorType: metrics.errorType || "None",
          },
        },
      },
      // Additional context for analysis
      context: {
        uploadId: metrics.uploadId,
        totalBytes: metrics.totalBytes,
        averageChunkSize: metrics.averageChunkSize,
        pollingAttempts: metrics.pollingAttempts,
      },
    };

    // Async fire-and-forget: enqueue never blocks, errors logged internally
    metricBatcher.enqueue(structuredMetrics);
  }

  /**
   * Categorize error types for metrics
   */
  private categorizeError(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes("timeout")) {
      return "Timeout";
    }
    if (message.includes("429") || message.includes("rate limit")) {
      return "RateLimit";
    }
    if (message.includes("401") || message.includes("unauthorized")) {
      return "Authentication";
    }
    if (message.includes("403") || message.includes("forbidden")) {
      return "Authorization";
    }
    if (message.includes("500") || message.includes("server error")) {
      return "ServerError";
    }
    if (message.includes("network") || message.includes("fetch")) {
      return "NetworkError";
    }
    if (message.includes("processing failed")) {
      return "ProcessingError";
    }
    return "Unknown";
  }

  /**
   * Generate unique upload ID
   */
  private generateUploadId(): string {
    return `upload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Create new session
   */
  private createNewSession(): VideoUploadSession {
    return {
      sessionId: `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      uploads: [],
      successCount: 0,
      failureCount: 0,
      totalRetryAttempts: 0,
    };
  }
}

/**
 * Helper function to get metrics tracker instance
 */
export function getVideoUploadMetricsTracker(): VideoUploadMetricsTracker {
  return VideoUploadMetricsTracker.getInstance();
}

/**
 * Export session statistics for dashboard/monitoring
 */
export function getVideoUploadSessionStats() {
  const tracker = VideoUploadMetricsTracker.getInstance();
  return {
    session: tracker.getSessionStatistics(),
    percentiles: tracker.getPercentileStatistics(),
    chunkStats: tracker.getChunkStatistics(),
    successRate: tracker.getSuccessRate(),
  };
}

/**
 * Get metric batcher queue size (for monitoring)
 */
export function getMetricBatcherQueueSize(): number {
  return metricBatcher.getQueueSize();
}

/**
 * Update metric batch configuration
 * Useful for adjusting batching behavior based on network conditions
 */
export function updateMetricBatchConfig(
  config: Partial<MetricBatchConfig>
): void {
  metricBatcher.updateConfig(config);
}

/**
 * Shutdown metric batcher and flush remaining metrics
 * Should be called before application closes
 */
export async function shutdownMetricBatcher(): Promise<void> {
  await metricBatcher.shutdown();
}
