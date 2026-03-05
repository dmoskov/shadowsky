import React, { useMemo } from 'react';
import {View, ActivityIndicator, Text, StyleSheet} from 'react-native';
import { useTheme } from "../contexts/ThemeContext";
import {fontSize} from '../utils/typography';

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({message = 'Loading...'}: LoadingStateProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
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
    message: {
      marginTop: 16,
      color: colors.textSecondary,
      fontSize: fontSize.subheadline,
      fontWeight: '500',
    },
  });
}
