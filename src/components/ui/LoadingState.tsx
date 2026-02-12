import { Loader } from "lucide-react";
import React, {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useState,
} from "react";
import {
  useDelayedBoolean,
  useMinDuration,
  useTimeout,
} from "../../hooks/useTiming";
import { TIMING } from "../../utils/timing";
import {
  ContentReveal,
  SkeletonTransition,
  SkeletonTransitionList,
  useSkeletonTransition,
} from "./SkeletonTransition";

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

/**
 * Loading tokens - re-exported from centralized timing utilities for backward compatibility.
 * New code should import directly from '../../utils/timing'.
 */
export const LOADING_TOKENS = {
  /** Minimum time to show loading state to prevent flash (ms) */
  MIN_DISPLAY_DURATION: TIMING.MIN_LOADING_DURATION,
  /** Skeleton pulse animation duration (ms) */
  SKELETON_PULSE_DURATION: 2000,
  /** Shimmer animation duration (ms) */
  SHIMMER_DURATION: 2000,
  /** Spinner rotation duration (ms) */
  SPINNER_DURATION: 1000,
  /** Delay before showing loading indicator for quick operations (ms) */
  LOADING_DELAY: TIMING.LOADING_DELAY,
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

interface SuspenseLoadingBoundaryProps {
  /** Children to render (may include lazy-loaded components) */
  children: React.ReactNode;
  /** Custom fallback component */
  fallback?: React.ReactNode;
  /** Component name for error reporting */
  componentName?: string;
  /** Whether to use delayed fallback display to prevent flash */
  delayFallback?: boolean;
  /** Custom delay duration in ms (uses LOADING_TOKENS.LOADING_DELAY by default) */
  delayMs?: number;
  /** Size of the default loading indicator */
  size?: LoadingSize;
  /** Custom error fallback component */
  errorFallback?: React.ReactNode;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
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
 *
 * @deprecated Use useMinDuration from '../../hooks/useTiming' directly.
 * This export is maintained for backward compatibility.
 */
export function useMinLoadingDuration(
  isLoading: boolean,
  minDuration: number = LOADING_TOKENS.MIN_DISPLAY_DURATION,
): boolean {
  return useMinDuration(isLoading, minDuration);
}

// ============================================================================
// Hook: useDelayedLoading
// ============================================================================

/**
 * Hook to delay showing loading state.
 * Prevents flash of loading for quick operations.
 *
 * @deprecated Use useDelayedBoolean from '../../hooks/useTiming' directly.
 * This export is maintained for backward compatibility.
 */
export function useDelayedLoading(
  isLoading: boolean,
  delay: number = LOADING_TOKENS.LOADING_DELAY,
): boolean {
  return useDelayedBoolean(isLoading, delay);
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
      className={`animate-spin text-asph-primary ${className}`}
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
    primary: "border-asph-border-primary border-t-asph-primary",
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

  // Use the shared timing hook for delayed display
  useTimeout(
    () => setShowDelayed(true),
    delay && !showDelayed ? delayDuration : null,
  );

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
            <div className="h-4 w-3/4 rounded bg-asph-bg-tertiary" />
            <div className="h-4 w-full rounded bg-asph-bg-tertiary" />
            <div className="h-4 w-2/3 rounded bg-asph-bg-tertiary" />
          </div>
        );

      case "overlay":
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 rounded-lg bg-asph-bg-secondary p-6 shadow-asph-lg">
              <Spinner size={size} aria-label={ariaLabel} />
              {message && (
                <p
                  className={`text-asph-text-secondary ${TEXT_SIZES[size]} animate-pulse`}
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
                className={`text-asph-text-secondary ${TEXT_SIZES[size]} animate-pulse`}
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
          } bg-asph-bg-primary/60 transition-opacity duration-200 ${className}`}
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="bg-asph-bg-secondary/90 flex flex-col items-center gap-3 rounded-lg p-4 shadow-asph-md">
            <Spinner size="lg" />
            {message && (
              <p className="text-sm text-asph-text-secondary">{message}</p>
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
// Delayed Fallback Component (internal)
// ============================================================================

/**
 * Internal component that delays rendering of fallback content.
 * This prevents a flash of loading state for quick operations.
 */
const DelayedFallback: React.FC<{
  children: React.ReactNode;
  delayMs: number;
}> = ({ children, delayMs }) => {
  const [showFallback, setShowFallback] = useState(delayMs === 0);

  // Use the shared timing hook for delayed display
  useTimeout(
    () => setShowFallback(true),
    delayMs > 0 && !showFallback ? delayMs : null,
  );

  if (!showFallback) {
    return null;
  }

  return <>{children}</>;
};

// ============================================================================
// Suspense Loading Boundary Component
// ============================================================================

/**
 * A Suspense-integrated loading boundary that enforces consistent loading behavior
 * across the app using the standardized LOADING_TOKENS timing system.
 *
 * Features:
 * - Wraps React Suspense for lazy-loaded components
 * - Configurable delayed fallback display (prevents flash for quick loads)
 * - Consistent timing using LOADING_TOKENS
 * - Optional error handling integration
 * - Proper accessibility attributes
 *
 * @example
 * // Basic usage with default skeleton
 * <SuspenseLoadingBoundary componentName="UserProfile">
 *   <LazyUserProfile userId={userId} />
 * </SuspenseLoadingBoundary>
 *
 * @example
 * // With custom fallback and delay
 * <SuspenseLoadingBoundary
 *   fallback={<ProfileSkeleton />}
 *   delayFallback={true}
 *   delayMs={150}
 *   componentName="Profile"
 * >
 *   <LazyProfile />
 * </SuspenseLoadingBoundary>
 *
 * @example
 * // With error handling
 * <SuspenseLoadingBoundary
 *   componentName="Dashboard"
 *   onError={(error) => analytics.trackError(error)}
 *   errorFallback={<DashboardErrorState />}
 * >
 *   <LazyDashboard />
 * </SuspenseLoadingBoundary>
 */
export const SuspenseLoadingBoundary: React.FC<
  SuspenseLoadingBoundaryProps
> = ({
  children,
  fallback,
  componentName,
  delayFallback = true,
  delayMs = LOADING_TOKENS.LOADING_DELAY,
  size = "md",
  errorFallback,
  onError,
}) => {
  // Create the fallback content
  const fallbackContent = fallback || (
    <LoadingState
      variant="skeleton"
      size={size}
      centered={true}
      aria-label={
        componentName ? `Loading ${componentName}` : "Loading content"
      }
    />
  );

  // Optionally wrap fallback with delay to prevent flash
  const delayedFallbackContent = delayFallback ? (
    <DelayedFallback delayMs={delayMs}>{fallbackContent}</DelayedFallback>
  ) : (
    fallbackContent
  );

  // Wrap with accessibility attributes
  const accessibleFallback = (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={componentName ? `Loading ${componentName}` : "Loading"}
    >
      {delayedFallbackContent}
    </div>
  );

  // If error handling is requested, wrap with error boundary
  if (errorFallback || onError) {
    return (
      <SuspenseErrorBoundary
        fallback={errorFallback}
        onError={onError}
        componentName={componentName}
      >
        <Suspense fallback={accessibleFallback}>{children}</Suspense>
      </SuspenseErrorBoundary>
    );
  }

  return <Suspense fallback={accessibleFallback}>{children}</Suspense>;
};

// ============================================================================
// Suspense Error Boundary (internal)
// ============================================================================

interface SuspenseErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error) => void;
  componentName?: string;
}

interface SuspenseErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Internal error boundary for use with SuspenseLoadingBoundary.
 * Provides a consistent error handling experience.
 */
class SuspenseErrorBoundary extends React.Component<
  SuspenseErrorBoundaryProps,
  SuspenseErrorBoundaryState
> {
  constructor(props: SuspenseErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): SuspenseErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.props.onError?.(error);
    console.error(
      `SuspenseLoadingBoundary error${this.props.componentName ? ` in ${this.props.componentName}` : ""}:`,
      error,
      errorInfo,
    );
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div
          className="flex min-h-[100px] items-center justify-center p-4"
          role="alert"
          aria-live="assertive"
        >
          <div className="text-center">
            <p className="text-sm text-asph-text-secondary">
              {this.props.componentName
                ? `Failed to load ${this.props.componentName}`
                : "Failed to load content"}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-2 text-sm text-asph-primary hover:underline"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

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
          <div className="h-6 w-6 rounded-full bg-asph-bg-tertiary" />
          <div className="h-5 w-32 rounded bg-asph-bg-tertiary" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-asph-bg-tertiary" />
          <div className="h-8 w-8 rounded-lg bg-asph-bg-tertiary" />
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Default Export
// ============================================================================

export default LoadingState;

// ============================================================================
// Re-export Skeleton Transition Components
// ============================================================================

export {
  ContentReveal,
  SkeletonTransition,
  SkeletonTransitionList,
  useSkeletonTransition,
};
