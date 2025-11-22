import { AlertTriangle, RefreshCw } from "lucide-react";
import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    this.setState({
      errorInfo,
    });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex h-full flex-col items-center justify-center bg-bsky-bg-primary p-8">
          <div className="w-full max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 shadow-lg dark:border-red-800 dark:bg-red-900/20">
            <div className="mb-4 flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 flex-shrink-0 text-red-600 dark:text-red-400" />
              <div className="flex-1">
                <h3 className="mb-2 text-lg font-semibold text-red-900 dark:text-red-200">
                  {this.props.componentName
                    ? `${this.props.componentName} Error`
                    : "Something went wrong"}
                </h3>
                <p className="mb-3 text-sm text-red-800 dark:text-red-300">
                  {this.state.error?.message ||
                    "An unexpected error occurred. Other parts of the app should continue to work."}
                </p>

                <details className="mb-4 rounded-lg bg-red-100 p-3 dark:bg-red-950/50">
                  <summary className="cursor-pointer text-sm font-medium text-red-900 dark:text-red-200">
                    Technical Details
                  </summary>
                  <div className="mt-2 space-y-2">
                    <div className="rounded bg-red-200 p-2 dark:bg-red-900/30">
                      <p className="break-words font-mono text-xs text-red-900 dark:text-red-200">
                        {this.state.error?.toString()}
                      </p>
                    </div>
                    {this.state.errorInfo && (
                      <div className="rounded bg-red-200 p-2 dark:bg-red-900/30">
                        <pre className="max-h-32 overflow-auto text-xs text-red-900 dark:text-red-200">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>

                <button
                  onClick={this.handleReset}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition-colors hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </button>
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
