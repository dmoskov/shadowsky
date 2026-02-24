import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import { DrawerActions, useNavigation } from "@react-navigation/native";
import { MenuIcon } from "./icons";
import { useTheme } from "../contexts/ThemeContext";

export function DrawerMenuButton() {
  const navigation = useNavigation();
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      style={styles.button}
      accessibilityLabel="Open menu"
      accessibilityRole="button"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <MenuIcon size={24} color={colors.text} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingLeft: 16,
    paddingRight: 8,
  },
});
