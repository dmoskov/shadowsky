import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../../contexts/ThemeContext";
import {fontSize} from '../../../utils/typography';

export interface SettingRowProps {
  label: string;
  description?: string;
  value?: string;
  onPress?: () => void;
  children?: React.ReactNode;
  labelStyle?: object;
  showChevron?: boolean;
}

export function SettingRow({
  label,
  description,
  value,
  onPress,
  children,
  labelStyle,
  showChevron,
}: SettingRowProps) {
  const { colors: themeColors } = useTheme();
  const styles = createStyles(themeColors);
  const content = (
    <View style={styles.settingRow}>
      <View style={styles.settingLeft}>
        <Text style={[styles.settingLabel, labelStyle]}>{label}</Text>
        {description && (
          <Text style={styles.settingDescription}>{description}</Text>
        )}
      </View>
      <View style={styles.settingRight}>
        {value && <Text style={styles.settingValue}>{value}</Text>}
        {children}
        {showChevron && <Text style={styles.chevron}>›</Text>}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const createStyles = (themeColors: Record<string, string>) =>
  StyleSheet.create({
    settingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: themeColors.border,
      minHeight: 48,
    },
    settingLeft: {
      flex: 1,
      marginRight: 12,
    },
    settingLabel: {
      color: themeColors.text,
      fontSize: fontSize.callout,
      fontWeight: "500",
    },
    settingDescription: {
      color: themeColors.textTertiary,
      fontSize: fontSize.footnote,
      marginTop: 2,
    },
    settingRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexShrink: 0,
    },
    settingValue: {
      color: themeColors.textSecondary,
      fontSize: fontSize.subheadline,
    },
    chevron: {
      color: themeColors.textTertiary,
      fontSize: fontSize.title2,
      fontWeight: "300",
    },
  });
