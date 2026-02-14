import { useRouter } from "expo-router";
import React, { Component, ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { captureException } from "../utils/error-reporting";


import { createLogger } from '../utils/logger';

const logger = createLogger('Errorboundaryx');
interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string;
}

/**
 * Generate a short error ID for reference in bug reports
 */
function generateErrorId(): string {
  return `err-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
}

// Error boundary requires class component
class ErrorBoundaryClass extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorId: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error, errorId: generateErrorId() };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log the error for debugging with error ID
    logger.error(`Error ID: ${this.state.errorId}`,
      error,
      errorInfo.componentStack,
    );

    // Report to Sentry
    captureException(error, {
      extra: {
        errorId: this.state.errorId,
        componentStack: errorInfo.componentStack,
      },
    });
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorId: "" });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          errorId={this.state.errorId}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

// Functional component for the fallback UI that can use hooks
function ErrorFallback({
  error,
  errorId,
  onReset,
}: {
  error: Error | null;
  errorId: string;
  onReset: () => void;
}) {
  const router = useRouter();

  const handleGoHome = () => {
    onReset();
    router.replace("/(app)/(tabs)/(home)");
  };

  // Check if we're in development mode
  const globalAny = global as unknown as { __DEV__?: boolean };
  const isDevelopment =
    typeof globalAny !== "undefined" && globalAny.__DEV__ !== undefined
      ? globalAny.__DEV__
      : false;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>
          We encountered an unexpected error. You can try again or return to the
          home screen.
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
            onPress={onReset}
          >
            <Text style={styles.primaryButtonText}>Try Again</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={handleGoHome}
          >
            <Text style={styles.secondaryButtonText}>Go Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
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
    color: "#FFFFFF",
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    color: "#AAAAAA",
    marginBottom: 12,
    textAlign: "center",
    lineHeight: 22,
  },
  errorId: {
    fontSize: 12,
    color: "#666666",
    marginBottom: 24,
    textAlign: "center",
    fontFamily: "monospace",
  },
  errorDetails: {
    backgroundColor: "#1A1A1A",
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#FF4444",
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FF4444",
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 13,
    color: "#FFFFFF",
    marginBottom: 8,
    fontFamily: "monospace",
  },
  errorStack: {
    fontSize: 11,
    color: "#AAAAAA",
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
    backgroundColor: "#1DA1F2",
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#333333",
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#AAAAAA",
  },
});

export default ErrorBoundaryClass;
