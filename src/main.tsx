// Polyfill requestIdleCallback for Safari/iOS
if (typeof window !== "undefined" && !("requestIdleCallback" in window)) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).requestIdleCallback = (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions,
  ): number => {
    const timeout = options?.timeout ?? 50;
    return window.setTimeout(
      () => {
        callback({
          didTimeout: true,
          timeRemaining: () => 0,
        });
      },
      Math.min(timeout, 1),
    );
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).cancelIdleCallback = (handle: number): void => {
    window.clearTimeout(handle);
  };
}

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./config/amplify"; // Configure Amplify
import "./index.css";
import { setupGlobalErrorHandlers } from "./utils/global-error-handlers";

// Install global handlers for errors that escape React's error boundary tree
// (e.g. errors in async callbacks, event handlers, setTimeout, third-party scripts)
setupGlobalErrorHandlers();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
