import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useStorageErrorManager } from "./storage-error-manager";

// Mock the useErrorHandler hook
vi.mock("../../hooks/useErrorHandler", () => ({
  useErrorHandler: vi.fn(() => ({
    handleError: vi.fn(),
  })),
}));

describe("useStorageErrorManager", () => {
  it("should return a storage error manager", () => {
    const { result } = renderHook(() => useStorageErrorManager());

    expect(result.current).toHaveProperty("handleStorageError");
    expect(typeof result.current.handleStorageError).toBe("function");
  });

  it("should wrap errors with storage context", async () => {
    const mockHandleError = vi.fn();
    const mockUseErrorHandler = vi.mocked(
      (await import("../../hooks/useErrorHandler")).useErrorHandler,
    );
    mockUseErrorHandler.mockReturnValue({ handleError: mockHandleError });

    const { result } = renderHook(() => useStorageErrorManager());

    const originalError = new Error("Database connection failed");
    originalError.stack =
      "Error: Database connection failed\n  at someFunction";

    result.current.handleStorageError(originalError, "save bookmark");

    expect(mockHandleError).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          "Storage operation failed: save bookmark. Database connection failed",
        stack: originalError.stack,
        cause: originalError,
      }),
      "storage_save_bookmark",
    );
  });

  it("should normalize action names for tracking", async () => {
    const mockHandleError = vi.fn();
    const mockUseErrorHandler = vi.mocked(
      (await import("../../hooks/useErrorHandler")).useErrorHandler,
    );
    mockUseErrorHandler.mockReturnValue({ handleError: mockHandleError });

    const { result } = renderHook(() => useStorageErrorManager());

    const error = new Error("Test error");

    // Test various action formats
    result.current.handleStorageError(error, "fetch draft records");
    expect(mockHandleError).toHaveBeenLastCalledWith(
      expect.any(Error),
      "storage_fetch_draft_records",
    );

    result.current.handleStorageError(error, "update column feed preference");
    expect(mockHandleError).toHaveBeenLastCalledWith(
      expect.any(Error),
      "storage_update_column_feed_preference",
    );

    result.current.handleStorageError(error, "clear all bookmarks");
    expect(mockHandleError).toHaveBeenLastCalledWith(
      expect.any(Error),
      "storage_clear_all_bookmarks",
    );
  });

  it("should configure error handler with alerts enabled", async () => {
    const mockUseErrorHandler = vi.mocked(
      (await import("../../hooks/useErrorHandler")).useErrorHandler,
    );

    renderHook(() => useStorageErrorManager());

    expect(mockUseErrorHandler).toHaveBeenCalledWith({
      silent: false,
    });
  });

  it("should preserve error properties when wrapping", async () => {
    const mockHandleError = vi.fn();
    const mockUseErrorHandler = vi.mocked(
      (await import("../../hooks/useErrorHandler")).useErrorHandler,
    );
    mockUseErrorHandler.mockReturnValue({ handleError: mockHandleError });

    const { result } = renderHook(() => useStorageErrorManager());

    const originalError = new Error("Network timeout");
    originalError.stack = "Error: Network timeout\n  at fetch";
    (originalError as any).code = "ETIMEDOUT";
    (originalError as any).status = 504;

    result.current.handleStorageError(originalError, "fetch records");

    const calledError = mockHandleError.mock.calls[0][0];
    expect(calledError.message).toBe(
      "Storage operation failed: fetch records. Network timeout",
    );
    expect(calledError.stack).toBe(originalError.stack);
    expect(calledError.cause).toBe(originalError);
  });
});
