import React, {ReactNode, useMemo} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {MailboxIcon} from './icons';
import { useTheme } from "../contexts/ThemeContext";

interface EmptyStateProps {
  message: string;
  icon?: ReactNode;
}

export function EmptyState({message, icon}: EmptyStateProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={`Empty state. ${message}`}>
      <View style={styles.iconWrapper}>
        {icon || <MailboxIcon size={64} color={colors.textSecondary} />}
      </View>
      <Text style={styles.message}>{message}</Text>
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
      fontSize: 16,
      textAlign: 'center',
      fontWeight: '500',
      lineHeight: 24,
    },
  });
}
