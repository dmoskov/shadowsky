/**
 * Custom Vite plugins for the BSKY application.
 * Extracted to reduce churn in main vite.config.ts.
 */

import type { Plugin } from "vite";
import { visualizer } from "rollup-plugin-visualizer";
import pkg from "../../package.json" with { type: "json" };

/**
 * Vite plugin to defer non-critical CSS loading.
 * Converts stylesheet links to use the media="print" trick for async loading,
 * which improves First Contentful Paint on slow connections.
 */
export function deferCssPlugin(): Plugin {
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
export function versionCacheBustPlugin(): Plugin {
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

/**
 * Bundle analyzer plugin.
 * Generates bundle-stats.html when ANALYZE=true is set.
 *
 * @param enabled - Whether to enable the analyzer (default: checks ANALYZE env var)
 */
export function bundleAnalyzerPlugin(enabled?: boolean): Plugin | false {
  const shouldAnalyze = enabled ?? process.env.ANALYZE === "true";

  return shouldAnalyze
    ? visualizer({
        filename: "bundle-stats.html",
        open: false,
        gzipSize: true,
        brotliSize: true,
        template: "treemap", // treemap, sunburst, or network
      })
    : false;
}
