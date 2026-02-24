import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "../ToastContext";

// Mock the Toast component to avoid rendering DOM complexity
vi.mock("../../components/Toast", () => ({
  ToastContainer: () => null,
}));

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <ToastProvider>{children}</ToastProvider>;
  };
}

describe("ToastContext", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("useToast hook", () => {
    it("should throw error when used outside ToastProvider", () => {
      expect(() => {
        renderHook(() => useToast());
      }).toThrow("useToast must be used within a ToastProvider");
    });
  });

  describe("Default values", () => {
    it("should provide all expected functions", () => {
      const { result } = renderHook(() => useToast(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.showToast).toBe("function");
      expect(typeof result.current.dismissToast).toBe("function");
      expect(typeof result.current.dismissAllToasts).toBe("function");
      expect(typeof result.current.showUndoToast).toBe("function");
      expect(typeof result.current.getQueueStats).toBe("function");
      expect(typeof result.current.updateQueueConfig).toBe("function");
    });

    it("should start with empty queue", () => {
      const { result } = renderHook(() => useToast(), {
        wrapper: createWrapper(),
      });

      const stats = result.current.getQueueStats();
      expect(stats.visible).toBe(0);
      expect(stats.queued).toBe(0);
      expect(stats.total).toBe(0);
    });
  });

  describe("showToast", () => {
    it("should add a toast and return an id", () => {
      const { result } = renderHook(() => useToast(), {
        wrapper: createWrapper(),
      });

      let toastId: string;
      act(() => {
        toastId = result.current.showToast("Hello world");
      });

      expect(toastId!).toBeDefined();
      expect(typeof toastId!).toBe("string");
      expect(toastId!).toContain("toast-");
    });

    it("should increment visible count when toast is added", () => {
      const { result } = renderHook(() => useToast(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.showToast("Test message");
      });

      const stats = result.current.getQueueStats();
      expect(stats.visible).toBe(1);
    });

    it("should respect maxVisible queue config", () => {
      const { result } = renderHook(() => useToast(), {
        wrapper: createWrapper(),
      });

      // Default maxVisible is 3. Use urgent priority to bypass rate limiting.
      act(() => {
        result.current.showToast("Toast 1", { priority: "urgent" });
      });
      act(() => {
        result.current.showToast("Toast 2", { priority: "urgent" });
      });
      act(() => {
        result.current.showToast("Toast 3", { priority: "urgent" });
      });
      act(() => {
        result.current.showToast("Toast 4", { priority: "urgent" });
      });

      const stats = result.current.getQueueStats();
      expect(stats.visible).toBe(3);
      expect(stats.queued).toBeGreaterThanOrEqual(1);
    });

    it("should accept custom toast options", () => {
      const { result } = renderHook(() => useToast(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.showToast("Error toast", {
          type: "error",
          duration: 10000,
          dismissible: false,
        });
      });

      const stats = result.current.getQueueStats();
      expect(stats.total).toBe(1);
    });
  });

  describe("dismissToast", () => {
    it("should remove a toast by id", () => {
      const { result } = renderHook(() => useToast(), {
        wrapper: createWrapper(),
      });

      let toastId: string;
      act(() => {
        toastId = result.current.showToast("Dismissable toast");
      });

      expect(result.current.getQueueStats().total).toBe(1);

      act(() => {
        result.current.dismissToast(toastId);
      });

      expect(result.current.getQueueStats().total).toBe(0);
    });

    it("should handle dismissing non-existent toast gracefully", () => {
      const { result } = renderHook(() => useToast(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.dismissToast("non-existent-id");
      });

      expect(result.current.getQueueStats().total).toBe(0);
    });
  });

  describe("dismissAllToasts", () => {
    it("should clear all toasts", () => {
      const { result } = renderHook(() => useToast(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.showToast("Toast 1", { priority: "urgent" });
      });
      act(() => {
        result.current.showToast("Toast 2", { priority: "urgent" });
      });
      act(() => {
        result.current.showToast("Toast 3", { priority: "urgent" });
      });

      expect(result.current.getQueueStats().total).toBeGreaterThan(0);

      act(() => {
        result.current.dismissAllToasts();
      });

      expect(result.current.getQueueStats().total).toBe(0);
      expect(result.current.getQueueStats().visible).toBe(0);
    });
  });

  describe("showUndoToast", () => {
    it("should create a toast with undo action", () => {
      const { result } = renderHook(() => useToast(), {
        wrapper: createWrapper(),
      });

      const onUndo = vi.fn();
      const onExpire = vi.fn();

      let toastId: string;
      act(() => {
        toastId = result.current.showUndoToast(
          "Item deleted",
          onUndo,
          onExpire,
        );
      });

      expect(toastId!).toBeDefined();
      expect(result.current.getQueueStats().total).toBe(1);
    });

    it("should accept custom duration", () => {
      const { result } = renderHook(() => useToast(), {
        wrapper: createWrapper(),
      });

      const onUndo = vi.fn();
      const onExpire = vi.fn();

      act(() => {
        result.current.showUndoToast("Item deleted", onUndo, onExpire, 10000);
      });

      expect(result.current.getQueueStats().total).toBe(1);
    });
  });

  describe("Queue configuration", () => {
    it("should allow updating maxVisible", () => {
      const { result } = renderHook(() => useToast(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.updateQueueConfig({ maxVisible: 5 });
      });

      // Add 5 urgent toasts in separate act blocks
      act(() => {
        result.current.showToast("Toast 1", { priority: "urgent" });
      });
      act(() => {
        result.current.showToast("Toast 2", { priority: "urgent" });
      });
      act(() => {
        result.current.showToast("Toast 3", { priority: "urgent" });
      });
      act(() => {
        result.current.showToast("Toast 4", { priority: "urgent" });
      });
      act(() => {
        result.current.showToast("Toast 5", { priority: "urgent" });
      });

      const stats = result.current.getQueueStats();
      expect(stats.visible).toBe(5);
    });
  });

  describe("Toast grouping", () => {
    it("should deduplicate toasts with same groupId", () => {
      const { result } = renderHook(() => useToast(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.showToast("Network error", {
          groupId: "network-error",
          priority: "urgent",
        });
      });

      act(() => {
        result.current.showToast("Network error again", {
          groupId: "network-error",
          priority: "urgent",
        });
      });

      // Only one toast should exist since they share a groupId
      const stats = result.current.getQueueStats();
      expect(stats.total).toBe(1);
    });

    it("should replace group when replaceGroup is true", () => {
      const { result } = renderHook(() => useToast(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.showToast("First message", {
          groupId: "status",
          priority: "urgent",
        });
      });

      expect(result.current.getQueueStats().total).toBe(1);

      act(() => {
        result.current.showToast("Updated message", {
          groupId: "status",
          replaceGroup: true,
          priority: "urgent",
        });
      });

      // Should still be 1 because the first was replaced
      expect(result.current.getQueueStats().total).toBe(1);
    });
  });

  describe("Provider renders children", () => {
    it("should render children within provider", () => {
      const { result } = renderHook(() => useToast(), {
        wrapper: createWrapper(),
      });

      expect(result.current).toBeDefined();
      expect(result.current.showToast).toBeDefined();
    });
  });
});
