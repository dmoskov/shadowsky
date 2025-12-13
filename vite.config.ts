import react from "@vitejs/plugin-react";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import pkg from "./package.json" with { type: "json" };

/**
 * Vite plugin to defer non-critical CSS loading.
 * Converts stylesheet links to use the media="print" trick for async loading,
 * which improves First Contentful Paint on slow connections.
 */
function deferCssPlugin(): Plugin {
  return {
    name: "defer-css",
    enforce: "post",
    transformIndexHtml(html) {
      // Convert: <link rel="stylesheet" crossorigin href="/assets/index-xxx.css">
      // To: <link rel="stylesheet" href="/assets/index-xxx.css" media="print" onload="this.media='all'">
      // Plus a noscript fallback
      return html.replace(
        /<link rel="stylesheet" crossorigin href="(\/assets\/[^"]+\.css)">/g,
        `<link rel="stylesheet" href="$1" media="print" onload="this.media='all'">
    <noscript><link rel="stylesheet" href="$1"></noscript>`,
      );
    },
  };
}

/**
 * Vite plugin to add version query parameter to main entry point.
 * This forces cache invalidation when the app version changes, bypassing
 * service worker and CDN caches that may serve stale bundles.
 *
 * NOTE: Only runs in production builds. In dev mode, adding query params
 * to .tsx files causes esbuild loader errors.
 */
function versionCacheBustPlugin(): Plugin {
  const version = pkg.version;
  return {
    name: "version-cache-bust",
    enforce: "post",
    apply: "build", // Only run during production builds, not dev server
    transformIndexHtml(html) {
      // Add version query param to the main module script (production only)
      // Prod: <script type="module" crossorigin src="/assets/index-xxx.js"></script>
      return html.replace(
        /<script type="module" crossorigin src="(\/assets\/[^"]+\.js)"><\/script>/g,
        `<script type="module" crossorigin src="$1?v=${version}"></script>`,
      );
    },
  };
}

// Enable bundle analysis when ANALYZE=true is set
const analyze = process.env.ANALYZE === "true";

// https://vitejs.dev/config/
export default defineConfig({
  base: "/",
  build: {
    // Optimize modulepreload - don't preload OAuth chunk since it's conditionally loaded
    // based on whether user has existing OAuth session (checked via IndexedDB)
    modulePreload: {
      resolveDependencies: (_filename, deps) => {
        // Filter out chunks that aren't needed for initial render
        // OAuth: only loaded when user initiates OAuth login
        // Amplify: only needed for API calls after authentication
        return deps.filter(
          (dep) =>
            !dep.includes("vendor-atproto-oauth") &&
            !dep.includes("vendor-amplify"),
        );
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Core React - always needed first
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/")
          ) {
            return "vendor-react-core";
          }
          // React Router - needed for navigation
          if (id.includes("node_modules/react-router")) {
            return "vendor-react-router";
          }
          // AT Protocol core types and basic client
          if (id.includes("node_modules/@atproto/api")) {
            return "vendor-atproto";
          }
          // OAuth client - separate chunk, loaded on demand
          if (id.includes("node_modules/@atproto/oauth-client-browser")) {
            return "vendor-atproto-oauth";
          }
          // AWS Amplify - only needed for certain features
          if (
            id.includes("node_modules/aws-amplify") ||
            id.includes("node_modules/@aws-amplify")
          ) {
            return "vendor-amplify";
          }
          // Date utilities - used across the app
          if (id.includes("node_modules/date-fns")) {
            return "vendor-date-fns";
          }
          // Query management
          if (id.includes("node_modules/@tanstack/react-query")) {
            return "vendor-query";
          }
          // HLS.js is dynamically imported - let Vite handle its chunking
          // Database utilities
          if (id.includes("node_modules/idb")) {
            return "vendor-idb";
          }
          // Sanitization
          if (id.includes("node_modules/dompurify")) {
            return "vendor-security";
          }
          // Lucide icons - tree shaken but still grouped
          if (id.includes("node_modules/lucide-react")) {
            return "vendor-icons";
          }
        },
      },
    },
    // Target modern browsers for smaller bundle
    target: "es2020",
    // Increase warning limit since we have route splitting
    chunkSizeWarningLimit: 300,
  },
  plugins: [
    react(),
    deferCssPlugin(),
    versionCacheBustPlugin(),
    // Bundle analysis - generates bundle-stats.html when ANALYZE=true
    analyze &&
      visualizer({
        filename: "bundle-stats.html",
        open: false,
        gzipSize: true,
        brotliSize: true,
        template: "treemap", // treemap, sunburst, or network
      }),
  ].filter(Boolean),
  optimizeDeps: {
    exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
  },
  resolve: {
    alias: {
      "@bsky/shared": path.resolve(__dirname, "./src/shared/index.ts"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5174,
    // Configure the dev server to handle SPA routing
    middlewareMode: false,
    // This ensures that the dev server serves index.html for all routes
    // that don't match static files
    fs: {
      strict: false,
    },
    // Fix for ENOTSUP socket errors on macOS
    watch: {
      usePolling: false,
      // Ignore node_modules and large directories to prevent socket exhaustion
      ignored: ["**/node_modules/**", "**/.git/**", "**/dist/**"],
    },
    // Configure HMR to use a specific port and avoid conflicts
    hmr: {
      overlay: true,
    },
    // Security and feature headers
    headers: {
      // Required for FFmpeg with SharedArrayBuffer
      "Cross-Origin-Embedder-Policy": "credentialless",
      "Cross-Origin-Opener-Policy": "same-origin",
      // Security headers
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      // Note: CSP is configured loosely for dev; production should be stricter via hosting config
    },
    // Proxy configuration for Bluesky CDN images to avoid CORS issues
    proxy: {
      // Proxy for OAuth client metadata to avoid CORS issues in development
      "/proxy-client-metadata": {
        target: "https://shadowsky.io",
        changeOrigin: true,
        rewrite: () => "/client-metadata.json",
      },
      // Proxy for local API server to avoid CORS issues in development
      "/api": {
        target: "http://localhost:3002",
        changeOrigin: true,
      },
      "/bsky-cdn": {
        target: "https://cdn.bsky.app",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/bsky-cdn/, ""),
        headers: {
          Referer: "https://bsky.app",
        },
      },
      "/bsky-video": {
        target: "https://video.bsky.app",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/bsky-video/, ""),
        headers: {
          Referer: "https://bsky.app",
        },
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            // Add CORS headers to allow the resource
            proxyRes.headers["Cross-Origin-Resource-Policy"] = "cross-origin";
            proxyRes.headers["Access-Control-Allow-Origin"] = "*";
          });
        },
      },
      "/bsky-video-cdn": {
        target: "https://video.cdn.bsky.app",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/bsky-video-cdn/, ""),
        headers: {
          Referer: "https://bsky.app",
        },
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            // Add CORS headers to allow the resource
            proxyRes.headers["Cross-Origin-Resource-Policy"] = "cross-origin";
            proxyRes.headers["Access-Control-Allow-Origin"] = "*";
          });
        },
      },
    },
  },
  preview: {
    port: 5174,
    // Security headers for preview builds (production-like)
    headers: {
      "Cross-Origin-Embedder-Policy": "credentialless",
      "Cross-Origin-Opener-Policy": "same-origin",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  },
  // Handle SPA routing - return index.html for all routes
  appType: "spa",
});
