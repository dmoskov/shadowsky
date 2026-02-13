import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import {colors} from '../constants/theme';

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
  const isDisabled = disabled || loading;

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
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{disabled: isDisabled, busy: loading}}>
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? '#fff' : colors.primary}
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

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  // Variants
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
  },
  danger: {
    backgroundColor: '#ef4444',
  },
  ghost: {
    backgroundColor: 'transparent',
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
    color: '#ffffff',
  },
  secondaryText: {
    color: '#ffffff',
  },
  dangerText: {
    color: '#ffffff',
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
