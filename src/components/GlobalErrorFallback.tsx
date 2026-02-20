import { AlertCircle, Home, RefreshCw } from "lucide-react";

interface GlobalErrorFallbackProps {
  error?: Error;
  errorId?: string;
}

/**
 * Global error fallback UI shown when an unhandled error crashes the app
 * Provides user-friendly messaging and recovery options
 */
export function GlobalErrorFallback({
  error,
  errorId,
}: GlobalErrorFallbackProps) {
  const handleReload = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    window.location.href = "/";
  };

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center p-8"
      style={{ backgroundColor: "var(--asph-bg-primary)" }}
      role="alert"
      aria-live="assertive"
      aria-labelledby="global-error-title"
      aria-describedby="global-error-description"
    >
      <div className="w-full max-w-md rounded-xl border border-red-200 bg-red-50 p-6 shadow-lg dark:border-red-800 dark:bg-red-900/20">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 rounded-full bg-red-100 p-3 dark:bg-red-950/50">
            <AlertCircle
              className="h-8 w-8 text-red-600 dark:text-red-400"
              aria-hidden="true"
            />
          </div>

          <h1
            id="global-error-title"
            className="mb-2 text-xl font-bold text-red-900 dark:text-red-200"
          >
            Something went wrong
          </h1>

          <p
            id="global-error-description"
            className="mb-6 text-sm text-red-800 dark:text-red-300"
          >
            We encountered an unexpected error. Don't worry - your data is safe.
            Try reloading the page to continue.
          </p>

          {errorId && (
            <p className="mb-6 text-xs text-red-800 opacity-60 dark:text-red-300">
              Error ID: <code className="font-mono">{errorId}</code>
            </p>
          )}

          <div className="flex w-full flex-col gap-2">
            <button
              onClick={handleReload}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
              aria-label="Reload the application"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Reload Application
            </button>

            <button
              onClick={handleGoHome}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 font-medium text-asph-text-secondary transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
              aria-label="Go to home page"
            >
              <Home className="h-4 w-4" aria-hidden="true" />
              Go to Home
            </button>
          </div>

          {error?.message && (
            <details className="mt-6 w-full text-left">
              <summary className="cursor-pointer text-xs text-red-800 opacity-75 hover:opacity-100 dark:text-red-300">
                Technical details
              </summary>
              <div className="mt-2 rounded-lg bg-red-100 p-3 dark:bg-red-950/50">
                <pre className="overflow-auto text-xs text-red-900 dark:text-red-200">
                  {error.message}
                </pre>
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
