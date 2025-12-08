import {
  Bug,
  Camera,
  Check,
  CheckCircle,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { getErrorMonitor } from "../../utils/error-monitoring";

type ModalState = "entering" | "open" | "exiting" | "closed";

interface DiagnosticData {
  appVersion: string;
  userAgent: string;
  platform: string;
  screenSize: string;
  colorDepth: number;
  language: string;
  timezone: string;
  timestamp: string;
  url: string;
  errorStats: {
    totalErrors: number;
    lastHour: number;
    byCategory: Record<string, number>;
    mostFrequentType?: string;
  };
  recentErrors: Array<{
    type: string;
    message: string;
    category: string;
    timestamp: number;
  }>;
  performanceMetrics?: {
    memory?: { usedJSHeapSize: number; totalJSHeapSize: number };
    navigation?: { loadTime: number };
  };
}

interface BugReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReportSubmitted?: (referenceId: string) => void;
}

export function BugReportModal({
  isOpen,
  onClose,
  onReportSubmitted,
}: BugReportModalProps) {
  const { session } = useAuth();
  const [modalState, setModalState] = useState<ModalState>("closed");
  const [description, setDescription] = useState("");
  const [stepsToReproduce, setStepsToReproduce] = useState("");
  const [expectedBehavior, setExpectedBehavior] = useState("");
  const [actualBehavior, setActualBehavior] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [referenceId, setReferenceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [diagnosticData, setDiagnosticData] = useState<DiagnosticData | null>(
    null,
  );
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [includeScreenshot, setIncludeScreenshot] = useState(false);

  const containerRef = useFocusTrap<HTMLDivElement>(
    modalState === "entering" || modalState === "open",
  );

  // Collect diagnostic data when modal opens
  useEffect(() => {
    if (isOpen) {
      collectDiagnosticData();
    }
  }, [isOpen]);

  // Handle isOpen prop changes
  useEffect(() => {
    if (isOpen && modalState === "closed") {
      setModalState("entering");
    } else if (
      !isOpen &&
      (modalState === "entering" || modalState === "open")
    ) {
      setModalState("exiting");
    }
  }, [isOpen, modalState]);

  // Transition from entering to open after entrance animation
  const handleEntranceEnd = useCallback(() => {
    if (modalState === "entering") {
      setModalState("open");
    }
  }, [modalState]);

  // Transition from exiting to closed after exit animation
  const handleExitEnd = useCallback(() => {
    if (modalState === "exiting") {
      setModalState("closed");
      onClose();
    }
  }, [modalState, onClose]);

  const handleClose = useCallback(() => {
    setModalState("exiting");
  }, []);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        (modalState === "entering" || modalState === "open")
      ) {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalState, handleClose]);

  const collectDiagnosticData = () => {
    const errorMonitor = getErrorMonitor();
    const errorStats = errorMonitor.getErrorStats();
    const exportedData = errorMonitor.exportData();

    // Get recent errors (last 10)
    const recentErrors = exportedData.errors.slice(-10).map((err) => ({
      type: err.type,
      message: err.message,
      category: err.context.category,
      timestamp: err.timestamp,
    }));

    // Collect performance metrics if available
    let performanceMetrics: DiagnosticData["performanceMetrics"];
    if (typeof performance !== "undefined") {
      const memory = (
        performance as unknown as {
          memory?: { usedJSHeapSize: number; totalJSHeapSize: number };
        }
      ).memory;
      const navigation = performance.getEntriesByType(
        "navigation",
      )[0] as PerformanceNavigationTiming;

      performanceMetrics = {
        memory: memory
          ? {
              usedJSHeapSize: memory.usedJSHeapSize,
              totalJSHeapSize: memory.totalJSHeapSize,
            }
          : undefined,
        navigation: navigation
          ? {
              loadTime: navigation.loadEventEnd - navigation.startTime,
            }
          : undefined,
      };
    }

    setDiagnosticData({
      appVersion: "0.7.0",
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      screenSize: `${window.innerWidth}x${window.innerHeight}`,
      colorDepth: screen.colorDepth,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      errorStats: {
        totalErrors: errorStats.totalErrors,
        lastHour: errorStats.lastHour,
        byCategory: errorStats.byCategory,
        mostFrequentType: errorStats.mostFrequentType,
      },
      recentErrors,
      performanceMetrics,
    });
  };

  const captureScreenshot = async () => {
    setIsCapturingScreenshot(true);
    try {
      // Dynamically import html2canvas to keep bundle size down
      const html2canvas = (await import("html2canvas")).default;

      // Temporarily hide the modal for screenshot
      const modalElement = containerRef.current?.closest(".modal-backdrop");
      if (modalElement) {
        (modalElement as HTMLElement).style.visibility = "hidden";
      }

      // Small delay to ensure modal is hidden
      await new Promise((resolve) => setTimeout(resolve, 100));

      const canvas = await html2canvas(document.body, {
        useCORS: true,
        allowTaint: true,
        logging: false,
        scale: 1,
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight,
      });

      // Restore modal visibility
      if (modalElement) {
        (modalElement as HTMLElement).style.visibility = "visible";
      }

      // Convert to base64
      const dataUrl = canvas.toDataURL("image/png", 0.8);
      setScreenshot(dataUrl);
      setIncludeScreenshot(true);
    } catch (err) {
      console.error("Failed to capture screenshot:", err);
      setError(
        "Failed to capture screenshot. You can still submit the report without it.",
      );
    } finally {
      setIsCapturingScreenshot(false);
    }
  };

  const removeScreenshot = () => {
    setScreenshot(null);
    setIncludeScreenshot(false);
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      setError("Please provide a description of the bug.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const reportPayload = {
        description: description.trim(),
        stepsToReproduce: stepsToReproduce.trim() || undefined,
        expectedBehavior: expectedBehavior.trim() || undefined,
        actualBehavior: actualBehavior.trim() || undefined,
        diagnostics: includeDiagnostics ? diagnosticData : undefined,
        screenshot: includeScreenshot && screenshot ? screenshot : undefined,
        userHandle: session?.handle || "anonymous",
        submittedAt: new Date().toISOString(),
      };

      const response = await fetch("/api/bug-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(reportPayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to submit bug report");
      }

      const result = await response.json();
      setReferenceId(result.referenceId);
      setIsSubmitted(true);

      if (onReportSubmitted) {
        onReportSubmitted(result.referenceId);
      }
    } catch (err) {
      console.error("Failed to submit bug report:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to submit bug report. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setDescription("");
    setStepsToReproduce("");
    setExpectedBehavior("");
    setActualBehavior("");
    setScreenshot(null);
    setIncludeScreenshot(false);
    setIncludeDiagnostics(true);
    setIsSubmitted(false);
    setReferenceId(null);
    setError(null);
    collectDiagnosticData();
  };

  const handleModalClose = () => {
    resetForm();
    handleClose();
  };

  // Don't render if modal is fully closed
  if (modalState === "closed") return null;

  // Determine animation classes based on state
  const isEntering = modalState === "entering";
  const isExiting = modalState === "exiting";

  const backdropAnimationClass = isEntering
    ? "animate-enter-fade"
    : isExiting
      ? "animate-exit-fade"
      : "";

  const contentAnimationClass = isEntering
    ? "animate-enter-scale"
    : isExiting
      ? "animate-exit-scale"
      : "";

  return (
    <div
      className={`modal-backdrop ${backdropAnimationClass}`}
      onClick={handleModalClose}
      onAnimationEnd={isExiting ? handleExitEnd : undefined}
      role="presentation"
      data-state={modalState}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bug-report-title"
        aria-describedby="bug-report-description"
        className={`modal-container modal-auto-height modal-lg bg-white dark:bg-gray-900 ${contentAnimationClass}`}
        onClick={(e) => e.stopPropagation()}
        onAnimationEnd={isEntering ? handleEntranceEnd : undefined}
        data-state={modalState}
      >
        {isSubmitted ? (
          <>
            {/* Success State */}
            <div className="flex items-start gap-3 p-6">
              <CheckCircle className="mt-1 h-6 w-6 flex-shrink-0 text-green-600 dark:text-green-400" />
              <div className="flex-1">
                <h3
                  id="bug-report-title"
                  className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100"
                >
                  Bug Report Submitted
                </h3>
                <p
                  id="bug-report-description"
                  className="text-gray-600 dark:text-gray-300"
                >
                  Thank you for helping us improve ShadowSky! We&apos;ve
                  received your bug report and will investigate the issue.
                </p>
                {referenceId && (
                  <div className="mt-4 rounded-md bg-gray-100 p-3 dark:bg-gray-800">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Reference ID:
                    </p>
                    <p className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
                      {referenceId}
                    </p>
                  </div>
                )}
              </div>
              <button
                onClick={handleModalClose}
                aria-label="Close dialog"
                className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* Close Button */}
            <div className="flex justify-end gap-3 border-t bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
              <button
                onClick={handleModalClose}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start gap-3 p-6">
              <Bug className="mt-1 h-6 w-6 flex-shrink-0 text-orange-600 dark:text-orange-400" />
              <div className="flex-1">
                <h3
                  id="bug-report-title"
                  className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100"
                >
                  Report a Bug
                </h3>
                <p
                  id="bug-report-description"
                  className="text-sm text-gray-600 dark:text-gray-300"
                >
                  Help us improve ShadowSky by reporting issues you encounter.
                  Diagnostic information will be automatically included to help
                  us investigate.
                </p>
              </div>
              <button
                onClick={handleModalClose}
                aria-label="Close dialog"
                className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* Form */}
            <div className="max-h-[60vh] overflow-y-auto border-t border-gray-200 p-6 dark:border-gray-700">
              <div className="space-y-4">
                {/* Bug Description */}
                <div>
                  <label
                    htmlFor="bug-description"
                    className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100"
                  >
                    Bug Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="bug-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the bug you encountered..."
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                    rows={3}
                    required
                  />
                </div>

                {/* Steps to Reproduce */}
                <div>
                  <label
                    htmlFor="steps-to-reproduce"
                    className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100"
                  >
                    Steps to Reproduce (optional)
                  </label>
                  <textarea
                    id="steps-to-reproduce"
                    value={stepsToReproduce}
                    onChange={(e) => setStepsToReproduce(e.target.value)}
                    placeholder="1. Go to...&#10;2. Click on...&#10;3. Observe..."
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                    rows={3}
                  />
                </div>

                {/* Expected vs Actual Behavior */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="expected-behavior"
                      className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100"
                    >
                      Expected Behavior (optional)
                    </label>
                    <textarea
                      id="expected-behavior"
                      value={expectedBehavior}
                      onChange={(e) => setExpectedBehavior(e.target.value)}
                      placeholder="What did you expect to happen?"
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="actual-behavior"
                      className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100"
                    >
                      Actual Behavior (optional)
                    </label>
                    <textarea
                      id="actual-behavior"
                      value={actualBehavior}
                      onChange={(e) => setActualBehavior(e.target.value)}
                      placeholder="What actually happened?"
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                      rows={2}
                    />
                  </div>
                </div>

                {/* Screenshot Section */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
                    Screenshot (optional)
                  </label>
                  {screenshot ? (
                    <div className="relative">
                      <img
                        src={screenshot}
                        alt="Screenshot preview"
                        className="max-h-40 w-full rounded-md border border-gray-300 object-contain dark:border-gray-600"
                      />
                      <button
                        onClick={removeScreenshot}
                        className="absolute right-2 top-2 rounded-full bg-red-600 p-1 text-white hover:bg-red-700"
                        aria-label="Remove screenshot"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={captureScreenshot}
                      disabled={isCapturingScreenshot}
                      className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      {isCapturingScreenshot ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Capturing...
                        </>
                      ) : (
                        <>
                          <Camera className="h-4 w-4" />
                          Capture Screenshot
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Diagnostic Info Toggle */}
                <div className="rounded-md border border-gray-200 p-4 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Include Diagnostic Information
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Browser info, error logs, and performance metrics
                      </p>
                    </div>
                    <button
                      onClick={() => setIncludeDiagnostics(!includeDiagnostics)}
                      className={`relative h-6 w-11 rounded-full transition-colors ${
                        includeDiagnostics
                          ? "bg-blue-600 dark:bg-blue-500"
                          : "bg-gray-300 dark:bg-gray-600"
                      }`}
                      role="switch"
                      aria-checked={includeDiagnostics}
                    >
                      <span
                        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                          includeDiagnostics ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Diagnostic Preview */}
                  {includeDiagnostics && diagnosticData && (
                    <div className="mt-3 space-y-2 border-t border-gray-200 pt-3 dark:border-gray-600">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">
                            Version:
                          </span>{" "}
                          <span className="text-gray-900 dark:text-gray-100">
                            {diagnosticData.appVersion}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">
                            Screen:
                          </span>{" "}
                          <span className="text-gray-900 dark:text-gray-100">
                            {diagnosticData.screenSize}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">
                            Platform:
                          </span>{" "}
                          <span className="text-gray-900 dark:text-gray-100">
                            {diagnosticData.platform}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">
                            Errors (1h):
                          </span>{" "}
                          <span className="text-gray-900 dark:text-gray-100">
                            {diagnosticData.errorStats.lastHour}
                          </span>
                        </div>
                      </div>
                      {diagnosticData.recentErrors.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Recent errors: {diagnosticData.recentErrors.length}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="border-t border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-900/20">
                <p className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 border-t bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
              <button
                onClick={handleModalClose}
                disabled={isSubmitting}
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!description.trim() || isSubmitting}
                className="flex items-center gap-2 rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50 dark:bg-orange-500 dark:hover:bg-orange-600"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Submit Report
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
