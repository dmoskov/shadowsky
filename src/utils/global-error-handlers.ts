/**
 * Global error handlers for catching errors that escape React's error boundary tree.
 *
 * React error boundaries only catch errors during rendering, lifecycle methods, and
 * constructors. They do NOT catch errors in:
 * - Event handlers (onClick, onSubmit, etc.)
 * - Asynchronous code (setTimeout, requestAnimationFrame, promises)
 * - Server-side rendering
 * - Errors thrown in the error boundary itself
 *
 * This module installs window-level handlers for these cases to ensure no error
 * goes completely untracked.
 */

import { getErrorMonitor } from "./error-monitoring";
import { createLogger } from "./logger";

const logger = createLogger("GlobalErrors");

/** Tracks whether handlers have already been installed (prevents double-install) */
let installed = false;

/**
 * Install global `error` and `unhandledrejection` event listeners.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function setupGlobalErrorHandlers(): void {
  if (installed) return;
  installed = true;

  // Catch synchronous errors that bubble to the window (e.g. errors in
  // setTimeout callbacks, non-React event listeners, third-party scripts).
  window.addEventListener("error", (event: ErrorEvent) => {
    // Ignore errors from browser extensions or cross-origin scripts
    if (
      event.filename &&
      !event.filename.startsWith(window.location.origin) &&
      !event.filename.startsWith("/")
    ) {
      return;
    }

    const error =
      event.error instanceof Error ? event.error : new Error(event.message);

    logger.error("Unhandled error:", error.message);

    getErrorMonitor().recordError(error, {
      operation: "window.onerror",
      component: "global",
      category: "unknown",
      severity: "error",
      metadata: {
        filename: event.filename || "unknown",
        lineno: event.lineno || 0,
        colno: event.colno || 0,
      },
    });
  });

  // Catch unhandled promise rejections (e.g. forgotten .catch(), async/await
  // without try/catch in event handlers).
  window.addEventListener(
    "unhandledrejection",
    (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const error =
        reason instanceof Error ? reason : new Error(String(reason));

      logger.error("Unhandled promise rejection:", error.message);

      getErrorMonitor().recordError(error, {
        operation: "unhandledrejection",
        component: "global",
        category: "unknown",
        severity: "error",
        metadata: {
          type: reason?.constructor?.name || "unknown",
        },
      });
    },
  );
}
