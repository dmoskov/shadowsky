/**
 * Debug utility for conditional console logging
 */

// Debug flag - can be controlled via environment variable or local storage
const isDebugEnabled = (): boolean => {
  // Check environment variable first
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development' && process.env?.DEBUG === 'true') {
    return true;
  }
  
  // Check localStorage for browser environment
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem('debug') === 'true';
  }
  
  return false;
};

// Create a debug logger instance
export const debug = {
  log: (...args: any[]): void => {
    if (isDebugEnabled()) {
      console.log(...args);
    }
  },
  
  error: (...args: any[]): void => {
    if (isDebugEnabled()) {
      console.error(...args);
    }
  },
  
  warn: (...args: any[]): void => {
    if (isDebugEnabled()) {
      console.warn(...args);
    }
  },
  
  info: (...args: any[]): void => {
    if (isDebugEnabled()) {
      console.info(...args);
    }
  },
  
  group: (label?: string): void => {
    if (isDebugEnabled()) {
      console.group(label);
    }
  },
  
  groupEnd: (): void => {
    if (isDebugEnabled()) {
      console.groupEnd();
    }
  },
  
  time: (label: string): void => {
    if (isDebugEnabled()) {
      console.time(label);
    }
  },
  
  timeEnd: (label: string): void => {
    if (isDebugEnabled()) {
      console.timeEnd(label);
    }
  },
  
  table: (data: any): void => {
    if (isDebugEnabled()) {
      console.table(data);
    }
  }
};

// Helper functions to control debug state
export const enableDebug = (): void => {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem('debug', 'true');
  }
};

export const disableDebug = (): void => {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem('debug');
  }
};

// Export convenience function for quick debugging
export const debugLog = debug.log;