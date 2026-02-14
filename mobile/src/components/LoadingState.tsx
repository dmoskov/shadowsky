import React from 'react';
import {View, ActivityIndicator, Text, StyleSheet} from 'react-native';
import {colors} from '../constants/theme';

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({message = 'Loading...'}: LoadingStateProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
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
  message: {
    marginTop: 12,
    color: colors.textSecondary,
    fontSize: 14,
  },
});
