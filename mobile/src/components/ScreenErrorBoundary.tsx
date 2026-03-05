import React, { Component, ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { captureException } from "../utils/error-reporting";
import { createLogger } from "../utils/logger";
import { colors } from "../constants/theme";
import {fontSize} from '../utils/typography';

const logger = createLogger("ScreenErrorBoundary");

interface ScreenErrorBoundaryProps {
  children: ReactNode;
  screenName?: string;
}

interface ScreenErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Screen-level error boundary for tab layouts and major screen groups.
 *
 * Sits between the root ErrorBoundary (full app crash) and InlineErrorBoundary
 * (individual components). When a tab's content throws during render, this
 * boundary catches it so the user can still navigate to other tabs. The fallback
 * shows a friendly message with a retry button that resets the error state.
 */
class ScreenErrorBoundary extends Component<
  ScreenErrorBoundaryProps,
  ScreenErrorBoundaryState
> {
  constructor(props: ScreenErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ScreenErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    const screenName = this.props.screenName || "Unknown";
    logger.error(`[${screenName}] Screen error boundary caught:`, error);

    captureException(error, {
      extra: {
        screenName,
        componentStack: errorInfo.componentStack,
      },
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.icon}>⚠</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            This screen encountered an error. You can try again or navigate to
            another tab.
          </Text>

          {__DEV__ && this.state.error && (
            <View style={styles.errorDetails}>
              <Text style={styles.errorMessage} numberOfLines={5}>
                {this.state.error.message}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.retryButton}
            onPress={this.handleRetry}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  content: {
    maxWidth: 320,
    alignItems: "center",
  },
  icon: {
    fontSize: fontSize.largeTitle,
    marginBottom: 16,
  },
  title: {
    fontSize: fontSize.title3,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 8,
    textAlign: "center",
  },
  message: {
    fontSize: fontSize.subheadline,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  errorDetails: {
    backgroundColor: colors.errorBackground,
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    width: "100%",
  },
  errorMessage: {
    fontSize: fontSize.caption1,
    color: colors.text,
    fontFamily: "monospace",
  },
  retryButton: {
    backgroundColor: colors.info,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: fontSize.callout,
    fontWeight: "600",
    color: colors.text,
  },
});

export { ScreenErrorBoundary };
export default ScreenErrorBoundary;
