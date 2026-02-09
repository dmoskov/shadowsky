/**
 * Tests for useErrorTracking hook
 *
 * Coverage targets:
 * 1. Error logging with full context
 * 2. localStorage integration
 * 3. Error limit enforcement (max 50 errors)
 * 4. Error data structure validation
 * 5. Handling localStorage failures
 */

import { renderHook } from "@testing-library/react";
import type { ErrorInfo } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useErrorTracking } from "./useErrorTracking";

describe("useErrorTracking", () => {
  let mockLocalStorage: Record<string, string>;

  beforeEach(() => {
    // Reset localStorage mock
    mockLocalStorage = {};

    // Mock localStorage
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          mockLocalStorage[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete mockLocalStorage[key];
        }),
        clear: vi.fn(() => {
          mockLocalStorage = {};
        }),
      },
      writable: true,
    });

    // Mock console.error to suppress output during tests
    vi.spyOn(console, "error").mockImplementation(() => {});

    // Mock navigator.userAgent
    Object.defineProperty(navigator, "userAgent", {
      value: "Test User Agent",
      writable: true,
      configurable: true,
    });

    // Mock window.location.href
    Object.defineProperty(window, "location", {
      value: { href: "http://test.com/path" },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should log error with all required data", () => {
    const { result } = renderHook(() => useErrorTracking());

    const error = new Error("Test error");
    const errorInfo: ErrorInfo = {
      componentStack: "at TestComponent\n  at App",
    };

    result.current.logError(error, errorInfo, "TestContext");

    expect(console.error).toHaveBeenCalledWith(
      "Error tracked:",
      expect.objectContaining({
        message: "Test error",
        stack: expect.any(String),
        componentStack: "at TestComponent\n  at App",
        context: "TestContext",
        timestamp: expect.any(String),
        userAgent: "Test User Agent",
        url: "http://test.com/path",
      }),
    );
  });

  it("should store error in localStorage", () => {
    const { result } = renderHook(() => useErrorTracking());

    const error = new Error("Storage test");
    const errorInfo: ErrorInfo = {
      componentStack: "at Component",
    };

    result.current.logError(error, errorInfo);

    expect(localStorage.setItem).toHaveBeenCalledWith(
      "app_errors",
      expect.any(String),
    );

    const storedErrors = JSON.parse(mockLocalStorage["app_errors"]);
    expect(storedErrors).toHaveLength(1);
    expect(storedErrors[0].message).toBe("Storage test");
  });

  it("should use 'unknown' as default context", () => {
    const { result } = renderHook(() => useErrorTracking());

    const error = new Error("No context");
    const errorInfo: ErrorInfo = {
      componentStack: "at Component",
    };

    result.current.logError(error, errorInfo);

    const storedErrors = JSON.parse(mockLocalStorage["app_errors"]);
    expect(storedErrors[0].context).toBe("unknown");
  });

  it("should limit stored errors to 50", () => {
    const { result } = renderHook(() => useErrorTracking());

    // Pre-populate with 50 errors
    const initialErrors = Array.from({ length: 50 }, (_, i) => ({
      message: `Error ${i}`,
      stack: "",
      componentStack: "",
      context: "test",
      timestamp: new Date().toISOString(),
      userAgent: "test",
      url: "http://test.com",
    }));
    mockLocalStorage["app_errors"] = JSON.stringify(initialErrors);

    // Add one more error
    const error = new Error("Error 51");
    const errorInfo: ErrorInfo = {
      componentStack: "at Component",
    };

    result.current.logError(error, errorInfo);

    const storedErrors = JSON.parse(mockLocalStorage["app_errors"]);
    expect(storedErrors).toHaveLength(50);
    expect(storedErrors[0].message).toBe("Error 1"); // First error was removed
    expect(storedErrors[49].message).toBe("Error 51"); // New error was added
  });

  it("should append to existing errors", () => {
    const { result } = renderHook(() => useErrorTracking());

    // Add first error
    const error1 = new Error("First error");
    const errorInfo1: ErrorInfo = {
      componentStack: "at Component1",
    };
    result.current.logError(error1, errorInfo1);

    // Add second error
    const error2 = new Error("Second error");
    const errorInfo2: ErrorInfo = {
      componentStack: "at Component2",
    };
    result.current.logError(error2, errorInfo2);

    const storedErrors = JSON.parse(mockLocalStorage["app_errors"]);
    expect(storedErrors).toHaveLength(2);
    expect(storedErrors[0].message).toBe("First error");
    expect(storedErrors[1].message).toBe("Second error");
  });

  it("should handle localStorage failures gracefully", () => {
    const { result } = renderHook(() => useErrorTracking());

    // Mock localStorage.setItem to throw an error
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("Quota exceeded");
    });

    const error = new Error("Test error");
    const errorInfo: ErrorInfo = {
      componentStack: "at Component",
    };

    // Should not throw
    expect(() => {
      result.current.logError(error, errorInfo);
    }).not.toThrow();

    expect(console.error).toHaveBeenCalledWith(
      "Failed to store error in localStorage:",
      expect.any(Error),
    );
  });

  it("should handle invalid JSON in localStorage", () => {
    const { result } = renderHook(() => useErrorTracking());

    // Set invalid JSON
    mockLocalStorage["app_errors"] = "invalid json";

    // Mock getItem to return the invalid JSON
    vi.spyOn(localStorage, "getItem").mockReturnValue("invalid json");

    const error = new Error("Test error");
    const errorInfo: ErrorInfo = {
      componentStack: "at Component",
    };

    // Should not throw, should start fresh
    expect(() => {
      result.current.logError(error, errorInfo);
    }).not.toThrow();
  });

  it("should include error stack trace", () => {
    const { result } = renderHook(() => useErrorTracking());

    const error = new Error("Error with stack");
    const errorInfo: ErrorInfo = {
      componentStack: "at Component",
    };

    result.current.logError(error, errorInfo);

    const storedErrors = JSON.parse(mockLocalStorage["app_errors"]);
    expect(storedErrors[0].stack).toBeDefined();
    expect(typeof storedErrors[0].stack).toBe("string");
  });

  it("should capture timestamp in ISO format", () => {
    const { result } = renderHook(() => useErrorTracking());

    const error = new Error("Time test");
    const errorInfo: ErrorInfo = {
      componentStack: "at Component",
    };

    result.current.logError(error, errorInfo);

    const storedErrors = JSON.parse(mockLocalStorage["app_errors"]);
    const timestamp = storedErrors[0].timestamp;

    // Verify it's a valid ISO string
    expect(() => new Date(timestamp)).not.toThrow();
    expect(new Date(timestamp).toISOString()).toBe(timestamp);
  });

  it("should capture browser information", () => {
    const { result } = renderHook(() => useErrorTracking());

    const error = new Error("Browser test");
    const errorInfo: ErrorInfo = {
      componentStack: "at Component",
    };

    result.current.logError(error, errorInfo);

    const storedErrors = JSON.parse(mockLocalStorage["app_errors"]);
    expect(storedErrors[0].userAgent).toBe("Test User Agent");
    expect(storedErrors[0].url).toBe("http://test.com/path");
  });
});
