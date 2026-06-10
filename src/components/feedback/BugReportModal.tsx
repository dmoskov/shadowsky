import { Bug, Camera, Check, CheckCircle, Loader2, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { getErrorMonitor } from "../../utils/error-monitoring";
import { Button } from "../ui/Button";
import { Modal, ModalClose, ModalFooter } from "../ui/Modal";

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

  const contentRef = useRef<HTMLDivElement>(null);

  // Collect diagnostic data when modal opens
  useEffect(() => {
    if (isOpen) {
      collectDiagnosticData();
    }
  }, [isOpen]);

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
      const modalElement = contentRef.current?.closest(".modal-backdrop");
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

  const handleClosed = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClosed}
      size="lg"
      labelledBy="bug-report-title"
      describedBy="bug-report-description"
      className="bg-asph-bg-secondary"
    >
      {(close) =>
        isSubmitted ? (
          <>
            {/* Success State */}
            <div className="flex items-start gap-3 p-6">
              <CheckCircle className="mt-1 h-6 w-6 flex-shrink-0 text-asph-success" />
              <div className="flex-1">
                <h3
                  id="bug-report-title"
                  className="mb-2 text-lg font-semibold text-asph-text-primary"
                >
                  Bug Report Submitted
                </h3>
                <p
                  id="bug-report-description"
                  className="text-asph-text-secondary"
                >
                  Thank you for helping us improve Asphodel! We&apos;ve received
                  your bug report and will investigate the issue.
                </p>
                {referenceId && (
                  <div className="mt-4 rounded-md bg-asph-bg-tertiary p-3">
                    <p className="text-sm text-asph-text-tertiary">
                      Reference ID:
                    </p>
                    <p className="font-mono text-sm font-medium text-asph-text-primary">
                      {referenceId}
                    </p>
                  </div>
                )}
              </div>
              <ModalClose className="touch-target-icon p-1" />
            </div>

            {/* Close Button */}
            <ModalFooter className="bg-asph-bg-tertiary px-6 py-4">
              <Button
                variant="primary"
                className="touch-target-sm"
                onClick={close}
              >
                Close
              </Button>
            </ModalFooter>
          </>
        ) : (
          <>
            {/* Header */}
            <div ref={contentRef} className="flex items-start gap-3 p-6">
              <Bug className="mt-1 h-6 w-6 flex-shrink-0 text-asph-warning" />
              <div className="flex-1">
                <h3
                  id="bug-report-title"
                  className="mb-2 text-lg font-semibold text-asph-text-primary"
                >
                  Report a Bug
                </h3>
                <p
                  id="bug-report-description"
                  className="text-sm text-asph-text-secondary"
                >
                  Help us improve Asphodel by reporting issues you encounter.
                  Diagnostic information will be automatically included to help
                  us investigate.
                </p>
              </div>
              <ModalClose className="touch-target-icon p-1" />
            </div>

            {/* Form */}
            <div className="asph-scrollbar max-h-[60vh] overflow-y-auto border-t border-asph-border-primary p-6">
              <div className="space-y-4">
                {/* Bug Description */}
                <div>
                  <label
                    htmlFor="bug-description"
                    className="mb-2 block text-sm font-medium text-asph-text-primary"
                  >
                    Bug Description <span className="text-asph-error">*</span>
                  </label>
                  <textarea
                    id="bug-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the bug you encountered..."
                    className="focus-border w-full rounded-md border border-asph-border-secondary bg-asph-bg-secondary px-3 py-2 text-sm text-asph-text-primary placeholder-asph-text-tertiary"
                    rows={3}
                    required
                  />
                </div>

                {/* Steps to Reproduce */}
                <div>
                  <label
                    htmlFor="steps-to-reproduce"
                    className="mb-2 block text-sm font-medium text-asph-text-primary"
                  >
                    Steps to Reproduce (optional)
                  </label>
                  <textarea
                    id="steps-to-reproduce"
                    value={stepsToReproduce}
                    onChange={(e) => setStepsToReproduce(e.target.value)}
                    placeholder="1. Go to...&#10;2. Click on...&#10;3. Observe..."
                    className="focus-border w-full rounded-md border border-asph-border-secondary bg-asph-bg-secondary px-3 py-2 text-sm text-asph-text-primary placeholder-asph-text-tertiary"
                    rows={3}
                  />
                </div>

                {/* Expected vs Actual Behavior */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="expected-behavior"
                      className="mb-2 block text-sm font-medium text-asph-text-primary"
                    >
                      Expected Behavior (optional)
                    </label>
                    <textarea
                      id="expected-behavior"
                      value={expectedBehavior}
                      onChange={(e) => setExpectedBehavior(e.target.value)}
                      placeholder="What did you expect to happen?"
                      className="focus-border w-full rounded-md border border-asph-border-secondary bg-asph-bg-secondary px-3 py-2 text-sm text-asph-text-primary placeholder-asph-text-tertiary"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="actual-behavior"
                      className="mb-2 block text-sm font-medium text-asph-text-primary"
                    >
                      Actual Behavior (optional)
                    </label>
                    <textarea
                      id="actual-behavior"
                      value={actualBehavior}
                      onChange={(e) => setActualBehavior(e.target.value)}
                      placeholder="What actually happened?"
                      className="focus-border w-full rounded-md border border-asph-border-secondary bg-asph-bg-secondary px-3 py-2 text-sm text-asph-text-primary placeholder-asph-text-tertiary"
                      rows={2}
                    />
                  </div>
                </div>

                {/* Screenshot Section */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-asph-text-primary">
                    Screenshot (optional)
                  </label>
                  {screenshot ? (
                    <div className="relative">
                      <img
                        src={screenshot}
                        alt="Screenshot preview"
                        className="max-h-40 w-full rounded-md border border-asph-border-secondary object-contain"
                      />
                      <button
                        onClick={removeScreenshot}
                        className="touch-target-icon absolute right-2 top-2 rounded-full bg-asph-error p-1 text-white hover:opacity-90"
                        aria-label="Remove screenshot"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <Button
                      variant="secondary"
                      className="touch-target-sm flex items-center gap-2"
                      onClick={captureScreenshot}
                      disabled={isCapturingScreenshot}
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
                    </Button>
                  )}
                </div>

                {/* Diagnostic Info Toggle */}
                <div className="rounded-md border border-asph-border-primary p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-asph-text-primary">
                        Include Diagnostic Information
                      </h4>
                      <p className="text-xs text-asph-text-tertiary">
                        Browser info, error logs, and performance metrics
                      </p>
                    </div>
                    <button
                      onClick={() => setIncludeDiagnostics(!includeDiagnostics)}
                      className={`touch-target relative h-6 w-11 rounded-full transition-colors ${
                        includeDiagnostics
                          ? "bg-asph-primary"
                          : "bg-asph-bg-active"
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
                    <div className="mt-3 space-y-2 border-t border-asph-border-primary pt-3">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-asph-text-tertiary">
                            Version:
                          </span>{" "}
                          <span className="text-asph-text-primary">
                            {diagnosticData.appVersion}
                          </span>
                        </div>
                        <div>
                          <span className="text-asph-text-tertiary">
                            Screen:
                          </span>{" "}
                          <span className="text-asph-text-primary">
                            {diagnosticData.screenSize}
                          </span>
                        </div>
                        <div>
                          <span className="text-asph-text-tertiary">
                            Platform:
                          </span>{" "}
                          <span className="text-asph-text-primary">
                            {diagnosticData.platform}
                          </span>
                        </div>
                        <div>
                          <span className="text-asph-text-tertiary">
                            Errors (1h):
                          </span>{" "}
                          <span className="text-asph-text-primary">
                            {diagnosticData.errorStats.lastHour}
                          </span>
                        </div>
                      </div>
                      {diagnosticData.recentErrors.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-asph-text-tertiary">
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
              <div className="border-t border-asph-error/30 bg-asph-error/10 p-4">
                <p className="text-sm text-asph-error">{error}</p>
              </div>
            )}

            {/* Actions */}
            <ModalFooter className="bg-asph-bg-tertiary px-6 py-4">
              <Button
                variant="ghost"
                className="touch-target-sm"
                onClick={close}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="touch-target-sm flex items-center gap-2"
                onClick={handleSubmit}
                disabled={!description.trim() || isSubmitting}
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
              </Button>
            </ModalFooter>
          </>
        )
      }
    </Modal>
  );
}
