import { RefreshCw } from "lucide-react";
import { Component, ErrorInfo, ReactNode } from "react";
import { getErrorMonitor } from "../../utils/error-monitoring";

interface Props {
  children: ReactNode;
  /** Name used in error monitoring and optional UI display */
  componentName: string;
  /** What to render when the boundary catches an error. Defaults to a minimal retry bar. */
  fallback?: ReactNode;
  /** Called when an error is caught, after recording to the monitor. */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** If true, render nothing on error instead of the default fallback. */
  silent?: boolean;
}

interface State {
  hasError: boolean;
}

/**
 * Lightweight error boundary designed for non-critical UI sections
 * (header, sidebar, tab bar, individual feed cards, etc.).
 *
 * Unlike the full-page ErrorBoundary, this renders a compact inline
 * fallback so the rest of the application remains usable.
 */
export class InlineErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    getErrorMonitor().recordError(error, {
      operation: "render",
      component: this.props.componentName,
      category: "ui",
      severity: "warning",
      metadata: {
        componentStack: (errorInfo.componentStack || "").slice(0, 500),
      },
    });

    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.silent) {
      return null;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <div
        className="flex items-center justify-center gap-2 p-2 text-xs"
        style={{ color: "var(--asph-text-tertiary)" }}
        role="alert"
      >
        <span>{this.props.componentName} failed to load.</span>
        <button
          onClick={this.handleRetry}
          className="touch-target-sm inline-flex items-center gap-1 rounded px-2 py-1 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
          aria-label={`Retry loading ${this.props.componentName}`}
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
          Retry
        </button>
      </div>
    );
  }
}
