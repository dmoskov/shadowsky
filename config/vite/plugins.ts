/**
 * Custom Vite plugins for the BSKY application.
 * Extracted to reduce churn in main vite.config.ts.
 */

import type { Plugin } from "vite";
import { visualizer } from "rollup-plugin-visualizer";

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
// versionCacheBustPlugin was removed: it appended ?v=<version> to the entry
// script URL while lazy chunks import the same file by its bare hashed name,
// so the browser executed the entry module twice (duplicate module-level
// singletons). The content hash in the filename already busts caches.

/**
 * Bundle analyzer plugin.
 * Generates bundle-stats.html when ANALYZE=true is set.
 *
 * @param enabled - Whether to enable the analyzer (default: checks ANALYZE env var)
 */
export function bundleAnalyzerPlugin(enabled?: boolean): Plugin | false {
  const shouldAnalyze = enabled ?? process.env.ANALYZE === "true";

  return shouldAnalyze
    ? (visualizer({
        filename: "bundle-stats.html",
        open: false,
        gzipSize: true,
        brotliSize: true,
        template: "treemap", // treemap, sunburst, or network
      }) as unknown as Plugin)
    : false;
}
