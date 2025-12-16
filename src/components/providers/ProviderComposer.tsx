import { ComponentType, ReactNode } from "react";

/**
 * Composes multiple context providers into a single component
 * This eliminates "Provider Hell" by flattening deeply nested provider trees
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
 *
 * This is equivalent to:
 * ```tsx
 * <ThemeProvider>
 *   <AuthProvider>
 *     <ToastProvider>
 *       <App />
 *     </ToastProvider>
 *   </AuthProvider>
 * </ThemeProvider>
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
    (acc, Provider) => <Provider>{acc}</Provider>,
    children,
  );
}
