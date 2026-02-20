import {
  Signal,
  SignalHigh,
  SignalLow,
  SignalMedium,
  SignalZero,
} from "lucide-react";
import React from "react";

export type ConnectionQuality =
  | "excellent"
  | "good"
  | "fair"
  | "poor"
  | "unknown";

export interface ConnectionQualityInfo {
  quality: ConnectionQuality;
  label: string;
  color: string;
  description: string;
}

/**
 * Calculate connection quality based on average latency
 * Thresholds:
 * - Excellent: < 100ms
 * - Good: < 500ms
 * - Fair: < 2000ms
 * - Poor: >= 2000ms
 * - Unknown: no data
 */
export function getConnectionQuality(
  latencyMs: number | undefined,
): ConnectionQualityInfo {
  if (latencyMs === undefined || latencyMs <= 0) {
    return {
      quality: "unknown",
      label: "Unknown",
      color: "text-asph-text-tertiary",
      description: "No latency data available",
    };
  }

  if (latencyMs < 100) {
    return {
      quality: "excellent",
      label: "Excellent",
      color: "text-green-500",
      description: `${latencyMs}ms - Excellent connection`,
    };
  }

  if (latencyMs < 500) {
    return {
      quality: "good",
      label: "Good",
      color: "text-green-400",
      description: `${latencyMs}ms - Good connection`,
    };
  }

  if (latencyMs < 2000) {
    return {
      quality: "fair",
      label: "Fair",
      color: "text-yellow-500",
      description: `${latencyMs}ms - Fair connection`,
    };
  }

  return {
    quality: "poor",
    label: "Poor",
    color: "text-red-500",
    description: `${latencyMs}ms - Poor connection`,
  };
}

interface ConnectionQualityBadgeProps {
  latencyMs: number | undefined;
  showLabel?: boolean;
  size?: "sm" | "md";
}

/**
 * Connection Quality Badge - Development Only
 *
 * Displays a WiFi-strength-style indicator based on WebSocket latency.
 * Only visible when debug mode is enabled (localStorage.debug === "true").
 */
export const ConnectionQualityBadge: React.FC<ConnectionQualityBadgeProps> = ({
  latencyMs,
  showLabel = false,
  size = "sm",
}) => {
  const qualityInfo = getConnectionQuality(latencyMs);
  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  const getSignalIcon = () => {
    switch (qualityInfo.quality) {
      case "excellent":
        return <Signal className={`${iconSize} ${qualityInfo.color}`} />;
      case "good":
        return <SignalHigh className={`${iconSize} ${qualityInfo.color}`} />;
      case "fair":
        return <SignalMedium className={`${iconSize} ${qualityInfo.color}`} />;
      case "poor":
        return <SignalLow className={`${iconSize} ${qualityInfo.color}`} />;
      default:
        return <SignalZero className={`${iconSize} ${qualityInfo.color}`} />;
    }
  };

  return (
    <div className="flex items-center gap-1" title={qualityInfo.description}>
      {getSignalIcon()}
      {showLabel && (
        <span className={`text-xs ${qualityInfo.color}`}>
          {qualityInfo.label}
        </span>
      )}
    </div>
  );
};

/**
 * Hook to check if debug mode is enabled
 */
export function useDebugMode(): boolean {
  const [isDebug, setIsDebug] = React.useState(false);

  React.useEffect(() => {
    const checkDebugMode = () => {
      if (typeof window === "undefined") return false;
      return (
        localStorage.getItem("debug") === "true" ||
        window.location.search.includes("debug=true")
      );
    };

    setIsDebug(checkDebugMode());

    // Listen for storage changes (in case debug is toggled in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "debug") {
        setIsDebug(e.newValue === "true");
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  return isDebug;
}
