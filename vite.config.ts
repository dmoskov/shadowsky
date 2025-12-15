/**
 * Vite Configuration
 *
 * This is the main Vite configuration file. It has been refactored to reduce churn
 * by extracting specific concerns into separate modules:
 *
 * - config/vite/plugins.ts - Custom Vite plugins
 * - config/vite/build.ts - Build configuration and optimization
 * - config/vite/chunking.ts - Manual chunking strategy
 * - config/vite/server.ts - Dev server and proxy configuration
 *
 * This structure allows changes to specific areas (e.g., adding a new proxy, adjusting
 * chunk strategy, tweaking plugins) without modifying this main config file.
 */

import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import { buildConfig } from "./config/vite/build.js";
import {
  bundleAnalyzerPlugin,
  deferCssPlugin,
  versionCacheBustPlugin,
} from "./config/vite/plugins.js";
import { previewConfig, serverConfig } from "./config/vite/server.js";

// https://vitejs.dev/config/
export default defineConfig({
  base: "/",
  build: buildConfig,
  plugins: [
    react(),
    deferCssPlugin(),
    versionCacheBustPlugin(),
    bundleAnalyzerPlugin(),
  ].filter(Boolean),
  optimizeDeps: {
    exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
  },
  resolve: {
    alias: {
      "@bsky/shared": path.resolve(__dirname, "./src/shared/index.ts"),
    },
  },
  server: serverConfig,
  preview: previewConfig,
  // Handle SPA routing - return index.html for all routes
  appType: "spa",
});
