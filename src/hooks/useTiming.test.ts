/**
 * Tests for timing hooks
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useCancellableTimeout,
  useDebouncedCallback,
  useDelayedBoolean,
  useDelayedValue,
  useInterval,
  useMinDuration,
  useThrottledCallback,
  useTimeout,
} from "./useTiming";

describe("useTiming hooks", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("useDelayedValue", () => {
    it("returns initial value immediately", () => {
      const { result } = renderHook(() => useDelayedValue("initial", 100));
      expect(result.current).toBe("initial");
    });

    it("delays value updates", () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDelayedValue(value, delay),
        { initialProps: { value: "initial", delay: 100 } },
      );

      expect(result.current).toBe("initial");

      rerender({ value: "updated", delay: 100 });
      expect(result.current).toBe("initial");

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current).toBe("updated");
    });

    it("cancels pending update on new value", () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDelayedValue(value, delay),
        { initialProps: { value: "initial", delay: 100 } },
      );

      rerender({ value: "first", delay: 100 });

      act(() => {
        vi.advanceTimersByTime(50);
      });

      rerender({ value: "second", delay: 100 });

      act(() => {
        vi.advanceTimersByTime(50);
      });

      // Should still be initial because "second" reset the timer
      expect(result.current).toBe("initial");

      act(() => {
        vi.advanceTimersByTime(50);
      });

      expect(result.current).toBe("second");
    });
  });

  describe("useMinDuration", () => {
    it("returns false when input is false", () => {
      const { result } = renderHook(() => useMinDuration(false, 300));
      expect(result.current).toBe(false);
    });

    it("returns true when input is true", () => {
      const { result } = renderHook(() => useMinDuration(true, 300));
      expect(result.current).toBe(true);
    });

    it("maintains true state for minimum duration", () => {
      const { result, rerender } = renderHook(
        ({ isActive }) => useMinDuration(isActive, 300),
        { initialProps: { isActive: true } },
      );

      expect(result.current).toBe(true);

      // Change to false after 100ms (less than minDuration)
      act(() => {
        vi.advanceTimersByTime(100);
      });
      rerender({ isActive: false });

      // Should still be true because minDuration hasn't passed
      expect(result.current).toBe(true);

      // Advance remaining time
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(result.current).toBe(false);
    });

    it("immediately turns false if minDuration has passed", () => {
      const { result, rerender } = renderHook(
        ({ isActive }) => useMinDuration(isActive, 300),
        { initialProps: { isActive: true } },
      );

      expect(result.current).toBe(true);

      // Wait longer than minDuration
      act(() => {
        vi.advanceTimersByTime(400);
      });
      rerender({ isActive: false });

      // Should immediately be false
      expect(result.current).toBe(false);
    });
  });

  describe("useDelayedBoolean", () => {
    it("immediately returns false when input is false", () => {
      const { result } = renderHook(() => useDelayedBoolean(false, 100));
      expect(result.current).toBe(false);
    });

    it("delays showing true state", () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDelayedBoolean(value, 100),
        { initialProps: { value: false } },
      );

      expect(result.current).toBe(false);

      rerender({ value: true });
      expect(result.current).toBe(false);

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current).toBe(true);
    });

    it("immediately returns false when input becomes false", () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDelayedBoolean(value, 100),
        { initialProps: { value: true } },
      );

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current).toBe(true);

      rerender({ value: false });
      expect(result.current).toBe(false);
    });

    it("cancels delayed true if value becomes false before delay", () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDelayedBoolean(value, 100),
        { initialProps: { value: false } },
      );

      rerender({ value: true });

      act(() => {
        vi.advanceTimersByTime(50);
      });

      rerender({ value: false });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current).toBe(false);
    });
  });

  describe("useCancellableTimeout", () => {
    it("schedules a callback", () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useCancellableTimeout());

      act(() => {
        result.current.schedule(callback, 100);
      });

      expect(callback).not.toHaveBeenCalled();
      expect(result.current.isPending()).toBe(true);

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(result.current.isPending()).toBe(false);
    });

    it("can cancel scheduled callback", () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useCancellableTimeout());

      act(() => {
        result.current.schedule(callback, 100);
        result.current.cancel();
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(callback).not.toHaveBeenCalled();
      expect(result.current.isPending()).toBe(false);
    });

    it("replaces previous scheduled callback", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const { result } = renderHook(() => useCancellableTimeout());

      act(() => {
        result.current.schedule(callback1, 100);
        result.current.schedule(callback2, 100);
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe("useDebouncedCallback", () => {
    it("debounces callback execution", () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useDebouncedCallback(callback, 100));

      act(() => {
        result.current("arg1");
        result.current("arg2");
        result.current("arg3");
      });

      expect(callback).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith("arg3");
    });
  });

  describe("useThrottledCallback", () => {
    it("executes immediately on first call", () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useThrottledCallback(callback, 100));

      act(() => {
        result.current("arg1");
      });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith("arg1");
    });

    it("throttles subsequent calls", () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useThrottledCallback(callback, 100));

      act(() => {
        result.current("arg1");
        result.current("arg2");
        result.current("arg3");
      });

      expect(callback).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenLastCalledWith("arg3");
    });
  });

  describe("useInterval", () => {
    it("calls callback at specified interval", () => {
      const callback = vi.fn();
      renderHook(() => useInterval(callback, 100));

      expect(callback).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(callback).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it("does not call callback when delay is null", () => {
      const callback = vi.fn();
      renderHook(() => useInterval(callback, null));

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it("cleans up interval on unmount", () => {
      const callback = vi.fn();
      const { unmount } = renderHook(() => useInterval(callback, 100));

      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(callback).toHaveBeenCalledTimes(1);

      unmount();

      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe("useTimeout", () => {
    it("calls callback after delay", () => {
      const callback = vi.fn();
      renderHook(() => useTimeout(callback, 100));

      expect(callback).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("does not call callback when delay is null", () => {
      const callback = vi.fn();
      renderHook(() => useTimeout(callback, null));

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it("cleans up timeout on unmount", () => {
      const callback = vi.fn();
      const { unmount } = renderHook(() => useTimeout(callback, 100));

      unmount();

      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it("only calls callback once", () => {
      const callback = vi.fn();
      renderHook(() => useTimeout(callback, 100));

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
});
