/**
 * Manual chunking strategy for Vite build.
 * Extracted to allow independent optimization without affecting main config.
 *
 * This strategy:
 * - Splits vendor code into logical chunks
 * - Separates on-demand features (OAuth, Amplify) from core bundles
 * - Groups commonly-used utilities together
 * - Optimizes for browser caching and parallel loading
 */

/**
 * Determines which chunk a module should be assigned to.
 * Returns undefined to let Vite decide automatically.
 */
export function getManualChunk(id: string): string | undefined {
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

  // Let Vite decide for everything else
  return undefined;
}

/**
 * Modulepreload optimization configuration.
 * Filters out chunks that aren't needed for initial render.
 */
export function optimizeModulePreload(_filename: string, deps: string[]): string[] {
  // Filter out chunks that aren't needed for initial render
  // OAuth: only loaded when user initiates OAuth login
  // Amplify: only needed for API calls after authentication
  return deps.filter(
    (dep) =>
      !dep.includes("vendor-atproto-oauth") &&
      !dep.includes("vendor-amplify"),
  );
}
