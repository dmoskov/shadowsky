import {
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  HelpCircle,
  LifeBuoy,
  RefreshCw,
  WifiOff,
} from "lucide-react";
import { Component, ErrorInfo, ReactNode } from "react";
import { getErrorMonitor } from "../utils/error-monitoring";
import {
  toUserFriendlyError,
  type UserFriendlyError,
} from "../utils/user-friendly-errors";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Called when the user clicks "Try Again" — use this to reset external state
   *  (e.g. React Query's QueryErrorResetBoundary). */
  onReset?: () => void;
  componentName?: string;
  showTechnicalDetails?: boolean;
  /** Show go back button (uses browser history) */
  showGoBack?: boolean;
  /** Show report issue link */
  showReportLink?: boolean;
  /** Custom URL for reporting issues */
  reportUrl?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
  errorId: string;
}

/**
 * Generate a short error ID for reference in bug reports
 */
function generateErrorId(): string {
  return `err-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
}

/**
 * Build a GitHub issue URL with pre-filled error information
 */
function buildReportUrl(
  baseUrl: string,
  errorId: string,
  errorMessage: string,
  componentName?: string,
): string {
  const title = encodeURIComponent(
    `[Bug] Error in ${componentName || "Application"}: ${errorMessage.substring(0, 50)}`,
  );
  const body = encodeURIComponent(
    `## Error Details
- **Error ID:** \`${errorId}\`
- **Component:** ${componentName || "Unknown"}
- **Error:** ${errorMessage}
- **URL:** ${window.location.href}
- **User Agent:** ${navigator.userAgent}
- **Timestamp:** ${new Date().toISOString()}

## Steps to Reproduce
1.

## Expected Behavior


## Additional Context
`,
  );
  return `${baseUrl}?title=${title}&body=${body}`;
}

/**
 * Get an appropriate icon for the error severity
 */
function getErrorIcon(severity: UserFriendlyError["severity"]) {
  switch (severity) {
    case "warning":
      return WifiOff;
    case "info":
      return HelpCircle;
    default:
      return AlertCircle;
  }
}

/**
 * Get severity-based styles
 */
function getSeverityStyles(severity: UserFriendlyError["severity"]) {
  switch (severity) {
    case "warning":
      return {
        container:
          "border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20",
        icon: "text-orange-600 dark:text-orange-400",
        title: "text-orange-900 dark:text-orange-200",
        text: "text-orange-800 dark:text-orange-300",
        button:
          "bg-orange-600 hover:bg-orange-700 dark:bg-orange-700 dark:hover:bg-orange-800",
        details: "bg-orange-100 dark:bg-orange-950/50",
        detailsInner: "bg-orange-200 dark:bg-orange-900/30",
      };
    case "info":
      return {
        container:
          "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20",
        icon: "text-blue-600 dark:text-blue-400",
        title: "text-blue-900 dark:text-blue-200",
        text: "text-blue-800 dark:text-blue-300",
        button:
          "bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800",
        details: "bg-blue-100 dark:bg-blue-950/50",
        detailsInner: "bg-blue-200 dark:bg-blue-900/30",
      };
    default:
      return {
        container:
          "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20",
        icon: "text-red-600 dark:text-red-400",
        title: "text-red-900 dark:text-red-200",
        text: "text-red-800 dark:text-red-300",
        button:
          "bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800",
        details: "bg-red-100 dark:bg-red-950/50",
        detailsInner: "bg-red-200 dark:bg-red-900/30",
      };
  }
}

/** Default GitHub issues URL for Asphodel */
const DEFAULT_REPORT_URL = "https://github.com/user/shadowsky/issues/new";

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      errorId: "",
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: generateErrorId(),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({
      errorInfo,
    });

    // Record error to monitoring system
    getErrorMonitor().recordError(error, {
      operation: "render",
      component: this.props.componentName || "ErrorBoundary",
      category: "ui",
      severity: "critical",
      metadata: {
        componentStack: errorInfo.componentStack || "unknown",
        errorId: this.state.errorId,
      },
    });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = (): void => {
    this.props.onReset?.();
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      errorId: "",
    });
  };

  handleRefresh = (): void => {
    window.location.reload();
  };

  handleGoBack = (): void => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      // Fallback to home if no history
      window.location.href = "/";
    }
  };

  toggleDetails = (): void => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const {
        showGoBack = true,
        showReportLink = true,
        reportUrl,
      } = this.props;
      const friendlyError = toUserFriendlyError(this.state.error, {
        includeDetails: this.props.showTechnicalDetails,
      });
      const Icon = getErrorIcon(friendlyError.severity);
      const styles = getSeverityStyles(friendlyError.severity);
      const errorMessage = this.state.error?.message || "Unknown error";

      return (
        <div
          className="flex h-full min-h-[200px] flex-col items-center justify-center p-8"
          style={{ backgroundColor: "var(--asph-bg-primary)" }}
          role="alert"
          aria-live="assertive"
          aria-labelledby="error-title"
          aria-describedby="error-description"
        >
          <div
            className={`w-full max-w-md rounded-xl border p-6 shadow-lg ${styles.container}`}
          >
            <div className="flex flex-col items-center text-center">
              <div className={`mb-4 rounded-full p-3 ${styles.details}`}>
                <Icon className={`h-8 w-8 ${styles.icon}`} aria-hidden="true" />
              </div>

              <h3
                id="error-title"
                className={`mb-2 text-lg font-semibold ${styles.title}`}
              >
                {friendlyError.title}
              </h3>

              <p
                id="error-description"
                className={`mb-4 text-sm ${styles.text}`}
              >
                {friendlyError.message}
              </p>

              {this.props.componentName && (
                <p className={`mb-2 text-xs ${styles.text} opacity-75`}>
                  Affected area: {this.props.componentName}
                </p>
              )}

              {this.state.errorId && (
                <p className={`mb-4 text-xs ${styles.text} opacity-60`}>
                  Error ID:{" "}
                  <code className="font-mono">{this.state.errorId}</code>
                </p>
              )}

              <div className="flex w-full flex-col gap-2">
                {friendlyError.retryable && (
                  <button
                    onClick={this.handleReset}
                    className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-medium text-white transition-colors ${styles.button}`}
                    aria-label="Try again to load content"
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    Try Again
                  </button>
                )}

                <div className="flex w-full gap-2">
                  {showGoBack && (
                    <button
                      onClick={this.handleGoBack}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                      aria-label="Go back to previous page"
                    >
                      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                      Go Back
                    </button>
                  )}

                  <button
                    onClick={this.handleRefresh}
                    className={`flex ${showGoBack ? "flex-1" : "w-full"} items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700`}
                    aria-label="Refresh the page"
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    Refresh
                  </button>
                </div>
              </div>

              <div className="mt-4 flex w-full flex-col gap-2">
                {(this.props.showTechnicalDetails ||
                  this.state.error?.message) && (
                  <>
                    <button
                      onClick={this.toggleDetails}
                      className={`flex w-full items-center justify-center gap-1 text-xs ${styles.text} opacity-75 hover:opacity-100`}
                      aria-expanded={this.state.showDetails}
                      aria-controls="error-details"
                    >
                      <LifeBuoy className="h-3 w-3" aria-hidden="true" />
                      {this.state.showDetails
                        ? "Hide technical details"
                        : "Show technical details"}
                    </button>

                    {this.state.showDetails && (
                      <div
                        id="error-details"
                        className={`mt-2 rounded-lg p-3 ${styles.details}`}
                      >
                        <div className={`rounded p-2 ${styles.detailsInner}`}>
                          <p
                            className={`break-words font-mono text-xs ${styles.title}`}
                          >
                            {errorMessage}
                          </p>
                        </div>
                        {this.state.errorInfo && (
                          <div
                            className={`mt-2 rounded p-2 ${styles.detailsInner}`}
                          >
                            <pre
                              className={`max-h-24 overflow-auto text-xs ${styles.title}`}
                            >
                              {this.state.errorInfo.componentStack}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {showReportLink && (
                  <a
                    href={buildReportUrl(
                      reportUrl || DEFAULT_REPORT_URL,
                      this.state.errorId,
                      errorMessage,
                      this.props.componentName,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center justify-center gap-1 text-xs ${styles.text} opacity-75 hover:opacity-100`}
                  >
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    Report this issue
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
