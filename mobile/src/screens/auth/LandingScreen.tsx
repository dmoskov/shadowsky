import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import type {RootStackScreenProps} from '../../types/navigation';

type Props = RootStackScreenProps<'Landing'>;

export function LandingScreen({navigation}: Props) {
  const handleLogin = () => {
    // TODO: Implement OAuth flow
    // For now, navigate to main after mock auth
    navigation.replace('Main', {screen: 'Tabs'});
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>ShadowSky</Text>
        <Text style={styles.subtitle}>
          A powerful Bluesky client with advanced features
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
          <Text style={styles.loginButtonText}>Sign in with Bluesky</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          By signing in, you agree to our Terms of Service and Privacy Policy
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 18,
    color: '#9ca3af',
    textAlign: 'center',
  },
  actions: {
    alignItems: 'center',
  },
  loginButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  disclaimer: {
    color: '#6b7280',
    fontSize: 12,
    textAlign: 'center',
  },
});
