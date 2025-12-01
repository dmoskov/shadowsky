import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
  base: "/",
  build: {
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
    VitePWA({
      registerType: "prompt",
      injectRegister: null, // We'll handle registration manually
      // Include push notification service worker code
      injectManifest: {
        injectionPoint: undefined,
      },
      workbox: {
        // Import push notification handler
        importScripts: ["/push-sw.js"],
        // Cache static assets with stale-while-revalidate
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "gstatic-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|avif)$/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "images-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
          {
            urlPattern: /\.(?:js|css)$/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "static-resources-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
            },
          },
          // AT Protocol API - Network first with offline fallback
          {
            urlPattern:
              /^https:\/\/(bsky\.social|public\.api\.bsky\.app)\/xrpc\/(app\.bsky\.feed|app\.bsky\.actor|app\.bsky\.notification|app\.bsky\.graph)\..*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "bsky-api-cache",
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60, // 1 hour
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Bluesky Chat API - Network first with shorter cache for DMs
          {
            urlPattern:
              /^https:\/\/api\.bsky\.chat\/xrpc\/chat\.bsky\.convo\..*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "bsky-chat-cache",
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 15, // 15 minutes for DMs
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Bluesky CDN images - Cache first (immutable content)
          {
            urlPattern: /^https:\/\/cdn\.bsky\.app\/img\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "bsky-cdn-images",
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Bluesky avatar images - Stale while revalidate (may change)
          {
            urlPattern: /^https:\/\/cdn\.bsky\.app\/img\/avatar.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "bsky-avatar-cache",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
        // Precache static assets from build
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        // Skip caching files larger than 2MB
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
        // Clean up old caches
        cleanupOutdatedCaches: true,
        // Skip waiting for old service workers
        skipWaiting: false,
        clientsClaim: true,
      },
      // Web manifest configuration for PWA
      manifest: {
        name: "ShadowSky - Bluesky Companion",
        short_name: "ShadowSky",
        description:
          "Your companion app for deeper Bluesky insights and enhanced social networking experience",
        theme_color: "#0a0e1a",
        background_color: "#0a0e1a",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/butterfly-icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      devOptions: {
        enabled: false, // Disable SW in development to avoid caching issues
      },
    }),
  ],
  optimizeDeps: {
    exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
  },
  resolve: {
    alias: {
      "@bsky/shared": path.resolve(__dirname, "./src/shared/index.ts"),
    },
  },
  server: {
    port: 5174,
    // Configure the dev server to handle SPA routing
    middlewareMode: false,
    // This ensures that the dev server serves index.html for all routes
    // that don't match static files
    fs: {
      strict: false,
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
