import React, { useMemo } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from "../contexts/ThemeContext";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  textStyle,
  accessibilityLabel,
  accessibilityHint,
}: ButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableOpacity
      style={[
        styles.button,
        styles[variant],
        styles[`${size}Button`],
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{disabled: isDisabled, busy: loading}}>
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? colors.text : colors.primary}
          size="small"
        />
      ) : (
        <Text
          style={[
            styles.text,
            styles[`${variant}Text`],
            styles[`${size}Text`],
            textStyle,
          ]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    button: {
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      // iOS-style shadow for depth
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 3,
    },
    // Variants
    primary: {
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOpacity: 0.3,
    },
    secondary: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.borderLight,
      shadowOpacity: 0.1,
    },
    danger: {
      backgroundColor: colors.danger,
      shadowColor: colors.danger,
      shadowOpacity: 0.3,
    },
    ghost: {
      backgroundColor: 'transparent',
      shadowOpacity: 0,
      elevation: 0,
    },
    // Sizes
    smallButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      minHeight: 32,
    },
    mediumButton: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      minHeight: 44,
    },
    largeButton: {
      paddingHorizontal: 24,
      paddingVertical: 14,
      minHeight: 52,
    },
    // Text
    text: {
      fontWeight: '600',
    },
    primaryText: {
      color: colors.text,
    },
    secondaryText: {
      color: colors.text,
    },
    dangerText: {
      color: colors.text,
    },
    ghostText: {
      color: colors.primary,
    },
    smallText: {
      fontSize: 13,
    },
    mediumText: {
      fontSize: 15,
    },
    largeText: {
      fontSize: 17,
    },
    // States
    disabled: {
      opacity: 0.5,
    },
  });
}
