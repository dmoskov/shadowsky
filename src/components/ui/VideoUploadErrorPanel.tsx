import {
  AlertCircle,
  AlertTriangle,
  Clock,
  FileQuestion,
  Network,
  RefreshCw,
  Server,
  Shield,
  WifiOff,
  X,
  XCircle,
} from "lucide-react";
import React from "react";
import {
  ATProtoErrorCode,
  type StandardErrorResponse,
} from "../../services/atproto/error-handler";

export interface VideoUploadErrorPanelProps {
  error:
    | StandardErrorResponse
    | { code?: string; message: string; retryable?: boolean };
  uploadId?: string;
  fileName?: string;
  onRetry?: () => void;
  onCancel?: () => void;
  compact?: boolean;
}

interface ErrorConfig {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  severity: "error" | "warning" | "info";
  iconColor: string;
  bgColor: string;
  borderColor: string;
  actionLabel?: string;
  recoverySteps?: string[];
}

function getErrorConfig(
  code?: string,
  message?: string,
  retryable?: boolean,
): ErrorConfig {
  const errorCode = code as ATProtoErrorCode | undefined;

  switch (errorCode) {
    case ATProtoErrorCode.NETWORK_TIMEOUT:
      return {
        icon: Clock,
        title: "Connection Timed Out",
        description:
          "The upload took too long to complete. This usually happens with slow connections or large files.",
        severity: "warning",
        iconColor: "text-orange-600 dark:text-orange-400",
        bgColor: "bg-orange-50 dark:bg-orange-900/20",
        borderColor: "border-orange-200 dark:border-orange-800",
        actionLabel: "Retry Upload",
        recoverySteps: [
          "Check your internet connection speed",
          "Try uploading during off-peak hours",
          "Consider compressing the video before uploading",
        ],
      };

    case ATProtoErrorCode.NETWORK_CONNECTION:
    case ATProtoErrorCode.NETWORK_DNS:
      return {
        icon: WifiOff,
        title: "Network Connection Failed",
        description:
          "Unable to connect to the server. Please check your internet connection.",
        severity: "error",
        iconColor: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-50 dark:bg-red-900/20",
        borderColor: "border-red-200 dark:border-red-800",
        actionLabel: "Retry Upload",
        recoverySteps: [
          "Check your internet connection",
          "Try disabling VPN if you're using one",
          "Restart your router if the problem persists",
        ],
      };

    case ATProtoErrorCode.RATE_LIMIT_EXCEEDED:
    case ATProtoErrorCode.RATE_LIMIT_QUOTA:
      return {
        icon: Shield,
        title: "Rate Limit Reached",
        description:
          "You've uploaded too many videos recently. Please wait a moment before trying again.",
        severity: "warning",
        iconColor: "text-yellow-600 dark:text-yellow-400",
        bgColor: "bg-yellow-50 dark:bg-yellow-900/20",
        borderColor: "border-yellow-200 dark:border-yellow-800",
        actionLabel: "Try Again Later",
        recoverySteps: [
          "Wait a few minutes before uploading again",
          "Avoid uploading multiple videos simultaneously",
        ],
      };

    case ATProtoErrorCode.VIDEO_SIZE_EXCEEDED:
      return {
        icon: AlertTriangle,
        title: "Video Too Large",
        description:
          "The video file exceeds the maximum size limit of 50MB. Please use a smaller file.",
        severity: "error",
        iconColor: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-50 dark:bg-red-900/20",
        borderColor: "border-red-200 dark:border-red-800",
        recoverySteps: [
          "Compress the video using video editing software",
          "Reduce video resolution or quality",
          "Trim the video to a shorter duration",
          "Maximum file size: 50MB",
        ],
      };

    case ATProtoErrorCode.VIDEO_INVALID_FORMAT:
      return {
        icon: FileQuestion,
        title: "Invalid Video Format",
        description:
          "The video format is not supported. Please use MP4, MOV, MPEG, or WebM format.",
        severity: "error",
        iconColor: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-50 dark:bg-red-900/20",
        borderColor: "border-red-200 dark:border-red-800",
        recoverySteps: [
          "Convert video to MP4 format (recommended)",
          "Supported formats: MP4, MOV, MPEG, WebM",
          "Use a video converter tool if needed",
        ],
      };

    case ATProtoErrorCode.VIDEO_PROCESSING_FAILED:
      return {
        icon: AlertCircle,
        title: "Video Processing Failed",
        description:
          "The server couldn't process your video. This may be due to codec issues or video corruption.",
        severity: "error",
        iconColor: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-50 dark:bg-red-900/20",
        borderColor: "border-red-200 dark:border-red-800",
        actionLabel: "Try Another Video",
        recoverySteps: [
          "Try re-encoding the video with standard codecs (H.264)",
          "Check if the video plays correctly on your device",
          "Use a different video file if the problem persists",
        ],
      };

    case ATProtoErrorCode.VIDEO_PROCESSING_TIMEOUT:
      return {
        icon: Clock,
        title: "Processing Took Too Long",
        description:
          "Video processing timed out. Your video may still be processing in the background.",
        severity: "warning",
        iconColor: "text-orange-600 dark:text-orange-400",
        bgColor: "bg-orange-50 dark:bg-orange-900/20",
        borderColor: "border-orange-200 dark:border-orange-800",
        actionLabel: "Retry Upload",
        recoverySteps: [
          "Wait a few minutes and check if the video appears in your posts",
          "Try uploading a shorter video",
          "Reduce video quality to speed up processing",
        ],
      };

    case ATProtoErrorCode.SERVER_UNAVAILABLE:
    case ATProtoErrorCode.SERVER_OVERLOADED:
      return {
        icon: Server,
        title: "Service Temporarily Unavailable",
        description:
          "The video service is currently experiencing issues. Please try again in a few minutes.",
        severity: "warning",
        iconColor: "text-orange-600 dark:text-orange-400",
        bgColor: "bg-orange-50 dark:bg-orange-900/20",
        borderColor: "border-orange-200 dark:border-orange-800",
        actionLabel: "Retry Upload",
        recoverySteps: [
          "Wait 5-10 minutes before trying again",
          "Check Bluesky status page for service updates",
        ],
      };

    case ATProtoErrorCode.SERVER_INTERNAL:
      return {
        icon: Server,
        title: "Server Error",
        description:
          "An internal server error occurred. This is not your fault. Please try again later.",
        severity: "error",
        iconColor: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-50 dark:bg-red-900/20",
        borderColor: "border-red-200 dark:border-red-800",
        actionLabel: "Retry Upload",
        recoverySteps: [
          "Wait a few minutes and try again",
          "Report the issue if it persists",
        ],
      };

    case ATProtoErrorCode.AUTH_EXPIRED_TOKEN:
    case ATProtoErrorCode.AUTH_INVALID_TOKEN:
    case ATProtoErrorCode.AUTH_MISSING_TOKEN:
      return {
        icon: Shield,
        title: "Authentication Required",
        description:
          "Your session has expired. Please log in again to continue.",
        severity: "error",
        iconColor: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-50 dark:bg-red-900/20",
        borderColor: "border-red-200 dark:border-red-800",
        actionLabel: "Log In Again",
        recoverySteps: [
          "Log out and log back in",
          "Your upload will need to be retried",
        ],
      };

    case ATProtoErrorCode.CLIENT_FORBIDDEN:
      return {
        icon: Shield,
        title: "Access Denied",
        description:
          "You don't have permission to upload videos to this account.",
        severity: "error",
        iconColor: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-50 dark:bg-red-900/20",
        borderColor: "border-red-200 dark:border-red-800",
        recoverySteps: [
          "Verify you're logged into the correct account",
          "Contact support if you believe this is an error",
        ],
      };

    case ATProtoErrorCode.VALIDATION_INPUT:
    case ATProtoErrorCode.CLIENT_BAD_REQUEST:
      return {
        icon: AlertCircle,
        title: "Invalid Upload Request",
        description:
          message || "The upload request was invalid. Please try again.",
        severity: "error",
        iconColor: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-50 dark:bg-red-900/20",
        borderColor: "border-red-200 dark:border-red-800",
        recoverySteps: [
          "Verify the video file is valid",
          "Try uploading a different video",
        ],
      };

    default:
      if (retryable) {
        return {
          icon: Network,
          title: "Upload Failed",
          description: message || "An unexpected error occurred during upload.",
          severity: "warning",
          iconColor: "text-orange-600 dark:text-orange-400",
          bgColor: "bg-orange-50 dark:bg-orange-900/20",
          borderColor: "border-orange-200 dark:border-orange-800",
          actionLabel: "Retry Upload",
          recoverySteps: [
            "Check your internet connection",
            "Try again in a few moments",
          ],
        };
      }

      return {
        icon: XCircle,
        title: "Upload Failed",
        description:
          message ||
          "An unexpected error occurred. Please try a different video.",
        severity: "error",
        iconColor: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-50 dark:bg-red-900/20",
        borderColor: "border-red-200 dark:border-red-800",
        recoverySteps: [
          "Try uploading a different video",
          "Contact support if the problem persists",
        ],
      };
  }
}

export const VideoUploadErrorPanel: React.FC<VideoUploadErrorPanelProps> = ({
  error,
  uploadId,
  fileName,
  onRetry,
  onCancel,
  compact = false,
}) => {
  const errorCode = "code" in error ? error.code : undefined;
  const errorMessage = error.message;
  const retryable = "retryable" in error ? error.retryable : false;

  const config = getErrorConfig(errorCode, errorMessage, retryable);
  const Icon = config.icon;

  const showRetryButton = retryable && onRetry;
  const showCancelButton = onCancel;

  if (compact) {
    return (
      <div
        className={`flex items-center gap-2 rounded-md border px-3 py-2 ${config.bgColor} ${config.borderColor}`}
        role="alert"
        aria-live="assertive"
      >
        <Icon
          className={`h-4 w-4 flex-shrink-0 ${config.iconColor}`}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-gray-900 dark:text-gray-100">
            {config.title}
          </p>
        </div>
        {showRetryButton && (
          <button
            onClick={onRetry}
            className="rounded p-1 transition-colors hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-gray-700"
            aria-label="Retry upload"
          >
            <RefreshCw className="h-4 w-4 text-asph-text-secondary" />
          </button>
        )}
        {showCancelButton && (
          <button
            onClick={onCancel}
            className="rounded p-1 transition-colors hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-gray-700"
            aria-label="Cancel upload"
          >
            <X className="h-4 w-4 text-asph-text-secondary" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`w-full rounded-lg border p-4 ${config.bgColor} ${config.borderColor} shadow-sm`}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <Icon className={`h-5 w-5 ${config.iconColor}`} aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                {config.title}
              </h3>
              {fileName && (
                <p className="mb-1 truncate text-xs text-asph-text-secondary">
                  {fileName}
                </p>
              )}
            </div>
          </div>

          <p className="mb-3 text-sm text-asph-text-secondary">
            {config.description}
          </p>

          {config.recoverySteps && config.recoverySteps.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-medium text-asph-text-secondary">
                What you can do:
              </p>
              <ul className="space-y-1.5" role="list">
                {config.recoverySteps.map((step, index) => (
                  <li
                    key={`recovery-step-${index}-${step.substring(0, 20)}`}
                    className="flex items-start gap-2 text-xs text-asph-text-secondary"
                  >
                    <span className="select-none text-asph-text-tertiary">
                      •
                    </span>
                    <span className="flex-1">{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-2">
            {showRetryButton && (
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                aria-label={config.actionLabel || "Retry upload"}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                {config.actionLabel || "Retry"}
              </button>
            )}
            {showCancelButton && (
              <button
                onClick={onCancel}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                aria-label="Cancel upload"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                Cancel
              </button>
            )}
          </div>

          {uploadId && (
            <p className="mt-3 font-mono text-xs text-asph-text-tertiary">
              Upload ID: {uploadId}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
