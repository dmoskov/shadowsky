import React, {ReactNode} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {MailboxIcon} from './icons';

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
        {icon || <MailboxIcon size={64} color="#9ca3af" />}
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
    backgroundColor: '#0a0a0f',
  },
  iconWrapper: {
    marginBottom: 16,
  },
  message: {
    color: '#9ca3af',
    fontSize: 16,
    textAlign: 'center',
  },
});
