import React, {ReactNode, useMemo} from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {MailboxIcon} from './icons';
import { useTheme } from "../contexts/ThemeContext";
import {fontSize} from '../utils/typography';

interface EmptyStateProps {
  message: string;
  description?: string;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({message, description, icon, actionLabel, onAction}: EmptyStateProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={`Empty state. ${message}${description ? `. ${description}` : ''}`}>
      <View style={styles.iconWrapper}>
        {icon || <MailboxIcon size={64} color={colors.textSecondary} />}
      </View>
      <Text style={styles.message}>{message}</Text>
      {description && (
        <Text style={styles.description}>{description}</Text>
      )}
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.actionButton} onPress={onAction} activeOpacity={0.7}>
          <Text style={styles.actionLabel}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      backgroundColor: colors.background,
    },
    iconWrapper: {
      marginBottom: 20,
      opacity: 0.6,
    },
    message: {
      color: colors.textSecondary,
      fontSize: fontSize.callout,
      textAlign: 'center',
      fontWeight: '500',
      lineHeight: 24,
    },
    description: {
      color: colors.textTertiary,
      fontSize: fontSize.subheadline,
      textAlign: 'center',
      lineHeight: 20,
      marginTop: 8,
      paddingHorizontal: 20,
    },
    actionButton: {
      marginTop: 20,
      paddingVertical: 10,
      paddingHorizontal: 24,
      backgroundColor: colors.primary,
      borderRadius: 20,
    },
    actionLabel: {
      color: '#ffffff',
      fontSize: fontSize.subheadline,
      fontWeight: '600',
    },
  });
}
