import { AlertCircle, CheckCircle, Loader, Upload } from "lucide-react";
import React, { useEffect, useState } from "react";
import {
  mapATProtoError,
  type StandardErrorResponse,
} from "../../services/atproto/error-handler";
import { getVideoUploadMetricsTracker } from "../../utils/video-upload-metrics";
import { VideoUploadErrorPanel } from "./VideoUploadErrorPanel";

export type UploadState =
  | "queued"
  | "uploading"
  | "processing"
  | "complete"
  | "error";

export interface UploadProgressBarProps {
  uploadId: string;
  fileName?: string;
  onRetry?: () => void;
  onCancel?: () => void;
  compact?: boolean;
}

interface UploadProgress {
  state: UploadState;
  percentage: number;
  bytesUploaded: number;
  totalBytes: number;
  speed: number;
  timeRemaining: number;
  retryAttempts: number;
  errorMessage?: string;
  errorDetails?: StandardErrorResponse;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "--";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond === 0) return "0 B/s";
  const k = 1024;
  const sizes = ["B/s", "KB/s", "MB/s", "GB/s"];
  const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
  return `${(bytesPerSecond / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export const UploadProgressBar: React.FC<UploadProgressBarProps> = ({
  uploadId,
  fileName,
  onRetry,
  onCancel,
  compact = false,
}) => {
  const [progress, setProgress] = useState<UploadProgress>({
    state: "queued",
    percentage: 0,
    bytesUploaded: 0,
    totalBytes: 0,
    speed: 0,
    timeRemaining: 0,
    retryAttempts: 0,
  });

  const metricsTracker = getVideoUploadMetricsTracker();

  useEffect(() => {
    let animationFrame: number;
    let lastUpdateTime = Date.now();
    let lastBytesUploaded = 0;

    const updateProgress = () => {
      let currentUpload = metricsTracker.getActiveUpload(uploadId);

      if (!currentUpload) {
        const sessionStats = metricsTracker.getSessionStatistics();
        currentUpload = sessionStats.uploads.find(
          (u) => u.uploadId === uploadId,
        );
      }

      if (currentUpload) {
        const now = Date.now();
        const elapsedMs = now - currentUpload.startTime;
        const elapsedSeconds = elapsedMs / 1000;

        let state: UploadState = "uploading";
        let percentage = 0;
        let bytesUploaded = 0;
        let speed = 0;
        let timeRemaining = 0;
        let errorDetails: StandardErrorResponse | undefined;

        if (currentUpload.success) {
          state = "complete";
          percentage = 100;
          bytesUploaded = currentUpload.totalBytes;
        } else if (currentUpload.errorMessage) {
          state = "error";
          percentage = 0;

          try {
            const error: any = new Error(currentUpload.errorMessage);

            if (currentUpload.errorType === "Timeout") {
              error.message = error.message.includes("timeout")
                ? error.message
                : `Timeout: ${error.message}`;
            } else if (currentUpload.errorType === "RateLimit") {
              error.message = error.message.includes("rate limit")
                ? error.message
                : `Rate limit: ${error.message}`;
            } else if (currentUpload.errorType === "NetworkError") {
              error.message = error.message.includes("network")
                ? error.message
                : `Network error: ${error.message}`;
            } else if (currentUpload.errorType === "ProcessingError") {
              error.message = error.message.includes("processing")
                ? error.message
                : `Processing failed: ${error.message}`;
            } else if (currentUpload.errorType === "ServerError") {
              error.message = error.message.includes("500")
                ? error.message
                : `Server error: ${error.message}`;
            }

            errorDetails = mapATProtoError(error, "videoUpload", {
              uploadId,
              errorType: currentUpload.errorType,
              retryAttempts: currentUpload.retryAttempts,
            });
          } catch (e) {
            errorDetails = {
              code: "UNKNOWN" as any,
              message: currentUpload.errorMessage,
              context: {
                uploadId,
                errorType: currentUpload.errorType,
                timestamp: new Date().toISOString(),
              },
              retryable: false,
            };
          }
        } else if (
          currentUpload.transcodingStartTime &&
          !currentUpload.transcodingEndTime
        ) {
          state = "processing";
          percentage = 95;
          bytesUploaded = currentUpload.totalBytes;
        } else if (currentUpload.endTime) {
          state = "complete";
          percentage = 100;
          bytesUploaded = currentUpload.totalBytes;
        } else {
          state = "uploading";
          bytesUploaded = currentUpload.chunkSizes.reduce(
            (sum, size) => sum + size,
            0,
          );

          if (currentUpload.totalBytes > 0) {
            percentage = Math.min(
              95,
              (bytesUploaded / currentUpload.totalBytes) * 100,
            );
          }

          if (elapsedSeconds > 0) {
            speed = bytesUploaded / elapsedSeconds;

            if (speed > 0) {
              const remainingBytes = currentUpload.totalBytes - bytesUploaded;
              timeRemaining = remainingBytes / speed;
            }
          }

          const timeSinceLastUpdate = (now - lastUpdateTime) / 1000;
          if (timeSinceLastUpdate > 0) {
            const bytesSinceLastUpdate = bytesUploaded - lastBytesUploaded;
            speed = bytesSinceLastUpdate / timeSinceLastUpdate;
            lastUpdateTime = now;
            lastBytesUploaded = bytesUploaded;
          }
        }

        setProgress({
          state,
          percentage,
          bytesUploaded,
          totalBytes: currentUpload.totalBytes,
          speed,
          timeRemaining,
          retryAttempts: currentUpload.retryAttempts,
          errorMessage: currentUpload.errorMessage,
          errorDetails,
        });
      }

      animationFrame = requestAnimationFrame(updateProgress);
    };

    updateProgress();

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [uploadId, metricsTracker]);

  const getStateConfig = () => {
    switch (progress.state) {
      case "queued":
        return {
          icon: Upload,
          color: "text-blue-500",
          bgColor: "bg-blue-500",
          label: "Queued",
        };
      case "uploading":
        return {
          icon: Loader,
          color: "text-blue-500",
          bgColor: "bg-blue-500",
          label: "Uploading",
          animated: true,
        };
      case "processing":
        return {
          icon: Loader,
          color: "text-purple-500",
          bgColor: "bg-purple-500",
          label: "Processing",
          animated: true,
        };
      case "complete":
        return {
          icon: CheckCircle,
          color: "text-green-500",
          bgColor: "bg-green-500",
          label: "Complete",
        };
      case "error":
        return {
          icon: AlertCircle,
          color: "text-red-500",
          bgColor: "bg-red-500",
          label: "Error",
        };
    }
  };

  const stateConfig = getStateConfig();
  const Icon = stateConfig.icon;

  if (compact) {
    if (progress.state === "error" && progress.errorDetails) {
      return (
        <VideoUploadErrorPanel
          error={progress.errorDetails}
          uploadId={uploadId}
          fileName={fileName}
          onRetry={onRetry}
          onCancel={onCancel}
          compact={true}
        />
      );
    }

    return (
      <div
        className="flex items-center gap-2 rounded-md bg-gray-100 px-2 py-1 dark:bg-gray-800"
        role="status"
        aria-label={`Upload ${progress.state}: ${progress.percentage.toFixed(0)}%`}
        aria-live="polite"
      >
        <Icon
          className={`h-4 w-4 ${stateConfig.color} ${stateConfig.animated ? "animate-spin" : ""}`}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className={`h-full ${stateConfig.bgColor} transition-all duration-300 ease-out`}
              style={{ width: `${progress.percentage}%` }}
              role="progressbar"
              aria-valuenow={progress.percentage}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
        <span className="text-xs font-medium tabular-nums text-gray-700 dark:text-gray-300">
          {progress.percentage.toFixed(0)}%
        </span>
      </div>
    );
  }

  if (progress.state === "error" && progress.errorDetails) {
    return (
      <VideoUploadErrorPanel
        error={progress.errorDetails}
        uploadId={uploadId}
        fileName={fileName}
        onRetry={onRetry}
        onCancel={onCancel}
        compact={false}
      />
    );
  }

  return (
    <div
      className="w-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      role="region"
      aria-label="Upload progress"
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex-shrink-0 ${stateConfig.animated ? "animate-spin" : ""}`}
        >
          <Icon className={`h-5 w-5 ${stateConfig.color}`} aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                {fileName || "Video Upload"}
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {stateConfig.label}
                {progress.retryAttempts > 0 && (
                  <span className="ml-2 text-orange-600 dark:text-orange-400">
                    (Retry {progress.retryAttempts})
                  </span>
                )}
              </p>
            </div>

            {onCancel && progress.state !== "complete" && (
              <button
                onClick={onCancel}
                className="ml-2 rounded-md p-1.5 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Cancel upload"
              >
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  ✕
                </span>
              </button>
            )}
          </div>

          <div
            className="mb-2 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
            role="progressbar"
            aria-valuenow={progress.percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Upload progress: ${progress.percentage.toFixed(0)}%`}
          >
            <div
              className={`h-full ${stateConfig.bgColor} transition-all duration-300 ease-out`}
              style={{ width: `${progress.percentage}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-3">
              <span className="font-medium tabular-nums" aria-live="polite">
                {progress.percentage.toFixed(0)}%
              </span>

              {progress.state === "uploading" && progress.speed > 0 && (
                <>
                  <span className="text-gray-400 dark:text-gray-600">•</span>
                  <span
                    className="tabular-nums"
                    aria-label={`Upload speed: ${formatSpeed(progress.speed)}`}
                  >
                    {formatSpeed(progress.speed)}
                  </span>
                </>
              )}

              {progress.totalBytes > 0 && (
                <>
                  <span className="text-gray-400 dark:text-gray-600">•</span>
                  <span className="tabular-nums">
                    {formatBytes(progress.bytesUploaded)} /{" "}
                    {formatBytes(progress.totalBytes)}
                  </span>
                </>
              )}
            </div>

            {progress.state === "uploading" && progress.timeRemaining > 0 && (
              <span
                className="tabular-nums"
                aria-label={`Time remaining: ${formatTime(progress.timeRemaining)}`}
              >
                {formatTime(progress.timeRemaining)} remaining
              </span>
            )}

            {progress.state === "complete" && (
              <span className="font-medium text-green-600 dark:text-green-400">
                Upload complete
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
