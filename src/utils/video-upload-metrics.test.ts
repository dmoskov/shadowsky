import { beforeEach, describe, expect, it } from "vitest";
import {
  VideoUploadMetricsTracker,
  getVideoUploadSessionStats,
} from "./video-upload-metrics";

describe("VideoUploadMetricsTracker", () => {
  let tracker: VideoUploadMetricsTracker;

  beforeEach(() => {
    tracker = VideoUploadMetricsTracker.getInstance();
    tracker.resetSession();
  });

  it("should create a singleton instance", () => {
    const instance1 = VideoUploadMetricsTracker.getInstance();
    const instance2 = VideoUploadMetricsTracker.getInstance();
    expect(instance1).toBe(instance2);
  });

  it("should start tracking an upload", () => {
    const uploadId = tracker.startUpload("video/mp4", 1024000);
    expect(uploadId).toMatch(/^upload_\d+_[a-z0-9]+$/);
  });

  it("should track retry attempts", () => {
    const uploadId = tracker.startUpload("video/mp4", 1024000);
    tracker.trackRetry(uploadId);
    tracker.trackRetry(uploadId);

    tracker.completeUpload(uploadId, "test-video-id");

    const stats = tracker.getSessionStatistics();
    expect(stats.totalRetryAttempts).toBe(2);
  });

  it("should complete upload successfully with metrics", async () => {
    const uploadId = tracker.startUpload("video/mp4", 1024000);
    tracker.startTranscoding(uploadId);

    // Simulate transcoding delay
    await new Promise((resolve) => setTimeout(resolve, 10));
    tracker.completeTranscoding(uploadId, 5);
    tracker.completeUpload(uploadId, "test-video-id");

    await new Promise((resolve) => setTimeout(resolve, 10));
    const stats = tracker.getSessionStatistics();
    expect(stats.successCount).toBe(1);
    expect(stats.failureCount).toBe(0);
    expect(stats.uploads.length).toBe(1);
    expect(stats.uploads[0].success).toBe(true);
  });

  it("should track failed uploads with error type", () => {
    const uploadId = tracker.startUpload("video/mp4", 1024000);
    const error = new Error("Network timeout");

    tracker.failUpload(uploadId, error);

    const stats = tracker.getSessionStatistics();
    expect(stats.successCount).toBe(0);
    expect(stats.failureCount).toBe(1);
    expect(stats.uploads[0].success).toBe(false);
    expect(stats.uploads[0].errorType).toBe("Timeout");
  });

  it("should calculate bandwidth correctly", async () => {
    const uploadId = tracker.startUpload("video/mp4", 1000000); // 1MB

    // Complete upload after a delay
    await new Promise((resolve) => {
      setTimeout(() => {
        tracker.completeUpload(uploadId, "test-video-id");
        resolve(undefined);
      }, 100);
    });

    await new Promise((resolve) => {
      setTimeout(() => {
        const stats = tracker.getSessionStatistics();
        expect(stats.uploads[0].bandwidthBytesPerSecond).toBeGreaterThan(0);
        resolve(undefined);
      }, 50);
    });
  });

  it("should track transcoding wait time", async () => {
    const uploadId = tracker.startUpload("video/mp4", 1024000);
    tracker.startTranscoding(uploadId);

    await new Promise((resolve) => {
      setTimeout(() => {
        tracker.completeTranscoding(uploadId, 10);
        tracker.completeUpload(uploadId, "test-video-id");
        resolve(undefined);
      }, 50);
    });

    await new Promise((resolve) => {
      setTimeout(() => {
        const stats = tracker.getSessionStatistics();
        expect(stats.uploads[0].transcodingWaitTimeMs).toBeGreaterThan(0);
        expect(stats.uploads[0].pollingAttempts).toBe(10);
        resolve(undefined);
      }, 50);
    });
  });

  it("should calculate success rate", () => {
    const uploadId1 = tracker.startUpload("video/mp4", 1024000);
    tracker.completeUpload(uploadId1);

    const uploadId2 = tracker.startUpload("video/mp4", 1024000);
    tracker.failUpload(uploadId2, new Error("Test error"));

    const successRate = tracker.getSuccessRate();
    expect(successRate).toBe(50);
  });

  it("should calculate percentile statistics", () => {
    // Create multiple uploads with different durations
    for (let i = 0; i < 10; i++) {
      const uploadId = tracker.startUpload("video/mp4", 1024000);
      setTimeout(() => {
        tracker.completeUpload(uploadId);
      }, i * 10);
    }

    setTimeout(() => {
      const percentiles = tracker.getPercentileStatistics();
      expect(percentiles.duration.p50).toBeGreaterThanOrEqual(0);
      expect(percentiles.duration.p95).toBeGreaterThanOrEqual(
        percentiles.duration.p50,
      );
      expect(percentiles.duration.p99).toBeGreaterThanOrEqual(
        percentiles.duration.p95,
      );
    }, 150);
  });

  it("should reset session correctly", () => {
    const uploadId = tracker.startUpload("video/mp4", 1024000);
    tracker.completeUpload(uploadId);

    let stats = tracker.getSessionStatistics();
    expect(stats.successCount).toBe(1);

    tracker.resetSession();

    stats = tracker.getSessionStatistics();
    expect(stats.successCount).toBe(0);
    expect(stats.failureCount).toBe(0);
    expect(stats.uploads.length).toBe(0);
  });

  it("should export session stats correctly", () => {
    const uploadId = tracker.startUpload("video/mp4", 1024000);
    tracker.completeUpload(uploadId);

    const sessionStats = getVideoUploadSessionStats();
    expect(sessionStats.session).toBeDefined();
    expect(sessionStats.percentiles).toBeDefined();
    expect(sessionStats.chunkStats).toBeDefined();
    expect(sessionStats.successRate).toBeDefined();
  });

  it("should categorize different error types", () => {
    const testCases = [
      { error: new Error("timeout"), expectedType: "Timeout" },
      { error: new Error("429 rate limit"), expectedType: "RateLimit" },
      { error: new Error("401 unauthorized"), expectedType: "Authentication" },
      { error: new Error("403 forbidden"), expectedType: "Authorization" },
      { error: new Error("500 server error"), expectedType: "ServerError" },
      {
        error: new Error("network fetch failed"),
        expectedType: "NetworkError",
      },
      {
        error: new Error("processing failed"),
        expectedType: "ProcessingError",
      },
      { error: new Error("random error"), expectedType: "Unknown" },
    ];

    testCases.forEach(({ error, expectedType }, index) => {
      const uploadId = tracker.startUpload("video/mp4", 1024000);
      tracker.failUpload(uploadId, error);

      const stats = tracker.getSessionStatistics();
      expect(stats.uploads[index].errorType).toBe(expectedType);
    });
  });
});
