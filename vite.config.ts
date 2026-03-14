/**
 * Vite+ Configuration
 *
 * This is the main Vite+ configuration file. It has been refactored to reduce churn
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
import { defineConfig } from "vite-plus";
import { buildConfig } from "./config/vite/build.js";
import {
  bundleAnalyzerPlugin,
  deferCssPlugin,
  versionCacheBustPlugin,
} from "./config/vite/plugins.js";
import { previewConfig, serverConfig } from "./config/vite/server.js";

// https://viteplus.dev/
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
  fmt: {
    sortImports: {},
    sortTailwindcss: {},
  },
  lint: {
    plugins: ["typescript", "react"],
    env: {
      browser: true,
      node: true,
    },
    rules: {
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    },
    overrides: [
      {
        files: [
          "src/shared/debug.ts",
          "src/utils/debug-control.ts",
          "src/components/DebugConsole.tsx",
        ],
        rules: {
          "no-console": "off",
        },
      },
    ],
  },


  // ── Oxfmt (replaces Prettier) ──────────────────────────────────
  fmt: {
    semi: true,
    singleQuote: false,
    tabWidth: 2,
    trailingComma: "all",
    printWidth: 100,
  },

  // ── Oxlint (replaces ESLint) ───────────────────────────────────
  lint: {
    ignorePatterns: ["dist/**", "node_modules/**", "coverage/**"],
  },
});
