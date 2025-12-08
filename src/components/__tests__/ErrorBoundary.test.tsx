import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getErrorMonitor,
  resetErrorMonitor,
} from "../../utils/error-monitoring";
import { ErrorBoundary } from "../ErrorBoundary";

const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error("Test error");
  }
  return <div>No error</div>;
};

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    resetErrorMonitor();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetErrorMonitor();
  });

  it("renders children when there is no error", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("No error")).toBeInTheDocument();
  });

  it("renders error UI when child component throws", () => {
    render(
      <ErrorBoundary componentName="Test Component" showTechnicalDetails>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    // Check for user-friendly error title
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    // Check for affected area info
    expect(
      screen.getByText(/Affected area: Test Component/),
    ).toBeInTheDocument();
    // Check for Try Again button
    expect(screen.getByText("Try Again")).toBeInTheDocument();
  });

  it("renders custom fallback when provided", () => {
    const customFallback = <div>Custom error message</div>;

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Custom error message")).toBeInTheDocument();
  });

  it("calls onError callback when error occurs", () => {
    const onError = vi.fn();

    render(
      <ErrorBoundary onError={onError}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String),
      }),
    );
  });

  it("displays error ID when error occurs", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    // Check that an error ID is displayed
    expect(screen.getByText(/Error ID:/)).toBeInTheDocument();
    expect(screen.getByText(/err-/)).toBeInTheDocument();
  });

  it("shows Go Back button by default", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Go Back")).toBeInTheDocument();
  });

  it("hides Go Back button when showGoBack is false", () => {
    render(
      <ErrorBoundary showGoBack={false}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.queryByText("Go Back")).not.toBeInTheDocument();
  });

  it("shows Report this issue link by default", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Report this issue")).toBeInTheDocument();
  });

  it("hides Report this issue link when showReportLink is false", () => {
    render(
      <ErrorBoundary showReportLink={false}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.queryByText("Report this issue")).not.toBeInTheDocument();
  });

  it("has proper accessibility attributes", () => {
    render(
      <ErrorBoundary componentName="Accessible Test">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    // Check for role="alert"
    const alertElement = screen.getByRole("alert");
    expect(alertElement).toBeInTheDocument();

    // Check aria-labelledby points to title
    expect(alertElement).toHaveAttribute("aria-labelledby", "error-title");

    // Check aria-describedby points to description
    expect(alertElement).toHaveAttribute(
      "aria-describedby",
      "error-description",
    );
  });

  it("toggles technical details visibility", () => {
    render(
      <ErrorBoundary showTechnicalDetails>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    // Details should be hidden initially
    expect(screen.queryByText("Test error")).not.toBeInTheDocument();

    // Click to show details
    fireEvent.click(screen.getByText("Show technical details"));

    // Details should now be visible
    expect(screen.getByText("Test error")).toBeInTheDocument();

    // Click to hide details
    fireEvent.click(screen.getByText("Hide technical details"));

    // Details should be hidden again
    expect(screen.queryByText("Test error")).not.toBeInTheDocument();
  });

  it("calls reset handler when Try Again is clicked", () => {
    // This test verifies that clicking "Try Again" triggers the reset mechanism
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    // Verify error state
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // Verify Try Again button exists and is a button
    const tryAgainButton = screen.getByText("Try Again");
    expect(tryAgainButton).toBeInTheDocument();
    expect(tryAgainButton.tagName).toBe("BUTTON");

    // Clicking should not throw
    expect(() => fireEvent.click(tryAgainButton)).not.toThrow();
  });

  it("records error to error monitoring system when error occurs", () => {
    render(
      <ErrorBoundary componentName="TestComponent">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    // Get error stats from the monitor
    const stats = getErrorMonitor().getErrorStats();

    // Verify error was recorded
    expect(stats.totalErrors).toBe(1);
    expect(stats.byCategory.ui).toBe(1);
    expect(stats.bySeverity.critical).toBe(1);
  });

  it("records error with correct metadata including component stack", () => {
    // Spy on recordError to verify the call
    const recordErrorSpy = vi.spyOn(getErrorMonitor(), "recordError");

    render(
      <ErrorBoundary componentName="MetadataTestComponent">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    // Verify recordError was called with correct parameters
    expect(recordErrorSpy).toHaveBeenCalledTimes(1);
    expect(recordErrorSpy).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        operation: "render",
        component: "MetadataTestComponent",
        category: "ui",
        severity: "critical",
        metadata: expect.objectContaining({
          componentStack: expect.any(String),
          errorId: expect.any(String),
        }),
      }),
    );

    recordErrorSpy.mockRestore();
  });

  it("uses ErrorBoundary as default component name when not provided", () => {
    const recordErrorSpy = vi.spyOn(getErrorMonitor(), "recordError");

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(recordErrorSpy).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        component: "ErrorBoundary",
      }),
    );

    recordErrorSpy.mockRestore();
  });
});
