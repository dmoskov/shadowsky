import { Loader } from "lucide-react";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

/**
 * Loading State Design System
 *
 * This module provides a unified loading state system with consistent patterns
 * for displaying loading indicators across the application.
 *
 * Design Tokens:
 * - Skeleton pulse: 2s duration, cubic-bezier(0.4, 0, 0.6, 1) easing
 * - Shimmer: 2s duration, linear, left-to-right
 * - Minimum display duration: 300ms (prevents flash of loading state)
 * - Spinner rotation: 1s linear infinite
 *
 * Variants:
 * - spinner: Rotating spinner icon (default for actions)
 * - skeleton: Pulsing placeholder shapes (default for content)
 * - overlay: Semi-transparent overlay with centered spinner (blocking operations)
 * - inline: Small inline spinner for text contexts
 */

// ============================================================================
// Loading Tokens - Centralized timing configuration
// ============================================================================

export const LOADING_TOKENS = {
  /** Minimum time to show loading state to prevent flash (ms) */
  MIN_DISPLAY_DURATION: 300,
  /** Skeleton pulse animation duration (ms) */
  SKELETON_PULSE_DURATION: 2000,
  /** Shimmer animation duration (ms) */
  SHIMMER_DURATION: 2000,
  /** Spinner rotation duration (ms) */
  SPINNER_DURATION: 1000,
  /** Delay before showing loading indicator for quick operations (ms) */
  LOADING_DELAY: 150,
} as const;

// ============================================================================
// Types
// ============================================================================

export type LoadingVariant = "spinner" | "skeleton" | "overlay" | "inline";
export type LoadingSize = "xs" | "sm" | "md" | "lg" | "xl";

interface LoadingStateProps {
  /** Loading state variant */
  variant?: LoadingVariant;
  /** Size of the loading indicator */
  size?: LoadingSize;
  /** Optional message to display */
  message?: string;
  /** Whether to center the loading indicator in its container */
  centered?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Label for screen readers */
  "aria-label"?: string;
  /** Whether to fill the parent container */
  fullHeight?: boolean;
  /** Show loading only after delay (prevents flash) */
  delay?: boolean;
  /** Custom delay duration in ms */
  delayDuration?: number;
}

interface LoadingOverlayProps {
  /** Whether the overlay is visible */
  isLoading: boolean;
  /** Optional message to display */
  message?: string;
  /** Whether to blur the background */
  blur?: boolean;
  /** Whether the overlay is blocking (disables interaction) */
  blocking?: boolean;
  /** Additional CSS classes for the overlay */
  className?: string;
  /** Children to render behind the overlay */
  children: React.ReactNode;
}

interface LoadingBoundaryProps {
  /** Whether content is loading */
  isLoading: boolean;
  /** Content to show while loading */
  fallback?: React.ReactNode;
  /** Children to render when not loading */
  children: React.ReactNode;
  /** Enforce minimum display duration */
  minDuration?: boolean;
  /** Custom minimum duration in ms */
  minDurationMs?: number;
  /** Delay before showing loading state */
  delay?: boolean;
  /** Custom delay duration in ms */
  delayMs?: number;
}

// ============================================================================
// Size Mappings
// ============================================================================

const SPINNER_SIZES: Record<LoadingSize, number> = {
  xs: 12,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
};

const SPINNER_CLASSES: Record<LoadingSize, string> = {
  xs: "h-3 w-3",
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
  xl: "h-12 w-12",
};

const TEXT_SIZES: Record<LoadingSize, string> = {
  xs: "text-2xs",
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
  xl: "text-lg",
};

// ============================================================================
// Hook: useMinLoadingDuration
// ============================================================================

/**
 * Hook to enforce minimum loading duration.
 * Prevents jarring flash of loading state for quick operations.
 */
export function useMinLoadingDuration(
  isLoading: boolean,
  minDuration: number = LOADING_TOKENS.MIN_DISPLAY_DURATION,
): boolean {
  const [showLoading, setShowLoading] = useState(isLoading);
  const loadingStartRef = useRef<number | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isLoading) {
      // Started loading
      loadingStartRef.current = Date.now();
      setShowLoading(true);
    } else if (loadingStartRef.current !== null) {
      // Finished loading - check if min duration has passed
      const elapsed = Date.now() - loadingStartRef.current;
      const remaining = Math.max(0, minDuration - elapsed);

      if (remaining > 0) {
        timeoutRef.current = setTimeout(() => {
          setShowLoading(false);
          loadingStartRef.current = null;
        }, remaining);
      } else {
        setShowLoading(false);
        loadingStartRef.current = null;
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isLoading, minDuration]);

  return showLoading;
}

// ============================================================================
// Hook: useDelayedLoading
// ============================================================================

/**
 * Hook to delay showing loading state.
 * Prevents flash of loading for quick operations.
 */
export function useDelayedLoading(
  isLoading: boolean,
  delay: number = LOADING_TOKENS.LOADING_DELAY,
): boolean {
  const [showLoading, setShowLoading] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isLoading) {
      timeoutRef.current = setTimeout(() => {
        setShowLoading(true);
      }, delay);
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setShowLoading(false);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isLoading, delay]);

  return showLoading;
}

// ============================================================================
// Context for Loading State
// ============================================================================

interface LoadingContextValue {
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  message: string | null;
  setMessage: (message: string | null) => void;
}

const LoadingContext = createContext<LoadingContextValue | null>(null);

export function useLoadingContext() {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error("useLoadingContext must be used within a LoadingProvider");
  }
  return context;
}

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const setLoading = useCallback((loading: boolean) => {
    setIsLoading(loading);
    if (!loading) {
      setMessage(null);
    }
  }, []);

  return (
    <LoadingContext.Provider
      value={{ isLoading, setLoading, message, setMessage }}
    >
      {children}
    </LoadingContext.Provider>
  );
}

// ============================================================================
// Spinner Component
// ============================================================================

interface SpinnerProps {
  size?: LoadingSize;
  className?: string;
  "aria-label"?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = "md",
  className = "",
  "aria-label": ariaLabel = "Loading",
}) => {
  return (
    <Loader
      size={SPINNER_SIZES[size]}
      className={`animate-spin text-bsky-primary ${className}`}
      aria-label={ariaLabel}
      role="status"
    />
  );
};

// ============================================================================
// Inline Spinner Component
// ============================================================================

interface InlineSpinnerProps {
  size?: LoadingSize;
  className?: string;
}

export const InlineSpinner: React.FC<InlineSpinnerProps> = ({
  size = "sm",
  className = "",
}) => {
  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      role="status"
      aria-label="Loading"
    >
      <Loader
        size={SPINNER_SIZES[size]}
        className="animate-spin text-current"
      />
    </span>
  );
};

// ============================================================================
// Border Spinner Component (CSS-only, no icon dependency)
// ============================================================================

interface BorderSpinnerProps {
  size?: LoadingSize;
  className?: string;
  color?: "primary" | "current" | "white";
}

export const BorderSpinner: React.FC<BorderSpinnerProps> = ({
  size = "md",
  className = "",
  color = "primary",
}) => {
  const colorClasses = {
    primary: "border-bsky-border-primary border-t-bsky-primary",
    current: "border-current/20 border-t-current",
    white: "border-white/30 border-t-white",
  };

  return (
    <div
      className={`${SPINNER_CLASSES[size]} animate-spin rounded-full border-2 ${colorClasses[color]} ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
};

// ============================================================================
// Main LoadingState Component
// ============================================================================

export const LoadingState: React.FC<LoadingStateProps> = ({
  variant = "spinner",
  size = "md",
  message,
  centered = true,
  className = "",
  "aria-label": ariaLabel = "Loading",
  fullHeight = false,
  delay = false,
  delayDuration = LOADING_TOKENS.LOADING_DELAY,
}) => {
  const [showDelayed, setShowDelayed] = useState(!delay);

  useEffect(() => {
    if (delay) {
      const timer = setTimeout(() => {
        setShowDelayed(true);
      }, delayDuration);
      return () => clearTimeout(timer);
    }
  }, [delay, delayDuration]);

  if (!showDelayed) {
    return null;
  }

  const containerClasses = [
    centered && "flex items-center justify-center",
    fullHeight && "min-h-[200px]",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const renderContent = () => {
    switch (variant) {
      case "inline":
        return <InlineSpinner size={size} />;

      case "skeleton":
        return (
          <div className="w-full animate-pulse space-y-3">
            <div className="h-4 w-3/4 rounded bg-bsky-bg-tertiary" />
            <div className="h-4 w-full rounded bg-bsky-bg-tertiary" />
            <div className="h-4 w-2/3 rounded bg-bsky-bg-tertiary" />
          </div>
        );

      case "overlay":
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 rounded-lg bg-bsky-bg-secondary p-6 shadow-bsky-lg">
              <Spinner size={size} aria-label={ariaLabel} />
              {message && (
                <p
                  className={`text-bsky-text-secondary ${TEXT_SIZES[size]} animate-pulse`}
                >
                  {message}
                </p>
              )}
            </div>
          </div>
        );

      case "spinner":
      default:
        return (
          <div className="flex flex-col items-center gap-3">
            <Spinner size={size} aria-label={ariaLabel} />
            {message && (
              <p
                className={`text-bsky-text-secondary ${TEXT_SIZES[size]} animate-pulse`}
              >
                {message}
              </p>
            )}
          </div>
        );
    }
  };

  return (
    <div
      className={containerClasses}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {renderContent()}
    </div>
  );
};

// ============================================================================
// Loading Overlay Component
// ============================================================================

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isLoading,
  message,
  blur = true,
  blocking = true,
  className = "",
  children,
}) => {
  const displayLoading = useMinLoadingDuration(isLoading);

  return (
    <div className="relative">
      {children}
      {displayLoading && (
        <div
          className={`absolute inset-0 z-40 flex items-center justify-center ${
            blur ? "backdrop-blur-sm" : ""
          } ${
            blocking ? "pointer-events-auto" : "pointer-events-none"
          } bg-bsky-bg-primary/60 transition-opacity duration-200 ${className}`}
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="bg-bsky-bg-secondary/90 flex flex-col items-center gap-3 rounded-lg p-4 shadow-bsky-md">
            <Spinner size="lg" />
            {message && (
              <p className="text-sm text-bsky-text-secondary">{message}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Loading Boundary Component
// ============================================================================

export const LoadingBoundary: React.FC<LoadingBoundaryProps> = ({
  isLoading,
  fallback,
  children,
  minDuration = true,
  minDurationMs = LOADING_TOKENS.MIN_DISPLAY_DURATION,
  delay = false,
  delayMs = LOADING_TOKENS.LOADING_DELAY,
}) => {
  // Apply minimum duration if enabled
  let showLoading = useMinLoadingDuration(
    isLoading,
    minDuration ? minDurationMs : 0,
  );

  // Apply delay if enabled
  const delayedLoading = useDelayedLoading(isLoading, delayMs);
  if (delay) {
    showLoading = showLoading && delayedLoading;
  }

  if (showLoading) {
    return (
      <>{fallback || <LoadingState variant="skeleton" centered={false} />}</>
    );
  }

  return <>{children}</>;
};

// ============================================================================
// Column Header Skeleton
// ============================================================================

export const ColumnHeaderSkeleton: React.FC<{ className?: string }> = ({
  className = "",
}) => {
  return (
    <div className={`animate-pulse p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 rounded-full bg-bsky-bg-tertiary" />
          <div className="h-5 w-32 rounded bg-bsky-bg-tertiary" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-bsky-bg-tertiary" />
          <div className="h-8 w-8 rounded-lg bg-bsky-bg-tertiary" />
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Default Export
// ============================================================================

export default LoadingState;
