/**
 * Vite build configuration.
 * Extracted to isolate build optimization changes from other config concerns.
 */

import type { BuildOptions } from "vite";
import { getManualChunk, optimizeModulePreload } from "./chunking.js";

/**
 * Build configuration for production.
 */
export const buildConfig: BuildOptions = {
  // Optimize modulepreload - don't preload OAuth chunk since it's conditionally loaded
  // based on whether user has existing OAuth session (checked via IndexedDB)
  modulePreload: {
    resolveDependencies: optimizeModulePreload,
  },
  rollupOptions: {
    output: {
      manualChunks: getManualChunk,
    },
  },
  // Target modern browsers for smaller bundle
  target: "es2020",
  // Increase warning limit since we have route splitting
  chunkSizeWarningLimit: 300,
};
