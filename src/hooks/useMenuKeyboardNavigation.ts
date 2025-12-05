import { useCallback, useEffect, useRef } from "react";

/**
 * Hook to provide keyboard navigation for dropdown menus
 * Supports:
 * - Arrow Up/Down: Navigate between menu items
 * - Home/End: Jump to first/last item
 * - Enter/Space: Activate focused item
 * - Escape: Close menu
 * - Tab: Close menu (and let focus naturally move)
 * - Type-ahead: Focus item starting with typed character
 */
export interface UseMenuKeyboardNavigationOptions {
  /** Whether the menu is currently open */
  isOpen: boolean;
  /** Callback to close the menu */
  onClose: () => void;
  /** Ref to the menu container element */
  menuRef: React.RefObject<HTMLElement>;
  /** Ref to the trigger button (to return focus when closing) */
  triggerRef?: React.RefObject<HTMLElement>;
  /** Selector for menu items (defaults to 'button:not([disabled]), [role="menuitem"]:not([disabled])') */
  itemSelector?: string;
  /** Whether to enable type-ahead search */
  enableTypeAhead?: boolean;
}

export function useMenuKeyboardNavigation({
  isOpen,
  onClose,
  menuRef,
  triggerRef,
  itemSelector = 'button:not([disabled]), [role="menuitem"]:not([aria-disabled="true"])',
  enableTypeAhead = true,
}: UseMenuKeyboardNavigationOptions) {
  const focusedIndexRef = useRef<number>(-1);
  const typeAheadBufferRef = useRef<string>("");
  const typeAheadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const getMenuItems = useCallback((): HTMLElement[] => {
    if (!menuRef.current) return [];
    const items = menuRef.current.querySelectorAll<HTMLElement>(itemSelector);
    return Array.from(items).filter((item) => {
      // Filter out hidden elements
      return (
        item.offsetParent !== null &&
        !item.hasAttribute("aria-hidden") &&
        getComputedStyle(item).visibility !== "hidden"
      );
    });
  }, [menuRef, itemSelector]);

  const focusItem = useCallback(
    (index: number) => {
      const items = getMenuItems();
      if (items.length === 0) return;

      // Wrap around
      if (index < 0) {
        index = items.length - 1;
      } else if (index >= items.length) {
        index = 0;
      }

      focusedIndexRef.current = index;
      items[index]?.focus();
    },
    [getMenuItems],
  );

  const focusFirstItem = useCallback(() => {
    focusItem(0);
  }, [focusItem]);

  const focusLastItem = useCallback(() => {
    const items = getMenuItems();
    focusItem(items.length - 1);
  }, [getMenuItems, focusItem]);

  const focusNextItem = useCallback(() => {
    focusItem(focusedIndexRef.current + 1);
  }, [focusItem]);

  const focusPreviousItem = useCallback(() => {
    focusItem(focusedIndexRef.current - 1);
  }, [focusItem]);

  const handleTypeAhead = useCallback(
    (char: string) => {
      if (!enableTypeAhead) return;

      // Clear previous timeout
      if (typeAheadTimeoutRef.current) {
        clearTimeout(typeAheadTimeoutRef.current);
      }

      // Add character to buffer
      typeAheadBufferRef.current += char.toLowerCase();

      // Find matching item
      const items = getMenuItems();
      const matchIndex = items.findIndex((item) => {
        const text =
          item.textContent?.trim().toLowerCase() ||
          item.getAttribute("aria-label")?.toLowerCase() ||
          "";
        return text.startsWith(typeAheadBufferRef.current);
      });

      if (matchIndex !== -1) {
        focusItem(matchIndex);
      }

      // Clear buffer after delay
      typeAheadTimeoutRef.current = setTimeout(() => {
        typeAheadBufferRef.current = "";
      }, 500);
    },
    [enableTypeAhead, getMenuItems, focusItem],
  );

  const closeAndReturnFocus = useCallback(() => {
    onClose();
    // Return focus to trigger button after a short delay
    setTimeout(() => {
      triggerRef?.current?.focus();
    }, 0);
  }, [onClose, triggerRef]);

  // Handle keyboard events
  useEffect(() => {
    if (!isOpen) {
      focusedIndexRef.current = -1;
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle events when focus is within the menu
      if (!menuRef.current?.contains(document.activeElement)) {
        // But still handle Escape if menu is open
        if (event.key === "Escape") {
          event.preventDefault();
          closeAndReturnFocus();
        }
        return;
      }

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          focusNextItem();
          break;

        case "ArrowUp":
          event.preventDefault();
          focusPreviousItem();
          break;

        case "Home":
          event.preventDefault();
          focusFirstItem();
          break;

        case "End":
          event.preventDefault();
          focusLastItem();
          break;

        case "Escape":
          event.preventDefault();
          closeAndReturnFocus();
          break;

        case "Tab":
          // Close menu on Tab but don't prevent default (let focus move naturally)
          closeAndReturnFocus();
          break;

        case "Enter":
        case " ":
          // Let the default behavior handle button clicks
          // The focused item should be clicked
          break;

        default:
          // Type-ahead: single printable character
          if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
            handleTypeAhead(event.key);
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    isOpen,
    menuRef,
    closeAndReturnFocus,
    focusNextItem,
    focusPreviousItem,
    focusFirstItem,
    focusLastItem,
    handleTypeAhead,
  ]);

  // Focus first item when menu opens
  useEffect(() => {
    if (isOpen && menuRef.current) {
      // Small delay to ensure menu is rendered
      const timer = setTimeout(() => {
        focusFirstItem();
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [isOpen, focusFirstItem, menuRef]);

  // Cleanup type-ahead timeout
  useEffect(() => {
    return () => {
      if (typeAheadTimeoutRef.current) {
        clearTimeout(typeAheadTimeoutRef.current);
      }
    };
  }, []);

  return {
    focusFirstItem,
    focusLastItem,
    focusNextItem,
    focusPreviousItem,
    focusItem,
    getMenuItems,
  };
}
