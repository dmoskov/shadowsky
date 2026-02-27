import { StyleSheet } from "react-native";

export const createSectionStyles = (themeColors: Record<string, string>) =>
  StyleSheet.create({
    section: {
      marginBottom: 32,
    },
    sectionTitle: {
      color: themeColors.textTertiary,
      fontSize: 12,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      paddingHorizontal: 16,
      paddingVertical: 8,
      marginBottom: 4,
    },
    dangerText: {
      color: themeColors.danger,
    },
    themeSelector: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    themeButton: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: themeColors.surface,
      borderWidth: 1,
      borderColor: themeColors.borderLight,
    },
    themeButtonActive: {
      backgroundColor: themeColors.primary,
      borderColor: themeColors.primary,
    },
    themeButtonText: {
      color: themeColors.textSecondary,
      fontSize: 14,
      fontWeight: "500",
    },
    themeButtonTextActive: {
      color: themeColors.text,
    },
    smallButton: {
      paddingHorizontal: 12,
      paddingVertical: 4,
    },
    smallButtonText: {
      fontSize: 12,
    },
  });
