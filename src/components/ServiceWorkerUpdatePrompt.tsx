/**
 * Service Worker Update Prompt Component
 *
 * Displays a non-intrusive notification when a new version of the app is available.
 * Allows users to update immediately or dismiss the prompt.
 */

import { RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useServiceWorker } from "../hooks/useServiceWorker";

export function ServiceWorkerUpdatePrompt() {
  const { hasUpdate, applyUpdate, isSupported } = useServiceWorker();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Reset dismissed state when a new update becomes available
  useEffect(() => {
    if (hasUpdate) {
      setIsDismissed(false);
    }
  }, [hasUpdate]);

  // Don't render if SW not supported, no update, or dismissed
  if (!isSupported || !hasUpdate || isDismissed) {
    return null;
  }

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await applyUpdate();
    } catch {
      setIsUpdating(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  return (
    <div
      className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 transform"
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 rounded-lg border border-blue-500/30 bg-slate-900/95 px-4 py-3 shadow-lg backdrop-blur-sm">
        <div className="flex items-center gap-2 text-sm text-slate-200">
          <RefreshCw
            className={`h-4 w-4 text-blue-400 ${isUpdating ? "animate-spin" : ""}`}
          />
          <span>A new version is available</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleUpdate}
            disabled={isUpdating}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUpdating ? "Updating..." : "Update now"}
          </button>

          <button
            onClick={handleDismiss}
            disabled={isUpdating}
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Dismiss update notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
