import React, { Component, ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as Updates from "expo-updates";
import { captureException } from "../utils/error-reporting";
import { colors } from "../constants/theme";

import { createLogger } from "../utils/logger";

const logger = createLogger("ErrorBoundary");

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string;
}

function generateErrorId(): string {
  return `err-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
}

class ErrorBoundaryClass extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorId: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorId: generateErrorId() };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    logger.error(
      `Error ID: ${this.state.errorId}`,
      error,
      errorInfo.componentStack,
    );

    captureException(error, {
      extra: {
        errorId: this.state.errorId,
        componentStack: errorInfo.componentStack,
      },
    });
  }

  handleReload = async (): Promise<void> => {
    try {
      await Updates.reloadAsync();
    } catch {
      // reloadAsync fails in dev builds — fall back to resetting state
      this.setState({ hasError: false, error: null, errorId: "" });
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          errorId={this.state.errorId}
          onReload={this.handleReload}
        />
      );
    }

    return this.props.children;
  }
}

function ErrorFallback({
  error,
  errorId,
  onReload,
}: {
  error: Error | null;
  errorId: string;
  onReload: () => void;
}) {
  const isDevelopment = __DEV__;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>
          We encountered an unexpected error. Tap below to restart the app.
        </Text>

        {errorId && <Text style={styles.errorId}>Error ID: {errorId}</Text>}

        {isDevelopment && error && (
          <View style={styles.errorDetails}>
            <Text style={styles.errorTitle}>Error Details (Dev Mode):</Text>
            <Text style={styles.errorMessage}>{error.message}</Text>
            {error.stack && (
              <Text style={styles.errorStack} numberOfLines={10}>
                {error.stack}
              </Text>
            )}
          </View>
        )}

        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={onReload}
          >
            <Text style={styles.primaryButtonText}>Restart App</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.borderDark,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  content: {
    maxWidth: 500,
    width: "100%",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 12,
    textAlign: "center",
    lineHeight: 22,
  },
  errorId: {
    fontSize: 12,
    color: colors.textTertiary,
    marginBottom: 24,
    textAlign: "center",
    fontFamily: "monospace",
  },
  errorDetails: {
    backgroundColor: colors.errorBackground,
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.errorBorder,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.errorBorder,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 13,
    color: colors.text,
    marginBottom: 8,
    fontFamily: "monospace",
  },
  errorStack: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: "monospace",
    lineHeight: 16,
  },
  buttons: {
    gap: 12,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
  },
  primaryButton: {
    backgroundColor: colors.info,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textSecondary,
  },
});

export default ErrorBoundaryClass;
