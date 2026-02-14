/**
 * Debug utilities for development
 *
 * Usage:
 * - Logging is disabled by default in all environments
 * - Enable debug mode: AsyncStorage.setItem('debug', 'true')
 * - Disable debug mode: AsyncStorage.setItem('debug', 'false')
 * - Or use global function: window.enableDebug() / window.disableDebug()
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

interface DebugConfig {
  enabled: boolean;
  prefix: string;
}

const config: DebugConfig = {
  enabled: false,
  prefix: '[BSKY]',
};

// Initialize debug state from storage
AsyncStorage.getItem('debug').then((value) => {
  if (value === 'true') {
    config.enabled = true;
  }
}).catch(() => {
  // Ignore errors during initialization
});

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
  AsyncStorage.setItem('debug', 'true').catch(() => {
    // Ignore storage errors
  });
}

export function disableDebug() {
  config.enabled = false;
  AsyncStorage.setItem('debug', 'false').catch(() => {
    // Ignore storage errors
  });
}

// Expose globally for console access
if (typeof global !== 'undefined') {
  (global as any).enableDebug = enableDebug;
  (global as any).disableDebug = disableDebug;
}
