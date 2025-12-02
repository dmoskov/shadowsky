/**
 * Video Upload Progress Component
 *
 * Displays upload and compression progress with a visual progress bar
 * Supports multiple stages: compression, uploading, processing
 */

import { AlertCircle, Check, Film, Loader, X } from "lucide-react";
import type { CompressionProgress } from "../utils/video-compression";

export type VideoUploadStage =
  | "compressing"
  | "uploading"
  | "processing"
  | "complete"
  | "error";

export interface VideoUploadProgressProps {
  stage: VideoUploadStage;
  progress: number; // 0-100
  fileName?: string;
  error?: string;
  compressionProgress?: CompressionProgress;
  onCancel?: () => void;
  onRetry?: () => void;
  compact?: boolean;
}

const stageLabels: Record<VideoUploadStage, string> = {
  compressing: "Compressing video...",
  uploading: "Uploading video...",
  processing: "Processing video...",
  complete: "Upload complete",
  error: "Upload failed",
};

const stageDescriptions: Record<VideoUploadStage, string> = {
  compressing: "Optimizing for best quality and size",
  uploading: "Sending to Bluesky servers",
  processing: "Server is processing your video",
  complete: "Ready to post",
  error: "Something went wrong",
};

export function VideoUploadProgress({
  stage,
  progress,
  fileName,
  error,
  compressionProgress,
  onCancel,
  onRetry,
  compact = false,
}: VideoUploadProgressProps) {
  const isActive =
    stage === "compressing" || stage === "uploading" || stage === "processing";
  const isComplete = stage === "complete";
  const isError = stage === "error";

  // Calculate overall progress across stages
  const getOverallProgress = (): number => {
    switch (stage) {
      case "compressing":
        return Math.round(progress * 0.3); // 0-30%
      case "uploading":
        return 30 + Math.round(progress * 0.5); // 30-80%
      case "processing":
        return 80 + Math.round(progress * 0.2); // 80-100%
      case "complete":
        return 100;
      case "error":
        return 0;
      default:
        return 0;
    }
  };

  const overallProgress = getOverallProgress();

  if (compact) {
    return (
      <div
        className="flex items-center gap-2 rounded-lg px-3 py-2"
        style={{ backgroundColor: "var(--bsky-bg-secondary)" }}
      >
        {/* Icon */}
        {isActive && (
          <Loader size={16} className="animate-spin text-blue-500" />
        )}
        {isComplete && <Check size={16} className="text-green-500" />}
        {isError && <AlertCircle size={16} className="text-red-500" />}

        {/* Progress bar */}
        <div className="flex-1">
          <div
            className="h-1.5 overflow-hidden rounded-full"
            style={{ backgroundColor: "var(--bsky-bg-tertiary)" }}
          >
            <div
              className={`h-full transition-all duration-300 ${
                isError
                  ? "bg-red-500"
                  : isComplete
                    ? "bg-green-500"
                    : "bg-blue-500"
              }`}
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>

        {/* Progress text */}
        <span
          className="text-xs tabular-nums"
          style={{ color: "var(--bsky-text-secondary)" }}
        >
          {overallProgress}%
        </span>

        {/* Cancel button */}
        {isActive && onCancel && (
          <button
            onClick={onCancel}
            className="ml-1 rounded-full p-1 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
            title="Cancel upload"
          >
            <X size={14} style={{ color: "var(--bsky-text-secondary)" }} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-lg border"
      style={{
        backgroundColor: "var(--bsky-bg-secondary)",
        borderColor: "var(--bsky-border-primary)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-3">
        {/* Icon */}
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full ${
            isError
              ? "bg-red-100 dark:bg-red-900/30"
              : "bg-blue-100 dark:bg-blue-900/30"
          }`}
        >
          {isActive && (
            <Loader size={20} className="animate-spin text-blue-500" />
          )}
          {isComplete && <Check size={20} className="text-green-500" />}
          {isError && <AlertCircle size={20} className="text-red-500" />}
        </div>

        {/* Text content */}
        <div className="min-w-0 flex-1">
          <div
            className="truncate text-sm font-medium"
            style={{ color: "var(--bsky-text-primary)" }}
          >
            {stageLabels[stage]}
          </div>
          <div
            className="truncate text-xs"
            style={{ color: "var(--bsky-text-secondary)" }}
          >
            {error || stageDescriptions[stage]}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {isActive && (
            <span
              className="text-sm tabular-nums"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              {overallProgress}%
            </span>
          )}

          {isActive && onCancel && (
            <button
              onClick={onCancel}
              className="rounded-full p-1.5 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
              title="Cancel upload"
            >
              <X size={18} style={{ color: "var(--bsky-text-secondary)" }} />
            </button>
          )}

          {isError && onRetry && (
            <button
              onClick={onRetry}
              className="rounded-full bg-blue-500 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-blue-600"
            >
              Retry
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="h-1 overflow-hidden"
        style={{ backgroundColor: "var(--bsky-bg-tertiary)" }}
      >
        <div
          className={`h-full transition-all duration-300 ${
            isError ? "bg-red-500" : isComplete ? "bg-green-500" : "bg-blue-500"
          }`}
          style={{ width: `${overallProgress}%` }}
        />
      </div>

      {/* File info */}
      {fileName && (
        <div
          className="flex items-center gap-2 border-t px-3 py-2"
          style={{ borderColor: "var(--bsky-border-primary)" }}
        >
          <Film size={14} style={{ color: "var(--bsky-text-tertiary)" }} />
          <span
            className="truncate text-xs"
            style={{ color: "var(--bsky-text-tertiary)" }}
          >
            {fileName}
          </span>
        </div>
      )}

      {/* Stage indicators */}
      {isActive && (
        <div
          className="flex items-center justify-center gap-4 border-t px-3 py-2"
          style={{ borderColor: "var(--bsky-border-primary)" }}
        >
          <StageIndicator
            label="Compress"
            isActive={stage === "compressing"}
            isComplete={["uploading", "processing", "complete"].includes(stage)}
            progress={
              stage === "compressing"
                ? progress
                : ["uploading", "processing", "complete"].includes(stage)
                  ? 100
                  : 0
            }
          />
          <div
            className="h-px w-8"
            style={{ backgroundColor: "var(--bsky-border-primary)" }}
          />
          <StageIndicator
            label="Upload"
            isActive={stage === "uploading"}
            isComplete={["processing", "complete"].includes(stage)}
            progress={
              stage === "uploading"
                ? progress
                : ["processing", "complete"].includes(stage)
                  ? 100
                  : 0
            }
          />
          <div
            className="h-px w-8"
            style={{ backgroundColor: "var(--bsky-border-primary)" }}
          />
          <StageIndicator
            label="Process"
            isActive={stage === "processing"}
            isComplete={["complete"].includes(stage)}
            progress={
              stage === "processing"
                ? progress
                : ["complete"].includes(stage)
                  ? 100
                  : 0
            }
          />
        </div>
      )}

      {/* Compression details */}
      {compressionProgress && stage === "compressing" && (
        <div
          className="border-t px-3 py-2 text-xs"
          style={{
            borderColor: "var(--bsky-border-primary)",
            color: "var(--bsky-text-tertiary)",
          }}
        >
          {compressionProgress.stage === "analyzing" && "Analyzing video..."}
          {compressionProgress.stage === "compressing" &&
            "Compressing frames..."}
          {compressionProgress.stage === "finalizing" && "Finalizing output..."}
          {compressionProgress.estimatedTimeRemaining !== undefined &&
            compressionProgress.estimatedTimeRemaining > 0 && (
              <span className="ml-2">
                ~{compressionProgress.estimatedTimeRemaining}s remaining
              </span>
            )}
        </div>
      )}
    </div>
  );
}

interface StageIndicatorProps {
  label: string;
  isActive: boolean;
  isComplete: boolean;
  progress: number;
}

function StageIndicator({
  label,
  isActive,
  isComplete,
  progress,
}: StageIndicatorProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
          isComplete
            ? "bg-green-500 text-white"
            : isActive
              ? "bg-blue-500 text-white"
              : "bg-gray-200 dark:bg-gray-700"
        }`}
        style={
          !isComplete && !isActive
            ? { color: "var(--bsky-text-tertiary)" }
            : undefined
        }
      >
        {isComplete ? (
          <Check size={12} />
        ) : isActive ? (
          `${Math.round(progress)}`
        ) : (
          ""
        )}
      </div>
      <span
        className="text-xs"
        style={{
          color:
            isActive || isComplete
              ? "var(--bsky-text-primary)"
              : "var(--bsky-text-tertiary)",
        }}
      >
        {label}
      </span>
    </div>
  );
}

export default VideoUploadProgress;
