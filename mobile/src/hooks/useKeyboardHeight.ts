/**
 * useKeyboardHeight — tracks the current keyboard height in real-time.
 *
 * Returns the keyboard height (0 when hidden) so components can adjust
 * their layout to stay visible above the keyboard. Uses `will` events
 * for responsive animation-synced updates on iOS.
 */

import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

export function useKeyboardHeight(): number {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return keyboardHeight;
}
