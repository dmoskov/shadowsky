import {
  Activity,
  AlertTriangle,
  Cpu,
  HardDrive,
  Minimize2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PerformanceMonitor } from "../utils/performance-monitor";

// Performance budget thresholds
const BUDGETS = {
  fps: {
    warning: 45,
    critical: 30,
  },
  memory: {
    warning: 70, // percentage of heap limit
    critical: 85,
  },
  longTasks: {
    warning: 3,
    critical: 10,
  },
};

type AlertLevel = "normal" | "warning" | "critical";

interface MetricState {
  value: number;
  level: AlertLevel;
  flash: boolean;
}

interface OverlayState {
  fps: MetricState;
  memory: MetricState;
  longTasks: MetricState;
}

function getAlertLevel(
  value: number,
  thresholds: { warning: number; critical: number },
  inverse = false,
): AlertLevel {
  if (inverse) {
    // For FPS, lower is worse
    if (value <= thresholds.critical) return "critical";
    if (value <= thresholds.warning) return "warning";
    return "normal";
  }
  // For memory/long tasks, higher is worse
  if (value >= thresholds.critical) return "critical";
  if (value >= thresholds.warning) return "warning";
  return "normal";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MetricBadge({
  icon: Icon,
  value,
  unit,
  level,
  flash,
  detail,
}: {
  icon: typeof Activity;
  value: string | number;
  unit?: string;
  level: AlertLevel;
  flash: boolean;
  detail?: string;
}) {
  const levelColors = {
    normal: {
      bg: "rgba(34, 197, 94, 0.1)",
      border: "rgba(34, 197, 94, 0.3)",
      text: "#22c55e",
    },
    warning: {
      bg: "rgba(234, 179, 8, 0.15)",
      border: "rgba(234, 179, 8, 0.4)",
      text: "#eab308",
    },
    critical: {
      bg: "rgba(239, 68, 68, 0.2)",
      border: "rgba(239, 68, 68, 0.5)",
      text: "#ef4444",
    },
  };

  const colors = levelColors[level];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 8px",
        borderRadius: "4px",
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        transition: "all 0.15s ease",
        animation: flash ? "flash 0.3s ease-in-out" : undefined,
      }}
    >
      <Icon size={12} style={{ color: colors.text, flexShrink: 0 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "2px" }}>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: colors.text,
              fontFamily: "monospace",
            }}
          >
            {value}
          </span>
          {unit && (
            <span
              style={{
                fontSize: "9px",
                color: colors.text,
                opacity: 0.8,
              }}
            >
              {unit}
            </span>
          )}
        </div>
        {detail && (
          <span
            style={{
              fontSize: "8px",
              color: colors.text,
              opacity: 0.7,
            }}
          >
            {detail}
          </span>
        )}
      </div>
    </div>
  );
}

export function DevPerformanceOverlay() {
  const [isVisible, setIsVisible] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [state, setState] = useState<OverlayState>({
    fps: { value: 60, level: "normal", flash: false },
    memory: { value: 0, level: "normal", flash: false },
    longTasks: { value: 0, level: "normal", flash: false },
  });
  const [recentViolations, setRecentViolations] = useState<string[]>([]);

  const previousLevels = useRef<{
    fps: AlertLevel;
    memory: AlertLevel;
    longTasks: AlertLevel;
  }>({
    fps: "normal",
    memory: "normal",
    longTasks: "normal",
  });
  const monitor = useRef<PerformanceMonitor | null>(null);
  const rafId = useRef<number | null>(null);

  const updateMetrics = useCallback(() => {
    if (!monitor.current) return;

    const metrics = monitor.current.getMetrics();
    const now = new Date().toLocaleTimeString();

    // Calculate levels
    const fpsLevel = getAlertLevel(metrics.fps, BUDGETS.fps, true);
    const memoryPercent = metrics.memory
      ? (metrics.memory.usedJSHeapSize / metrics.memory.jsHeapSizeLimit) * 100
      : 0;
    const memoryLevel = getAlertLevel(memoryPercent, BUDGETS.memory);
    const longTasksLevel = getAlertLevel(metrics.longTasks, BUDGETS.longTasks);

    // Detect level changes for flash animation
    const fpsFlash =
      fpsLevel !== "normal" && fpsLevel !== previousLevels.current.fps;
    const memoryFlash =
      memoryLevel !== "normal" && memoryLevel !== previousLevels.current.memory;
    const longTasksFlash =
      longTasksLevel !== "normal" &&
      longTasksLevel !== previousLevels.current.longTasks;

    // Log violations (fpsFlash already implies fpsLevel !== "normal")
    const newViolations: string[] = [];
    if (fpsFlash) {
      newViolations.push(
        `[${now}] FPS dropped to ${metrics.fps.toFixed(0)} (${fpsLevel})`,
      );
    }
    if (memoryFlash) {
      newViolations.push(
        `[${now}] Memory at ${memoryPercent.toFixed(1)}% (${memoryLevel})`,
      );
    }
    if (longTasksFlash) {
      newViolations.push(
        `[${now}] ${metrics.longTasks} long tasks (${longTasksLevel})`,
      );
    }

    if (newViolations.length > 0) {
      setRecentViolations((prev) => [...newViolations, ...prev].slice(0, 5));
    }

    // Update state
    setState({
      fps: { value: metrics.fps, level: fpsLevel, flash: fpsFlash },
      memory: { value: memoryPercent, level: memoryLevel, flash: memoryFlash },
      longTasks: {
        value: metrics.longTasks,
        level: longTasksLevel,
        flash: longTasksFlash,
      },
    });

    // Store previous levels
    previousLevels.current = {
      fps: fpsLevel,
      memory: memoryLevel,
      longTasks: longTasksLevel,
    };

    // Clear flash after animation
    if (fpsFlash || memoryFlash || longTasksFlash) {
      setTimeout(() => {
        setState((prev) => ({
          fps: { ...prev.fps, flash: false },
          memory: { ...prev.memory, flash: false },
          longTasks: { ...prev.longTasks, flash: false },
        }));
      }, 300);
    }
  }, []);

  useEffect(() => {
    // Only show in development mode
    if (import.meta.env.PROD) {
      return;
    }

    // Check for URL param or localStorage setting
    const urlParams = new URLSearchParams(window.location.search);
    const showOverlay =
      urlParams.has("perf") ||
      localStorage.getItem("showPerfOverlay") === "true";

    if (!showOverlay) {
      setIsVisible(false);
      return;
    }

    // Initialize monitor
    monitor.current = PerformanceMonitor.getInstance();
    monitor.current.start();

    // Update loop
    const tick = () => {
      updateMetrics();
      rafId.current = requestAnimationFrame(tick);
    };

    // Start with slight delay to get initial readings
    setTimeout(() => {
      rafId.current = requestAnimationFrame(tick);
    }, 100);

    return () => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
      if (monitor.current) {
        monitor.current.stop();
      }
    };
  }, [updateMetrics]);

  // Don't render in production
  if (import.meta.env.PROD) {
    return null;
  }

  if (!isVisible) {
    return null;
  }

  const hasViolation =
    state.fps.level !== "normal" ||
    state.memory.level !== "normal" ||
    state.longTasks.level !== "normal";
  const worstLevel: AlertLevel =
    state.fps.level === "critical" ||
    state.memory.level === "critical" ||
    state.longTasks.level === "critical"
      ? "critical"
      : state.fps.level === "warning" ||
          state.memory.level === "warning" ||
          state.longTasks.level === "warning"
        ? "warning"
        : "normal";

  const metrics = monitor.current?.getMetrics();
  const memoryDetail = metrics?.memory
    ? `${formatBytes(metrics.memory.usedJSHeapSize)} / ${formatBytes(metrics.memory.jsHeapSizeLimit)}`
    : undefined;

  if (isMinimized) {
    return (
      <div
        style={{
          position: "fixed",
          bottom: "80px",
          left: "12px",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: "4px 8px",
          borderRadius: "4px",
          background: hasViolation
            ? worstLevel === "critical"
              ? "rgba(239, 68, 68, 0.9)"
              : "rgba(234, 179, 8, 0.9)"
            : "rgba(0, 0, 0, 0.8)",
          backdropFilter: "blur(4px)",
          cursor: "pointer",
          fontFamily: "monospace",
          fontSize: "11px",
          color: "white",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
        }}
        onClick={() => setIsMinimized(false)}
      >
        <Activity size={12} />
        <span style={{ fontWeight: 600 }}>{state.fps.value.toFixed(0)}</span>
        <span style={{ opacity: 0.7 }}>FPS</span>
        {hasViolation && (
          <AlertTriangle size={12} style={{ marginLeft: "4px" }} />
        )}
      </div>
    );
  }

  return (
    <>
      {/* CSS keyframes for flash animation - respects reduced motion preference */}
      <style>
        {`
          @keyframes flash {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }

          @media (prefers-reduced-motion: reduce) {
            @keyframes flash {
              0%, 100% { opacity: 1; }
            }
          }
        `}
      </style>
      <div
        style={{
          position: "fixed",
          bottom: "80px",
          left: "12px",
          zIndex: 9999,
          background: "rgba(0, 0, 0, 0.85)",
          backdropFilter: "blur(8px)",
          borderRadius: "8px",
          padding: "8px",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
          border: hasViolation
            ? `1px solid ${worstLevel === "critical" ? "rgba(239, 68, 68, 0.5)" : "rgba(234, 179, 8, 0.5)"}`
            : "1px solid rgba(255, 255, 255, 0.1)",
          maxWidth: "280px",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "8px",
            paddingBottom: "6px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Activity size={14} style={{ color: "#22c55e" }} />
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "rgba(255, 255, 255, 0.9)",
                letterSpacing: "0.5px",
              }}
            >
              PERF MONITOR
            </span>
            {hasViolation && (
              <AlertTriangle
                size={12}
                style={{
                  color: worstLevel === "critical" ? "#ef4444" : "#eab308",
                  animation: "flash 1s ease-in-out infinite",
                }}
              />
            )}
          </div>
          <div style={{ display: "flex", gap: "4px" }}>
            <button
              className="touch-target"
              onClick={() => setIsMinimized(true)}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "2px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Minimize2
                size={12}
                style={{ color: "rgba(255, 255, 255, 0.5)" }}
              />
            </button>
            <button
              className="touch-target"
              onClick={() => setIsVisible(false)}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "2px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={12} style={{ color: "rgba(255, 255, 255, 0.5)" }} />
            </button>
          </div>
        </div>

        {/* Metrics */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <MetricBadge
            icon={Activity}
            value={state.fps.value.toFixed(0)}
            unit="fps"
            level={state.fps.level}
            flash={state.fps.flash}
          />
          <MetricBadge
            icon={HardDrive}
            value={state.memory.value.toFixed(1)}
            unit="%"
            level={state.memory.level}
            flash={state.memory.flash}
            detail={memoryDetail}
          />
          <MetricBadge
            icon={Cpu}
            value={state.longTasks.value}
            level={state.longTasks.level}
            flash={state.longTasks.flash}
          />
        </div>

        {/* Recent Violations */}
        {recentViolations.length > 0 && (
          <div
            style={{
              marginTop: "8px",
              paddingTop: "6px",
              borderTop: "1px solid rgba(255, 255, 255, 0.1)",
            }}
          >
            <div
              style={{
                fontSize: "9px",
                color: "rgba(255, 255, 255, 0.5)",
                marginBottom: "4px",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Recent Alerts
            </div>
            <div
              style={{
                maxHeight: "60px",
                overflowY: "auto",
                fontSize: "9px",
                color: "rgba(255, 255, 255, 0.7)",
                fontFamily: "monospace",
              }}
            >
              {recentViolations.map((v, i) => (
                <div
                  key={`violation-${i}-${v.substring(0, 20)}`}
                  style={{ marginBottom: "2px" }}
                >
                  {v}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Budget thresholds hint */}
        <div
          style={{
            marginTop: "8px",
            paddingTop: "6px",
            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
            fontSize: "8px",
            color: "rgba(255, 255, 255, 0.4)",
          }}
        >
          Budgets: FPS &gt;{BUDGETS.fps.warning} | Mem &lt;
          {BUDGETS.memory.warning}% | Tasks &lt;{BUDGETS.longTasks.warning}
        </div>
      </div>
    </>
  );
}
