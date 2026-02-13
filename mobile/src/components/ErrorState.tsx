import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {Button} from './Button';
import {AlertTriangleIcon} from './icons';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({message, onRetry}: ErrorStateProps) {
  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityRole="alert"
      accessibilityLabel={`Error. ${message}`}>
      <AlertTriangleIcon size={48} color="#ef4444" />
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <Button
          title="Try Again"
          onPress={onRetry}
          variant="secondary"
          style={styles.button}
          accessibilityHint="Double tap to retry loading"
        />
      )}
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
  message: {
    color: '#ef4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    marginTop: 16,
  },
  button: {
    minWidth: 120,
  },
});
