/**
 * Debug utilities for development
 *
 * Usage:
 * - Logging is disabled by default in all environments
 * - Enable debug mode: localStorage.setItem('debug', 'true') or add ?debug=true to URL
 * - Disable debug mode: localStorage.setItem('debug', 'false')
 */

interface DebugConfig {
  enabled: boolean;
  prefix: string;
}

const config: DebugConfig = {
  enabled:
    typeof window !== "undefined" &&
    (localStorage.getItem("debug") === "true" ||
      window.location.search.includes("debug=true")),
  prefix: "[BSKY]",
};

// Helper to check if we should log
const shouldLog = (): boolean => {
  // Only log if debug is explicitly enabled
  return config.enabled;
};

export const debug = {
  log: (...args: unknown[]) => {
    if (shouldLog()) {
      console.log(config.prefix, ...args);
    }
  },

  error: (...args: unknown[]) => {
    if (shouldLog()) {
      console.error(config.prefix, ...args);
    }
  },

  warn: (...args: unknown[]) => {
    if (shouldLog()) {
      console.warn(config.prefix, ...args);
    }
  },

  info: (...args: unknown[]) => {
    if (shouldLog()) {
      console.info(config.prefix, ...args);
    }
  },

  time: (label: string) => {
    if (shouldLog()) {
      console.time(`${config.prefix} ${label}`);
    }
  },

  timeEnd: (label: string) => {
    if (shouldLog()) {
      console.timeEnd(`${config.prefix} ${label}`);
    }
  },
};

export function enableDebug() {
  config.enabled = true;
  if (typeof window !== "undefined") {
    localStorage.setItem("debug", "true");
  }
}

export function disableDebug() {
  config.enabled = false;
  if (typeof window !== "undefined") {
    localStorage.setItem("debug", "false");
  }
}
