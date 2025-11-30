import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
  base: "/",
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: null, // We'll handle registration manually
      workbox: {
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
    // Headers required for FFmpeg with SharedArrayBuffer
    headers: {
      "Cross-Origin-Embedder-Policy": "credentialless",
      "Cross-Origin-Opener-Policy": "same-origin",
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
  },
  // Handle SPA routing - return index.html for all routes
  appType: "spa",
});
