/**
 * KeyboardAwareContainer — wraps content that needs to stay above the keyboard.
 *
 * Unlike KeyboardAvoidingView (which shifts the whole view up, often pushing
 * content off-screen), this container adds bottom padding equal to the keyboard
 * height. This keeps inputs and typeaheads visible without disrupting layout.
 *
 * Usage:
 *   <KeyboardAwareContainer>
 *     <TextInput ... />
 *     <TypeaheadSuggestions ... />
 *   </KeyboardAwareContainer>
 */

import React from "react";
import { Platform, StyleSheet, View, ViewStyle } from "react-native";
import { useKeyboardHeight } from "../hooks/useKeyboardHeight";

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Extra offset (e.g. for tab bar height) */
  extraOffset?: number;
}

export function KeyboardAwareContainer({ children, style, extraOffset = 0 }: Props) {
  const keyboardHeight = useKeyboardHeight();

  // On iOS, the keyboard height includes the safe area bottom inset,
  // so we subtract the tab bar / extra offset to avoid double-padding
  const bottomPadding = Platform.OS === "ios"
    ? Math.max(0, keyboardHeight - extraOffset)
    : keyboardHeight;

  return (
    <View style={[styles.container, style, { paddingBottom: bottomPadding }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
