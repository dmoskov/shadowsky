import { ErrorInfo } from "react";

export const useErrorTracking = () => {
  const logError = (error: Error, errorInfo: ErrorInfo, context?: string) => {
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

    try {
      const errors = JSON.parse(localStorage.getItem("app_errors") || "[]");
      errors.push(errorData);
      if (errors.length > 50) {
        errors.shift();
      }
      localStorage.setItem("app_errors", JSON.stringify(errors));
    } catch (e) {
      console.error("Failed to store error:", e);
    }
  };

  return { logError };
};
