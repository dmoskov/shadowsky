import React, {useEffect, useState} from 'react';
import {View, Text, ActivityIndicator, StyleSheet, Alert} from 'react-native';
import type {RootStackScreenProps} from '../../types/navigation';
import {useAuth} from '../../contexts/AuthContext';
import * as OAuthService from '../../services/auth/oauth';

type Props = RootStackScreenProps<'OAuthCallback'>;

export function OAuthCallbackScreen({route, navigation}: Props) {
  const {code, state, error, iss} = route.params ?? {};
  const {refreshSession} = useAuth();
  const [statusMessage, setStatusMessage] = useState('Completing sign in...');

  useEffect(() => {
    const handleCallback = async () => {
      if (error) {
        // Handle OAuth error
        console.error('OAuth error:', error);
        setStatusMessage('Authentication failed');
        Alert.alert(
          'Authentication Failed',
          `OAuth error: ${error}`,
          [
            {
              text: 'OK',
              onPress: () => navigation.replace('Landing'),
            },
          ],
        );
        return;
      }

      if (!code || !state) {
        // Missing required params
        console.error('Missing OAuth callback parameters');
        setStatusMessage('Invalid callback parameters');
        Alert.alert(
          'Authentication Failed',
          'Missing required OAuth parameters',
          [
            {
              text: 'OK',
              onPress: () => navigation.replace('Landing'),
            },
          ],
        );
        return;
      }

      try {
        setStatusMessage('Exchanging authorization code...');

        // Exchange code for tokens using OAuth service
        await OAuthService.handleOAuthCallback({
          code,
          state,
          iss,
        });

        setStatusMessage('Session established, refreshing...');

        // Refresh the auth context to pick up the new session
        await refreshSession();

        // Navigation to Main screen happens automatically via RootNavigator
        // when isAuthenticated becomes true
      } catch (err) {
        console.error('OAuth callback handling failed:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setStatusMessage('Authentication failed');

        Alert.alert(
          'Authentication Failed',
          errorMessage,
          [
            {
              text: 'OK',
              onPress: () => navigation.replace('Landing'),
            },
          ],
        );
      }
    };

    handleCallback();
  }, [code, state, error, iss, navigation, refreshSession]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#3b82f6" />
      <Text style={styles.text}>{statusMessage}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    marginTop: 16,
    color: '#9ca3af',
    fontSize: 16,
  },
});
