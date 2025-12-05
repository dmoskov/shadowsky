import {
  ComponentType,
  createElement,
  lazy,
  ReactElement,
  Suspense,
} from "react";
import { ChunkLoadErrorBoundary } from "../components/ui/ChunkLoadErrorBoundary";

/**
 * Wraps React.lazy with automatic retry logic for failed chunk loads.
 * When a chunk fails to load (typically after a deployment), it will:
 * 1. Try to import again (in case it was a temporary network issue)
 * 2. If that fails, reload the page to get the new HTML/JS bundle
 *
 * This prevents the "Failed to fetch dynamically imported module" error
 * that occurs when users have old cached HTML trying to load new chunks.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>,
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    const pageHasAlreadyBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem("page-has-been-force-refreshed") || "false",
    );

    try {
      const component = await componentImport();
      window.sessionStorage.setItem("page-has-been-force-refreshed", "false");
      return component;
    } catch (error) {
      if (!pageHasAlreadyBeenForceRefreshed) {
        // Store flag to prevent infinite reload loop
        window.sessionStorage.setItem("page-has-been-force-refreshed", "true");

        // Unregister all service workers before reloading to clear old caches
        if ("serviceWorker" in navigator) {
          navigator.serviceWorker.getRegistrations().then((registrations) => {
            registrations.forEach((registration) => {
              registration.unregister();
            });
            // Reload after unregistering service workers
            window.location.reload();
          });
        } else {
          // Reload the page to get fresh HTML/JS
          window.location.reload();
        }

        // Return a dummy component (page will reload before this renders)
        return {
          default: (() => null) as unknown as T,
        };
      }

      // If we've already tried reloading, throw the error
      throw error;
    }
  });
}

/**
 * Options for creating a lazy component with error recovery UI
 */
export interface LazyWithErrorRecoveryOptions {
  /** Name to display in error UI */
  componentName?: string;
  /** Custom fallback while loading */
  loadingFallback?: ReactElement | null;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
}

/**
 * Creates a lazy-loaded component wrapped with error recovery UI.
 * This combines lazyWithRetry with ChunkLoadErrorBoundary for a complete solution.
 *
 * @example
 * ```tsx
 * const MyComponent = lazyWithErrorRecovery(
 *   () => import('./MyComponent'),
 *   { componentName: 'My Component' }
 * );
 *
 * // Use in JSX
 * <MyComponent />
 * ```
 */
export function lazyWithErrorRecovery<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>,
  options: LazyWithErrorRecoveryOptions = {},
): React.FC<React.ComponentProps<T>> {
  const LazyComponent = lazyWithRetry(componentImport);
  const { componentName, loadingFallback = null } = options;

  // Create a wrapper component that includes error boundary and suspense
  const WrappedComponent: React.FC<React.ComponentProps<T>> = (props) => {
    return createElement(ChunkLoadErrorBoundary, {
      componentName,
      children: createElement(
        Suspense,
        { fallback: loadingFallback },
        createElement(LazyComponent, props as any),
      ),
    });
  };

  // Set display name for debugging
  WrappedComponent.displayName = `LazyWithErrorRecovery(${componentName || "Component"})`;

  return WrappedComponent;
}

/**
 * Higher-order component that wraps any component with chunk load error recovery.
 * Use this to wrap existing lazy components or any component that might fail to load.
 *
 * @example
 * ```tsx
 * const SafeComponent = withChunkErrorRecovery(
 *   MyLazyComponent,
 *   { componentName: 'My Component' }
 * );
 * ```
 */
export function withChunkErrorRecovery<P extends object>(
  WrappedComponent: ComponentType<P>,
  options: { componentName?: string } = {},
): React.FC<P> {
  const { componentName } = options;

  const WithErrorRecovery: React.FC<P> = (props) => {
    return createElement(ChunkLoadErrorBoundary, {
      componentName,
      children: createElement(WrappedComponent, props),
    });
  };

  WithErrorRecovery.displayName = `WithChunkErrorRecovery(${componentName || WrappedComponent.displayName || "Component"})`;

  return WithErrorRecovery;
}
