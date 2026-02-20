import React, { Component, ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { captureException } from "../../utils/error-reporting";
import { createLogger } from "../../utils/logger";

const logger = createLogger("InlineErrorBoundary");

interface InlineErrorBoundaryProps {
  /** Custom fallback UI to render on error. If not provided and not silent, shows a default error message. */
  fallback?: ReactNode;
  /** Callback when an error is caught. Useful for reporting to analytics. */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** If true, render nothing on error (the broken component simply disappears). */
  silent?: boolean;
  /** Optional context label for error reports (e.g. "PostCard", "ImageEmbed"). */
  context?: string;
  /** Optional retry callback — when provided, shows a "Try again" button in the default fallback. */
  onRetry?: () => void;
  children: ReactNode;
}

interface InlineErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Lightweight error boundary that isolates render failures to a single component.
 *
 * Unlike the root ErrorBoundary (which shows a full-screen crash page), this component
 * catches errors in its children and either:
 *  - renders nothing (silent mode — for feed items, notifications)
 *  - renders a compact fallback (for embeds, profile sections)
 *
 * All caught errors are still reported to Sentry.
 */
class InlineErrorBoundary extends Component<
  InlineErrorBoundaryProps,
  InlineErrorBoundaryState
> {
  constructor(props: InlineErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): InlineErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    const context = this.props.context || "unknown";
    logger.error(`[${context}] Inline error boundary caught:`, error);

    captureException(error, {
      extra: {
        boundaryContext: context,
        componentStack: errorInfo.componentStack,
      },
    });

    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    // Silent mode: render nothing
    if (this.props.silent) {
      return null;
    }

    // Custom fallback provided
    if (this.props.fallback !== undefined) {
      return this.props.fallback;
    }

    // Default compact fallback
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Content unavailable</Text>
        {this.props.onRetry && (
          <TouchableOpacity
            onPress={this.handleRetry}
            style={styles.retryButton}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.6,
  },
  message: {
    fontSize: 13,
    color: "#8899a6",
  },
  retryButton: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#38444d",
  },
  retryText: {
    fontSize: 12,
    color: "#8899a6",
  },
});

export { InlineErrorBoundary };
export default InlineErrorBoundary;
