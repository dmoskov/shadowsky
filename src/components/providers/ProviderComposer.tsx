import { ComponentType, ReactNode } from "react";
import { InlineErrorBoundary } from "../ui/InlineErrorBoundary";

/**
 * Composes multiple context providers into a single component
 * This eliminates "Provider Hell" by flattening deeply nested provider trees
 *
 * Each provider is wrapped in an InlineErrorBoundary so that if a provider's
 * render throws (e.g. due to a bad initialization), it's caught and logged
 * rather than silently propagating up and producing a confusing stack trace.
 * The boundary renders nothing on failure (silent mode) — the outer app-level
 * ErrorBoundary will still catch the cascade and show the GlobalErrorFallback.
 *
 * Example:
 * ```tsx
 * <ProviderComposer providers={[
 *   ThemeProvider,
 *   AuthProvider,
 *   ToastProvider
 * ]}>
 *   <App />
 * </ProviderComposer>
 * ```
 */
export interface ProviderComposerProps {
  providers: ComponentType<{ children: ReactNode }>[];
  children: ReactNode;
}

export function ProviderComposer({
  providers,
  children,
}: ProviderComposerProps) {
  return providers.reduceRight(
    (acc, Provider) => (
      <InlineErrorBoundary
        componentName={Provider.displayName || Provider.name || "Provider"}
        silent
      >
        <Provider>{acc}</Provider>
      </InlineErrorBoundary>
    ),
    children,
  );
}
