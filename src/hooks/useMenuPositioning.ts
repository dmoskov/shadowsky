import { useCallback, useState } from "react";
import { layoutMeasurementService } from "../services/layout-measurement-service";

interface MenuPosition {
  top: number;
  left: number;
}

interface MenuPositioningOptions {
  menuWidth?: number;
  menuHeight?: number;
  padding?: number;
}

/**
 * Hook for calculating and managing menu positioning.
 * Ensures menus stay within viewport bounds and position relative to trigger element.
 */
export function useMenuPositioning({
  menuWidth = 224, // 224px = w-56
  menuHeight = 400, // Approximate max height of menu
  padding = 8,
}: MenuPositioningOptions = {}) {
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);

  const calculatePosition = useCallback(
    (triggerElement: HTMLElement) => {
      layoutMeasurementService.measureElement(
        triggerElement,
        (rect) => {
          const viewportHeight = window.innerHeight;
          const viewportWidth = window.innerWidth;

          // Calculate horizontal position (prefer right-aligned to button)
          let left = rect.right - menuWidth;
          // Ensure menu doesn't overflow left edge
          if (left < padding) {
            left = padding;
          }
          // Ensure menu doesn't overflow right edge
          if (left + menuWidth > viewportWidth - padding) {
            left = viewportWidth - menuWidth - padding;
          }

          // Calculate vertical position (check if there's space below)
          const spaceBelow = viewportHeight - rect.bottom;
          const spaceAbove = rect.top;

          let top;
          if (spaceBelow >= menuHeight || spaceBelow > spaceAbove) {
            // Position below the button
            top = rect.bottom + padding;
          } else {
            // Position above the button
            top = rect.top - menuHeight - padding;
            // Ensure menu doesn't overflow top edge
            if (top < padding) {
              top = padding;
            }
          }

          setMenuPosition({
            top,
            left,
          });
        },
        { priority: "high" },
      );
    },
    [menuWidth, menuHeight, padding],
  );

  const clearPosition = useCallback(() => {
    setMenuPosition(null);
  }, []);

  return {
    menuPosition,
    calculatePosition,
    clearPosition,
  };
}
