import { ErrorInfo } from "react";
import { getVersionedApiUrl } from "../config/amplify";

export const useErrorTracking = () => {
  const logError = async (
    error: Error,
    errorInfo: ErrorInfo,
    context?: string,
  ) => {
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      context: context || "unknown",
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    console.error("Error tracked:", errorData);

    // Always save to localStorage as backup
    try {
      const errors = JSON.parse(localStorage.getItem("app_errors") || "[]");
      errors.push(errorData);
      if (errors.length > 50) {
        errors.shift();
      }
      localStorage.setItem("app_errors", JSON.stringify(errors));
    } catch (e) {
      console.error("Failed to store error in localStorage:", e);
    }

    // Try to send to API server (silent fail if offline or API unavailable)
    try {
      const apiUrl = getVersionedApiUrl();
      const response = await fetch(`${apiUrl}/log-error`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(errorData),
        // Don't wait forever for logging to complete
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        console.warn(
          "Failed to send error to API:",
          response.status,
          response.statusText,
        );
      }
    } catch (apiError) {
      // Silent fail - don't break the app if logging fails
      // Error is already stored in localStorage
      if (apiError instanceof Error && apiError.name !== "AbortError") {
        console.warn("Error logging API call failed:", apiError.message);
      }
    }
  };

  return { logError };
};
