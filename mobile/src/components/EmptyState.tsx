import React from 'react';
import {View, Text, StyleSheet} from 'react-native';

interface EmptyStateProps {
  message: string;
  icon?: string;
}

export function EmptyState({message, icon = '📭'}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
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
  icon: {
    fontSize: 64,
    marginBottom: 16,
  },
  message: {
    color: '#9ca3af',
    fontSize: 16,
    textAlign: 'center',
  },
});
