import "@testing-library/jest-dom";
import "fake-indexeddb/auto";
import { afterEach, vi } from "vitest";

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// In-memory localStorage that behaves like the real API:
// - getItem returns null (not undefined) for missing keys
// - setItem/removeItem/clear/key/length all work correctly
// - Cleared between tests via afterEach in this file
function createMemoryStorage(): Storage {
  let store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
}

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  writable: true,
  value: createMemoryStorage(),
});

afterEach(() => {
  (globalThis as any).localStorage = createMemoryStorage();
});

// Mock document.cookie
Object.defineProperty(document, "cookie", {
  writable: true,
  value: "",
});

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Polyfill requestIdleCallback for tests (Safari/iOS don't support it)
if (!("requestIdleCallback" in window)) {
  (window as any).requestIdleCallback = (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions,
  ): number => {
    const timeout = options?.timeout ?? 50;
    return window.setTimeout(
      () => {
        callback({
          didTimeout: true,
          timeRemaining: () => 0,
        });
      },
      Math.min(timeout, 1),
    );
  };
  (window as any).cancelIdleCallback = (handle: number): void => {
    window.clearTimeout(handle);
  };
}
