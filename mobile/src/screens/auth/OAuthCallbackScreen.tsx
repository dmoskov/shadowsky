import React, {useEffect} from 'react';
import {View, Text, ActivityIndicator, StyleSheet} from 'react-native';
import type {RootStackScreenProps} from '../../types/navigation';

type Props = RootStackScreenProps<'OAuthCallback'>;

export function OAuthCallbackScreen({route, navigation}: Props) {
  const {code, state, error} = route.params ?? {};

  useEffect(() => {
    const handleCallback = async () => {
      if (error) {
        // Handle OAuth error
        console.error('OAuth error:', error);
        navigation.replace('Landing');
        return;
      }

      if (code && state) {
        // TODO: Exchange code for tokens
        // For now, simulate successful auth
        await new Promise(resolve => setTimeout(resolve, 1500));
        navigation.replace('Main', {screen: 'Tabs'});
      } else {
        // Missing required params
        navigation.replace('Landing');
      }
    };

    handleCallback();
  }, [code, state, error, navigation]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#3b82f6" />
      <Text style={styles.text}>
        {error ? 'Authentication failed...' : 'Completing sign in...'}
      </Text>
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
