import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeftIcon } from "./icons";
import { useTheme } from "../contexts/ThemeContext";

/**
 * A reusable back button for screen headers.
 * Uses router.back() to navigate to the previous screen,
 * with a fallback to the home tab if there's no history.
 */
export function HeaderBackButton() {
  const router = useRouter();
  const { colors } = useTheme();

  const handlePress = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      // Fallback: navigate to home tab if there's no history
      // (e.g., deep link directly to this screen)
      router.replace("/(app)/(tabs)/(home)");
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={styles.button}
      accessibilityLabel="Go back"
      accessibilityRole="button"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <ChevronLeftIcon size={28} color={colors.text} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingLeft: 8,
    paddingRight: 8,
  },
});
