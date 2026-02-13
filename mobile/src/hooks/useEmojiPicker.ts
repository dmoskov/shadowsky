/**
 * useEmojiPicker - State management for emoji picker
 *
 * Manages emoji picker visibility and selection
 */

import { useCallback, useState } from "react";

export function useEmojiPicker() {
  const [isVisible, setIsVisible] = useState(false);

  const open = useCallback(() => {
    setIsVisible(true);
  }, []);

  const close = useCallback(() => {
    setIsVisible(false);
  }, []);

  return {
    // State
    isVisible,

    // Actions
    open,
    close,
  };
}
