import { AlertTriangle, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  componentName?: string;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isRetrying: boolean;
  retryCount: number;
  isOnline: boolean;
}

/**
 * Checks if an error is a chunk load failure
 */
function isChunkLoadError(error: Error | null): boolean {
  if (!error) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("loading chunk") ||
    message.includes("loading css chunk") ||
    message.includes("failed to fetch dynamically imported module") ||
    message.includes("dynamically imported module") ||
    message.includes("importing a module script failed") ||
    message.includes("unable to preload css")
  );
}

/**
 * Error boundary specifically for handling lazy-loaded chunk failures.
 * Provides a user-friendly UI with retry functionality.
 */
export class ChunkLoadErrorBoundary extends Component<Props, State> {
  private onlineListener: (() => void) | null = null;
  private offlineListener: (() => void) | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      isRetrying: false,
      retryCount: 0,
      isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error for debugging
    console.error("Chunk load error:", error, errorInfo);
  }

  componentDidMount(): void {
    this.setupOnlineListeners();
  }

  componentWillUnmount(): void {
    this.cleanupOnlineListeners();
  }

  setupOnlineListeners = (): void => {
    this.onlineListener = () => {
      this.setState({ isOnline: true });
      // Auto-retry when coming back online if we had an error
      if (this.state.hasError && this.state.retryCount < 3) {
        this.handleRetry();
      }
    };
    this.offlineListener = () => {
      this.setState({ isOnline: false });
    };

    window.addEventListener("online", this.onlineListener);
    window.addEventListener("offline", this.offlineListener);
  };

  cleanupOnlineListeners = (): void => {
    if (this.onlineListener) {
      window.removeEventListener("online", this.onlineListener);
    }
    if (this.offlineListener) {
      window.removeEventListener("offline", this.offlineListener);
    }
  };

  handleRetry = async (): Promise<void> => {
    this.setState({ isRetrying: true });

    // Small delay to show loading state
    await new Promise((resolve) => setTimeout(resolve, 500));

    this.setState((prev) => ({
      hasError: false,
      error: null,
      isRetrying: false,
      retryCount: prev.retryCount + 1,
    }));

    // Trigger the retry callback if provided
    this.props.onRetry?.();
  };

  handleRefresh = (): void => {
    // Clear the session storage flag before refreshing
    window.sessionStorage.removeItem("page-has-been-force-refreshed");
    window.location.reload();
  };

  render(): ReactNode {
    const { hasError, error, isRetrying, retryCount, isOnline } = this.state;
    const { children, componentName } = this.props;

    if (!hasError) {
      return children;
    }

    const isChunkError = isChunkLoadError(error);
    const canRetry = retryCount < 3 && isOnline;

    return (
      <div
        className="flex h-full min-h-[200px] w-full items-center justify-center p-4"
        role="alert"
        aria-live="assertive"
      >
        <div
          className="w-full max-w-sm rounded-xl border p-6 shadow-lg"
          style={{
            backgroundColor: "var(--asph-bg-secondary)",
            borderColor: "var(--asph-border)",
          }}
        >
          <div className="flex flex-col items-center text-center">
            {/* Icon */}
            <div
              className="mb-4 rounded-full p-3"
              style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
            >
              {!isOnline ? (
                <WifiOff
                  className="h-8 w-8"
                  style={{ color: "var(--asph-warning)" }}
                  aria-hidden="true"
                />
              ) : (
                <AlertTriangle
                  className="h-8 w-8"
                  style={{ color: "var(--asph-warning)" }}
                  aria-hidden="true"
                />
              )}
            </div>

            {/* Title */}
            <h3
              className="mb-2 text-lg font-semibold"
              style={{ color: "var(--asph-text-primary)" }}
            >
              {!isOnline
                ? "You're offline"
                : isChunkError
                  ? "Loading failed"
                  : "Something went wrong"}
            </h3>

            {/* Message */}
            <p
              className="mb-4 text-sm"
              style={{ color: "var(--asph-text-secondary)" }}
            >
              {!isOnline
                ? "Check your internet connection and try again."
                : isChunkError
                  ? "We couldn't load this content. This usually happens after an update."
                  : "An error occurred while loading this content."}
            </p>

            {/* Component name hint */}
            {componentName && (
              <p
                className="mb-4 text-xs"
                style={{ color: "var(--asph-text-tertiary)" }}
              >
                Affected area: {componentName}
              </p>
            )}

            {/* Retry info */}
            {retryCount > 0 && (
              <p
                className="mb-4 text-xs"
                style={{ color: "var(--asph-text-tertiary)" }}
              >
                Retry attempt {retryCount} of 3
              </p>
            )}

            {/* Action buttons */}
            <div className="flex w-full flex-col gap-2">
              {/* Retry button */}
              {canRetry && (
                <button
                  onClick={this.handleRetry}
                  disabled={isRetrying || !isOnline}
                  className="touch-target-sm flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-medium text-white transition-colors disabled:opacity-50"
                  style={{
                    backgroundColor: "var(--asph-primary)",
                  }}
                  aria-busy={isRetrying}
                >
                  {isRetrying ? (
                    <>
                      <RefreshCw
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                      <span>Retrying...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" aria-hidden="true" />
                      <span>Try Again</span>
                    </>
                  )}
                </button>
              )}

              {/* Refresh page button */}
              <button
                onClick={this.handleRefresh}
                className="touch-target-sm flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-medium transition-colors"
                style={{
                  backgroundColor: "var(--asph-bg-tertiary)",
                  color: "var(--asph-text-primary)",
                }}
              >
                <Wifi className="h-4 w-4" aria-hidden="true" />
                <span>Refresh Page</span>
              </button>
            </div>

            {/* Online status indicator */}
            {!isOnline && (
              <div
                className="mt-4 flex items-center gap-2 text-xs"
                style={{ color: "var(--asph-text-tertiary)" }}
              >
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: "var(--asph-error)" }}
                  aria-hidden="true"
                />
                <span>Waiting for connection...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}

export default ChunkLoadErrorBoundary;
