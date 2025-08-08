/**
 * Utility functions
 */

import { debug } from "./debug";

// Rate limiting utilities
export interface RateLimiter {
  limit: number;
  window: number;
  requests: number[];
}

export const rateLimiters: Record<string, RateLimiter> = {
  default: {
    limit: 100,
    window: 60000, // 1 minute
    requests: [],
  },
  notifications: {
    limit: 50,
    window: 60000,
    requests: [],
  },
};

export async function withRateLimit<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const limiter = rateLimiters[key] || rateLimiters.default;
  const now = Date.now();

  // Clean old requests
  limiter.requests = limiter.requests.filter(
    (time) => now - time < limiter.window,
  );

  // Check limit
  if (limiter.requests.length >= limiter.limit) {
    const oldestRequest = limiter.requests[0];
    const waitTime = limiter.window - (now - oldestRequest);
    throw new Error(
      `Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`,
    );
  }

  // Track request
  limiter.requests.push(now);

  try {
    return await fn();
  } catch (error) {
    // Remove request on error
    limiter.requests.pop();
    throw error;
  }
}

// Storage utilities
export function getStorageSize(): number {
  if (typeof window === "undefined" || !window.localStorage) {
    return 0;
  }

  let size = 0;
  for (const key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      size += localStorage[key].length + key.length;
    }
  }
  return size * 2; // UTF-16 uses 2 bytes per character
}

export function clearOldData(prefix: string, maxAge: number) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  const now = Date.now();
  const keys = Object.keys(localStorage);

  for (const key of keys) {
    if (key.startsWith(prefix)) {
      try {
        const data = localStorage.getItem(key);
        if (data) {
          const parsed = JSON.parse(data);
          if (parsed.timestamp && now - parsed.timestamp > maxAge) {
            localStorage.removeItem(key);
            debug.log(`Removed old data: ${key}`);
          }
        }
      } catch {
        // Invalid data, remove it
        localStorage.removeItem(key);
      }
    }
  }
}

// Formatting utilities
export function formatCount(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
  return `${(count / 1000000).toFixed(1)}M`;
}

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;

  return d.toLocaleDateString();
}
