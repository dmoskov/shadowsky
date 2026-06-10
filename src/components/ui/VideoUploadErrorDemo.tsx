import React, { useState } from "react";
import {
  ATProtoErrorCode,
  type StandardErrorResponse,
} from "../../services/atproto/error-handler";
import { VideoUploadErrorPanel } from "./VideoUploadErrorPanel";

const errorExamples: Record<string, StandardErrorResponse> = {
  networkTimeout: {
    code: ATProtoErrorCode.NETWORK_TIMEOUT,
    message:
      "Network request timed out. Please check your connection and try again.",
    context: {
      uploadId: "demo-upload-1",
      endpoint: "app.bsky.video.uploadVideo",
      timestamp: new Date().toISOString(),
    },
    retryable: true,
  },
  networkConnection: {
    code: ATProtoErrorCode.NETWORK_CONNECTION,
    message:
      "Network connection failed. Please check your internet connection.",
    context: {
      uploadId: "demo-upload-2",
      endpoint: "app.bsky.video.uploadVideo",
      timestamp: new Date().toISOString(),
    },
    retryable: true,
  },
  rateLimit: {
    code: ATProtoErrorCode.RATE_LIMIT_EXCEEDED,
    message: "Rate limit exceeded. Please try again in 60 seconds.",
    context: {
      uploadId: "demo-upload-3",
      endpoint: "app.bsky.video.uploadVideo",
      retryAfter: 60,
      timestamp: new Date().toISOString(),
    },
    retryable: true,
  },
  videoSizeExceeded: {
    code: ATProtoErrorCode.VIDEO_SIZE_EXCEEDED,
    message: "Video file is too large. Please use a smaller file.",
    context: {
      uploadId: "demo-upload-4",
      endpoint: "app.bsky.video.uploadVideo",
      timestamp: new Date().toISOString(),
    },
    retryable: false,
  },
  videoInvalidFormat: {
    code: ATProtoErrorCode.VIDEO_INVALID_FORMAT,
    message:
      "The video format is not supported. Please use MP4, MOV, MPEG, or WebM format.",
    context: {
      uploadId: "demo-upload-5",
      endpoint: "app.bsky.video.uploadVideo",
      timestamp: new Date().toISOString(),
    },
    retryable: false,
  },
  videoProcessingFailed: {
    code: ATProtoErrorCode.VIDEO_PROCESSING_FAILED,
    message: "Video processing failed. Please try again with a different file.",
    context: {
      uploadId: "demo-upload-6",
      endpoint: "app.bsky.video.getJobStatus",
      jobId: "job-123456",
      timestamp: new Date().toISOString(),
    },
    retryable: false,
  },
  videoProcessingTimeout: {
    code: ATProtoErrorCode.VIDEO_PROCESSING_TIMEOUT,
    message:
      "Video processing timed out. The video may still be processing. Please try again later.",
    context: {
      uploadId: "demo-upload-7",
      endpoint: "app.bsky.video.getJobStatus",
      jobId: "job-789012",
      pollingAttempts: 60,
      timestamp: new Date().toISOString(),
    },
    retryable: true,
  },
  serverUnavailable: {
    code: ATProtoErrorCode.SERVER_UNAVAILABLE,
    message: "Service temporarily unavailable. Please try again later.",
    context: {
      uploadId: "demo-upload-8",
      endpoint: "app.bsky.video.uploadVideo",
      status: 503,
      timestamp: new Date().toISOString(),
    },
    retryable: true,
  },
  serverError: {
    code: ATProtoErrorCode.SERVER_INTERNAL,
    message: "Internal server error. Please try again later.",
    context: {
      uploadId: "demo-upload-9",
      endpoint: "app.bsky.video.uploadVideo",
      status: 500,
      timestamp: new Date().toISOString(),
    },
    retryable: true,
  },
  authExpired: {
    code: ATProtoErrorCode.AUTH_EXPIRED_TOKEN,
    message: "Authentication token has expired. Please log in again.",
    context: {
      uploadId: "demo-upload-10",
      endpoint: "com.atproto.server.getServiceAuth",
      status: 401,
      timestamp: new Date().toISOString(),
    },
    retryable: false,
  },
  forbidden: {
    code: ATProtoErrorCode.CLIENT_FORBIDDEN,
    message:
      "Access forbidden. You don't have permission to perform this action.",
    context: {
      uploadId: "demo-upload-11",
      endpoint: "app.bsky.video.uploadVideo",
      status: 403,
      timestamp: new Date().toISOString(),
    },
    retryable: false,
  },
  validationError: {
    code: ATProtoErrorCode.VALIDATION_INPUT,
    message: "Invalid input: video duration exceeds maximum allowed length",
    context: {
      uploadId: "demo-upload-12",
      endpoint: "app.bsky.video.uploadVideo",
      status: 400,
      timestamp: new Date().toISOString(),
    },
    retryable: false,
  },
};

export const VideoUploadErrorDemo: React.FC = () => {
  const [selectedError, setSelectedError] = useState<string>("networkTimeout");
  const [compact, setCompact] = useState(false);

  const handleRetry = () => {
    alert("Retry clicked!");
  };

  const handleCancel = () => {
    alert("Cancel clicked!");
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="rounded-lg bg-asph-bg-secondary p-6 shadow-md">
        <h1 className="mb-4 text-2xl font-bold text-asph-text-primary">
          Video Upload Error UI Demo
        </h1>
        <p className="mb-6 text-asph-text-secondary">
          This demo showcases the different error states for video uploads with
          actionable recovery options.
        </p>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-asph-text-secondary">
              Error Type
            </label>
            <select
              value={selectedError}
              onChange={(e) => setSelectedError(e.target.value)}
              className="w-full rounded-md border border-asph-border-secondary bg-asph-bg-tertiary px-3 py-2 text-asph-text-primary"
            >
              <optgroup label="Network Errors">
                <option value="networkTimeout">Network Timeout</option>
                <option value="networkConnection">
                  Network Connection Failed
                </option>
              </optgroup>
              <optgroup label="Rate Limiting">
                <option value="rateLimit">Rate Limit Exceeded</option>
              </optgroup>
              <optgroup label="Validation Errors">
                <option value="videoSizeExceeded">Video Size Exceeded</option>
                <option value="videoInvalidFormat">Invalid Video Format</option>
                <option value="validationError">Validation Error</option>
              </optgroup>
              <optgroup label="Processing Errors">
                <option value="videoProcessingFailed">
                  Video Processing Failed
                </option>
                <option value="videoProcessingTimeout">
                  Video Processing Timeout
                </option>
              </optgroup>
              <optgroup label="Server Errors">
                <option value="serverUnavailable">Server Unavailable</option>
                <option value="serverError">Internal Server Error</option>
              </optgroup>
              <optgroup label="Authentication Errors">
                <option value="authExpired">Authentication Expired</option>
                <option value="forbidden">Forbidden Access</option>
              </optgroup>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-asph-text-secondary">
              Layout
            </label>
            <div className="flex h-[42px] items-center gap-4">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  checked={!compact}
                  onChange={() => setCompact(false)}
                  className="h-4 w-4"
                />
                <span className="text-sm text-asph-text-secondary">Full</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  checked={compact}
                  onChange={() => setCompact(true)}
                  className="h-4 w-4"
                />
                <span className="text-sm text-asph-text-secondary">
                  Compact
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="border-t border-asph-border-primary pt-6">
          <h2 className="mb-4 text-lg font-semibold text-asph-text-primary">
            Preview
          </h2>
          <VideoUploadErrorPanel
            error={errorExamples[selectedError]}
            uploadId={errorExamples[selectedError].context.uploadId as string}
            fileName="my-awesome-video.mp4"
            onRetry={
              errorExamples[selectedError].retryable ? handleRetry : undefined
            }
            onCancel={handleCancel}
            compact={compact}
          />
        </div>
      </div>

      <div className="rounded-lg bg-asph-bg-secondary p-6 shadow-md">
        <h2 className="mb-4 text-lg font-semibold text-asph-text-primary">
          Error Details
        </h2>
        <pre className="overflow-auto rounded-lg bg-asph-bg-tertiary p-4 text-xs">
          {JSON.stringify(errorExamples[selectedError], null, 2)}
        </pre>
      </div>

      <div className="rounded-lg bg-blue-50 p-6 dark:bg-blue-900/20">
        <h2 className="mb-3 text-lg font-semibold text-blue-900 dark:text-blue-100">
          Accessibility Features
        </h2>
        <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
          <li className="flex items-start gap-2">
            <span className="text-blue-500">•</span>
            <span>
              <strong>ARIA live regions:</strong> Errors are announced with{" "}
              <code>role="alert"</code> and <code>aria-live="assertive"</code>
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500">•</span>
            <span>
              <strong>Keyboard navigation:</strong> All buttons are focusable
              and have visible focus indicators
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500">•</span>
            <span>
              <strong>Screen reader support:</strong> Icons are marked{" "}
              <code>aria-hidden</code> with descriptive labels on buttons
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500">•</span>
            <span>
              <strong>Visual hierarchy:</strong> Color coding indicates error
              severity (red=error, orange=warning, yellow=info)
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500">•</span>
            <span>
              <strong>Actionable messaging:</strong> Clear recovery steps guide
              users to resolve issues
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
};
