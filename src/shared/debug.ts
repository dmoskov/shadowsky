/**
 * Debug utilities for development
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

export const debug = {
  log: (...args: unknown[]) => {
    if (config.enabled) {
      console.log(config.prefix, ...args);
    }
  },

  error: (...args: unknown[]) => {
    if (config.enabled) {
      console.error(config.prefix, ...args);
    }
  },

  warn: (...args: unknown[]) => {
    if (config.enabled) {
      console.warn(config.prefix, ...args);
    }
  },

  info: (...args: unknown[]) => {
    if (config.enabled) {
      console.info(config.prefix, ...args);
    }
  },

  time: (label: string) => {
    if (config.enabled) {
      console.time(`${config.prefix} ${label}`);
    }
  },

  timeEnd: (label: string) => {
    if (config.enabled) {
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
