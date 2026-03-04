/**
 * StatusBar Component
 *
 * Unified status indicator that consolidates WebSocket, mutation queue,
 * rate limits, and network status into a single coherent UI.
 *
 * Design principles:
 * - Hidden by default when everything is healthy
 * - Shows a small indicator when there are issues
 * - Expands on click to show detailed status
 * - Uses ARIA live regions for accessibility
 */

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  ChevronUp,
  RefreshCw,
  SignalLow,
  Wifi,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import {
  useStatusBar,
  type HealthLevel,
  type SubsystemStatus,
} from "../contexts/StatusBarContext";

// Get icon for health level
const getHealthIcon = (level: HealthLevel, className: string = "h-4 w-4") => {
  switch (level) {
    case "healthy":
      return <CheckCircle className={`${className} text-green-500`} />;
    case "warning":
      return <AlertTriangle className={`${className} text-yellow-500`} />;
    case "error":
      return <AlertCircle className={`${className} text-red-500`} />;
    case "critical":
      return (
        <AlertCircle className={`${className} animate-pulse text-red-600`} />
      );
  }
};

// Get background color for health level
const getHealthColor = (level: HealthLevel): string => {
  switch (level) {
    case "healthy":
      return "bg-green-500";
    case "warning":
      return "bg-yellow-500";
    case "error":
      return "bg-red-500";
    case "critical":
      return "bg-red-600";
  }
};

// Get icon for subsystem
const getSubsystemIcon = (name: string, level: HealthLevel) => {
  const color =
    level === "healthy"
      ? "text-green-500"
      : level === "warning"
        ? "text-yellow-500"
        : "text-red-500";

  switch (name) {
    case "WebSocket":
      return level === "healthy" ? (
        <Activity className={`h-4 w-4 ${color}`} />
      ) : (
        <Activity className={`h-4 w-4 ${color} animate-pulse`} />
      );
    case "Sync Queue":
      return <RefreshCw className={`h-4 w-4 ${color}`} />;
    case "Rate Limits":
      return <Zap className={`h-4 w-4 ${color}`} />;
    case "Network":
      return level === "healthy" ? (
        <Wifi className={`h-4 w-4 ${color}`} />
      ) : (
        <WifiOff className={`h-4 w-4 ${color}`} />
      );
    default:
      return getHealthIcon(level);
  }
};

// Degraded connection indicator component
const DegradedIndicator: React.FC<{
  isVisible: boolean;
  reason?: string;
}> = ({ isVisible, reason }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!isVisible) return null;

  return (
    <div
      className="fixed bottom-20 left-4 z-50 lg:bottom-4"
      role="status"
      aria-live="polite"
    >
      <div
        className="relative flex items-center gap-2 rounded-full px-3 py-2 shadow-lg transition-all duration-300 ease-out"
        style={{
          background: "var(--asph-bg-secondary)",
          border: "1px solid var(--asph-border)",
          animation: "degraded-fade-in 0.3s ease-out",
        }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        tabIndex={0}
        aria-label="Slow connection - notifications may be delayed. Check your network connection."
      >
        {/* Yellow indicator with shape distinction for accessibility */}
        <div className="relative flex h-5 w-5 items-center justify-center">
          <SignalLow className="h-4 w-4 text-yellow-500" aria-hidden="true" />
          <div
            className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-yellow-500"
            aria-hidden="true"
          />
        </div>
        <span
          className="text-xs font-medium"
          style={{ color: "var(--asph-text-secondary)" }}
        >
          Slow
        </span>

        {/* Tooltip */}
        {showTooltip && (
          <div
            className="absolute bottom-full left-0 mb-2 w-56 rounded-lg p-3 shadow-xl"
            style={{
              background: "var(--asph-bg-secondary)",
              border: "1px solid var(--asph-border)",
            }}
            role="tooltip"
          >
            <p
              className="mb-1 text-sm font-medium"
              style={{ color: "var(--asph-text-primary)" }}
            >
              Slow connection
            </p>
            <p
              className="mb-2 text-xs"
              style={{ color: "var(--asph-text-secondary)" }}
            >
              Notifications may be delayed
            </p>
            <p
              className="text-xs"
              style={{ color: "var(--asph-text-tertiary)" }}
            >
              💡 Check your network connection
            </p>
            {reason && (
              <p
                className="mt-2 border-t pt-2 text-xs"
                style={{
                  color: "var(--asph-text-tertiary)",
                  borderColor: "var(--asph-border)",
                }}
              >
                {reason}
              </p>
            )}
            {/* Tooltip arrow */}
            <div
              className="absolute -bottom-1.5 left-4 h-3 w-3 rotate-45"
              style={{
                background: "var(--asph-bg-secondary)",
                border: "1px solid var(--asph-border)",
                borderTop: "none",
                borderLeft: "none",
              }}
            />
          </div>
        )}
      </div>

      {/* Screen reader only text with full context */}
      <span className="sr-only">
        Connection quality degraded. Notifications may be delayed. Check your
        network connection.
        {reason && ` Technical details: ${reason}`}
      </span>
    </div>
  );
};

// Subsystem row component
const SubsystemRow: React.FC<{ subsystem: SubsystemStatus }> = ({
  subsystem,
}) => {
  return (
    <div
      className="flex items-center justify-between py-2"
      style={{ borderBottom: "1px solid var(--asph-border)" }}
    >
      <div className="flex items-center gap-2">
        {getSubsystemIcon(subsystem.name, subsystem.level)}
        <span
          className="text-sm font-medium"
          style={{ color: "var(--asph-text-primary)" }}
        >
          {subsystem.name}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className="text-xs"
          style={{ color: "var(--asph-text-secondary)" }}
        >
          {subsystem.message}
        </span>
        {subsystem.action && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              subsystem.action?.handler();
            }}
            className="touch-target-sm rounded px-2 py-0.5 text-xs font-medium transition-colors hover:opacity-80"
            style={{
              background: "var(--asph-primary)",
              color: "white",
            }}
          >
            {subsystem.action.label}
          </button>
        )}
      </div>
    </div>
  );
};

export const StatusBar: React.FC = () => {
  const { status, isExpanded, setIsExpanded, refresh } = useStatusBar();
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Show the status bar when there are issues
  useEffect(() => {
    if (status.hasIssues) {
      setIsVisible(true);
    } else {
      // Keep visible for a moment before hiding
      const timer = setTimeout(() => {
        if (!isExpanded && !isHovered) {
          setIsVisible(false);
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [status.hasIssues, isExpanded, isHovered]);

  // Close expanded view when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isExpanded, setIsExpanded]);

  // Extract degraded state from status
  const { isDegradedSustained, degradedReason } = status;

  // Don't render if no issues and not visible (but still render degraded indicator if needed)
  if (!isVisible && !status.hasIssues && !isDegradedSustained) {
    return null;
  }

  const { overallHealth, subsystems, issueCount } = status;

  // If only showing degraded indicator (no other issues)
  if (!isVisible && !status.hasIssues && isDegradedSustained) {
    return <DegradedIndicator isVisible={true} reason={degradedReason} />;
  }

  return (
    <>
      {/* Degraded connection indicator (separate from main status bar) */}
      <DegradedIndicator
        isVisible={isDegradedSustained}
        reason={degradedReason}
      />

      {/* ARIA live region for screen readers */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {status.hasIssues
          ? `System status: ${issueCount} issue${issueCount > 1 ? "s" : ""} detected. ${
              subsystems.network.level !== "healthy"
                ? subsystems.network.message + ". "
                : ""
            }${
              subsystems.websocket.level !== "healthy"
                ? "WebSocket: " + subsystems.websocket.message + ". "
                : ""
            }${
              subsystems.mutationQueue.level !== "healthy"
                ? "Sync queue: " + subsystems.mutationQueue.message + ". "
                : ""
            }${
              subsystems.rateLimit.level !== "healthy"
                ? "Rate limits: " + subsystems.rateLimit.message + "."
                : ""
            }`
          : "System status: All systems operational."}
      </div>

      <div
        ref={containerRef}
        className="fixed bottom-20 right-4 z-50 lg:bottom-4"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Collapsed view - small indicator */}
        {!isExpanded && (
          <button
            onClick={() => setIsExpanded(true)}
            className="touch-target-sm flex items-center gap-2 rounded-full px-3 py-2 shadow-lg transition-all duration-200 hover:scale-105"
            style={{
              background: "var(--asph-bg-secondary)",
              border: "1px solid var(--asph-border)",
            }}
            aria-label={`System status: ${issueCount} issue${issueCount > 1 ? "s" : ""}. Click to expand.`}
            aria-expanded={false}
          >
            <div
              className={`h-2 w-2 rounded-full ${getHealthColor(overallHealth)}`}
            />
            {issueCount > 0 && (
              <span
                className="text-xs font-medium"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                {issueCount}
              </span>
            )}
            <ChevronUp
              className="h-3 w-3"
              style={{ color: "var(--asph-text-tertiary)" }}
            />
          </button>
        )}

        {/* Expanded view - detailed status */}
        {isExpanded && (
          <div
            className="w-72 rounded-lg shadow-xl transition-all duration-200"
            style={{
              background: "var(--asph-bg-secondary)",
              border: "1px solid var(--asph-border)",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between p-3"
              style={{ borderBottom: "1px solid var(--asph-border)" }}
            >
              <div className="flex items-center gap-2">
                {getHealthIcon(overallHealth)}
                <span
                  className="text-sm font-semibold"
                  style={{ color: "var(--asph-text-primary)" }}
                >
                  System Status
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => refresh()}
                  className="touch-target-icon rounded p-1 transition-colors hover:bg-black/10"
                  aria-label="Refresh status"
                >
                  <RefreshCw
                    className="h-4 w-4"
                    style={{ color: "var(--asph-text-tertiary)" }}
                  />
                </button>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="touch-target-icon rounded p-1 transition-colors hover:bg-black/10"
                  aria-label="Close status panel"
                >
                  <X
                    className="h-4 w-4"
                    style={{ color: "var(--asph-text-tertiary)" }}
                  />
                </button>
              </div>
            </div>

            {/* Subsystems list */}
            <div className="p-3">
              <SubsystemRow subsystem={subsystems.network} />
              <SubsystemRow subsystem={subsystems.websocket} />
              <SubsystemRow subsystem={subsystems.mutationQueue} />
              <SubsystemRow subsystem={subsystems.rateLimit} />
            </div>

            {/* Footer */}
            <div
              className="px-3 py-2 text-center"
              style={{
                borderTop: "1px solid var(--asph-border)",
                color: "var(--asph-text-tertiary)",
              }}
            >
              <span className="text-xs">
                {status.hasIssues
                  ? "Some services are experiencing issues"
                  : "All systems operational"}
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
