/**
 * Vite dev server configuration.
 * Extracted to reduce main config churn when adjusting dev environment.
 */

import type { ServerOptions, PreviewOptions, ProxyOptions } from "vite";

/**
 * Security and feature headers required for SharedArrayBuffer (FFmpeg).
 */
export const securityHeaders = {
  // Required for FFmpeg with SharedArrayBuffer
  "Cross-Origin-Embedder-Policy": "credentialless",
  "Cross-Origin-Opener-Policy": "same-origin",
  // Security headers
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // Note: CSP is configured loosely for dev; production should be stricter via hosting config
};

/**
 * Proxy configuration for external services.
 * Handles CORS issues and provides local development convenience.
 */
export const proxyConfig: Record<string, string | ProxyOptions> = {
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
};

/**
 * Development server configuration.
 */
export const serverConfig: ServerOptions = {
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
  headers: securityHeaders,
  proxy: proxyConfig,
};

/**
 * Preview server configuration (for production builds).
 */
export const previewConfig: PreviewOptions = {
  port: 5174,
  headers: securityHeaders,
};
