import React, {ReactNode} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {MailboxIcon} from './icons';
import {colors} from '../constants/theme';

interface EmptyStateProps {
  message: string;
  icon?: ReactNode;
}

export function EmptyState({message, icon}: EmptyStateProps) {
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

const styles = StyleSheet.create({
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
