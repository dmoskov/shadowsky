/**
 * Tests for timing utilities
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TIMING,
  cancellableDelay,
  debounce,
  delay,
  getRemainingTime,
  throttle,
} from "./timing";

describe("timing utilities", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("TIMING constants", () => {
    it("exports timing constants", () => {
      expect(TIMING.MIN_LOADING_DURATION).toBe(300);
      expect(TIMING.DEBOUNCE_DELAY).toBe(150);
      expect(TIMING.THROTTLE_INTERVAL).toBe(100);
      expect(TIMING.LOADING_DELAY).toBe(150);
      expect(TIMING.PREFETCH_DELAY).toBe(100);
      expect(TIMING.LINK_PREVIEW_DELAY).toBe(500);
      expect(TIMING.PRE_GENERATION_DELAY).toBe(5000);
      expect(TIMING.SW_POLL_INTERVAL).toBe(5000);
      expect(TIMING.UNDO_WINDOW).toBe(5000);
      expect(TIMING.SCROLL_THROTTLE).toBe(16);
      expect(TIMING.SCROLL_END_DELAY).toBe(150);
    });
  });

  describe("delay", () => {
    it("resolves after the specified delay", async () => {
      let resolved = false;
      delay(1000).then(() => {
        resolved = true;
      });

      expect(resolved).toBe(false);

      vi.advanceTimersByTime(500);
      await Promise.resolve();
      expect(resolved).toBe(false);

      vi.advanceTimersByTime(500);
      await Promise.resolve();
      expect(resolved).toBe(true);
    });
  });

  describe("cancellableDelay", () => {
    it("resolves to true when not cancelled", async () => {
      const { promise } = cancellableDelay(1000);

      vi.advanceTimersByTime(1000);
      const result = await promise;

      expect(result).toBe(true);
    });

    it("resolves to false when cancelled", async () => {
      const { promise, cancel } = cancellableDelay(1000);

      vi.advanceTimersByTime(500);
      cancel();
      vi.advanceTimersByTime(500);

      const result = await promise;
      expect(result).toBe(false);
    });

    it("can be cancelled before timeout", async () => {
      const { promise, cancel } = cancellableDelay(1000);

      cancel();
      vi.advanceTimersByTime(1000);

      const result = await promise;
      expect(result).toBe(false);
    });
  });

  describe("getRemainingTime", () => {
    it("returns remaining time correctly", () => {
      const startTime = Date.now();
      vi.advanceTimersByTime(100);

      const remaining = getRemainingTime(startTime, 300);
      expect(remaining).toBe(200);
    });

    it("returns 0 when duration has passed", () => {
      const startTime = Date.now();
      vi.advanceTimersByTime(500);

      const remaining = getRemainingTime(startTime, 300);
      expect(remaining).toBe(0);
    });

    it("returns 0 when duration equals elapsed time", () => {
      const startTime = Date.now();
      vi.advanceTimersByTime(300);

      const remaining = getRemainingTime(startTime, 300);
      expect(remaining).toBe(0);
    });
  });

  describe("debounce", () => {
    it("delays function execution", () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("resets delay on subsequent calls", () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      vi.advanceTimersByTime(50);
      debouncedFn();
      vi.advanceTimersByTime(50);

      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("passes arguments to the function", () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn("arg1", "arg2");
      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledWith("arg1", "arg2");
    });

    it("cancel method prevents execution", () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      debouncedFn.cancel();
      vi.advanceTimersByTime(200);

      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe("throttle", () => {
    it("executes immediately on first call", () => {
      const fn = vi.fn();
      const throttledFn = throttle(fn, 100);

      throttledFn();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("prevents rapid calls within interval", () => {
      const fn = vi.fn();
      const throttledFn = throttle(fn, 100);

      throttledFn();
      throttledFn();
      throttledFn();

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("allows calls after interval has passed", () => {
      const fn = vi.fn();
      const throttledFn = throttle(fn, 100);

      throttledFn();
      expect(fn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);
      throttledFn();
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("schedules trailing call", () => {
      const fn = vi.fn();
      const throttledFn = throttle(fn, 100);

      throttledFn();
      throttledFn();

      expect(fn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("passes arguments to the function", () => {
      const fn = vi.fn();
      const throttledFn = throttle(fn, 100);

      throttledFn("arg1", "arg2");
      expect(fn).toHaveBeenCalledWith("arg1", "arg2");
    });
  });
});
