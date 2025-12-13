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
import pkg from "../package.json";

// Aggressive cache clearing on version change
const CURRENT_VERSION = pkg.version;
const VERSION_KEY = "app_version";

async function clearAllCaches() {
  console.log("[Cache Clear] Clearing all caches...");

  // Unregister all service workers
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((reg) => reg.unregister()));
    console.log(`[Cache Clear] Unregistered ${registrations.length} service worker(s)`);
  }

  // Clear all caches
  if ("caches" in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
    console.log(`[Cache Clear] Cleared ${cacheNames.length} cache(s)`);
  }
}

// Check version and clear caches if needed
const storedVersion = localStorage.getItem(VERSION_KEY);
if (storedVersion !== CURRENT_VERSION) {
  console.log(`[Version Check] Version changed: ${storedVersion} -> ${CURRENT_VERSION}`);

  // Clear caches and reload (only once)
  const isReloading = sessionStorage.getItem("cache_clear_reload");
  if (!isReloading) {
    sessionStorage.setItem("cache_clear_reload", "true");
    clearAllCaches().then(() => {
      localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
      console.log("[Cache Clear] Reloading page with fresh caches...");
      window.location.reload();
    });
  } else {
    // Second load after clearing - proceed normally
    sessionStorage.removeItem("cache_clear_reload");
    localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
  }
} else {
  console.log(`[Version Check] Version unchanged: ${CURRENT_VERSION}`);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
