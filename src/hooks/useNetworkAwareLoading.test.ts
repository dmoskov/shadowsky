import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NetworkInfoSnapshot } from "../utils/network-info";
import {
  getInitialLoadingStrategy,
  shouldDeferInit,
  useDeferredOperation,
  useNetworkAwareLoading,
} from "./useNetworkAwareLoading";

// Helper to create mock network info
const createMockNetworkInfo = (
  overrides: Partial<NetworkInfoSnapshot> = {},
): NetworkInfoSnapshot => ({
  isSupported: true,
  isOnline: true,
  effectiveType: "4g",
  connectionType: "wifi",
  downlink: 10,
  rtt: 50,
  saveData: false,
  quality: "good",
  prefetchStrategy: {
    enabled: true,
    maxConcurrentLoads: 4,
    rootMarginPercent: 200,
    lowQualityOnly: false,
    batchDelayMs: 0,
    imageQuality: "high",
  },
  ...overrides,
});

// Mock the network-info module
vi.mock("../utils/network-info", () => ({
  getNetworkInfo: vi.fn(() => createMockNetworkInfo()),
  subscribeToNetworkChanges: vi.fn(() => vi.fn()), // Returns unsubscribe function
}));

import {
  getNetworkInfo,
  subscribeToNetworkChanges,
} from "../utils/network-info";

describe("useNetworkAwareLoading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to good network by default
    vi.mocked(getNetworkInfo).mockReturnValue(createMockNetworkInfo());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("useNetworkAwareLoading hook", () => {
    it("returns a loading strategy based on network quality", () => {
      const { result } = renderHook(() => useNetworkAwareLoading());

      expect(result.current).toMatchObject({
        quality: "good",
        deferNonCritical: false,
        skipRoutePrefetch: false,
        reduceImageQuality: false,
      });
    });

    it("subscribes to network changes on mount", () => {
      renderHook(() => useNetworkAwareLoading());

      expect(subscribeToNetworkChanges).toHaveBeenCalledTimes(1);
    });

    it("unsubscribes on unmount", () => {
      const unsubscribe = vi.fn();
      vi.mocked(subscribeToNetworkChanges).mockReturnValue(unsubscribe);

      const { unmount } = renderHook(() => useNetworkAwareLoading());
      unmount();

      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    it("returns appropriate strategy for excellent network", () => {
      vi.mocked(getNetworkInfo).mockReturnValue(
        createMockNetworkInfo({
          quality: "excellent",
          effectiveType: "4g",
          downlink: 20,
          rtt: 20,
        }),
      );

      const { result } = renderHook(() => useNetworkAwareLoading());

      expect(result.current.quality).toBe("excellent");
      expect(result.current.deferNonCritical).toBe(false);
      expect(result.current.maxConcurrentRequests).toBeGreaterThanOrEqual(6);
      expect(result.current.enableBackgroundSync).toBe(true);
    });

    it("returns degraded strategy for poor network", () => {
      vi.mocked(getNetworkInfo).mockReturnValue(
        createMockNetworkInfo({
          quality: "poor",
          effectiveType: "2g",
          downlink: 0.5,
          rtt: 500,
        }),
      );

      const { result } = renderHook(() => useNetworkAwareLoading());

      expect(result.current.quality).toBe("poor");
      expect(result.current.deferNonCritical).toBe(true);
      expect(result.current.skipRoutePrefetch).toBe(true);
      expect(result.current.reduceImageQuality).toBe(true);
      expect(result.current.reduceAnimations).toBe(true);
      expect(result.current.maxConcurrentRequests).toBe(2);
      expect(result.current.enableBackgroundSync).toBe(false);
    });

    it("returns offline strategy when offline", () => {
      vi.mocked(getNetworkInfo).mockReturnValue(
        createMockNetworkInfo({
          quality: "offline",
          effectiveType: null,
          downlink: 0,
          rtt: 0,
          isOnline: false,
        }),
      );

      const { result } = renderHook(() => useNetworkAwareLoading());

      expect(result.current.quality).toBe("offline");
      expect(result.current.maxConcurrentRequests).toBe(0);
      expect(result.current.queryStaleTime).toBe(Infinity);
    });
  });

  describe("getInitialLoadingStrategy", () => {
    it("returns strategy synchronously", () => {
      const strategy = getInitialLoadingStrategy();

      expect(strategy).toHaveProperty("quality");
      expect(strategy).toHaveProperty("deferNonCritical");
      expect(strategy).toHaveProperty("queryStaleTime");
      expect(strategy).toHaveProperty("maxConcurrentRequests");
    });

    it("uses current network info", () => {
      vi.mocked(getNetworkInfo).mockReturnValue(
        createMockNetworkInfo({
          quality: "moderate",
          effectiveType: "3g",
          downlink: 2,
          rtt: 200,
        }),
      );

      const strategy = getInitialLoadingStrategy();

      expect(strategy.quality).toBe("moderate");
      expect(strategy.deferNonCritical).toBe(true);
    });
  });

  describe("shouldDeferInit", () => {
    it("returns false for good network", () => {
      vi.mocked(getNetworkInfo).mockReturnValue(createMockNetworkInfo());

      expect(shouldDeferInit()).toBe(false);
    });

    it("returns true for poor network", () => {
      vi.mocked(getNetworkInfo).mockReturnValue(
        createMockNetworkInfo({
          quality: "poor",
          effectiveType: "2g",
          downlink: 0.5,
          rtt: 500,
        }),
      );

      expect(shouldDeferInit()).toBe(true);
    });

    it("returns true for moderate network", () => {
      vi.mocked(getNetworkInfo).mockReturnValue(
        createMockNetworkInfo({
          quality: "moderate",
          effectiveType: "3g",
          downlink: 2,
          rtt: 200,
        }),
      );

      expect(shouldDeferInit()).toBe(true);
    });
  });

  describe("useDeferredOperation", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("executes immediately on good network", () => {
      vi.mocked(getNetworkInfo).mockReturnValue(createMockNetworkInfo());

      const { result } = renderHook(() => useDeferredOperation());
      const callback = vi.fn();

      act(() => {
        result.current.executeWhenReady(callback);
      });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(result.current.shouldDefer).toBe(false);
    });

    it("defers execution on poor network", () => {
      vi.mocked(getNetworkInfo).mockReturnValue(
        createMockNetworkInfo({
          quality: "poor",
          effectiveType: "2g",
          downlink: 0.5,
          rtt: 500,
        }),
      );

      const { result } = renderHook(() => useDeferredOperation());
      const callback = vi.fn();

      act(() => {
        result.current.executeWhenReady(callback);
      });

      // Should not be called immediately
      expect(callback).not.toHaveBeenCalled();
      expect(result.current.shouldDefer).toBe(true);

      // Advance timers to trigger deferred execution
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
});

describe("requestIdleCallback polyfill", () => {
  it("polyfill should exist in window", () => {
    // The polyfill is added in main.tsx and index.html
    // In test environment, we verify the pattern works
    expect(typeof window.requestIdleCallback).toBe("function");
    expect(typeof window.cancelIdleCallback).toBe("function");
  });

  it("polyfill accepts callback and options", () => {
    const callback = vi.fn();
    vi.useFakeTimers();

    const handle = window.requestIdleCallback(callback, { timeout: 100 });

    expect(typeof handle).toBe("number");
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10);
    expect(callback).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("polyfill can be cancelled", () => {
    // Skip fake timers for this test since they conflict with polyfill
    const callback = vi.fn();

    const handle = window.requestIdleCallback(callback);
    window.cancelIdleCallback(handle);

    // Use real setTimeout to wait
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(callback).not.toHaveBeenCalled();
        resolve();
      }, 50);
    });
  });
});
