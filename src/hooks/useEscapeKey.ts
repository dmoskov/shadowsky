import { useEffect } from "react";

/**
 * Hook to handle Escape key press for closing modals/dialogs
 * @param isActive - Whether the hook should be active
 * @param onEscape - Callback to run when Escape is pressed
 */
export function useEscapeKey(isActive: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onEscape();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, onEscape]);
}
